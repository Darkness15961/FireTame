import { supabase } from '@/supabase'
import type { RiskEvent } from '@/types/database'

export async function fetchAlertasActivas(limit = 50): Promise<RiskEvent[]> {
  const { data, error } = await supabase
    .from('risk_events')
    .select('*')
    .in('level', ['medium', 'high', 'critical'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as RiskEvent[]
}

/** Marca alertas como atendidas. Sin ids, marca todas las pendientes. Devuelve la hora guardada. */
export async function marcarAtendidas(ids?: string[]): Promise<string> {
  const atendidaAt = new Date().toISOString()
  let query = supabase.from('risk_events').update({ atendida_at: atendidaAt }).is('atendida_at', null)
  if (ids) query = query.in('id', ids)
  const { error } = await query
  if (error) throw new Error(error.message)
  return atendidaAt
}
