import type { RiskLevel } from '@/constants/risk'

export interface DbNodo {
  id: string
  nombre: string
  ubicacion: string | null
  descripcion: string | null
  estado: number
  status?: string | null
  ttn_device_id?: string | null
  deveui?: string | null
  lat?: number | null
  lng?: number | null
  ultima_conexion: string
}

export interface SensorReading {
  id: string
  node_id: string
  received_at: string
  temp_dht_c: number | null
  humidity_pct: number | null
  mq135_adc: number | null
  temp_bmp_c: number | null
  pressure_hpa: number | null
  pitch_deg: number | null
  roll_deg: number | null
  rssi?: number | null
  snr?: number | null
  gateway_id?: string | null
  f_port?: number | null
  schema_version: number
  raw_payload?: Record<string, unknown> | null
}

export interface CondicionPrueba {
  id: string
  n: number
  node_id: string
  distancia_m: number | null
  obstaculos: string | null
  altura_m: number | null
  clima: string | null
  situacion_real: string | null
  activa: boolean
  iniciada_at: string
  cerrada_at: string | null
  created_at: string
}

export interface BitacoraRow {
  reading_id: string
  node_id: string
  nodo_nombre: string | null
  nodo_mac: string | null
  n: number | null
  distancia_m: number | null
  obstaculos: string | null
  altura_m: number | null
  clima: string | null
  rssi: number | null
  snr: number | null
  node_rssi: number | null
  node_snr: number | null
  crc_status: string | null
  f_cnt: number | null
  pdr_pct: number | null
  pdr_recibidos: number | null
  pdr_esperados: number | null
  disponibilidad_pct: number | null
  node_sent_at: string | null
  gateway_received_at: string | null
  received_at: string
  db_received_at: string | null
  airtime_s: number | null
  tiempo_subida_s: number | null
  retraso_gateway_red_s: number | null
  retraso_red_bd_s: number | null
  hora_emision_alerta: string | null
  temp_dht_c: number | null
  humidity_pct: number | null
  mq135_adc: number | null
  situacion_real: string | null
  alerta_emitida: boolean
  condicion_id: string | null
  datarate: string | null
}

export interface RiskEvent {
  id: string
  node_id: string
  level: RiskLevel
  score: number
  reason: { reasons?: string[]; baseline?: number } | null
  reading_id: string | null
  created_at: string
  atendida_at?: string | null
}

export interface NodeDevice {
  id: string
  name: string
  ttn_device_id: string
  deveui: string
  location_label?: string
  lat?: number | null
  lng?: number | null
  status: 'active' | 'inactive' | 'maintenance'
}

export interface DbNodoDashboard {
  nodo_id: string
  nombre: string
  ubicacion: string | null
  descripcion?: string | null
  estado: number
  status?: string | null
  ttn_device_id?: string | null
  deveui?: string | null
  lat?: number | null
  lng?: number | null
  ultima_conexion: string | null
  ultima_lectura_at?: string | null
  temp_dht_c: number | null
  humidity_pct: number | null
  mq135_adc: number | null
  temp_bmp_c: number | null
  pressure_hpa: number | null
  pitch_deg: number | null
  roll_deg: number | null
  rssi?: number | null
  snr?: number | null
  risk_level?: RiskLevel | null
  risk_score?: number | null
}

export interface DbResumenGlobal {
  total_nodos: number
  nodos_online: number
  nodos_offline: number
  alertas_activas: number
  temp_promedio: number | null
  ultima_lectura_at: string | null
}