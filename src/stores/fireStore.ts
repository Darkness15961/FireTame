import { defineStore } from 'pinia'
import { isSupabaseConfigured, supabase } from '@/supabase'
import { EMPTY_TELEMETRY, type HeltecTelemetry } from '@/constants/sensors'
import { isNodeOnline, isNodeConnected } from '@/constants/connection'
import {
  DEFAULT_UMBRALES,
  evaluateEnvironmentalRisk,
  riskLevelToStatus,
  type RiskStatus,
  type UmbralesAlerta,
} from '@/constants/risk'
import { fetchUmbrales, saveUmbrales } from '@/services/umbralesService'
import { fetchNodosDashboard, createNodo, updateNodoEstado, deleteNodo as deleteNodoDb } from '@/services/nodosService'
import { fetchNodeHistory } from '@/services/lecturasService'
import { fetchAlertasActivas } from '@/services/alertasService'
import { buildResumenFromNodes } from '@/services/resumenService'
import type { DbNodoDashboard, DbResumenGlobal, RiskEvent, SensorReading } from '@/types/database'
import { formatTime } from '@/utils/format'

export type TechStatus = 'online' | 'offline'

export interface SensorHealth {
  tempDht: 'OK' | 'ERR'
  humidity: 'OK' | 'ERR'
  mq135: 'OK' | 'ERR'
  tempBmp: 'OK' | 'ERR'
  pressure: 'OK' | 'ERR'
  tilt: 'OK' | 'ERR'
}

export interface NodeHistoryEntry {
  timestamp: string
  tempDht: number | null
  humidity: number | null
  mq135Adc: number | null
  tempBmp: number | null
  pressureHpa: number | null
  pitchDeg: number | null
  rollDeg: number | null
}

export interface IoTNode {
  id: string
  name: string
  ttnDeviceId: string | null
  deveui: string | null
  lat: number | null
  lng: number | null
  riskStatus: RiskStatus
  riskScore: number
  techStatus: TechStatus
  /** `nodos.estado`: false si se deshabilitó a mano desde Registro de Nodos. */
  enabled: boolean
  sensorsHealth: SensorHealth
  telemetry: HeltecTelemetry
  history: NodeHistoryEntry[]
  lastConnection: string
  lastReadingAt: string | null
}

export interface Alert {
  id: string
  nodeId: string
  nodeName: string
  severity: RiskEvent['level']
  type: 'environmental' | 'tamper'
  message: string
  timestamp: string
  acknowledged: boolean
  score: number
}

export interface SystemLog {
  id: string
  timestamp: string
  type: 'info' | 'warning' | 'error' | 'success'
  message: string
}

function parseUbicacion(row: DbNodoDashboard): { lat: number | null; lng: number | null } {
  if (row.lat != null && row.lng != null) return { lat: row.lat, lng: row.lng }
  const [latStr, lngStr] = (row.ubicacion || '').split(',')
  const lat = parseFloat(latStr ?? '')
  const lng = parseFloat(lngStr ?? '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null }
  return { lat, lng }
}

function healthFrom(t: HeltecTelemetry): SensorHealth {
  return {
    tempDht: t.tempDht != null ? 'OK' : 'ERR',
    humidity: t.humidity != null ? 'OK' : 'ERR',
    mq135: t.mq135Adc != null ? 'OK' : 'ERR',
    tempBmp: t.tempBmp != null ? 'OK' : 'ERR',
    pressure: t.pressureHpa != null ? 'OK' : 'ERR',
    tilt: t.pitchDeg != null || t.rollDeg != null ? 'OK' : 'ERR',
  }
}

function telemetryFromRow(row: DbNodoDashboard | SensorReading): HeltecTelemetry {
  const r = row as DbNodoDashboard & SensorReading
  return {
    tempDht: r.temp_dht_c ?? null,
    humidity: r.humidity_pct ?? null,
    mq135Adc: r.mq135_adc ?? null,
    tempBmp: r.temp_bmp_c ?? null,
    pressureHpa: r.pressure_hpa ?? null,
    pitchDeg: r.pitch_deg ?? null,
    rollDeg: r.roll_deg ?? null,
    rssi: r.rssi ?? null,
    snr: r.snr ?? null,
  }
}

function mapDashboardToNode(row: DbNodoDashboard, umbrales: UmbralesAlerta): IoTNode {
  const { lat, lng } = parseUbicacion(row)
  const telemetry = telemetryFromRow(row)
  const online = isNodeOnline(row.ultima_lectura_at) && row.estado !== 0
  const computed = evaluateEnvironmentalRisk({
    temp_dht_c: telemetry.tempDht,
    humidity_pct: telemetry.humidity,
    mq135_adc: telemetry.mq135Adc,
    pitch_deg: telemetry.pitchDeg,
    roll_deg: telemetry.rollDeg,
  }, umbrales)
  return {
    id: row.nodo_id,
    name: row.ttn_device_id || row.nodo_id,
    ttnDeviceId: row.ttn_device_id ?? null,
    deveui: row.deveui ?? null,
    lat,
    lng,
    riskStatus: riskLevelToStatus(computed.level),
    riskScore: computed.score,
    techStatus: online ? 'online' : 'offline',
    enabled: row.estado !== 0,
    sensorsHealth: healthFrom(telemetry),
    telemetry,
    history: [],
    lastReadingAt: row.ultima_lectura_at ?? null,
    lastConnection: row.ultima_lectura_at
      ? formatTime(row.ultima_lectura_at)
      : row.ultima_conexion
        ? formatTime(row.ultima_conexion)
        : '—',
  }
}

function applyReading(node: IoTNode, reading: SensorReading, umbrales: UmbralesAlerta) {
  node.telemetry = telemetryFromRow(reading)
  node.sensorsHealth = healthFrom(node.telemetry)
  node.lastReadingAt = reading.received_at
  node.lastConnection = formatTime(reading.received_at)
  node.techStatus = isNodeOnline(reading.received_at) ? 'online' : 'offline'
  const risk = evaluateEnvironmentalRisk({
    temp_dht_c: node.telemetry.tempDht,
    humidity_pct: node.telemetry.humidity,
    mq135_adc: node.telemetry.mq135Adc,
    pitch_deg: node.telemetry.pitchDeg,
    roll_deg: node.telemetry.rollDeg,
  }, umbrales)
  node.riskScore = risk.score
  node.riskStatus = riskLevelToStatus(risk.level)
}

export const useFireStore = defineStore('fireStore', {
  state: () => ({
    nodes: [] as IoTNode[],
    alerts: [] as Alert[],
    logs: [] as SystemLog[],
    selectedNodeId: null as string | null,
    initializing: false,
    umbrales: { ...DEFAULT_UMBRALES } as UmbralesAlerta,
    resumen: {
      total_nodos: 0,
      nodos_online: 0,
      nodos_offline: 0,
      alertas_activas: 0,
      temp_promedio: null,
      ultima_lectura_at: null,
    } as DbResumenGlobal,
  }),

  getters: {
    selectedNode: (state) => state.nodes.find((n) => n.id === state.selectedNodeId) || null,

    activeFiresCount(): number {
      return this.nodes.filter((n) => n.riskStatus === 'red').length
    },

    connectedNodesCount(): number {
      return this.nodes.filter((n) => isNodeConnected(n)).length
    },

    offlineNodesCount(): number {
      return this.nodes.filter((n) => !isNodeConnected(n)).length
    },

    activeAlertsCount(): number {
      return this.alerts.filter((a) => !a.acknowledged).length
    },

    globalRiskScore(): number {
      if (!this.nodes.length) return 0
      const total = this.nodes.reduce((sum, n) => sum + n.riskScore, 0)
      return Math.round(total / this.nodes.length)
    },

    averageTemperature(): number {
      const active = this.nodes.filter((n) => isNodeConnected(n) && n.telemetry.tempDht != null)
      if (!active.length) return 0
      const total = active.reduce((sum, n) => sum + (n.telemetry.tempDht ?? 0), 0)
      return parseFloat((total / active.length).toFixed(1))
    },
  },

  actions: {
    async initializeStore() {
      if (this.nodes.length > 0 || this.initializing) return
      this.initializing = true

      if (!isSupabaseConfigured) {
        this.initializing = false
        this.addLog('warning', 'Supabase no configurado. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
        return
      }

      try {
        try {
          this.umbrales = await fetchUmbrales()
        } catch (e) {
          console.error('Error loading umbrales_alerta:', e)
        }
        const dashboard = await fetchNodosDashboard()
        this.nodes = dashboard.map((row) => mapDashboardToNode(row, this.umbrales))
        await Promise.all(this.nodes.map((node) => this.hydrateNode(node)))
        await this.loadAlertsFromDb()
        this.syncResumen()
      } catch (err) {
        console.error('Error connecting to Supabase:', err)
        this.nodes = []
        this.addLog('error', 'No se pudieron cargar nodos Heltec. ¿Aplicaste la migración SQL?')
      } finally {
        this.initializing = false
      }

      if (this.nodes.length > 0) {
        const live = [...this.nodes].sort((a, b) => {
          const aLive = a.lastReadingAt ? 1 : 0
          const bLive = b.lastReadingAt ? 1 : 0
          return bLive - aLive
        })
        this.selectedNodeId = live[0]?.id ?? this.nodes[0]?.id ?? null
        this.addLog('success', `Telemetría LoRaWAN: ${this.nodes.length} nodos (actualización ~1 min).`)
      } else {
        this.addLog('warning', 'No hay nodos registrados. Crea uno con DevEUI / TTN device id.')
      }

      this.subscribeRealtime()
      this.startConnectionWatcher()
    },

    startConnectionWatcher() {
      setInterval(() => {
        let changed = false
        for (const node of this.nodes) {
          const nowOnline = isNodeOnline(node.lastReadingAt)
          const wasOnline = node.techStatus === 'online'
          if (nowOnline === wasOnline) continue
          node.techStatus = nowOnline ? 'online' : 'offline'
          changed = true
        }
        if (changed) this.syncResumen()
      }, 30_000)
    },

    async refreshNode(nodeId: string) {
      await this.refreshFromServer()
      this.selectedNodeId = nodeId
    },

    async refreshFromServer() {
      this.nodes = []
      this.initializing = false
      await this.initializeStore()
    },

    async hydrateNode(node: IoTNode) {
      try {
        const history = await fetchNodeHistory(node.id, 60)
        if (!history.length) return
        const last = history.reduce<SensorReading | null>((best, row) => {
          if (!best || row.received_at > best.received_at) return row
          return best
        }, null)
        if (last) applyReading(node, last, this.umbrales)
        node.history = history.map((entry) => ({
          timestamp: formatTime(entry.received_at),
          tempDht: entry.temp_dht_c,
          humidity: entry.humidity_pct,
          mq135Adc: entry.mq135_adc,
          tempBmp: entry.temp_bmp_c,
          pressureHpa: entry.pressure_hpa,
          pitchDeg: entry.pitch_deg,
          rollDeg: entry.roll_deg,
        }))
      } catch (e) {
        console.error(`Error hydrating node ${node.id}:`, e)
      }
    },

    syncResumen() {
      this.resumen = buildResumenFromNodes(this.nodes, this.activeAlertsCount)
    },

    async loadAlertsFromDb() {
      try {
        const events = await fetchAlertasActivas()
        this.alerts = events.map((e) => this.mapRiskEvent(e))
      } catch (e) {
        console.error('Error loading risk_events:', e)
      }
    },

    mapRiskEvent(e: RiskEvent): Alert {
      const node = this.nodes.find((n) => n.id === e.node_id)
      const reasons = e.reason?.reasons?.join(', ') ?? e.level
      const isTamper = reasons.includes('inclinación')
      return {
        id: e.id,
        nodeId: e.node_id,
        nodeName: node?.name ?? 'Nodo desconocido',
        severity: e.level,
        type: isTamper ? 'tamper' : 'environmental',
        message: `Riesgo ${e.level} (score ${e.score}). ${reasons}`,
        timestamp: formatTime(e.created_at),
        acknowledged: false,
        score: e.score,
      }
    },

    subscribeRealtime() {
      if (!isSupabaseConfigured) return

      supabase
        .channel('heltec-readings')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'sensor_readings' },
          (payload: { new: SensorReading }) => {
            const reading = payload.new
            const node = this.nodes.find((n) => n.id === reading.node_id)
            if (!node) return
            applyReading(node, reading, this.umbrales)
            node.history.push({
              timestamp: formatTime(reading.received_at),
              tempDht: reading.temp_dht_c,
              humidity: reading.humidity_pct,
              mq135Adc: reading.mq135_adc,
              tempBmp: reading.temp_bmp_c,
              pressureHpa: reading.pressure_hpa,
              pitchDeg: reading.pitch_deg,
              rollDeg: reading.roll_deg,
            })
            if (node.history.length > 60) node.history.shift()
            this.syncResumen()
          },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'risk_events' },
          (payload: { new: RiskEvent }) => {
            const alert = this.mapRiskEvent(payload.new)
            this.alerts.unshift(alert)
            const node = this.nodes.find((n) => n.id === payload.new.node_id)
            if (node) {
              node.riskScore = payload.new.score
              node.riskStatus = riskLevelToStatus(payload.new.level)
            }
            this.addLog(
              payload.new.level === 'critical' || payload.new.level === 'high' ? 'error' : 'warning',
              alert.message,
            )
            this.syncResumen()
          },
        )
        .subscribe()
    },

    async addCustomNode(
      name: string,
      lat: number,
      lng: number,
      ttnDeviceId?: string,
      deveui?: string,
    ) {
      const id = ttnDeviceId?.trim() || `nodo_${Date.now().toString(36)}`
      try {
        await createNodo({
          id,
          nombre: name,
          ubicacion: `${lat},${lng}`,
          lat,
          lng,
          ttn_device_id: ttnDeviceId,
          deveui,
        })
      } catch (e) {
        console.error('Error creating node in Supabase:', e)
        this.addLog('error', `Error al registrar nodo [${name}] en Supabase.`)
        return
      }

      const node: IoTNode = {
        id,
        name,
        ttnDeviceId: ttnDeviceId || null,
        deveui: deveui?.toLowerCase() || null,
        lat,
        lng,
        riskStatus: 'green',
        riskScore: 0,
        techStatus: 'offline',
        enabled: true,
        sensorsHealth: healthFrom(EMPTY_TELEMETRY),
        telemetry: { ...EMPTY_TELEMETRY },
        history: [],
        lastReadingAt: null,
        lastConnection: '—',
      }
      this.nodes.push(node)
      this.selectedNodeId = node.id
      this.syncResumen()
      this.addLog('success', `Nodo LoRaWAN [${name}] registrado (${id}).`)
    },

    async toggleNodeActive(nodeId: string) {
      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node) return
      const newEstado = node.enabled ? 0 : 1
      try {
        await updateNodoEstado(nodeId, newEstado)
      } catch (e) {
        console.error('Error updating node estado:', e)
        return
      }
      node.enabled = newEstado === 1
      node.techStatus = isNodeOnline(node.lastReadingAt) ? 'online' : 'offline'
      this.syncResumen()
    },

    async deleteNode(nodeId: string) {
      const index = this.nodes.findIndex((n) => n.id === nodeId)
      if (index === -1) return
      const nodeName = this.nodes[index]?.name ?? ''
      try {
        await deleteNodoDb(nodeId)
      } catch (e) {
        console.error('Error deleting node:', e)
        this.addLog('error', `Error al eliminar nodo [${nodeName}].`)
        return
      }
      this.nodes.splice(index, 1)
      if (this.selectedNodeId === nodeId) {
        this.selectedNodeId = this.nodes[0]?.id ?? null
      }
      this.syncResumen()
      this.addLog('error', `Nodo [${nodeName}] eliminado.`)
    },

    acknowledgeAlert(alertId: string) {
      const alert = this.alerts.find((a) => a.id === alertId)
      if (alert) alert.acknowledged = true
    },

    acknowledgeAllAlerts() {
      this.alerts.forEach((alert) => {
        alert.acknowledged = true
      })
    },

    async updateUmbrales(next: UmbralesAlerta) {
      this.umbrales = await saveUmbrales(next)
      for (const node of this.nodes) {
        const risk = evaluateEnvironmentalRisk({
          temp_dht_c: node.telemetry.tempDht,
          humidity_pct: node.telemetry.humidity,
          mq135_adc: node.telemetry.mq135Adc,
          pitch_deg: node.telemetry.pitchDeg,
          roll_deg: node.telemetry.rollDeg,
        }, this.umbrales)
        node.riskScore = risk.score
        node.riskStatus = riskLevelToStatus(risk.level)
      }
      this.syncResumen()
      this.addLog('success', 'Umbrales de alerta actualizados.')
    },

    addLog(type: SystemLog['type'], message: string) {
      this.logs.unshift({
        id: `LOG-${Math.floor(10000 + Math.random() * 89999)}`,
        timestamp: formatTime(new Date().toISOString()),
        type,
        message,
      })
      if (this.logs.length > 100) this.logs.pop()
    },
  },
})
