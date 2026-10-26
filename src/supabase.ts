import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(SUPABASE_URL?.trim() && SUPABASE_KEY?.trim())

function createSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    console.warn(
      '[FireTame] Falta .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. La interfaz carga sin datos de Supabase.',
    )
    return createClient('https://placeholder.supabase.co', 'public-anon-key-placeholder')
  }

  return createClient(SUPABASE_URL!, SUPABASE_KEY!)
}

export const supabase = createSupabaseClient()
