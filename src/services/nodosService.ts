import { supabase } from '@/supabase'
import type { DbNodo, DbNodoDashboard } from '@/types/database'

export async function fetchNodos(): Promise<DbNodo[]> {
  const { data, error } = await supabase
    .from('nodos')
    .select('*')
    .order('nombre')

  if (error) throw error
  return data ?? []
}

export async function fetchNodosDashboard(): Promise<DbNodoDashboard[]> {
  const { data, error } = await supabase
    .from('nodos_heltec_dashboard')
    .select('*')
    .order('nombre')

  if (error) throw error
  return (data ?? []) as DbNodoDashboard[]
}

export async function createNodo(payload: {
  id: string
  nombre: string
  ubicacion: string
  lat: number
  lng: number
  ttn_device_id?: string
  deveui?: string
  descripcion?: string
}): Promise<DbNodo> {
  const { data, error } = await supabase
    .from('nodos')
    .insert({
      id: payload.id,
      nombre: payload.nombre,
      ubicacion: payload.ubicacion,
      lat: payload.lat,
      lng: payload.lng,
      ttn_device_id: payload.ttn_device_id || null,
      deveui: payload.deveui?.replace(/[:-]/g, '').toUpperCase() || null,
      descripcion: payload.descripcion ?? null,
      estado: 1,
      status: 'active',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateNodoEstado(id: string, estado: number): Promise<void> {
  const { error } = await supabase
    .from('nodos')
    .update({
      estado,
      status: estado === 1 ? 'active' : 'inactive',
      ultima_conexion: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw error
}

export async function deleteNodo(id: string): Promise<void> {
  const { error } = await supabase.from('nodos').delete().eq('id', id)
  if (error) throw error
}
