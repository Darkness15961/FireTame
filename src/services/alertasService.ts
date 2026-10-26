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
