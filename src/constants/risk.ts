export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type RiskStatus = 'green' | 'yellow' | 'orange' | 'red'

export const MQ135_BASELINE_SAMPLES = 10

/** Fila única de `umbrales_alerta` en Supabase. */
export interface UmbralesAlerta {
  temp_observacion_c: number
  temp_critica_c: number
  humedad_observacion_pct: number
  humedad_critica_pct: number
  mq135_baseline_defecto: number
  mq135_delta_observacion: number
  mq135_delta_critico: number
  inclinacion_activa: boolean
  inclinacion_deg: number
  score_minimo_alerta: number
  updated_at?: string | null
}

export const DEFAULT_UMBRALES: UmbralesAlerta = {
  temp_observacion_c: 35,
  temp_critica_c: 40,
  humedad_observacion_pct: 30,
  humedad_critica_pct: 20,
  mq135_baseline_defecto: 1500,
  mq135_delta_observacion: 400,
  mq135_delta_critico: 900,
  inclinacion_activa: true,
  inclinacion_deg: 45,
  score_minimo_alerta: 25,
}

export const RISK_POINTS = {
  tempObservacion: 20,
  tempCritica: 15,
  humedadObservacion: 20,
  humedadCritica: 15,
  mqObservacion: 20,
  mqCritico: 25,
  inclinacion: 10,
} as const

export interface RiskInput {
  temp_dht_c?: number | null
  humidity_pct?: number | null
  mq135_adc?: number | null
  pitch_deg?: number | null
  roll_deg?: number | null
}

export interface RiskResult {
  score: number
  level: RiskLevel
  reasons: string[]
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 25) return 'medium'
  return 'low'
}

export function riskLevelToStatus(level: RiskLevel): RiskStatus {
  if (level === 'critical') return 'red'
  if (level === 'high') return 'orange'
  if (level === 'medium') return 'yellow'
  return 'green'
}

export function evaluateEnvironmentalRisk(
  reading: RiskInput,
  umbrales: UmbralesAlerta = DEFAULT_UMBRALES,
  mq135Baseline = umbrales.mq135_baseline_defecto,
): RiskResult {
  let score = 0
  const reasons: string[] = []
  const temp = reading.temp_dht_c
  // El DHT22 manda 0 % cuando falla la lectura; no cuenta como aire seco.
  const hum = reading.humidity_pct != null && reading.humidity_pct > 0 ? reading.humidity_pct : null
  const mq = reading.mq135_adc
  const pitch = reading.pitch_deg
  const roll = reading.roll_deg

  if (temp != null && temp >= umbrales.temp_observacion_c) {
    score += RISK_POINTS.tempObservacion
    reasons.push(`temp_dht_c >= ${umbrales.temp_observacion_c} (${temp})`)
  }
  if (temp != null && temp >= umbrales.temp_critica_c) {
    score += RISK_POINTS.tempCritica
    reasons.push(`temp_dht_c >= ${umbrales.temp_critica_c} (${temp})`)
  }
  if (hum != null && hum <= umbrales.humedad_observacion_pct) {
    score += RISK_POINTS.humedadObservacion
    reasons.push(`humidity_pct <= ${umbrales.humedad_observacion_pct} (${hum})`)
  }
  if (hum != null && hum <= umbrales.humedad_critica_pct) {
    score += RISK_POINTS.humedadCritica
    reasons.push(`humidity_pct <= ${umbrales.humedad_critica_pct} (${hum})`)
  }
  if (mq != null && mq >= mq135Baseline + umbrales.mq135_delta_observacion) {
    score += RISK_POINTS.mqObservacion
    reasons.push(`mq135_adc >= baseline+${umbrales.mq135_delta_observacion} (${mq} vs ${mq135Baseline})`)
  }
  if (mq != null && mq >= mq135Baseline + umbrales.mq135_delta_critico) {
    score += RISK_POINTS.mqCritico
    reasons.push(`mq135_adc >= baseline+${umbrales.mq135_delta_critico} (${mq} vs ${mq135Baseline})`)
  }
  if (
    umbrales.inclinacion_activa &&
    ((pitch != null && Math.abs(pitch) > umbrales.inclinacion_deg) ||
      (roll != null && Math.abs(roll) > umbrales.inclinacion_deg))
  ) {
    score += RISK_POINTS.inclinacion
    reasons.push(`inclinación > ${umbrales.inclinacion_deg}° (pitch=${pitch}, roll=${roll})`)
  }

  score = Math.min(100, score)
  return { score, level: riskLevelFromScore(score), reasons }
}
