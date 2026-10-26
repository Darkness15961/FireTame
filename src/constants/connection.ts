import { parseUtcDate } from '@/utils/format'

/** Minutos sin lecturas para considerar un nodo desconectado (~5 uplinks de 60 s) */
export const ONLINE_THRESHOLD_MINUTES = 5

export function isNodeOnline(lastReadingAt: string | null | undefined): boolean {
  if (!lastReadingAt) return false
  const date = parseUtcDate(lastReadingAt)
  if (!date) return false
  const elapsed = Date.now() - date.getTime()
  return elapsed < ONLINE_THRESHOLD_MINUTES * 60 * 1000
}

/** Conexión real: lecturas recientes y no deshabilitado manualmente */
export function isNodeConnected(node: {
  lastReadingAt: string | null
  enabled?: boolean
}): boolean {
  if (node.enabled === false) return false
  return isNodeOnline(node.lastReadingAt)
}

export function connectionLabel(node: {
  lastReadingAt: string | null
  enabled?: boolean
}): string {
  if (node.enabled === false) return 'Deshabilitado'
  if (!node.lastReadingAt) return 'Sin uplinks'
  return isNodeOnline(node.lastReadingAt) ? 'En línea' : 'Sin señal'
}
