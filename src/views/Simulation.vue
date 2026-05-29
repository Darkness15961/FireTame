<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useFireStore } from '@/stores/fireStore'
import type { IoTNode } from '@/stores/fireStore'
import { useTheme } from '@/composables/useTheme'
import { 
  Flame, 
  Wind, 
  RefreshCw, 
  Settings, 
  Radio, 
  Battery,
  Wifi,
  Activity,
  AlertTriangle,
  Play,
  Signal,
  CheckCircle,
  HelpCircle
} from 'lucide-vue-next'

const store = useFireStore()
const { isDark } = useTheme()
const selectedNodeId = ref<string>('')

onMounted(() => {
  store.initializeStore()
  if (store.nodes.length > 0) {
    selectedNodeId.value = store.nodes[0]?.id || ''
  }
})

const selectedNode = computed(() => {
  return store.nodes.find(n => n.id === selectedNodeId.value) || null
})

// Quick simulation execution wrapper
const runSimulation = (action: string) => {
  if (!selectedNodeId.value) return
  
  if (action === 'smoke') {
    store.triggerSmokeSimulation(selectedNodeId.value)
  } else if (action === 'fire') {
    store.triggerFireSimulation(selectedNodeId.value)
  } else if (action === 'false_positive') {
    store.triggerFalsePositiveSimulation(selectedNodeId.value)
  } else if (action === 'sensor_freeze') {
    store.triggerSensorFreezeSimulation(selectedNodeId.value)
  } else if (action === 'offline') {
    store.triggerOfflineSimulation(selectedNodeId.value)
  } else if (action === 'low_battery') {
    store.triggerLowBatterySimulation(selectedNodeId.value)
  } else if (action === 'restore') {
    store.restoreNodeNormalState(selectedNodeId.value)
  }
}
</script>

<template>
  <div class="lg:pl-72 min-h-screen bg-cyber-grid pb-12 pt-20 lg:pt-6 transition-colors duration-300"
       :class="isDark ? 'bg-[#030712]' : 'bg-slate-100'">
    <div class="px-4 lg:px-8 space-y-6">

      <!-- Header panel -->
      <header class="flex flex-col md:flex-row justify-between items-start md:items-center p-4 lg:p-6 rounded-2xl glass-panel relative overflow-hidden">
        <div>
          <span class="text-[10px] font-mono tracking-widest uppercase text-cyan-400 font-bold flex items-center space-x-1.5">
            <Settings class="w-3.5 h-3.5 text-cyan-400" />
            <span>CONSOLA INYECTORA DE MOCK DATA DE EMERGENCIA</span>
          </span>
          <h2 class="text-2xl lg:text-3xl font-extrabold tracking-wide mt-1"
              :class="isDark ? 'text-white' : 'text-slate-900'">
            Simulador de Incidentes y Clima
          </h2>
        </div>
        <div class="mt-3 md:mt-0 flex items-center space-x-2.5 font-mono text-xs">
          <button 
            @click="store.restoreAllNodesNormal"
            class="px-4.5 py-2.5 border rounded-xl transition-all duration-300 font-bold flex items-center space-x-2 cursor-pointer"
            :class="isDark ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:text-white' : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800'"
          >
            <RefreshCw class="w-4 h-4" />
            <span>RESTABLECER RED ENTERA</span>
          </button>
        </div>
      </header>

      <!-- Main simulator dashboard split -->
      <section class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        <!-- Left Column: Interactive Deployed Nodes selector -->
        <div class="glass-panel p-5 flex flex-col h-[520px]">
          <span class="text-xs font-sans text-slate-400 font-extrabold block mb-4 flex items-center space-x-2">
            <Radio class="w-4 h-4 text-cyan-400" />
            <span>SELECCIONA DISPOSITIVO IoT DE DESTINO</span>
          </span>

          <div class="flex-1 overflow-y-auto space-y-2 pr-1.5">
            <button 
              v-for="node in store.nodes" 
              :key="node.id"
              @click="selectedNodeId = node.id"
              class="w-full text-left p-3 rounded-xl border transition-all duration-300 flex items-center justify-between cursor-pointer"
              :class="[
                selectedNodeId === node.id 
                  ? (isDark ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-400 shadow-glow-cyan/10' : 'bg-cyan-50 border-cyan-400/50 text-cyan-600 shadow-sm') 
                  : (isDark ? 'bg-slate-950/40 border-slate-900 text-slate-400 hover:bg-slate-900/40' : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50')
              ]"
            >
              <div class="flex items-center space-x-3 truncate">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" 
                      :class="node.riskStatus === 'red' ? 'bg-red-500 animate-pulse' : node.riskStatus === 'orange' ? 'bg-orange-500' : node.riskStatus === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'"></span>
                <div>
                  <h4 class="font-extrabold text-xs truncate max-w-[130px]"
                      :class="selectedNodeId === node.id ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-350' : 'text-slate-700')">{{ node.name }}</h4>
                  <span class="text-[9px] font-mono text-slate-500 block uppercase mt-0.5">{{ node.id }}</span>
                </div>
              </div>

              <!-- Quick stats indicators -->
              <div class="flex items-center space-x-2 text-[10px] font-mono shrink-0">
                <span :class="node.techStatus === 'offline' ? 'text-red-400 font-bold' : 'text-slate-500'">
                  {{ node.techStatus === 'offline' ? 'OFFLINE' : `${node.telemetry.temperature}°C` }}
                </span>
              </div>
            </button>
          </div>
        </div>

        <!-- Right Column (2 cols): Injector console and progressive hazard validation HUD -->
        <div class="xl:col-span-2 space-y-6 flex flex-col justify-between">
          
          <!-- Controller board -->
          <div class="glass-panel p-5 flex-1">
            <span class="text-xs font-sans text-slate-400 font-extrabold block mb-6 flex items-center space-x-2">
              <Play class="w-4 h-4 text-cyan-500" />
              <span>INYECTORES DE SIMULACIÓN PARA: <span :class="isDark ? 'text-white' : 'text-slate-800'">{{ selectedNode ? selectedNode.name.toUpperCase() : 'SELECCIONAR' }}</span></span>
            </span>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4" v-if="selectedNode">
              
              <!-- Simulation: Smoke Spike -->
              <div class="p-4 rounded-2xl flex flex-col justify-between border"
                   :class="isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-white border-slate-200 shadow-sm'">
                <div>
                  <div class="flex justify-between items-center"><span class="text-xs font-sans font-extrabold" :class="isDark ? 'text-white' : 'text-slate-800'">Anomalía de Humo</span> <span class="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-glow-orange"></span></div>
                  <p class="text-[10px] font-sans mt-2 leading-relaxed" :class="isDark ? 'text-slate-500' : 'text-slate-550'">Spike químico de gas monóxido de carbono CO2 (620ppm) y partículas PM2.5. IA térmica monitoriza.</p>
                </div>
                <button 
                  @click="runSimulation('smoke')"
                  class="mt-4 w-full py-2 border rounded-xl transition-all duration-300 font-mono text-[10px] uppercase font-bold cursor-pointer"
                  :class="isDark ? 'bg-orange-950/40 hover:bg-orange-500/20 border-orange-500/30 hover:border-orange-500/60 text-orange-400 hover:text-white' : 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-600 hover:text-orange-850'"
                >
                  Simular Humo
                </button>
              </div>

              <!-- Simulation: Wildfire -->
              <div class="p-4 rounded-2xl flex flex-col justify-between border"
                   :class="isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-white border-slate-200 shadow-sm'">
                <div>
                  <div class="flex justify-between items-center"><span class="text-xs font-sans font-extrabold" :class="isDark ? 'text-white' : 'text-slate-800'">Incendio Forestal</span> <span class="w-2.5 h-2.5 rounded-full bg-red-500 shadow-glow-red animate-pulse"></span></div>
                  <p class="text-[10px] font-sans mt-2 leading-relaxed" :class="isDark ? 'text-slate-500' : 'text-slate-550'">PROGRESIÓN REAL: Spikes químicos secuenciales, caída de humedad, elevación de calor, IA valida al 98%.</p>
                </div>
                <button 
                  @click="runSimulation('fire')"
                  class="mt-4 w-full py-2 border rounded-xl transition-all duration-300 font-mono text-[10px] uppercase font-bold cursor-pointer"
                  :class="isDark ? 'bg-red-950/40 hover:bg-red-500/20 border-red-500/30 hover:border-red-500/60 text-red-400 hover:text-white' : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-650 hover:text-red-850'"
                >
                  Simular Incendio
                </button>
              </div>

              <!-- Simulation: False Positive -->
              <div class="p-4 rounded-2xl flex flex-col justify-between border"
                   :class="isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-white border-slate-200 shadow-sm'">
                <div>
                  <div class="flex justify-between items-center"><span class="text-xs font-sans font-extrabold" :class="isDark ? 'text-white' : 'text-slate-800'">Falso Positivo IA</span> <span class="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-glow-yellow"></span></div>
                  <p class="text-[10px] font-sans mt-2 leading-relaxed" :class="isDark ? 'text-slate-500' : 'text-slate-550'">Spike de CO2 (790ppm) pero atmósfera fría y húmeda. Filtro IA valida y cancela alerta (Quema agrícola).</p>
                </div>
                <button 
                  @click="runSimulation('false_positive')"
                  class="mt-4 w-full py-2 border rounded-xl transition-all duration-300 font-mono text-[10px] uppercase font-bold cursor-pointer"
                  :class="isDark ? 'bg-amber-950/40 hover:bg-amber-500/20 border-amber-500/30 hover:border-amber-500/60 text-amber-400 hover:text-white' : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-600 hover:text-amber-850'"
                >
                  Simular Falso Pos
                </button>
              </div>

              <!-- Simulation: Sensor Freeze -->
              <div class="p-4 rounded-2xl flex flex-col justify-between border"
                   :class="isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-white border-slate-200 shadow-sm'">
                <div>
                  <div class="flex justify-between items-center"><span class="text-xs font-sans font-extrabold" :class="isDark ? 'text-white' : 'text-slate-800'">Falla Sensor Temp</span> <span class="w-2.5 h-2.5 rounded-full bg-yellow-500"></span></div>
                  <p class="text-[10px] font-sans mt-2 leading-relaxed" :class="isDark ? 'text-slate-500' : 'text-slate-550'">Falla en la resistencia NTC. Sensor envía 999.9°C constantes. Activa alarmas y reduce salud general.</p>
                </div>
                <button 
                  @click="runSimulation('sensor_freeze')"
                  class="mt-4 w-full py-2 border rounded-xl transition-all duration-300 font-mono text-[10px] uppercase font-bold cursor-pointer"
                  :class="isDark ? 'bg-yellow-950/40 hover:bg-yellow-500/20 border-yellow-500/30 hover:border-yellow-500/60 text-yellow-500 hover:text-white' : 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-600 hover:text-yellow-850'"
                >
                  Simular Falla Temp
                </button>
              </div>

              <!-- Simulation: Offline -->
              <div class="p-4 rounded-2xl flex flex-col justify-between border"
                   :class="isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-white border-slate-200 shadow-sm'">
                <div>
                  <div class="flex justify-between items-center"><span class="text-xs font-sans font-extrabold" :class="isDark ? 'text-white' : 'text-slate-800'">Nodo Fuera de Línea</span> <span class="w-2.5 h-2.5 rounded-full bg-slate-500"></span></div>
                  <p class="text-[10px] font-sans mt-2 leading-relaxed" :class="isDark ? 'text-slate-500' : 'text-slate-550'">Corte satelital de transceiver LoRa/Sat. Se suspende transmisión de telemetría y activa incidentes.</p>
                </div>
                <button 
                  @click="runSimulation('offline')"
                  class="mt-4 w-full py-2 border rounded-xl transition-all duration-300 font-mono text-[10px] uppercase font-bold cursor-pointer"
                  :class="isDark ? 'bg-slate-900 hover:bg-slate-750 border-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-250 text-slate-600 hover:text-slate-850'"
                >
                  Simular Offline
                </button>
              </div>

              <!-- Simulation: Low Battery -->
              <div class="p-4 rounded-2xl flex flex-col justify-between border"
                   :class="isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-white border-slate-200 shadow-sm'">
                <div>
                  <div class="flex justify-between items-center"><span class="text-xs font-sans font-extrabold" :class="isDark ? 'text-white' : 'text-slate-800'">Batería Crítica</span> <span class="w-2.5 h-2.5 rounded-full bg-red-400"></span></div>
                  <p class="text-[10px] font-sans mt-2 leading-relaxed" :class="isDark ? 'text-slate-500' : 'text-slate-550'">Carga de celda solar cae al 4% debido a obstrucción de polvo en panel. Entra en ahorro energético.</p>
                </div>
                <button 
                  @click="runSimulation('low_battery')"
                  class="mt-4 w-full py-2 border rounded-xl transition-all duration-300 font-mono text-[10px] uppercase font-bold cursor-pointer"
                  :class="isDark ? 'bg-red-950/20 hover:bg-red-500/20 border-red-500/30 hover:border-red-500/60 text-red-400 hover:text-white' : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-650 hover:text-red-850'"
                >
                  Simular Bat Baja
                </button>
              </div>

            </div>

            <!-- Master Restores specific to selected node -->
            <div class="mt-4 flex space-x-3" v-if="selectedNode">
              <button 
                @click="runSimulation('restore')"
                class="flex-1 py-3 border rounded-xl transition-all duration-300 font-mono text-[10px] uppercase font-bold tracking-widest cursor-pointer flex items-center justify-center space-x-2"
                :class="isDark ? 'bg-emerald-950/40 hover:bg-emerald-500/20 border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 hover:text-white' : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-600 hover:text-emerald-850'"
              >
                <CheckCircle class="w-4 h-4 text-emerald-500" />
                <span>Calibrar y Restablecer Nodo</span>
              </button>
            </div>
          </div>

          <!-- Climate controls panel -->
          <div class="glass-panel p-5" :class="isDark ? 'bg-cyan-950/5 border-cyan-500/20' : 'bg-cyan-50/20 border-cyan-200'">
            <span class="text-xs font-sans text-slate-400 font-extrabold block mb-4 flex items-center space-x-2">
              <Wind class="w-4 h-4 text-cyan-500" />
              <span>CONTROLES CLIMÁTICOS GLOBALES (CUSCO REGION)</span>
            </span>

            <div class="flex items-center justify-between p-4 border rounded-2xl"
                 :class="isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-white border-slate-200 shadow-sm'">
              <div>
                <span class="text-xs font-sans font-extrabold block" :class="isDark ? 'text-white' : 'text-slate-800'">Alerta de Fuertes Vientos (Vaguada Andina)</span>
                <p class="text-[10px] font-sans mt-1 leading-relaxed" :class="isDark ? 'text-slate-500' : 'text-slate-550'">
                  Incrementa ráfagas de viento promedio a 65 km/h+ en todos los nodos de Cusco. Eleva riesgo de propagación.
                </p>
              </div>
              
              <button 
                @click="store.triggerGlobalWindSimulation"
                class="px-5 py-2.5 rounded-xl font-mono text-[10px] uppercase font-bold tracking-widest transition-all duration-300 cursor-pointer flex items-center space-x-2"
                :class="[
                  store.globalWindAlert
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-glow-red'
                    : (isDark 
                      ? 'bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-400' 
                      : 'bg-slate-100 border border-slate-250 hover:border-cyan-400 text-slate-650 hover:text-cyan-700')
                ]"
              >
                <span>{{ store.globalWindAlert ? 'APAGAR ALERTA' : 'ENCENDER ALERTA' }}</span>
              </button>
            </div>
          </div>

        </div>

      </section>

      <!-- Logic progression pipeline visual guide -->
      <section class="glass-panel p-6">
        <div class="flex items-center space-x-2 border-b pb-3 mb-6"
             :class="isDark ? 'border-slate-800' : 'border-slate-200'">
          <HelpCircle class="w-5 h-5 text-cyan-555" />
          <span class="font-sans font-extrabold text-md tracking-wide"
                :class="isDark ? 'text-white' : 'text-slate-800'">PROTOCOLO DE VALIDACIÓN PROGRESIVA DE INCENDIOS DE FIRETAME</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono text-center">
          
          <!-- Phase 1 -->
          <div class="p-4 rounded-2xl border flex flex-col items-center"
               :class="isDark ? 'bg-slate-950/60 border-slate-900' : 'bg-white border-slate-200 shadow-sm'">
            <span class="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center font-bold">1</span>
            <span class="text-[10px] uppercase font-extrabold mt-3 block" :class="isDark ? 'text-white' : 'text-slate-800'">🔴 QUÍMICA DE GAS</span>
            <p class="text-[9.5px] mt-2 leading-relaxed" :class="isDark ? 'text-slate-500' : 'text-slate-550'">CO2 supera 450ppm, o PM2.5 supera 25µg. Dispositivo pasa a estado Amarillo (Vigilancia).</p>
          </div>

          <!-- Phase 2 -->
          <div class="p-4 rounded-2xl border flex flex-col items-center"
               :class="isDark ? 'bg-slate-950/60 border-slate-900' : 'bg-white border-slate-200 shadow-sm'">
            <span class="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-550 flex items-center justify-center font-bold">2</span>
            <span class="text-[10px] uppercase font-extrabold mt-3 block" :class="isDark ? 'text-white' : 'text-slate-800'">🟠 PREVENTIVO IA</span>
            <p class="text-[9.5px] mt-2 leading-relaxed" :class="isDark ? 'text-slate-500' : 'text-slate-550'">CO2 supera 550ppm, o Humedad baja a &lt;35%. Cámara FLIR IA se enciende e inicia análisis.</p>
          </div>

          <!-- Phase 3 -->
          <div class="p-4 rounded-2xl border flex flex-col items-center"
               :class="isDark ? 'bg-slate-950/60 border-slate-900' : 'bg-white border-slate-200 shadow-sm'">
            <span class="w-6 h-6 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-500 flex items-center justify-center font-bold">3</span>
            <span class="text-[10px] uppercase font-extrabold mt-3 block" :class="isDark ? 'text-white' : 'text-slate-800'">🔍 CRUCE TÉRMICO</span>
            <p class="text-[9.5px] mt-2 leading-relaxed" :class="isDark ? 'text-slate-500' : 'text-slate-550'">CO2 supera 850ppm, Humedad &lt;20%, Temp &gt;50°C. IA busca y marca puntos calientes (Hotspots).</p>
          </div>

          <!-- Phase 4 -->
          <div class="p-4 rounded-2xl border flex flex-col items-center"
               :class="isDark ? 'bg-slate-950/60 border-slate-900' : 'bg-white border-slate-200 shadow-sm'">
            <span class="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 text-red-550 flex items-center justify-center font-bold">4</span>
            <span class="text-[10px] uppercase font-extrabold mt-3 block" :class="isDark ? 'text-white' : 'text-slate-800'">🚨 CONFIRMACIÓN ACK</span>
            <p class="text-[9.5px] mt-2 leading-relaxed" :class="isDark ? 'text-slate-500' : 'text-slate-550'">Modelo de IA reporta confianza &gt;85%. Tránsito a Rojo. Generación de alarma crítica e incidentes.</p>
          </div>

        </div>
      </section>

    </div>
  </div>
</template>
