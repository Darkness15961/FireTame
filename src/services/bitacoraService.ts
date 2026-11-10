import { supabase } from '@/supabase'
import type { BitacoraRow, CondicionPrueba } from '@/types/database'

export class BitacoraSchemaError extends Error {
  constructor() {
    super('Falta aplicar la migración de la bitácora en Supabase.')
    this.name = 'BitacoraSchemaError'
  }
}

function isMissingSchema(error: { code?: string; message?: string }): boolean {
  const message = `${error.code ?? ''} ${error.message ?? ''}`
  return /bitacora_pruebas|condiciones_prueba|PGRST205|42P01|schema cache|does not exist/i.test(message)
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

function mapRow(raw: Record<string, unknown>): BitacoraRow {
  return {
    reading_id: String(raw.reading_id),
    node_id: String(raw.node_id),
    nodo_nombre: asText(raw.nodo_nombre),
    nodo_mac: asText(raw.nodo_mac),
    n: asNumber(raw.n),
    distancia_m: asNumber(raw.distancia_m),
    obstaculos: asText(raw.obstaculos),
    altura_m: asNumber(raw.altura_m),
    clima: asText(raw.clima),
    rssi: asNumber(raw.rssi),
    snr: asNumber(raw.snr),
    node_rssi: asNumber(raw.node_rssi),
    node_snr: asNumber(raw.node_snr),
    crc_status: asText(raw.crc_status),
    f_cnt: asNumber(raw.f_cnt),
    pdr_pct: asNumber(raw.pdr_pct),
    pdr_recibidos: asNumber(raw.pdr_recibidos),
    pdr_esperados: asNumber(raw.pdr_esperados),
    disponibilidad_pct: asNumber(raw.disponibilidad_pct),
    node_sent_at: asText(raw.node_sent_at),
    gateway_received_at: asText(raw.gateway_received_at),
    received_at: String(raw.received_at ?? ''),
    db_received_at: asText(raw.db_received_at),
    airtime_s: asNumber(raw.airtime_s),
    tiempo_subida_s: asNumber(raw.tiempo_subida_s),
    retraso_gateway_red_s: asNumber(raw.retraso_gateway_red_s),
    retraso_red_bd_s: asNumber(raw.retraso_red_bd_s),
    hora_emision_alerta: asText(raw.hora_emision_alerta),
    temp_dht_c: asNumber(raw.temp_dht_c),
    humidity_pct: asNumber(raw.humidity_pct),
    mq135_adc: asNumber(raw.mq135_adc),
    temp_bmp_c: asNumber(raw.temp_bmp_c),
    pressure_hpa: asNumber(raw.pressure_hpa),
    pitch_deg: asNumber(raw.pitch_deg),
    roll_deg: asNumber(raw.roll_deg),
    situacion_real: asText(raw.situacion_real),
    alerta_emitida: asBool(raw.alerta_emitida),
    condicion_id: asText(raw.condicion_id),
    datarate: asText(raw.datarate),
  }
}

const PAGINA_CONSULTA = 1000

export async function contarBitacora(): Promise<number> {
  const { count, error } = await supabase
    .from('bitacora_pruebas')
    .select('reading_id', { count: 'exact', head: true })

  if (error) {
    if (isMissingSchema(error)) throw new BitacoraSchemaError()
    throw new Error(error.message)
  }
  return count ?? 0
}

export async function fetchBitacora(limit = 300): Promise<BitacoraRow[]> {
  const pedidos = Math.max(0, Math.floor(limit))
  const rows: BitacoraRow[] = []
  for (let desde = 0; rows.length < pedidos; desde += PAGINA_CONSULTA) {
    const hasta = Math.min(desde + PAGINA_CONSULTA, pedidos) - 1
    const { data, error } = await supabase
      .from('bitacora_pruebas')
      .select('*')
      .order('received_at', { ascending: false })
      .range(desde, hasta)

    if (error) {
      if (isMissingSchema(error)) throw new BitacoraSchemaError()
      throw new Error(error.message)
    }
    const lote = (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
    rows.push(...lote)
    if (lote.length < hasta - desde + 1) break
  }
  await completarSensores(rows)
  return rows
}

/** BMP, presión e inclinación viven en la lectura y no en la vista de la bitácora. */
async function completarSensores(rows: BitacoraRow[]): Promise<void> {
  const ids = rows.map((row) => row.reading_id).filter(Boolean)
  const extras = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < ids.length; i += 150) {
    const slice = ids.slice(i, i + 150)
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('id, temp_bmp_c, pressure_hpa, pitch_deg, roll_deg')
      .in('id', slice)
    if (error || !data) continue
    for (const item of data) extras.set(String(item.id), item as Record<string, unknown>)
  }
  for (const row of rows) {
    const extra = extras.get(row.reading_id)
    row.temp_bmp_c = asNumber(extra?.temp_bmp_c)
    row.pressure_hpa = asNumber(extra?.pressure_hpa)
    row.pitch_deg = asNumber(extra?.pitch_deg)
    row.roll_deg = asNumber(extra?.roll_deg)
  }
}

export async function fetchCondiciones(): Promise<CondicionPrueba[]> {
  const { data, error } = await supabase
    .from('condiciones_prueba')
    .select('*')
    .order('iniciada_at', { ascending: false })
    .limit(40)

  if (error) {
    if (isMissingSchema(error)) throw new BitacoraSchemaError()
    throw new Error(error.message)
  }
  return (data ?? []) as CondicionPrueba[]
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
