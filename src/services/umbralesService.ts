import { supabase } from '@/supabase'
import { DEFAULT_UMBRALES, type UmbralesAlerta } from '@/constants/risk'

function toUmbrales(raw: Record<string, unknown> | null): UmbralesAlerta {
  if (!raw) return { ...DEFAULT_UMBRALES }
  const num = (key: keyof UmbralesAlerta) => {
    const value = Number(raw[key])
    return Number.isFinite(value) ? value : (DEFAULT_UMBRALES[key] as number)
  }
  return {
    temp_observacion_c: num('temp_observacion_c'),
    temp_critica_c: num('temp_critica_c'),
    humedad_observacion_pct: num('humedad_observacion_pct'),
    humedad_critica_pct: num('humedad_critica_pct'),
    mq135_baseline_defecto: num('mq135_baseline_defecto'),
    mq135_delta_observacion: num('mq135_delta_observacion'),
    mq135_delta_critico: num('mq135_delta_critico'),
    inclinacion_activa: raw.inclinacion_activa !== false,
    inclinacion_deg: num('inclinacion_deg'),
    score_minimo_alerta: num('score_minimo_alerta'),
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : null,
  }
}

export async function fetchUmbrales(): Promise<UmbralesAlerta> {
  const { data, error } = await supabase
    .from('umbrales_alerta')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return toUmbrales(data as Record<string, unknown> | null)
}

export async function saveUmbrales(umbrales: UmbralesAlerta): Promise<UmbralesAlerta> {
  const { updated_at: _ignored, ...values } = umbrales
  const { data, error } = await supabase
    .from('umbrales_alerta')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return toUmbrales(data as Record<string, unknown>)
}
