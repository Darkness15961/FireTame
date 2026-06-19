import { defineStore } from 'pinia'
import { supabase } from '@/supabase'
import type { Mpu6050Readings } from '@/constants/sensors'
import { EMPTY_MPU, parseMpuFromRow, SENSOR_TYPES } from '@/constants/sensors'
import { isNodeOnline, isNodeConnected } from '@/constants/connection'
import { fetchNodosDashboard, fetchNodoDetalle, createNodo, updateNodoEstado, deleteNodo as deleteNodoDb } from '@/services/nodosService'
import { fetchNodeHistory } from '@/services/lecturasService'
import { fetchAlertasActivas } from '@/services/alertasService'
import { fetchEventosRecientes } from '@/services/eventosService'
import { fetchResumenGlobal } from '@/services/resumenService'
import type { DbNodoDashboard, DbNodoDetalle, DbResumenGlobal } from '@/types/database'
import { formatTime } from '@/utils/format'


// Types
export type RiskStatus = 'green' | 'yellow' | 'orange' | 'red'
export type TechStatus = 'online' | 'offline' | 'low_battery' | 'sensor_error' | 'signal_weak'

export interface TelemetryReadings {
  temperature: number
  humidity: number
  co2: number
  pm25: number
  windSpeed: number
  windDirection: string
  mpu: Mpu6050Readings
}

export interface SensorHealth {
  temperature: 'OK' | 'ERR'
  humidity: 'OK' | 'ERR'
  co2: 'OK' | 'ERR'
  pm25: 'OK' | 'ERR'
  camera: 'OK' | 'ERR'
}

export interface AICamera {
  state: 'idle' | 'processing' | 'alert' | 'error'
  confidence: number
  streamActive: boolean
  thermalHotspots: { x: number; y: number; r: number }[]
  classification: string
}

export interface NodeHistoryEntry {
  timestamp: string
  temperature: number
  humidity: number
  co2: number
  pm25: number
}

export interface IoTNode {
  id: string
  name: string
  lat: number
  lng: number
  riskStatus: RiskStatus
  techStatus: TechStatus
  sensorsHealth: SensorHealth
  telemetry: TelemetryReadings
  aiCamera: AICamera
  battery: number
  signalStrength: number // in % (0 - 100)
  healthScore: number // Calculated percentage
  history: NodeHistoryEntry[]
  lastConnection: string
  lastReadingAt: string | null
  falsePositiveActive: boolean
  isSimulatingFire: boolean
  fireSimStep: number
}

export interface Alert {
  id: string
  nodeId: string
  nodeName: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: 'smoke' | 'fire' | 'hardware' | 'false_positive' | 'offline'
  message: string
  timestamp: string
  acknowledged: boolean
}

export interface SystemLog {
  id: string
  timestamp: string
  type: 'info' | 'warning' | 'error' | 'success'
  message: string
}

function parseUbicacion(ubicacion: string | null): { lat: number; lng: number } {
  const [latStr, lngStr] = (ubicacion || '').split(',')
  return {
    lat: parseFloat(latStr ?? '') || -13.5,
    lng: parseFloat(lngStr ?? '') || -71.9,
  }
}

function sensorStatus(value: number | null | undefined): 'OK' | 'ERR' {
  return value != null ? 'OK' : 'ERR'
}

/** Compatibilidad: nodos en memoria (HMR) pueden no tener `telemetry.mpu` */
function ensureMpu(node: IoTNode) {
  if (node.telemetry.mpu) return
  const legacy = node.telemetry as TelemetryReadings & { accelX?: number }
  node.telemetry.mpu = {
    accX: legacy.accelX ?? null,
    accY: null,
    accZ: null,
    gyroX: null,
    gyroY: null,
    gyroZ: null,
  }
}

function applyMpuReading(node: IoTNode, sensorTypeId: number, val: number) {
  ensureMpu(node)
  if (sensorTypeId === SENSOR_TYPES.ACELEROMETRO_X) node.telemetry.mpu.accX = val
  else if (sensorTypeId === SENSOR_TYPES.ACELEROMETRO_Y) node.telemetry.mpu.accY = val
  else if (sensorTypeId === SENSOR_TYPES.ACELEROMETRO_Z) node.telemetry.mpu.accZ = val
  else if (sensorTypeId === SENSOR_TYPES.GIROSCOPIO_X) node.telemetry.mpu.gyroX = val
  else if (sensorTypeId === SENSOR_TYPES.GIROSCOPIO_Y) node.telemetry.mpu.gyroY = val
  else if (sensorTypeId === SENSOR_TYPES.GIROSCOPIO_Z) node.telemetry.mpu.gyroZ = val
}

function resolveOnlineStatus(row: {
  en_linea?: boolean | null
  ultima_lectura_at?: string | null
}): TechStatus {
  if (row.en_linea != null) return row.en_linea ? 'online' : 'offline'
  return isNodeOnline(row.ultima_lectura_at) ? 'online' : 'offline'
}

function mapDashboardToNode(row: DbNodoDashboard): IoTNode {
  const { lat, lng } = parseUbicacion(row.ubicacion)
  const online = resolveOnlineStatus(row)
  return {
    id: row.nodo_id,
    name: row.nombre,
    lat,
    lng,
    riskStatus: 'green',
    techStatus: online,
    sensorsHealth: {
      temperature: sensorStatus(row.temperatura),
      humidity: sensorStatus(row.humedad),
      co2: sensorStatus(row.co2),
      pm25: sensorStatus(row.pm25),
      camera: 'ERR',
    },
    telemetry: {
      temperature: row.temperatura ?? 0,
      humidity: row.humedad ?? 0,
      co2: row.co2 ?? 0,
      pm25: row.pm25 ?? 0,
      windSpeed: 0,
      windDirection: 'N',
      mpu: parseMpuFromRow(row),
    },
    aiCamera: {
      state: 'idle',
      confidence: 0,
      streamActive: false,
      thermalHotspots: [],
      classification: 'NO THREAT',
    },
    battery: 0,
    signalStrength: online === 'online' ? 100 : 0,
    healthScore: 100,
    history: [],
    lastReadingAt: row.ultima_lectura_at ?? null,
    lastConnection: row.ultima_lectura_at
      ? formatTime(row.ultima_lectura_at)
      : row.ultima_conexion
        ? formatTime(row.ultima_conexion)
        : '—',
    falsePositiveActive: false,
    isSimulatingFire: false,
    fireSimStep: 0,
  }
}

function applyDetalleToNode(node: IoTNode, det: DbNodoDetalle) {
  ensureMpu(node)
  if (det.temperatura != null) node.telemetry.temperature = det.temperatura
  if (det.humedad != null) node.telemetry.humidity = det.humedad
  if (det.co2 != null) node.telemetry.co2 = det.co2
  if (det.pm25 != null) node.telemetry.pm25 = det.pm25
  if (det.acc_x != null) node.telemetry.mpu.accX = det.acc_x
  if (det.acc_y != null) node.telemetry.mpu.accY = det.acc_y
  if (det.acc_z != null) node.telemetry.mpu.accZ = det.acc_z
  if (det.gyro_x != null) node.telemetry.mpu.gyroX = det.gyro_x
  if (det.gyro_y != null) node.telemetry.mpu.gyroY = det.gyro_y
  if (det.gyro_z != null) node.telemetry.mpu.gyroZ = det.gyro_z

  node.sensorsHealth.temperature = sensorStatus(det.temperatura)
  node.sensorsHealth.humidity = sensorStatus(det.humedad)
  node.sensorsHealth.co2 = sensorStatus(det.co2)
  node.sensorsHealth.pm25 = sensorStatus(det.pm25)

  const online = isNodeOnline(node.lastReadingAt)
  node.techStatus = online ? 'online' : 'offline'
  node.signalStrength = online ? 100 : 0
  node.lastConnection = node.lastReadingAt
    ? formatTime(node.lastReadingAt)
    : det.ultima_conexion
      ? formatTime(det.ultima_conexion)
      : node.lastConnection

  if (det.vision_deteccion != null || det.vision_estado != null) {
    applyVisionToNode(node, {
      deteccion: det.vision_deteccion,
      confianza: det.vision_confianza,
      estado: det.vision_estado,
    })
    node.sensorsHealth.camera = 'OK'
  }
}

function applyVisionToNode(
  node: IoTNode,
  det: { deteccion: string | null; confianza: number | null; estado: number | null }
) {
  const stateVal = det.estado ?? 0
  node.aiCamera.state = stateVal === 2 ? 'alert' : stateVal === 1 ? 'processing' : 'idle'
  node.aiCamera.confidence = det.confianza ?? 0
  node.aiCamera.classification =
    det.deteccion === 'smoke' ? 'SMOKE DETECTED' : det.deteccion === 'fire' ? 'FIRE DETECTED' : 'NO THREAT'
  node.aiCamera.streamActive = stateVal > 0
}

export const useFireStore = defineStore('fireStore', {
  state: () => ({
    nodes: [] as IoTNode[],
    alerts: [] as Alert[],
    logs: [] as SystemLog[],
    selectedNodeId: null as string | null,
    globalWindAlert: false,
    initializing: false,
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
    
    averageTemperature(): number {
      const activeNodes = this.nodes.filter((n) => n.techStatus !== 'offline')
      if (activeNodes.length === 0) return 0
      const total = activeNodes.reduce((sum, n) => sum + n.telemetry.temperature, 0)
      return parseFloat((total / activeNodes.length).toFixed(1))
    },
    
    globalRiskScore(): number {
      // Calculates a global index (0-100) reflecting general Cusco network hazard levels
      if (this.nodes.length === 0) return 0
      let totalRiskWeight = 0
      this.nodes.forEach((n) => {
        if (n.techStatus === 'offline') return
        if (n.riskStatus === 'green') totalRiskWeight += 10
        if (n.riskStatus === 'yellow') totalRiskWeight += 35
        if (n.riskStatus === 'orange') totalRiskWeight += 65
        if (n.riskStatus === 'red') totalRiskWeight += 100
      })
      const averageBaseRisk = totalRiskWeight / this.nodes.length
      const windMultiplier = this.globalWindAlert ? 1.2 : 1.0
      return Math.min(100, Math.round(averageBaseRisk * windMultiplier))
    }
  },

  actions: {
    async initializeStore() {
      if (this.nodes.length > 0 || this.initializing) return
      this.initializing = true

      try {
        const [dashboard, resumen] = await Promise.all([
          fetchNodosDashboard(),
          fetchResumenGlobal(),
        ])
        this.resumen = resumen
        this.nodes = dashboard.map(mapDashboardToNode)
        this.nodes.forEach(ensureMpu)

        await Promise.all(this.nodes.map((node) => this.hydrateNode(node)))
        this.syncResumenCounts()
        await this.loadAlertsFromDb()
        await this.loadLogsFromDb()
      } catch (err) {
        console.error('Error connecting to Supabase:', err)
        this.nodes = []
      } finally {
        this.initializing = false
      }

      if (this.nodes.length > 0) {
        this.selectedNodeId = this.nodes[0]?.id ?? null
      }

      this.addLog('info', 'Sistema de Monitoreo Centralizado FireTame inicializado.')
      if (this.nodes.length > 0) {
        this.addLog('success', `Conectados ${this.nodes.length} nodos desde Supabase.`)
      } else {
        this.addLog('warning', 'No hay nodos registrados en la base de datos.')
      }

      this.subscribeRealtime()
      this.startConnectionWatcher()
    },

    startConnectionWatcher() {
      setInterval(() => {
        let changed = false
        for (const node of this.nodes) {
          const wasConnected = isNodeConnected(node)
          const nowConnected = node.techStatus !== 'offline' && isNodeOnline(node.lastReadingAt)
          if (wasConnected === nowConnected) continue
          node.techStatus = nowConnected ? 'online' : 'offline'
          node.signalStrength = nowConnected ? 100 : 0
          node.healthScore = this.calculateNodeHealth(node)
          changed = true
        }
        if (changed) this.syncResumenCounts()
      }, 30_000)
    },

    async refreshNode(nodeId: string) {
      let node = this.nodes.find((n) => n.id === nodeId)
      if (!node) {
        const detalle = await fetchNodoDetalle(nodeId)
        if (!detalle) return
        node = mapDashboardToNode({
          nodo_id: detalle.nodo_id,
          nombre: detalle.nombre,
          ubicacion: detalle.ubicacion,
          estado: detalle.estado,
          ultima_conexion: detalle.ultima_conexion,
          temperatura: detalle.temperatura,
          humedad: detalle.humedad,
          co2: detalle.co2,
          pm25: detalle.pm25,
          acc_x: detalle.acc_x,
          acc_y: detalle.acc_y,
          acc_z: detalle.acc_z,
          gyro_x: detalle.gyro_x,
          gyro_y: detalle.gyro_y,
          gyro_z: detalle.gyro_z,
        })
        this.nodes.push(node)
      }
      await this.hydrateNode(node)
      this.selectedNodeId = nodeId
    },

    async refreshFromServer() {
      this.nodes = []
      this.initializing = false
      await this.initializeStore()
    },

    async hydrateNode(node: IoTNode) {
      try {
        const [detalle, history] = await Promise.all([
          fetchNodoDetalle(node.id),
          fetchNodeHistory(node.id, 20),
        ])

        if (detalle) applyDetalleToNode(node, detalle)

        if (history.length > 0) {
          const lastEntry = history[history.length - 1]
          if (lastEntry) {
            node.lastReadingAt = lastEntry.created_at
            node.techStatus = isNodeOnline(lastEntry.created_at) ? 'online' : 'offline'
            node.signalStrength = node.techStatus === 'online' ? 100 : 0
          }

          node.history = history.map((entry) => ({
            timestamp: formatTime(entry.created_at),
            temperature: entry.temperatura ?? node.telemetry.temperature,
            humidity: entry.humedad ?? node.telemetry.humidity,
            co2: entry.co2 ?? node.telemetry.co2,
            pm25: entry.pm25 ?? node.telemetry.pm25,
          }))
        }

        this.evaluateNodeRisk(node)
        node.healthScore = this.calculateNodeHealth(node)
      } catch (e) {
        console.error(`Error hydrating node ${node.id}:`, e)
      }
    },

    syncResumenCounts() {
      this.resumen.total_nodos = this.nodes.length
      this.resumen.nodos_online = this.connectedNodesCount
      this.resumen.nodos_offline = this.offlineNodesCount
    },

    async refreshResumen() {
      try {
        this.resumen = await fetchResumenGlobal()
      } catch (e) {
        console.error('Error refreshing resumen:', e)
      }
    },

    async loadAlertsFromDb() {
      try {
        const alertas = await fetchAlertasActivas()
        this.alerts = alertas.map((a) => {
          const node = this.nodes.find((n) => n.id === a.nodo_id)
          return {
            id: `DB-${a.id}`,
            nodeId: a.nodo_id,
            nodeName: node?.name ?? 'Nodo desconocido',
            severity: (a.nivel as Alert['severity']) ?? 'medium',
            type: 'smoke' as const,
            message: a.mensaje ?? '',
            timestamp: formatTime(a.created_at),
            acknowledged: a.estado === 1,
          }
        })
      } catch (e) {
        console.error('Error loading alerts:', e)
      }
    },

    async loadLogsFromDb() {
      try {
        const eventos = await fetchEventosRecientes(50)
        this.logs = eventos.map((e) => ({
          id: `DB-${e.id}`,
          timestamp: formatTime(e.created_at),
          type: e.estado === 2 ? 'error' : e.estado === 1 ? 'warning' : 'info',
          message: e.mensaje ?? '',
        }))
      } catch (e) {
        console.error('Error loading eventos:', e)
      }
    },

    subscribeRealtime() {
      supabase.channel('db-changes')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'lecturas_sensores' },
          (payload: { new: Record<string, unknown> }) => {
            const nodoId = payload.new.nodo_id as string
            const node = this.nodes.find((n) => n.id === nodoId)
            if (!node) return

            ensureMpu(node)

            const val = payload.new.valor as number
            const sensorTypeId = payload.new.tipo_sensor_id as number
            const timeStr = formatTime(payload.new.created_at as string)
            const readingAt = payload.new.created_at as string

            if (sensorTypeId === SENSOR_TYPES.TEMPERATURA) {
              node.telemetry.temperature = val
            } else if (sensorTypeId === SENSOR_TYPES.HUMEDAD) {
              node.telemetry.humidity = val
            } else if (sensorTypeId === SENSOR_TYPES.CO2) {
              node.telemetry.co2 = val
            } else if (sensorTypeId === SENSOR_TYPES.PM25) {
              node.telemetry.pm25 = val
            } else if (
              sensorTypeId === SENSOR_TYPES.ACELEROMETRO_X ||
              sensorTypeId === SENSOR_TYPES.ACELEROMETRO_Y ||
              sensorTypeId === SENSOR_TYPES.ACELEROMETRO_Z ||
              sensorTypeId === SENSOR_TYPES.GIROSCOPIO_X ||
              sensorTypeId === SENSOR_TYPES.GIROSCOPIO_Y ||
              sensorTypeId === SENSOR_TYPES.GIROSCOPIO_Z
            ) {
              applyMpuReading(node, sensorTypeId, val)
            }

            node.history.push({
              timestamp: timeStr,
              temperature: node.telemetry.temperature,
              humidity: node.telemetry.humidity,
              co2: node.telemetry.co2,
              pm25: node.telemetry.pm25,
            })
            if (node.history.length > 20) node.history.shift()

            node.lastConnection = timeStr
            node.lastReadingAt = readingAt
            node.techStatus = 'online'
            node.signalStrength = 100
            this.evaluateNodeRisk(node)
            node.healthScore = this.calculateNodeHealth(node)
            this.syncResumenCounts()
            this.refreshResumen()
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'vision_ai' },
          (payload: { new: Record<string, unknown> }) => {
            const node = this.nodes.find(n => n.id === payload.new.nodo_id)
            if (!node) return

            applyVisionToNode(node, {
              deteccion: payload.new.deteccion as string | null,
              confianza: payload.new.confianza as number | null,
              estado: payload.new.estado as number | null,
            })

            this.evaluateNodeRisk(node)
            node.healthScore = this.calculateNodeHealth(node)

            const stateVal = payload.new.estado ?? 0
            this.addLog(
              stateVal === 2 ? 'error' : stateVal === 1 ? 'warning' : 'success',
              `[${node.name}] Visión IA: ${payload.new.deteccion === 'smoke' ? 'HUMO' : 'NORMAL'} (${payload.new.confianza}%)`
            )
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'eventos' },
          (payload: { new: Record<string, unknown> }) => {
            const type = payload.new.estado === 2 ? 'error' : payload.new.estado === 1 ? 'warning' : 'info'
            this.addLog(type as SystemLog['type'], payload.new.mensaje as string)
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'alertas' },
          (payload: { new: Record<string, unknown> }) => {
            const node = this.nodes.find(n => n.id === payload.new.nodo_id)
            this.alerts.unshift({
              id: `DB-${payload.new.id}`,
              nodeId: payload.new.nodo_id as string,
              nodeName: node?.name ?? 'Nodo desconocido',
              severity: (payload.new.nivel as Alert['severity']) ?? 'medium',
              type: 'smoke',
              message: payload.new.mensaje as string,
              timestamp: formatTime(payload.new.created_at as string),
              acknowledged: payload.new.estado === 1,
            })
          }
        )
        .subscribe()
    },

    evaluateNodeRisk(node: IoTNode) {
      if (node.techStatus === 'offline') {
        node.riskStatus = 'green' // Reset visual threat marker
        return
      }

      // Overrides risk status if AI Camera has real detections from Supabase
      if (node.aiCamera.state === 'alert') {
        if (node.riskStatus !== 'red') {
          node.riskStatus = 'red'
          node.aiCamera.streamActive = true
          node.aiCamera.thermalHotspots = [
            { x: 35, y: 40, r: 25 },
            { x: 60, y: 30, r: 35 },
            { x: 45, y: 65, r: 40 }
          ]
          this.triggerAlert(
            node.id,
            node.name,
            'critical',
            'fire',
            `🚨 ¡INCENDIO CONFIRMADO EN ${node.name.toUpperCase()}! La cámara con Visión Artificial reporta fuego/humo con confianza ${node.aiCamera.confidence}.`
          )
        }
        return
      }

      if (node.aiCamera.state === 'processing') {
        if (node.riskStatus !== 'orange') {
          node.riskStatus = 'orange'
          node.aiCamera.streamActive = true
          node.aiCamera.thermalHotspots = [{ x: 45, y: 50, r: 15 }]
          this.triggerAlert(
            node.id,
            node.name,
            'high',
            'smoke',
            `⚠️ Detección preliminar de humo en [${node.name}]. La cámara con Visión Artificial está analizando la escena.`
          )
        }
        return
      }

      const { temperature, humidity, co2, pm25 } = node.telemetry

      // 1. GREEN (NORMAL) STATE
      if (co2 < 430 && temperature < 31 && humidity > 40 && pm25 < 25) {
        // Smooth return to idle if danger cleared
        if (node.riskStatus !== 'green') {
          node.riskStatus = 'green'
          node.aiCamera.state = 'idle'
          node.aiCamera.confidence = 0
          node.aiCamera.streamActive = false
          node.aiCamera.thermalHotspots = []
          node.aiCamera.classification = 'NO THREAT'
          this.addLog('success', `El nodo [${node.name}] ha regresado a estado NORMAL (Verde). Humo/calor dispersados.`)
        }
        return
      }

      // 2. FALSE POSITIVE OVERRIDE
      if (node.falsePositiveActive) {
        // High CO2/PM2.5 but normal Temperature & Humidity, with AI confirming negative scan
        node.riskStatus = 'orange' // Keeps it orange/preventative warning
        node.aiCamera.state = 'processing'
        node.aiCamera.streamActive = true
        node.aiCamera.confidence = 2.4 // Exceedingly low fire signature
        node.aiCamera.classification = 'FALSE ALARM: CROPS SMOKE'
        node.aiCamera.thermalHotspots = [{ x: 50, y: 55, r: 8 }] // small localized point, no growing wildfire
        return
      }

      // 3. RED (FIRE CONFIRMED) STATE
      // Requires multiple critical environmental readings and high AI classification confidence
      const criticalCO2 = co2 >= 850
      const criticalTemp = temperature >= 50
      const criticalHum = humidity <= 25
      const criticalPM = pm25 >= 120

      if (criticalCO2 && (criticalTemp || criticalHum) && (criticalPM || node.isSimulatingFire)) {
        if (node.riskStatus !== 'red') {
          node.riskStatus = 'red'
          node.aiCamera.state = 'alert'
          node.aiCamera.streamActive = true
          node.aiCamera.confidence = parseFloat((95 + Math.random() * 4.9).toFixed(1))
          node.aiCamera.classification = 'CRITICAL WILDFIRE DETECTED'
          node.aiCamera.thermalHotspots = [
            { x: 35, y: 40, r: 25 },
            { x: 60, y: 30, r: 35 },
            { x: 45, y: 65, r: 40 }
          ]
          
          this.triggerAlert(
            node.id,
            node.name,
            'critical',
            'fire',
            `🚨 ¡INCENDIO CONFIRMADO EN ${node.name.toUpperCase()}! Múltiples sensores críticos e Inteligencia Artificial reportan 98% de confianza. Se sugiere despacho de brigadas.`
          )
        }
        return
      }

      // 4. ORANGE (POSSIBLE FIRE / PREVENTATIVE PROTOCOLS) STATE
      // Humidity drops, CO2 rises moderately, PM2.5 rises, temperature increases slightly
      const warningCO2 = co2 >= 550
      const warningTemp = temperature >= 36
      const warningHum = humidity <= 35
      const warningPM = pm25 >= 45

      if (warningCO2 || (warningTemp && warningHum) || warningPM) {
        if (node.riskStatus !== 'orange') {
          node.riskStatus = 'orange'
          node.aiCamera.state = 'processing'
          node.aiCamera.streamActive = true
          node.aiCamera.confidence = parseFloat((40 + Math.random() * 25).toFixed(1))
          node.aiCamera.classification = 'CLASSIFYING ANOMALOUS HEAT'
          node.aiCamera.thermalHotspots = [{ x: 45, y: 50, r: 15 }]
          
          this.triggerAlert(
            node.id,
            node.name,
            'high',
            'smoke',
            `⚠️ Anomalía detectada en [${node.name}]: CO2 a ${co2}ppm, Temp a ${temperature}°C. Se activa protocolo preventivo y cámara de IA para análisis térmico.`
          )
        } else {
          // If already orange, adjust thermal hotspots/confidence dynamically
          node.aiCamera.confidence = parseFloat(Math.min(84.9, node.aiCamera.confidence + (Math.random() * 4 - 1.8)).toFixed(1))
        }
        return
      }

      // 5. YELLOW (OBSERVATION STATE)
      // Small sensor deviations detected
      const mildCO2 = co2 >= 440
      const mildTemp = temperature >= 30
      const mildHum = humidity <= 42

      if (mildCO2 || mildTemp || mildHum) {
        if (node.riskStatus !== 'yellow') {
          node.riskStatus = 'yellow'
          node.aiCamera.state = 'processing'
          node.aiCamera.streamActive = true
          node.aiCamera.confidence = parseFloat((12 + Math.random() * 15).toFixed(1))
          node.aiCamera.classification = 'SCANNING FOR AIR DEVIATION'
          node.aiCamera.thermalHotspots = []
          
          this.triggerAlert(
            node.id,
            node.name,
            'medium',
            'smoke',
            `🔍 Vigilancia Reforzada en [${node.name}]: Ligeras desviaciones en la calidad del aire detectadas (CO2: ${co2}ppm, Temp: ${temperature}°C).`
          )
        }
      }
    },

    calculateNodeHealth(node: IoTNode): number {
      if (!isNodeConnected(node) && node.techStatus === 'offline') return 0
      if (!isNodeOnline(node.lastReadingAt)) return 20

      let score = 100

      let sensorErrCount = 0
      Object.keys(node.sensorsHealth).forEach((key) => {
        if (node.sensorsHealth[key as keyof SensorHealth] === 'ERR') {
          score -= 15
          sensorErrCount++
        }
      })

      if (sensorErrCount > 0) {
        node.techStatus = 'sensor_error'
      } else if (node.techStatus !== 'offline') {
        node.techStatus = 'online'
      }

      return Math.max(0, score)
    },

    // Dynamic Simulation Trigger Functions
    triggerSmokeSimulation(nodeId: string) {
      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node) return
      this.restoreNodeHardward(node)

      node.telemetry.co2 = 620
      node.telemetry.pm25 = 85
      node.telemetry.temperature = 31.5
      node.telemetry.humidity = 38.0
      
      this.addLog('warning', `Simulación de HUMO / MONÓXIDO inyectada manualmente en el nodo [${node.name}].`)
    },

    triggerFireSimulation(nodeId: string) {
      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node) return
      this.restoreNodeHardward(node)

      node.isSimulatingFire = true
      node.fireSimStep = 1
      this.handleFireSimulationStep(node)
      this.startSimulationTick()

      this.addLog('error', `Simulación de incendio iniciada en [${node.name}].`)
    },

    startSimulationTick() {
      if ((this as { _simTick?: ReturnType<typeof setInterval> })._simTick) return

      ;(this as { _simTick?: ReturnType<typeof setInterval> })._simTick = setInterval(() => {
        let active = false
        for (const node of this.nodes) {
          if (node.isSimulatingFire) {
            active = true
            this.handleFireSimulationStep(node)
            this.evaluateNodeRisk(node)
            node.healthScore = this.calculateNodeHealth(node)
          }
        }
        if (!active) {
          const tick = (this as { _simTick?: ReturnType<typeof setInterval> })._simTick
          if (tick) clearInterval(tick)
          ;(this as { _simTick?: ReturnType<typeof setInterval> })._simTick = undefined
        }
      }, 3000)
    },

    handleFireSimulationStep(node: IoTNode) {
      if (node.fireSimStep === 1) {
        // Step 1: Smoke/CO2 spikes, temperature rises slightly, humidity drops, system changes to yellow/orange
        node.telemetry.co2 = 580
        node.telemetry.pm25 = 75
        node.telemetry.temperature = 33.2
        node.telemetry.humidity = 36.4
        node.fireSimStep = 2
        this.addLog('info', `[Fase 1: Sensor de Gas] El nodo [${node.name}] registra aumento drástico de CO2 y PM2.5. IA térmica activada.`)
      } else if (node.fireSimStep === 2) {
        // Step 2: System advances to orange. Humidity drops further, CO2 reaches warning limits, AI detects heat signature
        node.telemetry.co2 = 820
        node.telemetry.pm25 = 145
        node.telemetry.temperature = 46.8
        node.telemetry.humidity = 24.5
        node.fireSimStep = 3
        this.addLog('warning', `[Fase 2: Protocolo Preventivo] Nodo [${node.name}] en estado Naranja. IA inicia análisis termográfico con confianza moderada.`)
      } else if (node.fireSimStep === 3) {
        // Step 3: Extreme environmental metrics. Full fire confirmed. Red state.
        node.telemetry.co2 = 1250
        node.telemetry.pm25 = 260
        node.telemetry.temperature = 72.4
        node.telemetry.humidity = 11.2
        node.fireSimStep = 4 // Simulation reaches peak
        this.addLog('error', `[Fase 3: Confirmación IA] El modelo neural de [${node.name}] valida anomalía en píxeles. INCENDIO forestal activo confirmado.`)
      } else {
        // Maintain extreme fire state with small high fluctuations
        node.telemetry.temperature = parseFloat(Math.min(95, node.telemetry.temperature + (Math.random() * 4 - 2)).toFixed(1))
        node.telemetry.humidity = parseFloat(Math.max(4, node.telemetry.humidity + (Math.random() * 1.5 - 0.75)).toFixed(1))
        node.telemetry.co2 = Math.round(node.telemetry.co2 + (Math.random() * 20 - 10))
        node.telemetry.pm25 = Math.round(node.telemetry.pm25 + (Math.random() * 10 - 5))
      }
    },

    triggerFalsePositiveSimulation(nodeId: string) {
      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node) return
      this.restoreNodeHardward(node)

      node.falsePositiveActive = true
      node.telemetry.co2 = 790
      node.telemetry.pm25 = 95
      // Normal temperature & humidity kept
      node.telemetry.temperature = 18.5
      node.telemetry.humidity = 58.0
      
      this.triggerAlert(
        node.id,
        node.name,
        'low',
        'false_positive',
        `ℹ️ [FALSO POSITIVO] Anomalía química de CO2 en [${node.name}] resuelta por IA. Clasificado como: Actividad Agrícola Autorizada.`
      )
      this.addLog('success', `Simulación de FALSO POSITIVO (Quema agrícola controlada) inyectada en [${node.name}]. IA filtró la alarma con éxito.`)
    },

    triggerSensorFreezeSimulation(nodeId: string) {
      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node) return
      this.restoreNodeHardward(node)

      // Freeze temperature reading to extremely incorrect value
      node.sensorsHealth.temperature = 'ERR'
      node.telemetry.temperature = 999.9 // Frozen critical erroneous read
      node.techStatus = 'sensor_error'
      
      this.triggerAlert(
        node.id,
        node.name,
        'medium',
        'hardware',
        `🔧 Falla técnica en [${node.name}]: Sensor de Temperatura enviando valores corruptos (999.9°C). Requiere servicio.`
      )
      this.addLog('error', `Simulación de FALLA SENSOR inyectada en [${node.name}]. Sensor de Temperatura marcado como defectuoso.`)
    },

    triggerOfflineSimulation(nodeId: string) {
      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node) return
      this.restoreNodeHardward(node)

      node.techStatus = 'offline'
      node.signalStrength = 0
      node.battery = 0
      node.aiCamera.streamActive = false
      node.aiCamera.state = 'error'
      
      this.triggerAlert(
        node.id,
        node.name,
        'high',
        'offline',
        `📶 CONEXIÓN PERDIDA: El dispositivo IoT [${node.name}] se encuentra fuera de línea. Falla de comunicación inalámbrica.`
      )
      this.addLog('error', `Simulación NODO OFFLINE inyectada en [${node.name}]. Enlace satelital de telemetría cortado.`)
    },

    triggerLowBatterySimulation(nodeId: string) {
      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node) return
      this.restoreNodeHardward(node)

      node.battery = 4 // 4% remaining solar charge
      node.techStatus = 'low_battery'
      
      this.triggerAlert(
        node.id,
        node.name,
        'medium',
        'hardware',
        `🔋 BATERÍA CRÍTICA en [${node.name}]: 4% de carga solar restante. Entrando en modo de ahorro de energía pasivo.`
      )
      this.addLog('warning', `Simulación BATERÍA CRÍTICA inyectada en [${node.name}].`)
    },

    triggerGlobalWindSimulation() {
      this.globalWindAlert = !this.globalWindAlert
      
      this.nodes.forEach((node) => {
        if (node.techStatus === 'offline') return
        if (this.globalWindAlert) {
          node.telemetry.windSpeed = parseFloat((55 + Math.random() * 20).toFixed(1))
          node.telemetry.windDirection = 'WNW'
        } else {
          node.telemetry.windSpeed = parseFloat((8 + Math.random() * 10).toFixed(1))
        }
      })

      if (this.globalWindAlert) {
        this.addLog('warning', `💨 Alerta de VIENTOS FUERTES (Vaguada Andina) activa en Cusco. Velocidad promedio superior a 60 km/h. Riesgo de propagación elevado.`)
      } else {
        this.addLog('info', `💨 Vientos fuertes disipados. Condiciones atmosféricas normales restablecidas.`)
      }
    },

    async restoreNodeNormalState(nodeId: string) {
      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node) return

      node.isSimulatingFire = false
      node.fireSimStep = 0
      node.falsePositiveActive = false

      await this.hydrateNode(node)

      this.alerts.forEach((alert) => {
        if (alert.nodeId === nodeId) alert.acknowledged = true
      })

      this.addLog('success', `Nodo [${node.name}] restablecido con datos reales de Supabase.`)
    },

    restoreAllNodesNormal() {
      this.nodes.forEach((node) => {
        this.restoreNodeNormalState(node.id)
      })
      this.globalWindAlert = false
      this.alerts.forEach((a) => a.acknowledged = true)
      this.addLog('success', `🧹 COMANDO MAESTRO ejecutado: Toda la red IoT ha sido restablecida y las alertas archivadas.`)
    },

    restoreNodeHardward(node: IoTNode) {
      // Re-enable sensors operational status
      node.sensorsHealth.temperature = 'OK'
      node.sensorsHealth.humidity = 'OK'
      node.sensorsHealth.co2 = 'OK'
      node.sensorsHealth.pm25 = 'OK'
      node.sensorsHealth.camera = 'OK'
      node.techStatus = 'online'
      node.battery = Math.round(85 + Math.random() * 15)
      node.signalStrength = Math.round(75 + Math.random() * 20)
    },

    // Administrative Actions
    async addCustomNode(name: string, lat: number, lng: number, installedSensors: string[]) {
      const id = `nodo_${Date.now().toString(36)}`

      const sensorsHealthObj: SensorHealth = {
        temperature: installedSensors.includes('temperature') ? 'OK' : 'ERR',
        humidity: installedSensors.includes('humidity') ? 'OK' : 'ERR',
        co2: installedSensors.includes('co2') ? 'OK' : 'ERR',
        pm25: installedSensors.includes('pm25') ? 'OK' : 'ERR',
        camera: installedSensors.includes('camera') ? 'OK' : 'ERR',
      }

      try {
        await createNodo({
          id,
          nombre: name,
          ubicacion: `${lat},${lng}`,
        })
      } catch (e) {
        console.error('Error creating node in Supabase:', e)
        this.addLog('error', `Error al registrar nodo [${name}] en Supabase.`)
        return
      }

      const node: IoTNode = {
        id,
        name,
        lat,
        lng,
        riskStatus: 'green',
        techStatus: 'online',
        sensorsHealth: sensorsHealthObj,
        telemetry: {
          temperature: 0,
          humidity: 0,
          co2: 0,
          pm25: 0,
          windSpeed: 0,
          windDirection: 'N',
          mpu: EMPTY_MPU,
        },
        aiCamera: {
          state: 'idle',
          confidence: 0,
          streamActive: false,
          thermalHotspots: [],
          classification: 'NO THREAT',
        },
        battery: 0,
        signalStrength: 100,
        healthScore: 100,
        history: [],
        lastReadingAt: null,
        lastConnection: formatTime(new Date().toISOString()),
        falsePositiveActive: false,
        isSimulatingFire: false,
        fireSimStep: 0,
      }

      node.healthScore = this.calculateNodeHealth(node)
      this.nodes.push(node)
      this.selectedNodeId = node.id

      this.addLog('success', `Nodo [${name}] registrado en Supabase con ID [${id}].`)
    },

    async toggleNodeActive(nodeId: string) {
      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node) return

      const newEstado = node.techStatus === 'offline' ? 1 : 0

      try {
        await updateNodoEstado(nodeId, newEstado)
      } catch (e) {
        console.error('Error updating node estado:', e)
        return
      }

      if (newEstado === 1) {
        this.restoreNodeHardward(node)
        this.addLog('success', `Nodo [${node.name}] activado.`)
      } else {
        node.techStatus = 'offline'
        node.signalStrength = 0
        node.aiCamera.streamActive = false
        node.aiCamera.state = 'error'
        this.addLog('warning', `Nodo [${node.name}] desactivado.`)
      }
    },

    async deleteNode(nodeId: string) {
      const index = this.nodes.findIndex((n) => n.id === nodeId)
      if (index === -1) return

      const nodeName = this.nodes[index]?.name ?? ''

      try {
        await deleteNodoDb(nodeId)
      } catch (e) {
        console.error('Error deleting node:', e)
        this.addLog('error', `Error al eliminar nodo [${nodeName}] de Supabase.`)
        return
      }

      this.nodes.splice(index, 1)

      if (this.selectedNodeId === nodeId) {
        this.selectedNodeId = this.nodes.length > 0 ? (this.nodes[0]?.id ?? null) : null
      }

      this.addLog('error', `Nodo [${nodeName}] eliminado de la red.`)
    },

    // Alerts Management
    triggerAlert(
      nodeId: string,
      nodeName: string,
      severity: Alert['severity'],
      type: Alert['type'],
      message: string
    ) {
      // Check if duplicate alert is active and unacknowledged
      const isDuplicate = this.alerts.some(
        (a) => a.nodeId === nodeId && a.type === type && !a.acknowledged
      )
      if (isDuplicate) return

      const newAlert: Alert = {
        id: `AL-${Math.floor(1000 + Math.random() * 8999)}`,
        nodeId,
        nodeName,
        severity,
        type,
        message,
        timestamp: formatTime(new Date().toISOString()),
        acknowledged: false
      }

      this.alerts.unshift(newAlert)
      
      // Also write to general log
      const logType = severity === 'critical' || severity === 'high' ? 'error' : 'warning'
      this.addLog(logType, message)
    },

    acknowledgeAlert(alertId: string) {
      const alert = this.alerts.find((a) => a.id === alertId)
      if (alert) {
        alert.acknowledged = true
        this.addLog('success', `Alarma [${alert.id}] de [${alert.nodeName}] ha sido acusada (ACK) por el operador.`)
      }
    },

    acknowledgeAllAlerts() {
      this.alerts.forEach((alert) => {
        alert.acknowledged = true
      })
      this.addLog('success', `Se han acusado (ACK) todas las alertas activas en cola.`)
    },

    // Log Utility
    addLog(type: SystemLog['type'], message: string) {
      const newLog: SystemLog = {
        id: `LOG-${Math.floor(10000 + Math.random() * 89999)}`,
        timestamp: formatTime(new Date().toISOString()),
        type,
        message
      }
      this.logs.unshift(newLog)
      // Keep log buffer to a solid 100 entries
      if (this.logs.length > 100) {
        this.logs.pop()
      }
    }
  }
})
