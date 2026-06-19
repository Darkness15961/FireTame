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

export function formatValue(value: number | null | undefined, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toFixed(decimals)
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

export function formatTime(iso: string | null | undefined): string {
  const date = parseUtcDate(iso)
  if (!date || Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('es-PE', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function riskLabel(status: string): string {
  const map: Record<string, string> = {
    green: 'Normal',
    yellow: 'Observación',
    orange: 'Riesgo',
    red: 'Alerta crítica',
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
