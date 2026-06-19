import { supabase } from '@/supabase'
import type { DbAlerta } from '@/types/database'

export async function fetchAlertasActivas(limit = 50): Promise<DbAlerta[]> {
  const { data, error } = await supabase.rpc('get_alertas_activas', { p_limit: limit })
  if (error) throw error
  return (data ?? []) as DbAlerta[]
}

export async function acknowledgeAlerta(id: number): Promise<void> {
  const { error } = await supabase.from('alertas').update({ estado: 1 }).eq('id', id)
  if (error) throw error
}
