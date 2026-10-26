import { supabase } from '@/supabase'
import type { SensorReading } from '@/types/database'

export async function fetchNodeHistory(nodoId: string, limit = 60): Promise<SensorReading[]> {
  const { data, error } = await supabase
    .from('sensor_readings')
    .select('*')
    .eq('node_id', nodoId)
    .order('received_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return ((data ?? []) as SensorReading[]).reverse()
}

export async function fetchLatestReading(nodoId: string): Promise<SensorReading | null> {
  const { data, error } = await supabase
    .from('sensor_readings')
    .select('*')
    .eq('node_id', nodoId)
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as SensorReading) ?? null
}
