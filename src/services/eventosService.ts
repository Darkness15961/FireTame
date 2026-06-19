import { supabase } from '@/supabase'
import type { DbEvento } from '@/types/database'

export async function fetchEventosRecientes(limit = 50): Promise<DbEvento[]> {
  const { data, error } = await supabase.rpc('get_eventos_recientes', { p_limit: limit })
  if (error) throw error
  return (data ?? []) as DbEvento[]
}
