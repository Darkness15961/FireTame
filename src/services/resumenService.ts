import { isNodeConnected } from '@/constants/connection'
import type { DbResumenGlobal } from '@/types/database'

export interface ResumenNodeInput {
  lastReadingAt: string | null
  enabled: boolean
  telemetry: { tempDht: number | null }
}

export function buildResumenFromNodes(
  nodes: ResumenNodeInput[],
  alertasActivas: number,
): DbResumenGlobal {
  const online = nodes.filter((n) => isNodeConnected(n))
  const temps = online
    .map((n) => n.telemetry.tempDht)
    .filter((v): v is number => v != null)
  const last = nodes
    .map((n) => n.lastReadingAt)
    .filter((v): v is string => !!v)
    .sort()
    .at(-1) ?? null

  return {
    total_nodos: nodes.length,
    nodos_online: online.length,
    nodos_offline: nodes.length - online.length,
    alertas_activas: alertasActivas,
    temp_promedio: temps.length
      ? parseFloat((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1))
      : null,
    ultima_lectura_at: last,
  }
}
