import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-ttn-secret',
}

const MQ135_BASELINE_SAMPLES = 10

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

interface Umbrales {
  temp_observacion_c: number
  temp_critica_c: number
  humedad_observacion_pct: number
  humedad_critica_pct: number
  mq135_baseline_defecto: number
  mq135_delta_observacion: number
  mq135_delta_critico: number
  inclinacion_activa: boolean
  inclinacion_deg: number
  score_minimo_alerta: number
}

const DEFAULT_UMBRALES: Umbrales = {
  temp_observacion_c: 35,
  temp_critica_c: 40,
  humedad_observacion_pct: 30,
  humedad_critica_pct: 20,
  mq135_baseline_defecto: 1500,
  mq135_delta_observacion: 400,
  mq135_delta_critico: 900,
  inclinacion_activa: true,
  inclinacion_deg: 45,
  score_minimo_alerta: 25,
}

function umbralesFrom(raw: Record<string, unknown> | null | undefined): Umbrales {
  if (!raw) return DEFAULT_UMBRALES
  const pick = (key: keyof Umbrales) => {
    const value = Number(raw[key])
    return Number.isFinite(value) ? value : (DEFAULT_UMBRALES[key] as number)
  }
  return {
    temp_observacion_c: pick('temp_observacion_c'),
    temp_critica_c: pick('temp_critica_c'),
    humedad_observacion_pct: pick('humedad_observacion_pct'),
    humedad_critica_pct: pick('humedad_critica_pct'),
    mq135_baseline_defecto: pick('mq135_baseline_defecto'),
    mq135_delta_observacion: pick('mq135_delta_observacion'),
    mq135_delta_critico: pick('mq135_delta_critico'),
    inclinacion_activa: raw.inclinacion_activa !== false,
    inclinacion_deg: pick('inclinacion_deg'),
    score_minimo_alerta: pick('score_minimo_alerta'),
  }
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 25) return 'medium'
  return 'low'
}

interface SensorValues {
  temp_dht_c?: number | null
  humidity_pct?: number | null
  mq135_adc?: number | null
  temp_bmp_c?: number | null
  pressure_hpa?: number | null
  pitch_deg?: number | null
  roll_deg?: number | null
}

/** Ventana para contar "2 de 3 uplinks": con envío cada ~60 s, tres uplinks caben en 5 min. */
const PERSISTENCIA_VENTANA_MS = 5 * 60 * 1000
const MQ135_ADC_MAX = 4095

/**
 * El firmware manda 0 cuando un sensor no responde (DHT con NaN, GY-91 sin iniciar, MPU sin lectura)
 * y el ADC del MQ135 se va a 0 o 4095 con el pin suelto o en corto. Esas lecturas no son datos.
 */
function detectarFallas(r: SensorValues): string[] {
  const fallas: string[] = []
  const t = r.temp_dht_c
  const h = r.humidity_pct
  if (t == null || h == null || (t === 0 && h === 0) || t < -40 || t > 80) fallas.push('dht')
  else if (h <= 0 || h > 100) fallas.push('humedad')

  const mq = r.mq135_adc
  if (mq == null || mq <= 0 || mq >= MQ135_ADC_MAX) fallas.push('mq135')

  const tb = r.temp_bmp_c
  const p = r.pressure_hpa
  if (tb == null || p == null || (tb === 0 && p === 0) || p < 300 || p > 1100 || tb < -40 || tb > 85) {
    fallas.push('bmp')
  }

  if (r.pitch_deg == null || r.roll_deg == null || (r.pitch_deg === 0 && r.roll_deg === 0)) fallas.push('mpu')
  return fallas
}

function sinFallas(r: SensorValues, fallas: string[]): SensorValues {
  const dht = fallas.includes('dht')
  return {
    temp_dht_c: dht ? null : r.temp_dht_c,
    humidity_pct: dht || fallas.includes('humedad') ? null : r.humidity_pct,
    mq135_adc: fallas.includes('mq135') ? null : r.mq135_adc,
    pitch_deg: fallas.includes('mpu') ? null : r.pitch_deg,
    roll_deg: fallas.includes('mpu') ? null : r.roll_deg,
  }
}

/** Recibe la lectura ya sin valores de sensores en falla. */
function evaluateRisk(reading: SensorValues, baseline: number, u: Umbrales) {
  let score = 0
  const reasons: string[] = []
  const grupos = new Set<'temperatura' | 'humedad' | 'gas'>()
  const temp = reading.temp_dht_c
  const hum = reading.humidity_pct
  const mq = reading.mq135_adc
  const pitch = reading.pitch_deg
  const roll = reading.roll_deg

  if (temp != null && temp >= u.temp_observacion_c) {
    score += 20
    grupos.add('temperatura')
    reasons.push(`temp_dht_c >= ${u.temp_observacion_c} (${temp})`)
  }
  if (temp != null && temp >= u.temp_critica_c) {
    score += 15
    reasons.push(`temp_dht_c >= ${u.temp_critica_c} (${temp})`)
  }
  if (hum != null && hum <= u.humedad_observacion_pct) {
    score += 20
    grupos.add('humedad')
    reasons.push(`humidity_pct <= ${u.humedad_observacion_pct} (${hum})`)
  }
  if (hum != null && hum <= u.humedad_critica_pct) {
    score += 15
    reasons.push(`humidity_pct <= ${u.humedad_critica_pct} (${hum})`)
  }
  if (mq != null && mq >= baseline + u.mq135_delta_observacion) {
    score += 20
    grupos.add('gas')
    reasons.push(`mq135_adc >= baseline+${u.mq135_delta_observacion} (${mq} vs ${baseline})`)
  }
  if (mq != null && mq >= baseline + u.mq135_delta_critico) {
    score += 25
    reasons.push(`mq135_adc >= baseline+${u.mq135_delta_critico} (${mq} vs ${baseline})`)
  }
  if (
    u.inclinacion_activa &&
    ((pitch != null && Math.abs(pitch) > u.inclinacion_deg) ||
      (roll != null && Math.abs(roll) > u.inclinacion_deg))
  ) {
    score += 10
    reasons.push(`inclinación > ${u.inclinacion_deg}°`)
  }

  score = Math.min(100, score)
  return { score, level: riskLevelFromScore(score), reasons, grupos: [...grupos] }
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmed = value.trim().replace(/(\.\d{3})\d+/, '$1')
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/** Duración estilo Go que manda TTN, por ejemplo "51.456ms" o "1.2s". */
function parseGoDurationSeconds(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const factor: Record<string, number> = {
    ns: 1e-9,
    us: 1e-6,
    µs: 1e-6,
    ms: 1e-3,
    s: 1,
    m: 60,
    h: 3600,
  }
  const re = /([0-9]*\.?[0-9]+)(ns|us|µs|ms|s|m|h)/g
  let total = 0
  let found = false
  for (const match of value.matchAll(re)) {
    found = true
    total += Number(match[1]) * (factor[match[2]] ?? 1)
  }
  return found ? total : null
}

function crcStatus(value: unknown): string | null {
  if (value == null || value === '') return null
  const label = String(value).trim().toUpperCase()
  if (label === 'CRC_BAD' || label === 'CRC_FAIL' || label === 'CRC_ERROR' || label === 'FAIL') {
    return 'CRC_ERROR'
  }
  if (label === 'CRC_OK' || label === 'OK') return 'CRC_OK'
  if (label === 'NO_CRC') return 'NO_CRC'
  return label
}

function formatDataRate(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object') return null
  const dataRate = (settings as { data_rate?: unknown }).data_rate
  if (!dataRate || typeof dataRate !== 'object') return null
  const lora = (dataRate as { lora?: { spreading_factor?: unknown; bandwidth?: unknown } }).lora
  if (lora?.spreading_factor != null && lora.bandwidth != null) {
    const bandwidth = Number(lora.bandwidth)
    const bandwidthLabel = Number.isFinite(bandwidth) ? bandwidth / 1000 : lora.bandwidth
    return `SF${lora.spreading_factor}BW${bandwidthLabel}`
  }
  if ('fsk' in dataRate) return 'FSK'
  return null
}

function nodeSentAt(decoded: Record<string, unknown>): string | null {
  const direct = isoOrNull(decoded.sent_at) ?? isoOrNull(decoded.node_sent_at)
  if (direct) return direct
  const unix = num(decoded.sent_unix)
  if (unix == null) return null
  const ms = unix > 1e12 ? unix : unix * 1000
  if (ms < Date.parse('2020-01-01T00:00:00Z') || ms > Date.parse('2036-01-01T00:00:00Z')) return null
  return new Date(ms).toISOString()
}

function normalizeDeveui(value: unknown): string {
  return String(value ?? '').replace(/[:-]/g, '').trim().toUpperCase()
}

function isBeacon(decoded: Record<string, unknown>): boolean {
  if (decoded.mode === 'beacon') return true
  if (num(decoded.schema_version) === 0) return true
  return false
}

function decodeSensorBytes(bytes: number[]): Record<string, unknown> | null {
  if (bytes.length >= 4 && bytes[0] === 0xbe && bytes[1] === 0xac) {
    return { mode: 'beacon', schema_version: 0, node_id: bytes[2], counter: bytes[3] }
  }
  if (bytes.length < 14) return null
  const i16 = (i: number) => {
    let v = (bytes[i] << 8) | bytes[i + 1]
    if (v & 0x8000) v -= 0x10000
    return v
  }
  const u16 = (i: number) => (bytes[i] << 8) | bytes[i + 1]
  return {
    mode: 'sensors',
    temp_dht_c: i16(0) / 10,
    humidity_pct: u16(2) / 10,
    mq135_adc: u16(4),
    temp_bmp_c: i16(6) / 10,
    pressure_hpa: u16(8) / 10,
    pitch_deg: i16(10) / 10,
    roll_deg: i16(12) / 10,
    schema_version: 1,
    source: 'heltec_v3_gy91',
  }
}

function bytesFromFrmPayload(frm: unknown): number[] | null {
  if (typeof frm !== 'string' || !frm) return null
  try {
    const raw = atob(frm)
    return Array.from(raw, (ch) => ch.charCodeAt(0))
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const secret = Deno.env.get('TTN_WEBHOOK_SECRET')
  const provided =
    req.headers.get('x-ttn-secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (secret && provided !== secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'missing supabase env' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const uplink = body.uplink_message as Record<string, unknown> | undefined
  if (!uplink) {
    return new Response(JSON.stringify({ ok: true, ignored: 'not an uplink' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const ids = (body.end_device_ids ?? {}) as Record<string, unknown>
  const deviceId = String(ids.device_id ?? '').trim()
  const deveui = normalizeDeveui(ids.dev_eui)
  let decoded = (uplink.decoded_payload ?? {}) as Record<string, unknown>
  if (decoded.temp_dht_c == null && decoded.mode !== 'beacon') {
    const fromBytes = decodeSensorBytes(bytesFromFrmPayload(uplink.frm_payload) ?? [])
    if (fromBytes) decoded = { ...fromBytes, ...decoded }
  }
  const fPort = num(uplink.f_port) ?? 2
  const receivedAt = String(body.received_at ?? new Date().toISOString())

  if (isBeacon(decoded)) {
    return new Response(JSON.stringify({ ok: true, ignored: 'beacon' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const rx = Array.isArray(uplink.rx_metadata)
    ? (uplink.rx_metadata[0] as Record<string, unknown> | undefined)
    : undefined
  const gatewayIds = (rx?.gateway_ids ?? {}) as Record<string, unknown>
  const crc = crcStatus(rx?.crc_status ?? uplink.crc_status)
  const frameCounter = num(uplink.f_cnt)
  const airtime = parseGoDurationSeconds(uplink.consumed_airtime)
  const gatewayReceivedAt = isoOrNull(rx?.time) ?? isoOrNull(rx?.received_at)
  const nodeSent = nodeSentAt(decoded)
  const dataRate = formatDataRate(uplink.settings)

  if (!deviceId && !deveui) {
    return new Response(JSON.stringify({ error: 'missing device id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  let nodeQuery = supabase.from('nodos').select('id')
  if (deviceId && deveui) {
    nodeQuery = nodeQuery.or(
      `ttn_device_id.eq.${deviceId},deveui.eq.${deveui},deveui.eq.${deveui.toLowerCase()}`,
    )
  } else if (deviceId) {
    nodeQuery = nodeQuery.eq('ttn_device_id', deviceId)
  } else {
    nodeQuery = nodeQuery.or(`deveui.eq.${deveui},deveui.eq.${deveui.toLowerCase()}`)
  }

  const { data: existing, error: lookupError } = await nodeQuery.limit(1).maybeSingle()
  if (lookupError) {
    return new Response(JSON.stringify({ error: lookupError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let nodeId = existing?.id as string | undefined
  if (!nodeId) {
    nodeId = deviceId || deveui
    const { error: insertNodeError } = await supabase.from('nodos').insert({
      id: nodeId,
      nombre: deviceId || deveui,
      ttn_device_id: deviceId || null,
      deveui: deveui || null,
      estado: 1,
      status: 'active',
      ultima_conexion: receivedAt,
    })
    if (insertNodeError) {
      return new Response(JSON.stringify({ error: insertNodeError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } else {
    await supabase
      .from('nodos')
      .update({
        ultima_conexion: receivedAt,
        ttn_device_id: deviceId || undefined,
        deveui: deveui || undefined,
      })
      .eq('id', nodeId)
  }

  const reading = {
    node_id: nodeId,
    received_at: receivedAt,
    temp_dht_c: num(decoded.temp_dht_c),
    humidity_pct: num(decoded.humidity_pct),
    mq135_adc: num(decoded.mq135_adc) != null ? Math.round(num(decoded.mq135_adc)!) : null,
    temp_bmp_c: num(decoded.temp_bmp_c),
    pressure_hpa: num(decoded.pressure_hpa),
    pitch_deg: num(decoded.pitch_deg),
    roll_deg: num(decoded.roll_deg),
    fallas: [] as string[],
    rssi: num(rx?.rssi) != null ? Math.round(num(rx?.rssi)!) : null,
    snr: num(rx?.snr),
    node_rssi: num(decoded.node_rssi),
    node_snr: num(decoded.node_snr),
    crc_status: crc,
    f_cnt: frameCounter == null ? null : Math.round(frameCounter),
    node_sent_at: nodeSent,
    gateway_received_at: gatewayReceivedAt,
    airtime_s: airtime,
    datarate: dataRate,
    gateway_id: gatewayIds.gateway_id ? String(gatewayIds.gateway_id) : null,
    f_port: fPort,
    schema_version: num(decoded.schema_version) ?? 1,
    raw_payload: {
      decoded_payload: decoded,
      frm_payload: uplink.frm_payload ?? null,
      end_device_ids: ids,
      received_at: receivedAt,
      f_cnt: uplink.f_cnt ?? null,
      consumed_airtime: uplink.consumed_airtime ?? null,
      crc_status: crc,
      rx_metadata: uplink.rx_metadata ?? null,
      settings: uplink.settings ?? null,
    },
  }
  reading.fallas = detectarFallas(reading)

  let { data: inserted, error: insertReadingError } = await supabase
    .from('sensor_readings')
    .insert(reading)
    .select('id')
    .single()

  // Si la migración de bitácora aún no está aplicada, guarda el uplink con las columnas viejas.
  if (
    insertReadingError &&
    /column|schema cache|crc_status|f_cnt|airtime_s|node_rssi|gateway_received|fallas/i.test(insertReadingError.message)
  ) {
    const legacy = {
      node_id: reading.node_id,
      received_at: reading.received_at,
      temp_dht_c: reading.temp_dht_c,
      humidity_pct: reading.humidity_pct,
      mq135_adc: reading.mq135_adc,
      temp_bmp_c: reading.temp_bmp_c,
      pressure_hpa: reading.pressure_hpa,
      pitch_deg: reading.pitch_deg,
      roll_deg: reading.roll_deg,
      rssi: reading.rssi,
      snr: reading.snr,
      gateway_id: reading.gateway_id,
      f_port: reading.f_port,
      schema_version: reading.schema_version,
      raw_payload: reading.raw_payload,
    }
    const retry = await supabase.from('sensor_readings').insert(legacy).select('id').single()
    inserted = retry.data
    insertReadingError = retry.error
  }

  if (insertReadingError) {
    return new Response(JSON.stringify({ error: insertReadingError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: baselineRows } = await supabase
    .from('sensor_readings')
    .select('mq135_adc')
    .eq('node_id', nodeId)
    .gt('mq135_adc', 0)
    .lt('mq135_adc', MQ135_ADC_MAX)
    .order('received_at', { ascending: true })
    .limit(MQ135_BASELINE_SAMPLES)

  const { data: umbralesRow } = await supabase
    .from('umbrales_alerta')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  const umbrales = umbralesFrom(umbralesRow as Record<string, unknown> | null)

  const samples = (baselineRows ?? [])
    .map((row) => Number(row.mq135_adc))
    .filter((n) => Number.isFinite(n))
  const baseline = samples.length
    ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
    : umbrales.mq135_baseline_defecto

  const risk = evaluateRisk(sinFallas(reading, reading.fallas), baseline, umbrales)
  const minimo = umbrales.score_minimo_alerta

  // Dos sensores distintos que coinciden encienden la alerta de inmediato.
  // Si solo uno supera el umbral, se exige que también lo haya hecho otro de los 2 uplinks previos.
  let corroboracion: 'sensores' | 'persistencia' | null = null
  if (risk.score >= minimo) {
    if (risk.grupos.length >= 2) {
      corroboracion = 'sensores'
    } else {
      const desde = new Date(Date.parse(receivedAt) - PERSISTENCIA_VENTANA_MS).toISOString()
      const { data: previas } = await supabase
        .from('sensor_readings')
        .select('temp_dht_c, humidity_pct, mq135_adc, temp_bmp_c, pressure_hpa, pitch_deg, roll_deg')
        .eq('node_id', nodeId)
        .neq('id', inserted!.id)
        .gte('received_at', desde)
        .lt('received_at', receivedAt)
        .order('received_at', { ascending: false })
        .limit(2)
      const persistente = (previas ?? []).some((prev) => {
        const r = prev as SensorValues
        return evaluateRisk(sinFallas(r, detectarFallas(r)), baseline, umbrales).score >= minimo
      })
      if (persistente) corroboracion = 'persistencia'
    }
  }

  if (corroboracion) {
    await supabase.from('risk_events').insert({
      node_id: nodeId,
      level: risk.level,
      score: risk.score,
      reason: {
        reasons: risk.reasons,
        baseline,
        score_minimo_alerta: minimo,
        corroboracion,
        grupos: risk.grupos,
        fallas: reading.fallas,
      },
      reading_id: inserted!.id,
    })
  }

  return new Response(
    JSON.stringify({
      ok: true,
      node_id: nodeId,
      reading_id: inserted!.id,
      fallas: reading.fallas,
      risk,
      alerta: corroboracion,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
