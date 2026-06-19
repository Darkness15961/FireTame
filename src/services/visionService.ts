import { supabase } from '@/supabase'
import type { DbVisionAi } from '@/types/database'

export async function fetchLatestVision(nodoId: string): Promise<DbVisionAi | null> {
  const { data, error } = await supabase
    .from('vision_ai')
    .select('*')
    .eq('nodo_id', nodoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}
