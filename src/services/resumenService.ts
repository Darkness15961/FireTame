import { supabase } from '@/supabase'
import type { DbResumenGlobal } from '@/types/database'

const EMPTY_RESUMEN: DbResumenGlobal = {
  total_nodos: 0,
  nodos_online: 0,
  nodos_offline: 0,
  alertas_activas: 0,
  temp_promedio: null,
  ultima_lectura_at: null,
}

export async function fetchResumenGlobal(): Promise<DbResumenGlobal> {
  const { data, error } = await supabase.rpc('get_resumen_global')

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return EMPTY_RESUMEN

  return {
    total_nodos: Number(row.total_nodos ?? 0),
    nodos_online: Number(row.nodos_online ?? 0),
    nodos_offline: Number(row.nodos_offline ?? 0),
    alertas_activas: Number(row.alertas_activas ?? 0),
    temp_promedio: row.temp_promedio != null ? Number(row.temp_promedio) : null,
    ultima_lectura_at: row.ultima_lectura_at ?? null,
  }
}
