import { supabase } from '@/supabase'
import type { BitacoraRow, CondicionPrueba } from '@/types/database'
import { parseUtcDate } from '@/utils/format'

export class BitacoraSchemaError extends Error {
  constructor() {
    super('Falta aplicar la migración de la bitácora en Supabase.')
    this.name = 'BitacoraSchemaError'
  }
}

function isMissingSchema(error: { code?: string; message?: string }): boolean {
  const message = `${error.code ?? ''} ${error.message ?? ''}`
  return /bitacora_pruebas|condiciones_prueba|PGRST204|PGRST205|42P01|42703|schema cache|does not exist/i.test(message)
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asText(value: unknown): string | null {
  if (value == null) return null
  const text = String(value)
  return text.trim() ? text : null
}

function asBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 't' || value === 1
}

function instante(iso: string | null | undefined): number {
  return parseUtcDate(iso)?.getTime() ?? 0
}

function segundosEntre(desde: string | null, hasta: string | null): number | null {
  const a = parseUtcDate(desde)
  const b = parseUtcDate(hasta)
  if (!a || !b || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return (b.getTime() - a.getTime()) / 1000
}

const PAGINA = 1000
const DIA_MS = 24 * 60 * 60 * 1000

const COLUMNAS_LECTURA = [
  'id',
  'node_id',
  'received_at',
  'rssi',
  'snr',
  'node_rssi',
  'node_snr',
  'crc_status',
  'f_cnt',
  'node_sent_at',
  'gateway_received_at',
  'db_received_at',
  'airtime_s',
  'datarate',
  'temp_dht_c',
  'humidity_pct',
  'mq135_adc',
  'temp_bmp_c',
  'pressure_hpa',
  'pitch_deg',
  'roll_deg',
].join(', ')

const COLUMNAS_CONDICION = [
  'id',
  'n',
  'node_id',
  'distancia_m',
  'obstaculos',
  'altura_m',
  'clima',
  'situacion_real',
  'activa',
  'iniciada_at',
  'cerrada_at',
  'created_at',
].join(', ')

interface NodoLite {
  nombre: string | null
  deveui: string | null
}

interface AlertaLectura {
  reading_id: string | null
  created_at: string
}

interface MuestraFcnt {
  f_cnt: number
  at: number
}

function mapCondicion(raw: Record<string, unknown>): CondicionPrueba {
  return {
    id: String(raw.id),
    n: asNumber(raw.n) ?? 0,
    node_id: String(raw.node_id),
    distancia_m: asNumber(raw.distancia_m),
    obstaculos: asText(raw.obstaculos),
    altura_m: asNumber(raw.altura_m),
    clima: asText(raw.clima),
    situacion_real: asText(raw.situacion_real),
    activa: asBool(raw.activa),
    iniciada_at: String(raw.iniciada_at ?? ''),
    cerrada_at: asText(raw.cerrada_at),
    created_at: String(raw.created_at ?? ''),
  }
}

/** La prueba abierta (o la última que cubre el uplink) para ese nodo. */
function condicionDe(nodeId: string, receivedAt: string, condiciones: CondicionPrueba[]): CondicionPrueba | null {
  const t = instante(receivedAt)
  if (!t) return null
  let best: CondicionPrueba | null = null
  let bestInicio = -Infinity
  for (const condicion of condiciones) {
    if (condicion.node_id !== nodeId) continue
    const inicio = instante(condicion.iniciada_at)
    if (!inicio || t < inicio) continue
    const fin = condicion.cerrada_at ? instante(condicion.cerrada_at) : 0
    if (fin && t >= fin) continue
    if (inicio >= bestInicio) {
      best = condicion
      bestInicio = inicio
    }
  }
  return best
}

function mapLectura(
  raw: Record<string, unknown>,
  nodo: NodoLite | undefined,
  condicion: CondicionPrueba | null,
  disponibilidad: number | null,
): BitacoraRow {
  const receivedAt = String(raw.received_at ?? '')
  const nodeSent = asText(raw.node_sent_at)
  const gateway = asText(raw.gateway_received_at)
  const dbAt = asText(raw.db_received_at)
  const airtime = asNumber(raw.airtime_s)
  return {
    reading_id: String(raw.id),
    node_id: String(raw.node_id),
    nodo_nombre: nodo?.nombre ?? null,
    nodo_mac: nodo?.deveui ?? null,
    n: condicion?.n ?? null,
    distancia_m: condicion?.distancia_m ?? null,
    obstaculos: condicion?.obstaculos ?? null,
    altura_m: condicion?.altura_m ?? null,
    clima: condicion?.clima ?? null,
    rssi: asNumber(raw.rssi),
    snr: asNumber(raw.snr),
    node_rssi: asNumber(raw.node_rssi),
    node_snr: asNumber(raw.node_snr),
    crc_status: asText(raw.crc_status),
    f_cnt: asNumber(raw.f_cnt),
    pdr_pct: null,
    pdr_recibidos: null,
    pdr_esperados: null,
    disponibilidad_pct: disponibilidad,
    node_sent_at: nodeSent,
    gateway_received_at: gateway,
    received_at: receivedAt,
    db_received_at: dbAt,
    airtime_s: airtime,
    tiempo_subida_s: nodeSent && gateway ? segundosEntre(nodeSent, gateway) : airtime,
    retraso_gateway_red_s: gateway ? segundosEntre(gateway, receivedAt) : null,
    retraso_red_bd_s: dbAt ? segundosEntre(receivedAt, dbAt) : null,
    hora_emision_alerta: null,
    temp_dht_c: asNumber(raw.temp_dht_c),
    humidity_pct: asNumber(raw.humidity_pct),
    mq135_adc: asNumber(raw.mq135_adc),
    temp_bmp_c: asNumber(raw.temp_bmp_c),
    pressure_hpa: asNumber(raw.pressure_hpa),
    pitch_deg: asNumber(raw.pitch_deg),
    roll_deg: asNumber(raw.roll_deg),
    situacion_real: condicion?.situacion_real ?? null,
    alerta_emitida: false,
    condicion_id: condicion?.id ?? null,
    datarate: asText(raw.datarate),
  }
}

export async function contarBitacora(nodeId?: string): Promise<number> {
  let query = supabase.from('sensor_readings').select('id', { count: 'exact', head: true })
  if (nodeId) query = query.eq('node_id', nodeId)
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function fetchLecturas(limit: number, nodeId?: string): Promise<Record<string, unknown>[]> {
  const pedido = Math.max(0, Math.floor(limit))
  const rows: Record<string, unknown>[] = []
  for (let desde = 0; rows.length < pedido; desde += PAGINA) {
    const hasta = Math.min(desde + PAGINA, pedido) - 1
    let query = supabase
      .from('sensor_readings')
      .select(COLUMNAS_LECTURA)
      .order('received_at', { ascending: false })
      .range(desde, hasta)
    if (nodeId) query = query.eq('node_id', nodeId)
    const { data, error } = await query
    if (error) {
      if (isMissingSchema(error)) throw new BitacoraSchemaError()
      throw new Error(error.message)
    }
    const lote = (data ?? []) as Record<string, unknown>[]
    rows.push(...lote)
    if (lote.length < hasta - desde + 1) break
  }
  return rows
}

async function fetchNodosLite(): Promise<Map<string, NodoLite>> {
  const { data, error } = await supabase.from('nodos').select('id, nombre, deveui')
  if (error) throw new Error(error.message)
  const nodos = new Map<string, NodoLite>()
  for (const row of data ?? []) {
    const item = row as { id: string; nombre: string | null; deveui: string | null }
    nodos.set(item.id, { nombre: item.nombre, deveui: item.deveui })
  }
  return nodos
}

let condicionesCache: { at: number; rows: CondicionPrueba[] } | null = null
let condicionesFlight: Promise<CondicionPrueba[]> | null = null

function fetchCondicionesCruce(): Promise<CondicionPrueba[]> {
  if (condicionesCache && Date.now() - condicionesCache.at < 4_000) return Promise.resolve(condicionesCache.rows)
  if (!condicionesFlight) {
    condicionesFlight = leerCondiciones().finally(() => {
      condicionesFlight = null
    })
  }
  return condicionesFlight
}

async function leerCondiciones(): Promise<CondicionPrueba[]> {
  const { data, error } = await supabase
    .from('condiciones_prueba')
    .select(COLUMNAS_CONDICION)
    .order('iniciada_at', { ascending: false })
  if (error) {
    if (isMissingSchema(error)) throw new BitacoraSchemaError()
    throw new Error(error.message)
  }
  const rows = (data ?? []).map((row) => mapCondicion(row as Record<string, unknown>))
  condicionesCache = { at: Date.now(), rows }
  return rows
}

/** Un solo porcentaje para todas las filas: pings OK de las últimas 24 h. */
async function fetchDisponibilidad24h(): Promise<number | null> {
  const since = new Date(Date.now() - DIA_MS).toISOString()
  const conteo = () =>
    supabase.from('health_checks').select('id', { count: 'exact', head: true }).gte('checked_at', since)
  const [okRes, totalRes] = await Promise.all([conteo().eq('ok', true), conteo()])
  if (okRes.error || totalRes.error) return null
  const total = totalRes.count ?? 0
  if (!total) return null
  return Math.round((1000 * (okRes.count ?? 0)) / total) / 10
}

async function fetchAlertasDe(lecturas: Record<string, unknown>[]): Promise<AlertaLectura[]> {
  const nodeIds = [...new Set(lecturas.map((row) => String(row.node_id)).filter(Boolean))]
  if (!nodeIds.length) return []
  let min = Infinity
  let max = -Infinity
  for (const row of lecturas) {
    const t = instante(asText(row.received_at))
    if (!t) continue
    if (t < min) min = t
    if (t > max) max = t
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  const desde = new Date(min - 60_000).toISOString()
  const hasta = new Date(max + 5 * 60_000).toISOString()
  const eventos: AlertaLectura[] = []
  for (let from = 0; ; from += PAGINA) {
    const { data, error } = await supabase
      .from('risk_events')
      .select('reading_id, created_at')
      .in('node_id', nodeIds)
      .gte('created_at', desde)
      .lte('created_at', hasta)
      .order('created_at', { ascending: true })
      .range(from, from + PAGINA - 1)
    if (error) throw new Error(error.message)
    const lote = (data ?? []) as AlertaLectura[]
    eventos.push(...lote)
    if (lote.length < PAGINA) break
  }
  return eventos
}

function aplicarAlertas(rows: BitacoraRow[], eventos: AlertaLectura[]): void {
  const porLectura = new Map<string, string>()
  for (const evento of eventos) {
    if (!evento.reading_id || porLectura.has(evento.reading_id)) continue
    porLectura.set(evento.reading_id, evento.created_at)
  }
  for (const row of rows) {
    const hora = porLectura.get(row.reading_id)
    if (!hora) continue
    row.hora_emision_alerta = hora
    row.alerta_emitida = true
  }
}

/**
 * Lecturas recientes, sin la vista bitacora_pruebas.
 * Cada nodo se consulta aparte (índice node_id + received_at), del más nuevo al más viejo.
 * Pruebas, disponibilidad y alertas van en paralelo. El PDR se completa después de pintar.
 */
export async function fetchBitacora(limit = 100, nodeId?: string): Promise<BitacoraRow[]> {
  const pedido = Math.max(0, Math.floor(limit))
  if (!pedido) return []

  const condicionesPromise = fetchCondicionesCruce()
  const disponibilidadPromise = fetchDisponibilidad24h()
  const nodos = await fetchNodosLite()
  const ids = nodeId ? [nodeId] : [...nodos.keys()]
  const partes = ids.length
    ? await Promise.all(ids.map((id) => fetchLecturas(pedido, id)))
    : [await fetchLecturas(pedido)]
  const lecturas = partes.flat()
  if (!lecturas.length) {
    await Promise.all([condicionesPromise, disponibilidadPromise])
    return []
  }

  const [condiciones, disponibilidad, alertas] = await Promise.all([
    condicionesPromise,
    disponibilidadPromise,
    fetchAlertasDe(lecturas),
  ])

  const rows = lecturas.map((raw) => {
    const id = String(raw.node_id)
    const receivedAt = String(raw.received_at ?? '')
    return mapLectura(raw, nodos.get(id), condicionDe(id, receivedAt, condiciones), disponibilidad)
  })
  aplicarAlertas(rows, alertas)
  rows.sort((a, b) => instante(b.received_at) - instante(a.received_at))
  return rows
}

interface VentanaPdr {
  inicio: number
  fin: number | null
}

function ventanaPdr(row: BitacoraRow, condiciones: CondicionPrueba[], hace24h: number): VentanaPdr {
  const condicion = row.condicion_id
    ? condiciones.find((item) => item.id === row.condicion_id) ?? null
    : null
  if (condicion) {
    return {
      inicio: instante(condicion.iniciada_at),
      fin: condicion.cerrada_at ? instante(condicion.cerrada_at) : null,
    }
  }
  return { inicio: hace24h, fin: null }
}

function claveVentana(ventana: VentanaPdr): string {
  return `${ventana.inicio}|${ventana.fin ?? ''}`
}

function estadisticaPdr(muestras: MuestraFcnt[], ventana: VentanaPdr): {
  recibidos: number
  esperados: number
  pct: number | null
} | null {
  const seen = new Set<number>()
  let min = Infinity
  let max = -Infinity
  for (const muestra of muestras) {
    if (muestra.at < ventana.inicio) continue
    if (ventana.fin != null && muestra.at >= ventana.fin) continue
    seen.add(muestra.f_cnt)
    if (muestra.f_cnt < min) min = muestra.f_cnt
    if (muestra.f_cnt > max) max = muestra.f_cnt
  }
  if (!seen.size || min === Infinity) return null
  const esperados = max - min + 1
  const recibidos = seen.size
  const pct = esperados > 0 ? Math.round((1000 * recibidos) / esperados) / 10 : null
  return { recibidos, esperados, pct }
}

async function fetchFcnt(nodeId: string, desdeIso: string): Promise<MuestraFcnt[]> {
  const muestras: MuestraFcnt[] = []
  for (let from = 0; ; from += PAGINA) {
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('f_cnt, received_at')
      .eq('node_id', nodeId)
      .gte('received_at', desdeIso)
      .not('f_cnt', 'is', null)
      .order('received_at', { ascending: false })
      .range(from, from + PAGINA - 1)
    if (error) throw new Error(error.message)
    const lote = data ?? []
    for (const row of lote) {
      const fCnt = asNumber(row.f_cnt)
      const at = instante(asText(row.received_at))
      if (fCnt == null || !at) continue
      muestras.push({ f_cnt: fCnt, at })
    }
    if (lote.length < PAGINA) break
  }
  return muestras
}

/**
 * PDR una vez por nodo y ventana, no una vez por uplink.
 * `completo` usa los f_cnt que ya vinieron en las filas (exportación de toda la historia).
 */
export async function completarPdr(rows: BitacoraRow[], completo = false): Promise<void> {
  if (!rows.length) return
  const condiciones = await fetchCondicionesCruce()
  const hace24h = Date.now() - DIA_MS
  const porNodo = new Map<string, BitacoraRow[]>()
  for (const row of rows) {
    const lista = porNodo.get(row.node_id)
    if (lista) lista.push(row)
    else porNodo.set(row.node_id, [row])
  }

  await Promise.all([...porNodo.entries()].map(async ([nodeId, lista]) => {
    const ventanas = new Map<string, VentanaPdr>()
    for (const row of lista) {
      const ventana = ventanaPdr(row, condiciones, hace24h)
      ventanas.set(claveVentana(ventana), ventana)
    }
    let muestras: MuestraFcnt[]
    if (completo) {
      muestras = []
      for (const row of lista) {
        if (row.f_cnt == null) continue
        const at = instante(row.received_at)
        if (!at) continue
        muestras.push({ f_cnt: row.f_cnt, at })
      }
    } else {
      let inicio = Infinity
      for (const ventana of ventanas.values()) {
        if (ventana.inicio && ventana.inicio < inicio) inicio = ventana.inicio
      }
      if (!Number.isFinite(inicio)) return
      muestras = await fetchFcnt(nodeId, new Date(inicio).toISOString())
    }
    const stats = new Map<string, ReturnType<typeof estadisticaPdr>>()
    for (const [clave, ventana] of ventanas) stats.set(clave, estadisticaPdr(muestras, ventana))
    for (const row of lista) {
      const pdr = stats.get(claveVentana(ventanaPdr(row, condiciones, hace24h)))
      if (!pdr) continue
      row.pdr_recibidos = pdr.recibidos
      row.pdr_esperados = pdr.esperados
      row.pdr_pct = pdr.pct
    }
  }))
}

export async function fetchCondiciones(): Promise<CondicionPrueba[]> {
  const rows = await fetchCondicionesCruce()
  return rows.slice(0, 40)
}

export async function createCondicion(input: {
  n: number
  node_id: string
  iniciada_at: string
  distancia_m: number | null
  obstaculos: string | null
  altura_m: number | null
  clima: string | null
  situacion_real: string | null
}): Promise<void> {
  const { error } = await supabase.from('condiciones_prueba').insert({
    ...input,
    activa: true,
  })
  if (error) {
    if (isMissingSchema(error)) throw new BitacoraSchemaError()
    throw new Error(error.message)
  }
}

export async function updateCondicion(
  id: string,
  patch: Partial<Pick<CondicionPrueba, 'distancia_m' | 'obstaculos' | 'altura_m' | 'clima' | 'situacion_real' | 'n'>>,
): Promise<void> {
  const { error } = await supabase.from('condiciones_prueba').update(patch).eq('id', id)
  if (error) throw error
}

export async function closeCondicion(id: string): Promise<void> {
  const { error } = await supabase
    .from('condiciones_prueba')
    .update({ activa: false, cerrada_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
