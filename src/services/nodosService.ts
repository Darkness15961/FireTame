import { supabase } from '@/supabase'
import type { DbNodo, DbNodoDashboard, DbNodoDetalle } from '@/types/database'

export async function fetchNodos(): Promise<DbNodo[]> {
  const { data, error } = await supabase
    .from('nodos')
    .select('*')
    .order('nombre')

  if (error) throw error
  return data ?? []
}

export async function fetchNodosDashboard(): Promise<DbNodoDashboard[]> {
  const { data, error } = await supabase.rpc('get_nodos_dashboard')
  if (error) throw error
  return (data ?? []) as DbNodoDashboard[]
}

export async function fetchNodoDetalle(nodoId: string): Promise<DbNodoDetalle | null> {
  const { data, error } = await supabase.rpc('get_nodo_detalle', { p_nodo_id: nodoId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return (row as DbNodoDetalle) ?? null
}

export async function createNodo(payload: {
  id: string
  nombre: string
  ubicacion: string
  descripcion?: string
}): Promise<DbNodo> {
  const { data, error } = await supabase
    .from('nodos')
    .insert({
      id: payload.id,
      nombre: payload.nombre,
      ubicacion: payload.ubicacion,
      descripcion: payload.descripcion ?? null,
      estado: 1,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateNodoEstado(id: string, estado: number): Promise<void> {
  const { error } = await supabase
    .from('nodos')
    .update({ estado, ultima_conexion: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function deleteNodo(id: string): Promise<void> {
  const { error } = await supabase.from('nodos').delete().eq('id', id)
  if (error) throw error
}
