<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFireStore } from '@/stores/fireStore'
import type { IoTNode } from '@/stores/fireStore'
import { useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { 
  Search, 
  Filter, 
  Battery, 
  Wifi, 
  Cpu, 
  Thermometer, 
  Activity, 
  ShieldAlert,
  ArrowUpDown,
  ExternalLink,
  Power
} from 'lucide-vue-next'

const store = useFireStore()
const router = useRouter()
const { isDark } = useTheme()

// Filtering and search state
const searchQuery = ref('')
const selectedRiskFilter = ref<string>('all')
const selectedTechFilter = ref<string>('all')
const sortBy = ref<string>('name')

onMounted(() => {
  store.initializeStore()
})

// Filtered and sorted list of nodes
const filteredNodes = computed(() => {
  let list = [...store.nodes]

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    list = list.filter(n => n.name.toLowerCase().includes(query) || n.id.toLowerCase().includes(query))
  }

  if (selectedRiskFilter.value !== 'all') {
    list = list.filter(n => n.riskStatus === selectedRiskFilter.value)
  }

  if (selectedTechFilter.value !== 'all') {
    list = list.filter(n => n.techStatus === selectedTechFilter.value)
  }

  list.sort((a, b) => {
    if (sortBy.value === 'name') return a.name.localeCompare(b.name)
    if (sortBy.value === 'health') return b.healthScore - a.healthScore
    if (sortBy.value === 'battery') return b.battery - a.battery
    if (sortBy.value === 'signal') return b.signalStrength - a.signalStrength
    return 0
  })

  return list
})

const navigateToDetail = (id: string) => {
  store.selectedNodeId = id
  router.push(`/devices/${id}`)
}
</script>

<template>
  <div class="lg:pl-72 min-h-screen bg-cyber-grid pb-12 pt-20 lg:pt-6 transition-colors duration-300"
       :class="isDark ? 'bg-[#030712]' : 'bg-slate-100'">
    <div class="px-4 lg:px-8 space-y-6">

      <!-- Header panel -->
      <header class="flex flex-col md:flex-row justify-between items-start md:items-center p-4 lg:p-6 rounded-2xl glass-panel relative overflow-hidden">
        <div>
          <span class="text-[10px] font-mono tracking-widest uppercase text-cyan-500 font-bold flex items-center space-x-1.5">
            <Cpu class="w-3.5 h-3.5 text-cyan-500" />
            <span>ESTADO DE LA INFRAESTRUCTURA DE DISPOSITIVOS</span>
          </span>
          <h2 class="text-2xl lg:text-3xl font-extrabold tracking-wide mt-1"
              :class="isDark ? 'text-white' : 'text-slate-900'">
            Red de Dispositivos IoT Forestales
          </h2>
        </div>
        <div class="mt-3 md:mt-0 flex items-center space-x-2 text-xs font-mono">
          <span class="px-3.5 py-1.5 rounded-xl block font-bold border"
                :class="isDark ? 'text-slate-400 bg-slate-950/60 border-slate-800' : 'text-slate-500 bg-white border-slate-200'">
            NODOS TOTALES: <span :class="isDark ? 'text-white' : 'text-slate-800'">{{ store.nodes.length }}</span>
          </span>
        </div>
      </header>

      <!-- Search, filter and sorting controls -->
      <section class="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-2xl glass-panel">
        
        <!-- Search bar -->
        <div class="relative flex items-center">
          <Search class="w-4 h-4 absolute left-3.5 text-secondary" />
          <input 
            type="text" 
            v-model="searchQuery"
            placeholder="Buscar por nombre o ID..."
            class="w-full pl-10 pr-4 py-2 rounded-xl border focus:outline-none transition-all font-sans text-sm"
            :class="isDark
              ? 'bg-slate-950/80 border-slate-800 focus:border-cyan-500/40 text-slate-200 placeholder-slate-500'
              : 'bg-white border-slate-200 focus:border-cyan-400/50 text-slate-800 placeholder-slate-400'"
          />
        </div>

        <!-- Filter by risk level -->
        <div class="relative flex items-center">
          <Filter class="w-4 h-4 absolute left-3.5 text-secondary" />
          <select 
            v-model="selectedRiskFilter"
            class="w-full pl-10 pr-4 py-2 rounded-xl border font-sans text-sm focus:outline-none transition-all appearance-none cursor-pointer"
            :class="isDark
              ? 'bg-slate-950/80 border-slate-800 focus:border-cyan-500/40 text-slate-300'
              : 'bg-white border-slate-200 focus:border-cyan-400/50 text-slate-700'"
          >
            <option value="all">Riesgo Ambiental: Todos</option>
            <option value="green">🟢 Verde (Normal)</option>
            <option value="yellow">🟡 Amarillo (Obs.)</option>
            <option value="orange">🟠 Naranja (Riesgo)</option>
            <option value="red">🔴 Rojo (Incendio)</option>
          </select>
        </div>

        <!-- Filter by technical health status -->
        <div class="relative flex items-center">
          <Activity class="w-4 h-4 absolute left-3.5 text-secondary" />
          <select 
            v-model="selectedTechFilter"
            class="w-full pl-10 pr-4 py-2 rounded-xl border font-sans text-sm focus:outline-none transition-all appearance-none cursor-pointer"
            :class="isDark
              ? 'bg-slate-950/80 border-slate-800 focus:border-cyan-500/40 text-slate-300'
              : 'bg-white border-slate-200 focus:border-cyan-400/50 text-slate-700'"
          >
            <option value="all">Fallas de Enlace: Todas</option>
            <option value="online">🟢 Operativo</option>
            <option value="offline">🔴 Caído (Offline)</option>
            <option value="low_battery">🟡 Batería Crítica</option>
            <option value="sensor_error">🟠 Error de Sensor</option>
            <option value="signal_weak">🔵 Señal Débil</option>
          </select>
        </div>

        <!-- Sort by -->
        <div class="relative flex items-center">
          <ArrowUpDown class="w-4 h-4 absolute left-3.5 text-secondary" />
          <select 
            v-model="sortBy"
            class="w-full pl-10 pr-4 py-2 rounded-xl border font-sans text-sm focus:outline-none transition-all appearance-none cursor-pointer"
            :class="isDark
              ? 'bg-slate-950/80 border-slate-800 focus:border-cyan-500/40 text-slate-300'
              : 'bg-white border-slate-200 focus:border-cyan-400/50 text-slate-700'"
          >
            <option value="name">Ordenar por: Nombre</option>
            <option value="health">Ordenar por: Salud</option>
            <option value="battery">Ordenar por: Batería</option>
            <option value="signal">Ordenar por: Señal</option>
          </select>
        </div>

      </section>

      <!-- Deployed Nodes Grid -->
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        <div 
          v-for="node in filteredNodes" 
          :key="node.id"
          class="glass-panel p-5 flex flex-col justify-between h-[390px] relative overflow-hidden transition-all duration-300 hover:shadow-2xl group"
          :class="[
            node.riskStatus === 'red' ? 'border-red-500/40 shadow-glow-red/20' : '',
            node.techStatus === 'offline' ? 'opacity-80' : ''
          ]"
        >
          <!-- Flashing top line for critical active forest fire -->
          <div 
            v-if="node.riskStatus === 'red'" 
            class="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse"
          ></div>

          <!-- Header -->
          <div class="flex justify-between items-start">
            <div>
              <span class="text-[9px] font-mono font-bold tracking-widest px-2 py-0.5 rounded border"
                    :class="isDark ? 'text-slate-500 bg-slate-950 border-slate-900' : 'text-slate-400 bg-slate-100 border-slate-200'">
                {{ node.id }}
              </span>
              <h3 class="text-md font-extrabold mt-1.5 truncate max-w-[170px]"
                  :class="isDark ? 'text-white' : 'text-slate-800'">
                {{ node.name }}
              </h3>
            </div>
            
            <!-- Risk alert status bubble -->
            <span 
              class="text-[9px] font-mono uppercase font-extrabold px-2.5 py-0.5 rounded border flex items-center space-x-1"
              :class="{
                'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': node.riskStatus === 'green' && node.techStatus !== 'offline',
                'bg-amber-500/10 text-amber-400 border-amber-500/20': node.riskStatus === 'yellow' && node.techStatus !== 'offline',
                'bg-orange-500/10 text-orange-400 border-orange-500/20': node.riskStatus === 'orange' && node.techStatus !== 'offline',
                'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse': node.riskStatus === 'red' && node.techStatus !== 'offline',
                'bg-slate-900 text-slate-500 border-slate-800': node.techStatus === 'offline'
              }"
            >
              <span 
                v-if="node.techStatus !== 'offline'" 
                class="w-1.5 h-1.5 rounded-full"
                :class="{
                  'bg-emerald-400': node.riskStatus === 'green',
                  'bg-amber-400': node.riskStatus === 'yellow',
                  'bg-orange-400': node.riskStatus === 'orange',
                  'bg-red-400 animate-pulse-fast': node.riskStatus === 'red'
                }"
              ></span>
              <span>{{ node.techStatus === 'offline' ? 'DESCONECTADO' : node.riskStatus === 'red' ? 'Incendio' : node.riskStatus === 'orange' ? 'Posible' : node.riskStatus === 'yellow' ? 'Observación' : 'Normal' }}</span>
            </span>
          </div>

          <!-- Calculated Health Rating Gauge -->
          <div class="my-4 flex items-center justify-between p-3.5 rounded-xl border"
               :class="isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-slate-50 border-slate-200'">
            <div class="flex items-center space-x-3">
              <span class="text-xs font-sans text-secondary">Salud General</span>
              <span 
                class="text-md font-mono font-extrabold"
                :class="{
                  'text-emerald-400': node.healthScore >= 75,
                  'text-amber-400': node.healthScore >= 40 && node.healthScore < 75,
                  'text-red-400 animate-pulse': node.healthScore < 40
                }"
              >
                {{ node.healthScore }}%
              </span>
            </div>
            
            <!-- Connection State tags -->
            <span 
              class="text-[9px] font-mono px-2 py-0.5 rounded border"
              :class="{
                'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': node.techStatus === 'online',
                'bg-red-500/10 text-red-500 border-red-500/20': node.techStatus === 'offline',
                'bg-amber-500/10 text-amber-400 border-amber-500/20': node.techStatus === 'low_battery',
                'bg-orange-500/10 text-orange-400 border-orange-500/20': node.techStatus === 'sensor_error',
                'bg-blue-500/10 text-blue-400 border-blue-500/20': node.techStatus === 'signal_weak',
              }"
            >
              {{ node.techStatus === 'online' ? 'OPERATIVO' : node.techStatus === 'offline' ? 'CAÍDO' : node.techStatus === 'low_battery' ? 'BAT_BAJA' : node.techStatus === 'sensor_error' ? 'ERR_SENSOR' : 'SIG_DEBIL' }}
            </span>
          </div>

          <!-- Quick sub-sensors diagnostics checklist -->
          <div class="space-y-1.5 my-3 text-xs font-mono">
            
            <div class="flex justify-between items-center px-2 py-1 rounded"
                 :class="isDark ? 'bg-slate-900/10' : 'bg-slate-50'">
              <span class="text-secondary">🌡️ Temp</span>
              <span class="font-bold" :class="node.sensorsHealth.temperature === 'OK' ? (isDark ? 'text-white' : 'text-slate-800') : 'text-red-400 animate-pulse'">
                {{ node.sensorsHealth.temperature === 'OK' ? `${node.telemetry.temperature}°C` : 'ERROR' }}
              </span>
            </div>
            
            <div class="flex justify-between items-center px-2 py-1 rounded"
                 :class="isDark ? 'bg-slate-900/10' : 'bg-slate-50'">
              <span class="text-secondary">💧 Humedad</span>
              <span class="font-bold" :class="node.sensorsHealth.humidity === 'OK' ? (isDark ? 'text-white' : 'text-slate-800') : 'text-red-400 animate-pulse'">
                {{ node.sensorsHealth.humidity === 'OK' ? `${node.telemetry.humidity}%` : 'ERROR' }}
              </span>
            </div>
            
            <div class="flex justify-between items-center px-2 py-1 rounded"
                 :class="isDark ? 'bg-slate-900/10' : 'bg-slate-50'">
              <span class="text-secondary">💨 Monóxido</span>
              <span class="font-bold" :class="node.sensorsHealth.co2 === 'OK' ? (isDark ? 'text-white' : 'text-slate-800') : 'text-red-400 animate-pulse'">
                {{ node.sensorsHealth.co2 === 'OK' ? `${node.telemetry.co2} ppm` : 'ERROR' }}
              </span>
            </div>

            <div class="flex justify-between items-center px-2 py-1 rounded"
                 :class="isDark ? 'bg-slate-900/10' : 'bg-slate-50'">
              <span class="text-secondary">📷 FLIR IA Cam</span>
              <span class="font-bold" 
                    :class="{
                      'text-emerald-400': node.sensorsHealth.camera === 'OK' && node.aiCamera.streamActive,
                      'text-slate-400': node.sensorsHealth.camera === 'OK' && !node.aiCamera.streamActive,
                      'text-red-400 animate-pulse': node.sensorsHealth.camera === 'ERR'
                    }">
                {{ node.sensorsHealth.camera === 'ERR' ? 'GLITCH' : node.aiCamera.streamActive ? 'TRANSMITIENDO' : 'MONITOR_PASIVO' }}
              </span>
            </div>

          </div>

          <!-- Bottom: Solar Battery and Wireless Signal levels -->
          <div class="space-y-2 border-t pt-3"
               :class="isDark ? 'border-slate-900' : 'border-slate-200'">
            <div class="flex items-center justify-between text-[10px] font-mono text-secondary">
              <div class="flex items-center space-x-1.5">
                <Battery class="w-3.5 h-3.5" :class="node.battery < 20 ? 'text-red-400 animate-pulse' : 'text-slate-400'" />
                <span :class="node.battery < 20 ? 'text-red-400 font-bold' : ''">Bat Solar: {{ node.battery }}%</span>
              </div>
              <div class="flex items-center space-x-1.5">
                <Wifi class="w-3.5 h-3.5 text-slate-400" />
                <span>Señal: {{ node.signalStrength }}%</span>
              </div>
            </div>

            <!-- Double structural loading gauges -->
            <div class="flex space-x-4">
              <div class="h-1 flex-1 rounded-full overflow-hidden"
                   :class="isDark ? 'bg-slate-950' : 'bg-slate-200'">
                <div 
                  class="h-full rounded-full transition-all duration-500"
                  :class="node.battery < 20 ? 'bg-red-500 shadow-glow-red animate-pulse' : node.battery < 60 ? 'bg-amber-500' : 'bg-emerald-500'"
                  :style="{ width: `${node.battery}%` }"
                ></div>
              </div>
              <div class="h-1 flex-1 rounded-full overflow-hidden"
                   :class="isDark ? 'bg-slate-950' : 'bg-slate-200'">
                <div 
                  class="h-full bg-cyan-500 rounded-full transition-all duration-500 shadow-glow-cyan"
                  :style="{ width: `${node.signalStrength}%` }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Hover Overlay button to open Digital Twin details -->
          <div class="absolute inset-0 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center space-y-3 transition-opacity duration-300 rounded-2xl z-20"
               :class="isDark ? 'bg-slate-950/80' : 'bg-white/80'">
            <span class="text-xs font-mono" :class="isDark ? 'text-slate-400' : 'text-slate-500'">TELEMETRÍA COMPLETA NODO</span>
            <button 
              @click="navigateToDetail(node.id)"
              class="px-5 py-2.5 bg-cyan-950 border border-cyan-800/80 hover:bg-cyan-500/20 text-cyan-400 hover:text-white rounded-xl text-xs font-mono font-bold tracking-wide uppercase transition-all duration-300 flex items-center space-x-2 shadow-glow-cyan cursor-pointer"
            >
              <span>Acceder Digital Twin</span>
              <ExternalLink class="w-4 h-4" />
            </button>
            <button 
              @click="store.toggleNodeActive(node.id)"
              class="px-4 py-1.5 border text-[10px] font-mono uppercase transition-all duration-300 flex items-center space-x-1.5 cursor-pointer rounded-lg"
              :class="isDark
                ? 'border-slate-800 hover:border-red-500/40 text-slate-500 hover:text-red-400 hover:bg-red-500/5'
                : 'border-slate-300 hover:border-red-400/40 text-slate-500 hover:text-red-500 hover:bg-red-50'"
            >
              <Power class="w-3.5 h-3.5" />
              <span>{{ node.techStatus === 'offline' ? 'Conectar' : 'Desconectar' }}</span>
            </button>
          </div>

        </div>

      </section>

      <!-- Empty state -->
      <div 
        v-if="filteredNodes.length === 0" 
        class="glass-panel p-16 text-center font-mono border border-dashed rounded-2xl"
        :class="isDark ? 'text-slate-500 border-slate-800' : 'text-slate-400 border-slate-300'"
      >
        <span class="block text-lg font-bold mb-2" :class="isDark ? 'text-slate-400' : 'text-slate-500'">Ningún dispositivo IoT coincide</span>
        <span>Ajusta los filtros de búsqueda o la configuración de fallas del panel.</span>
      </div>

    </div>
  </div>
</template>
