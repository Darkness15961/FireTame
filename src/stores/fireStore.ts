import { defineStore } from 'pinia'
import { supabase } from '@/supabase'


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

const WIND_DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

export const useFireStore = defineStore('fireStore', {
  state: () => ({
    nodes: [] as IoTNode[],
    alerts: [] as Alert[],
    logs: [] as SystemLog[],
    selectedNodeId: null as string | null,
    globalWindAlert: false, // Simulates strong wind across Cusco
    initializing: false,
    simulationInterval: null as any | null,
  }),

  getters: {
    selectedNode: (state) => state.nodes.find((n) => n.id === state.selectedNodeId) || null,
    
    activeFiresCount(): number {
      return this.nodes.filter((n) => n.riskStatus === 'red').length
    },
    
    connectedNodesCount(): number {
      return this.nodes.filter((n) => n.techStatus !== 'offline').length
    },
    
    offlineNodesCount(): number {
      return this.nodes.filter((n) => n.techStatus === 'offline').length
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
      // Prevent double init concurrency race conditions
      if (this.nodes.length > 0 || this.initializing) return
      this.initializing = true

      try {
        // Try fetching registered nodes from Supabase
        const { data: nodesData, error } = await supabase.from('nodos').select('*')
        
        if (error) {
          console.error('Error fetching nodes from Supabase:', error)
          this.loadMockNodes()
        } else if (nodesData && nodesData.length > 0) {
          this.nodes = nodesData.map((dbNode) => {
            // Parse ubicacion "lat,lng"
            const [latStr, lngStr] = (dbNode.ubicacion || '').split(',')
            const lat = parseFloat(latStr) || -13.5
            const lng = parseFloat(lngStr) || -71.9
            
            const baseTemp = 16 + Math.random() * 6
            const baseHum = 50 + Math.random() * 12
            
            return {
              id: dbNode.id,
              name: dbNode.nombre,
              lat,
              lng,
              riskStatus: 'green',
              techStatus: dbNode.estado === 1 ? 'online' : 'offline',
              sensorsHealth: {
                temperature: 'OK',
                humidity: 'OK',
                co2: 'OK',
                pm25: 'OK',
                camera: 'OK'
              },
              telemetry: {
                temperature: parseFloat(baseTemp.toFixed(1)),
                humidity: parseFloat(baseHum.toFixed(1)),
                co2: 400,
                pm25: 10,
                windSpeed: 8 + Math.random() * 8,
                windDirection: WIND_DIRECTIONS[Math.floor(Math.random() * WIND_DIRECTIONS.length)] || 'N'
              },
              aiCamera: {
                state: 'idle',
                confidence: 0,
                streamActive: false,
                thermalHotspots: [],
                classification: 'NO THREAT'
              },
              battery: 100,
              signalStrength: 100,
              healthScore: 100,
              history: [],
              lastConnection: dbNode.ultima_conexion ? new Date(dbNode.ultima_conexion).toLocaleTimeString() : new Date().toLocaleTimeString(),
              falsePositiveActive: false,
              isSimulatingFire: false,
              fireSimStep: 0
            }
          })
          
          // Seed the history buffer for the loaded nodes initially
          this.nodes.forEach((node) => {
            const now = new Date()
            for (let i = 19; i >= 0; i--) {
              const entryTime = new Date(now.getTime() - i * 60000)
              node.history.push({
                timestamp: entryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                temperature: parseFloat((node.telemetry.temperature + (Math.random() * 2 - 1)).toFixed(1)),
                humidity: parseFloat((node.telemetry.humidity + (Math.random() * 4 - 2)).toFixed(1)),
                co2: Math.round(node.telemetry.co2 + (Math.random() * 10 - 5)),
                pm25: Math.round(node.telemetry.pm25 + (Math.random() * 4 - 2))
              })
            }
            node.healthScore = this.calculateNodeHealth(node)
          })

          // Hydrate node metrics with latest records from database
          await this.loadInitialReadings()
        } else {
          // Empty table fallback
          this.loadMockNodes()
        }
      } catch (err) {
        console.error('Error connecting to Supabase, falling back to simulator:', err)
        this.loadMockNodes()
      }

      finally {
        this.initializing = false
      }

      // Select first node as active selected node by default
      if (this.nodes.length > 0) {
        this.selectedNodeId = this.nodes[0]?.id || null
      }

      this.addLog('info', 'Sistema de Monitoreo Centralizado FireTame inicializado.')
      this.addLog('success', `Se han desplegado y conectado ${this.nodes.length} nodos de monitoreo en Cusco.`)

      // Start Realtime subscriptions
      this.subscribeRealtime()

      // Spawn periodic simulator clock (every 3 seconds)
      this.startSimulator()
    },

    loadMockNodes() {
      const initialNodesData = [
        { id: 'MP-01', name: 'Machu Picchu (Santuario)', lat: -13.1631, lng: -72.5450 },
        { id: 'SH-02', name: 'Sacsayhuamán (Fortaleza)', lat: -13.5079, lng: -71.9820 },
        { id: 'OT-03', name: 'Ollantaytambo (Parque)', lat: -13.2584, lng: -72.2634 },
        { id: 'PS-04', name: 'Písac (Complejo Histórico)', lat: -13.4219, lng: -71.8504 },
        { id: 'CQ-05', name: 'Choquequirao (Cuna del Sol)', lat: -13.3917, lng: -72.8732 },
        { id: 'UR-06', name: 'Urubamba (Valle Forestal)', lat: -13.3039, lng: -72.1158 },
        { id: 'CL-07', name: 'Calca (Bosque Alto)', lat: -13.3198, lng: -71.9525 },
        { id: 'CH-08', name: 'Chinchero (Meseta Andina)', lat: -13.3913, lng: -72.0494 }
      ]

      this.nodes = initialNodesData.map((data) => {
        const baseTemp = 16 + Math.random() * 6
        const baseHum = 50 + Math.random() * 12
        const baseCO2 = 380 + Math.random() * 15
        const basePM25 = 8 + Math.random() * 5
        const baseWind = 8 + Math.random() * 8
        const baseWindDir = WIND_DIRECTIONS[Math.floor(Math.random() * WIND_DIRECTIONS.length)] || 'N'

        const node: IoTNode = {
          id: data.id,
          name: data.name,
          lat: data.lat,
          lng: data.lng,
          riskStatus: 'green',
          techStatus: 'online',
          sensorsHealth: {
            temperature: 'OK',
            humidity: 'OK',
            co2: 'OK',
            pm25: 'OK',
            camera: 'OK'
          },
          telemetry: {
            temperature: parseFloat(baseTemp.toFixed(1)),
            humidity: parseFloat(baseHum.toFixed(1)),
            co2: Math.round(baseCO2),
            pm25: Math.round(basePM25),
            windSpeed: parseFloat(baseWind.toFixed(1)),
            windDirection: baseWindDir
          },
          aiCamera: {
            state: 'idle',
            confidence: 0,
            streamActive: false,
            thermalHotspots: [],
            classification: 'NO THREAT'
          },
          battery: Math.round(85 + Math.random() * 15),
          signalStrength: Math.round(75 + Math.random() * 20),
          healthScore: 100,
          history: [],
          lastConnection: new Date().toLocaleTimeString(),
          falsePositiveActive: false,
          isSimulatingFire: false,
          fireSimStep: 0
        }

        const now = new Date()
        for (let i = 19; i >= 0; i--) {
          const entryTime = new Date(now.getTime() - i * 60000)
          node.history.push({
            timestamp: entryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            temperature: parseFloat((node.telemetry.temperature + (Math.random() * 2 - 1)).toFixed(1)),
            humidity: parseFloat((node.telemetry.humidity + (Math.random() * 4 - 2)).toFixed(1)),
            co2: Math.round(node.telemetry.co2 + (Math.random() * 10 - 5)),
            pm25: Math.round(node.telemetry.pm25 + (Math.random() * 4 - 2))
          })
        }
        
        node.healthScore = this.calculateNodeHealth(node)
        return node
      })
    },

    async loadInitialReadings() {
      for (const node of this.nodes) {
        try {
          // Fetch last 20 temperature readings
          const { data: tempReadings } = await supabase
            .from('lecturas_sensores')
            .select('valor, created_at')
            .eq('nodo_id', node.id)
            .eq('tipo_sensor_id', 1)
            .order('created_at', { ascending: false })
            .limit(20)

          // Fetch last 20 humidity readings
          const { data: humReadings } = await supabase
            .from('lecturas_sensores')
            .select('valor, created_at')
            .eq('nodo_id', node.id)
            .eq('tipo_sensor_id', 2)
            .order('created_at', { ascending: false })
            .limit(20)

          if (tempReadings && tempReadings.length > 0 && tempReadings[0]) {
            node.telemetry.temperature = tempReadings[0].valor
          }
          if (humReadings && humReadings.length > 0 && humReadings[0]) {
            node.telemetry.humidity = humReadings[0].valor
          }

          // Hydrate history
          const historyLength = Math.max(tempReadings?.length || 0, humReadings?.length || 0)
          if (historyLength > 0) {
            const newHistory: NodeHistoryEntry[] = []
            for (let i = historyLength - 1; i >= 0; i--) {
              const tempEntry = tempReadings?.[i]
              const humEntry = humReadings?.[i]
              const timeStr = tempEntry 
                ? new Date(tempEntry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : (humEntry ? new Date(humEntry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '')
              
              newHistory.push({
                timestamp: timeStr,
                temperature: tempEntry ? tempEntry.valor : node.telemetry.temperature,
                humidity: humEntry ? humEntry.valor : node.telemetry.humidity,
                co2: node.telemetry.co2,
                pm25: node.telemetry.pm25
              })
            }
            node.history = newHistory
          }

          // Fetch last vision_ai status
          const { data: visionData } = await supabase
            .from('vision_ai')
            .select('deteccion, confianza, estado, created_at')
            .eq('nodo_id', node.id)
            .order('created_at', { ascending: false })
            .limit(1)

          if (visionData && visionData.length > 0 && visionData[0]) {
            const det = visionData[0]
            const stateVal = det.estado || 0
            node.aiCamera.state = stateVal === 2 ? 'alert' : (stateVal === 1 ? 'processing' : 'idle')
            node.aiCamera.confidence = det.confianza || 0
            node.aiCamera.classification = det.deteccion === 'smoke' ? 'SMOKE DETECTED' : 'NO THREAT'
            node.aiCamera.streamActive = stateVal > 0
          }

          node.healthScore = this.calculateNodeHealth(node)
          this.evaluateNodeRisk(node)
        } catch (e) {
          console.error(`Error loading initial readings for node ${node.id}:`, e)
        }
      }
    },

    subscribeRealtime() {
      // Subscribe to all changes in a single channel
      supabase.channel('db-changes')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'lecturas_sensores' },
          (payload) => {
            const node = this.nodes.find(n => n.id === payload.new.nodo_id)
            if (node) {
              const val = payload.new.valor
              const sensorTypeId = payload.new.tipo_sensor_id
              const timeStr = new Date(payload.new.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

              if (sensorTypeId === 1) {
                node.telemetry.temperature = val
              } else if (sensorTypeId === 2) {
                node.telemetry.humidity = val
              } else if (sensorTypeId === 8) {
                this.addLog('info', `[${node.name}] MPU6050 Aceleración X recibida: ${val}`)
              }

              // Append history entry
              node.history.push({
                timestamp: timeStr,
                temperature: node.telemetry.temperature,
                humidity: node.telemetry.humidity,
                co2: node.telemetry.co2,
                pm25: node.telemetry.pm25
              })
              if (node.history.length > 20) {
                node.history.shift()
              }

              node.lastConnection = timeStr
              this.evaluateNodeRisk(node)
              node.healthScore = this.calculateNodeHealth(node)
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'vision_ai' },
          (payload) => {
            const node = this.nodes.find(n => n.id === payload.new.nodo_id)
            if (node) {
              const stateVal = payload.new.estado || 0
              node.aiCamera.state = stateVal === 2 ? 'alert' : (stateVal === 1 ? 'processing' : 'idle')
              node.aiCamera.confidence = payload.new.confianza || 0
              node.aiCamera.classification = payload.new.deteccion === 'smoke' ? 'SMOKE DETECTED' : 'NO THREAT'
              node.aiCamera.streamActive = stateVal > 0

              this.evaluateNodeRisk(node)
              node.healthScore = this.calculateNodeHealth(node)

              this.addLog(
                stateVal === 2 ? 'error' : (stateVal === 1 ? 'warning' : 'success'),
                `[${node.name}] Visión IA reporta: ${payload.new.deteccion === 'smoke' ? 'HUMO' : 'NORMAL'} con confianza de ${payload.new.confianza}`
              )
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'eventos' },
          (payload) => {
            const type = payload.new.estado === 2 ? 'error' : (payload.new.estado === 1 ? 'warning' : 'info')
            this.addLog(type as any, payload.new.mensaje)
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'alertas' },
          (payload) => {
            const node = this.nodes.find(n => n.id === payload.new.nodo_id)
            this.alerts.unshift({
              id: `DB-${payload.new.id}`,
              nodeId: payload.new.nodo_id,
              nodeName: node ? node.name : 'Nodo desconocido',
              severity: payload.new.nivel || 'medium',
              type: 'smoke',
              message: payload.new.mensaje,
              timestamp: new Date(payload.new.created_at).toLocaleTimeString(),
              acknowledged: payload.new.estado === 1
            })
          }
        )
        .subscribe()
    },


    startSimulator() {
      if (this.simulationInterval) clearInterval(this.simulationInterval)

      this.simulationInterval = setInterval(() => {
        this.nodes.forEach((node) => {
          // Skip telemetry updates if offline
          if (node.techStatus === 'offline') {
            node.healthScore = 0
            return
          }

          // Step-by-step custom fire simulations
          if (node.isSimulatingFire) {
            this.handleFireSimulationStep(node)
          } else {
            // Apply slight telemetry fluctuations (jitter) to make the metrics look real-time
            this.applySensorFluctuations(node)
          }

          // Evaluate risk level & trigger states programmatically
          this.evaluateNodeRisk(node)

          // Calculate node general technical health
          node.healthScore = this.calculateNodeHealth(node)

          // Record latest historical reading log for charts
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          node.history.push({
            timestamp: timeStr,
            temperature: node.telemetry.temperature,
            humidity: node.telemetry.humidity,
            co2: node.telemetry.co2,
            pm25: node.telemetry.pm25
          })

          // Maintain historical buffer size of 20
          if (node.history.length > 20) {
            node.history.shift()
          }

          node.lastConnection = timeStr
        })
      }, 3000)
    },

    applySensorFluctuations(node: IoTNode) {
      // Skips fluctuations if technical freeze
      if (node.techStatus === 'sensor_error') {
        // Simulates sensor frozen reading (no fluctuation)
        return
      }

      if (node.id === 'nodo_01B') {
        // For physical node, only apply slight fluctuations to missing metrics
        // (CO2 and PM2.5, which are not currently reported by the physical hardware)
        const co2Fluct = Math.round(Math.random() * 4 - 2)
        const pmFluct = Math.round(Math.random() * 2 - 1)
        
        if (node.sensorsHealth.co2 === 'OK') {
          node.telemetry.co2 = Math.round(Math.max(380, Math.min(450, node.telemetry.co2 + co2Fluct)))
        }
        if (node.sensorsHealth.pm25 === 'OK') {
          node.telemetry.pm25 = Math.round(Math.max(5, Math.min(20, node.telemetry.pm25 + pmFluct)))
        }
        
        // Slight changes to signal strength and battery
        node.signalStrength = Math.max(80, Math.min(100, node.signalStrength + Math.round(Math.random() * 2 - 1)))
        return
      }

      const tempFluct = (Math.random() * 0.4 - 0.2)
      const humFluct = (Math.random() * 0.8 - 0.4)
      const co2Fluct = Math.round(Math.random() * 4 - 2)
      const pmFluct = Math.round(Math.random() * 2 - 1)

      // Apply changes while preventing out-of-bounds metrics
      if (node.sensorsHealth.temperature === 'OK') {
        node.telemetry.temperature = parseFloat(Math.max(0, Math.min(85, node.telemetry.temperature + tempFluct)).toFixed(1))
      }
      if (node.sensorsHealth.humidity === 'OK') {
        node.telemetry.humidity = parseFloat(Math.max(0, Math.min(100, node.telemetry.humidity + humFluct)).toFixed(1))
      }
      if (node.sensorsHealth.co2 === 'OK') {
        node.telemetry.co2 = Math.round(Math.max(300, Math.min(2500, node.telemetry.co2 + co2Fluct)))
      }
      if (node.sensorsHealth.pm25 === 'OK') {
        node.telemetry.pm25 = Math.round(Math.max(0, Math.min(500, node.telemetry.pm25 + pmFluct)))
      }

      // Fluctuating Battery (discharges 1% over time, recharged by solar during check sometimes)
      const isRecharging = Math.random() > 0.4
      if (isRecharging && node.battery < 100) {
        node.battery = Math.min(100, node.battery + 1)
      } else if (!isRecharging && node.battery > 5) {
        node.battery = Math.max(0, node.battery - 1)
      }

      // Random signal fluctuations
      node.signalStrength = Math.max(10, Math.min(100, node.signalStrength + Math.round(Math.random() * 6 - 3)))
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
      if (node.techStatus === 'offline') return 0

      let score = 100

      // Connection penalty
      if (node.signalStrength < 30) {
        score -= 20
        node.techStatus = 'signal_weak'
      } else if (node.signalStrength < 50) {
        score -= 10
      }

      // Battery penalty
      if (node.battery <= 5) {
        score -= 50
        node.techStatus = 'low_battery'
      } else if (node.battery <= 20) {
        score -= 25
        node.techStatus = 'low_battery'
      }

      // Dead sensor penalties
      let sensorErrCount = 0
      Object.keys(node.sensorsHealth).forEach((key) => {
        if (node.sensorsHealth[key as keyof SensorHealth] === 'ERR') {
          score -= 15
          sensorErrCount++
        }
      })

      if (sensorErrCount > 0) {
        node.techStatus = 'sensor_error'
      } else if (node.battery > 20 && node.signalStrength >= 50) {
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

      this.addLog('error', `🚨 SIMULACIÓN DE INCENDIO forestal iniciada en el nodo [${node.name}]. Iniciando validación progresiva...`)
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

    restoreNodeNormalState(nodeId: string) {
      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node) return

      this.restoreNodeHardward(node)
      
      node.isSimulatingFire = false
      node.fireSimStep = 0
      node.falsePositiveActive = false

      // Gradually ease environmental metrics to safe values
      node.telemetry.temperature = parseFloat((17 + Math.random() * 5).toFixed(1))
      node.telemetry.humidity = parseFloat((52 + Math.random() * 6).toFixed(1))
      node.telemetry.co2 = Math.round(380 + Math.random() * 15)
      node.telemetry.pm25 = Math.round(8 + Math.random() * 4)
      if (this.globalWindAlert) {
        node.telemetry.windSpeed = parseFloat((55 + Math.random() * 15).toFixed(1))
      } else {
        node.telemetry.windSpeed = parseFloat((6 + Math.random() * 8).toFixed(1))
      }

      // Reset AI Camera
      node.aiCamera.state = 'idle'
      node.aiCamera.confidence = 0
      node.aiCamera.streamActive = false
      node.aiCamera.thermalHotspots = []
      node.aiCamera.classification = 'NO THREAT'

      // Force instant risk recheck
      this.evaluateNodeRisk(node)
      node.healthScore = this.calculateNodeHealth(node)

      // Automatically acknowledge alerts related to this node
      this.alerts.forEach((alert) => {
        if (alert.nodeId === nodeId) {
          alert.acknowledged = true
        }
      })

      this.addLog('success', `Nodo [${node.name}] restablecido por completo. Telemetría y hardware calibrados a estado basal.`)
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

    // Administrative Actions (Node management CRUD-like simulation)
    addCustomNode(name: string, lat: number, lng: number, installedSensors: string[]) {
      const id = `CN-${Math.floor(10 + Math.random() * 89)}`
      
      const baseTemp = 15 + Math.random() * 7
      const baseHum = 48 + Math.random() * 15
      const baseCO2 = 380 + Math.random() * 10
      const basePM25 = 7 + Math.random() * 6

      const sensorsHealthObj: SensorHealth = {
        temperature: installedSensors.includes('temperature') ? 'OK' : 'ERR',
        humidity: installedSensors.includes('humidity') ? 'OK' : 'ERR',
        co2: installedSensors.includes('co2') ? 'OK' : 'ERR',
        pm25: installedSensors.includes('pm25') ? 'OK' : 'ERR',
        camera: installedSensors.includes('camera') ? 'OK' : 'ERR'
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
          temperature: parseFloat(baseTemp.toFixed(1)),
          humidity: parseFloat(baseHum.toFixed(1)),
          co2: Math.round(baseCO2),
          pm25: Math.round(basePM25),
          windSpeed: parseFloat((5 + Math.random() * 10).toFixed(1)),
          windDirection: WIND_DIRECTIONS[Math.floor(Math.random() * WIND_DIRECTIONS.length)] || 'N'
        },
        aiCamera: {
          state: 'idle',
          confidence: 0,
          streamActive: false,
          thermalHotspots: [],
          classification: 'NO THREAT'
        },
        battery: 100,
        signalStrength: Math.round(80 + Math.random() * 20),
        healthScore: 100,
        history: [],
        lastConnection: new Date().toLocaleTimeString(),
        falsePositiveActive: false,
        isSimulatingFire: false,
        fireSimStep: 0
      }

      // Prehydrate history
      const now = new Date()
      for (let i = 19; i >= 0; i--) {
        const entryTime = new Date(now.getTime() - i * 60000)
        node.history.push({
          timestamp: entryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          temperature: parseFloat((node.telemetry.temperature + (Math.random() * 2 - 1)).toFixed(1)),
          humidity: parseFloat((node.telemetry.humidity + (Math.random() * 4 - 2)).toFixed(1)),
          co2: Math.round(node.telemetry.co2 + (Math.random() * 10 - 5)),
          pm25: Math.round(node.telemetry.pm25 + (Math.random() * 4 - 2))
        })
      }

      node.healthScore = this.calculateNodeHealth(node)
      
      this.nodes.push(node)
      this.selectedNodeId = node.id // Focus on newly registered node
      
      this.addLog('success', `💾 REGISTRO EXITOSO: Depliegue físico completado para [${name}] con ID [${id}] en coordenadas (${lat.toFixed(4)}, ${lng.toFixed(4)}).`)
    },

    toggleNodeActive(nodeId: string) {
      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node) return

      if (node.techStatus === 'offline') {
        this.restoreNodeHardward(node)
        this.addLog('success', `NODO ACTIVADO: Se reestableció la alimentación eléctrica del nodo [${node.name}].`)
      } else {
        node.techStatus = 'offline'
        node.signalStrength = 0
        node.battery = 0
        node.aiCamera.streamActive = false
        node.aiCamera.state = 'error'
        this.addLog('warning', `NODO DESACTIVADO: Dispositivo [${node.name}] puesto en modo inactivo manualmente.`)
      }
    },

    deleteNode(nodeId: string) {
      const index = this.nodes.findIndex((n) => n.id === nodeId)
      if (index === -1) return
      
      const nodeName = this.nodes[index]?.name || ''
      this.nodes.splice(index, 1)
      
      if (this.selectedNodeId === nodeId) {
        this.selectedNodeId = this.nodes.length > 0 ? (this.nodes[0]?.id || null) : null
      }

      this.addLog('error', `🗑️ NODO REMOVIDO: Dispositivo [${nodeName}] ha sido desinstalado de la red de monitoreo forestal.`)
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
        timestamp: new Date().toLocaleTimeString(),
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
        timestamp: new Date().toLocaleTimeString(),
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
