/** Zona horaria del proyecto (Perú no usa horario de verano) */
export const APP_TIMEZONE = 'America/Lima'

/**
 * Supabase/Postgres suele devolver UTC sin sufijo Z (ej. "2025-06-19T08:16:00").
 * Sin Z, JavaScript lo trata como hora LOCAL y muestra +5h de más en Perú.
 * Esta función fuerza interpretación UTC cuando no hay zona horaria en el string.
 */
export function parseUtcDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const trimmed = iso.trim()
  const hasTimezone = /[Zz]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed) || /[+-]\d{4}$/.test(trimmed)
  if (hasTimezone) return new Date(trimmed)
  const normalized = trimmed.replace(' ', 'T')
  return new Date(`${normalized}Z`)
}

/** DevEUI de LoRaWAN: identificador de hardware, equivalente a una MAC. */
export function formatDeveui(value: string | null | undefined): string {
  if (!value) return '—'
  const hex = value.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
  if (hex.length !== 16) return hex || '—'
  return hex.match(/.{2}/g)!.join(':')
}

export function formatValue(value: number | null | undefined, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toFixed(decimals)
}

/** Segundos de un tramo del uplink. Por debajo de 1 s se muestra en milisegundos. */
export function formatSeconds(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (Math.abs(value) < 1) return `${(value * 1000).toFixed(0)} ms`
  return `${value.toFixed(digits)} s`
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = parseUtcDate(iso)
  if (!date || Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-PE', {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function limaDayKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE })
}

/** Solo la hora si es de hoy (hora de Lima); si es de otro día, antepone la fecha. */
export function formatTime(iso: string | null | undefined): string {
  const date = parseUtcDate(iso)
  if (!date || Number.isNaN(date.getTime())) return '—'
  if (limaDayKey(date) !== limaDayKey(new Date())) return formatDateTime(iso)
  return date.toLocaleTimeString('es-PE', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatRelative(iso: string | null | undefined, now: number = Date.now()): string {
  const date = parseUtcDate(iso)
  if (!date || Number.isNaN(date.getTime())) return '—'
  const s = Math.max(0, Math.round((now - date.getTime()) / 1000))
  if (s < 60) return `hace ${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'hace 1 día' : `hace ${d} días`
}

export function riskLabel(status: string): string {
  const map: Record<string, string> = {
    green: 'Normal',
    yellow: 'Observación',
    orange: 'Riesgo alto',
    red: 'Crítico',
    low: 'Bajo',
    medium: 'Medio',
    high: 'Alto',
    critical: 'Crítico',
  }
  return map[status] ?? status
}

export function techLabel(status: string): string {
  const map: Record<string, string> = {
    online: 'En línea',
    offline: 'Desconectado',
    low_battery: 'Batería baja',
    sensor_error: 'Error de sensor',
    signal_weak: 'Señal débil',
  }
  return map[status] ?? status
}
