import { supabase } from '@/supabase'
import type { SensorReading } from '@/types/database'

const COLUMNAS_HISTORIAL = 'id, node_id, received_at, temp_dht_c, humidity_pct, mq135_adc, temp_bmp_c, pressure_hpa, pitch_deg, roll_deg, rssi, snr'

export async function fetchNodeHistory(nodoId: string, limit = 60): Promise<SensorReading[]> {
  const { data, error } = await supabase
    .from('sensor_readings')
    .select(COLUMNAS_HISTORIAL)
    .eq('node_id', nodoId)
    .order('received_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return ((data ?? []) as SensorReading[]).reverse()
}

export async function fetchLatestReading(nodoId: string): Promise<SensorReading | null> {
  const { data, error } = await supabase
    .from('sensor_readings')
    .select(COLUMNAS_HISTORIAL)
    .eq('node_id', nodoId)
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as SensorReading) ?? null
}
