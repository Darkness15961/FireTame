import { parseUtcDate } from '@/utils/format'

/** Minutos sin lecturas para considerar un nodo desconectado */
export const ONLINE_THRESHOLD_MINUTES = 3

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
  techStatus: string
}): boolean {
  if (node.techStatus === 'offline') return false
  return isNodeOnline(node.lastReadingAt)
}

export function connectionLabel(node: {
  lastReadingAt: string | null
  techStatus: string
}): string {
  if (node.techStatus === 'offline') return 'Deshabilitado'
  return isNodeOnline(node.lastReadingAt) ? 'En línea' : 'Sin señal'
}
