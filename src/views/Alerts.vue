<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFireStore } from '@/stores/fireStore'
import type { Alert } from '@/stores/fireStore'
import { useTheme } from '@/composables/useTheme'
import { 
  BellRing, 
  ShieldAlert, 
  Check, 
  Send, 
  MapPin, 
  Info,
  AlertTriangle,
  Flame,
  Radio,
  Eye,
  CheckCheck
} from 'lucide-vue-next'

const store = useFireStore()
const { isDark } = useTheme()
const filterSeverity = ref<string>('all')
const filterType = ref<string>('all')
const showAcknowledged = ref<boolean>(false)

// Drone simulation state overlay
const activeDroneMission = ref<string | null>(null)
const droneMissionStatus = ref<string>('')
const droneMissionProgress = ref<number>(0)
let droneInterval: any = null

onMounted(() => {
  store.initializeStore()
})

// Filtered Alerts queue
const filteredAlerts = computed(() => {
  let list = [...store.alerts]

  // Filter out acknowledged unless requested
  if (!showAcknowledged.value) {
    list = list.filter(a => !a.acknowledged)
  }

  // Filter by severity
  if (filterSeverity.value !== 'all') {
    list = list.filter(a => a.severity === filterSeverity.value)
  }

  // Filter by alert category
  if (filterType.value !== 'all') {
    list = list.filter(a => a.type === filterType.value)
  }

  return list
})

// Simulated drone flyby mission action
const dispatchDrone = (nodeName: string) => {
  if (activeDroneMission.value) return // Busy
  
  activeDroneMission.value = nodeName
  droneMissionProgress.value = 0
  droneMissionStatus.value = 'PREPARANDO AERONAVE: Drone de Reconocimiento FireTame-X1...'
  
  droneInterval = setInterval(() => {
    droneMissionProgress.value += 5
    
    if (droneMissionProgress.value === 15) {
      droneMissionStatus.value = 'CALIBRANDO SISTEMAS FLIR / SENSOR TÉRMICO INFRARROJO...'
    } else if (droneMissionProgress.value === 35) {
      droneMissionStatus.value = `DESPEJE AUTÓNOMO CONFIRMADO. Trayectoria trazada rumbo a: ${nodeName}...`
    } else if (droneMissionProgress.value === 60) {
      droneMissionStatus.value = `EN RUTA: Altitud 150m, Velocidad de crucero 65 km/h. Conectando telemetría...`
    } else if (droneMissionProgress.value === 85) {
      droneMissionStatus.value = `LLEGADA A COORDENADAS: Orbitando perímetro. Transmitiendo video óptico IA en vivo...`
    } else if (droneMissionProgress.value >= 100) {
      clearInterval(droneInterval)
      droneMissionStatus.value = `MISION COMPLETADA: Área inspeccionada con éxito. Enlace satelital archivado.`
      
      setTimeout(() => {
        activeDroneMission.value = null
      }, 3500)
    }
  }, 400)
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
            <BellRing class="w-3.5 h-3.5 text-cyan-400" />
            <span>CENTRAL OPERATIVA DE ALERTAS CRÍTICAS</span>
          </span>
          <h2 class="text-2xl lg:text-3xl font-extrabold tracking-wide mt-1"
              :class="isDark ? 'text-white' : 'text-slate-900'">
            Cola de Incidentes en Tiempo Real
          </h2>
        </div>
        <div class="mt-3 md:mt-0 flex items-center space-x-2.5 font-mono text-xs">
          <button 
            @click="store.acknowledgeAllAlerts"
            class="px-4 py-2.5 border rounded-xl transition-all flex items-center space-x-2 cursor-pointer font-bold"
            :class="isDark ? 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800'"
          >
            <CheckCheck class="w-4 h-4 text-emerald-400" />
            <span>ACUSAR TODOS (ACK)</span>
          </button>
        </div>
      </header>

      <section v-if="activeDroneMission" class="glass-panel p-6 animate-pulse relative overflow-hidden"
               :class="isDark ? 'border-cyan-500/40 bg-cyan-950/10 shadow-glow-cyan/20' : 'border-cyan-400/50 bg-cyan-50/50 shadow-sm'">
        <div class="flex items-center justify-between mb-3.5">
          <div class="flex items-center space-x-3">
            <Radio class="w-5 h-5 text-cyan-500 animate-pulse" />
            <h3 class="font-extrabold text-sm tracking-wider font-sans uppercase"
                :class="isDark ? 'text-white' : 'text-slate-800'">
              DESPACHO TÁCTICO DE DRON ACTIVO: {{ activeDroneMission }}
            </h3>
          </div>
          <span class="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded border"
                :class="isDark ? 'text-cyan-400 bg-slate-950 border-slate-900' : 'text-cyan-600 bg-cyan-50 border-cyan-200'">
            COMPLETADO: {{ droneMissionProgress }}%
          </span>
        </div>

        <p class="text-xs font-mono mb-4" :class="isDark ? 'text-cyan-300' : 'text-cyan-600'">{{ droneMissionStatus }}</p>

        <!-- Progress loading gauge -->
        <div class="h-2 w-full rounded-full overflow-hidden border"
             :class="isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-200 border-slate-300'">
          <div 
            class="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-300"
            :class="isDark ? 'shadow-glow-cyan' : ''"
            :style="{ width: `${droneMissionProgress}%` }"
          ></div>
        </div>
      </section>

      <section class="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-2xl glass-panel"
               :class="isDark ? 'bg-slate-950/20' : 'bg-slate-50/55'">
        
        <!-- Filter by severity priority -->
        <div class="relative flex items-center">
          <ShieldAlert class="w-4 h-4 text-slate-500 absolute left-3.5" />
          <select 
            v-model="filterSeverity"
            class="w-full pl-10 pr-4 py-2 rounded-xl border font-sans text-sm focus:outline-none transition-all appearance-none cursor-pointer"
            :class="isDark ? 'bg-slate-950/80 border-slate-800 focus:border-cyan-500/40 text-slate-300' : 'bg-white border-slate-200 focus:border-cyan-400/50 text-slate-700'"
          >
            <option value="all">Prioridad: Todas</option>
            <option value="critical">🔴 Crítica (Confirmado)</option>
            <option value="high">🟠 Alta (Riesgo/Caído)</option>
            <option value="medium">🟡 Media (Falla Técnica)</option>
            <option value="low">🟢 Baja (Resoluciones IA)</option>
          </select>
        </div>

        <!-- Filter by Incident Type -->
        <div class="relative flex items-center">
          <Activity class="w-4 h-4 text-slate-500 absolute left-3.5" />
          <select 
            v-model="filterType"
            class="w-full pl-10 pr-4 py-2 rounded-xl border font-sans text-sm focus:outline-none transition-all appearance-none cursor-pointer"
            :class="isDark ? 'bg-slate-950/80 border-slate-800 focus:border-cyan-500/40 text-slate-300' : 'bg-white border-slate-200 focus:border-cyan-400/50 text-slate-700'"
          >
            <option value="all">Categoría: Todas</option>
            <option value="fire">🔥 Detección de Fuego</option>
            <option value="smoke">💨 Monóxido/Humo</option>
            <option value="hardware">🔧 Desviación de Hardware</option>
            <option value="offline">📶 Pérdida Enlace</option>
            <option value="false_positive">ℹ️ Falsos Positivos</option>
          </select>
        </div>

        <!-- Toggle acknowledged archived list -->
        <div class="md:col-span-2 flex items-center justify-end px-2.5">
          <label class="flex items-center space-x-3 cursor-pointer select-none">
            <input 
              type="checkbox" 
              v-model="showAcknowledged"
              class="rounded text-cyan-500 focus:ring-0 w-4 h-4 cursor-pointer"
              :class="isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-300'"
            />
            <span class="text-xs font-sans font-bold transition-colors"
                  :class="isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'">
              Mostrar Alertas Archivadas / Acusadas (ACK)
            </span>
          </label>
        </div>

      </section>

      <!-- Alerts List Grid -->
      <section class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div 
          v-for="alert in filteredAlerts" 
          :key="alert.id"
          class="glass-panel p-5 flex flex-col justify-between h-[230px] relative overflow-hidden transition-all duration-300 hover:border-slate-700"
          :class="[
            alert.acknowledged ? 'opacity-65 border-slate-900 bg-slate-950/10' : '',
            alert.severity === 'critical' ? 'border-red-500/40 shadow-glow-red/10' : 
            alert.severity === 'high' ? 'border-orange-500/40' : 
            alert.severity === 'medium' ? 'border-amber-500/40' : 'border-emerald-500/40'
          ]"
        >
          <!-- Left color band representing severity -->
          <div 
            class="absolute top-0 bottom-0 left-0 w-1.5"
            :class="{
              'bg-red-500 shadow-glow-red animate-pulse': alert.severity === 'critical',
              'bg-orange-500': alert.severity === 'high',
              'bg-amber-500': alert.severity === 'medium',
              'bg-emerald-500': alert.severity === 'low',
              'bg-slate-700': alert.acknowledged
            }"
          ></div>

          <!-- Top Panel Header -->
          <div class="flex justify-between items-start pl-3">
            <div>
              <div class="flex items-center space-x-2">
                <span class="text-[9px] font-mono font-bold tracking-widest px-2 py-0.5 rounded border"
                      :class="isDark ? 'text-slate-500 bg-slate-950 border-slate-900' : 'text-slate-400 bg-slate-100 border-slate-200'">
                  {{ alert.id }}
                </span>
                <span 
                  class="text-[9px] font-mono uppercase font-extrabold px-2 py-0.5 rounded border"
                  :class="{
                    'bg-red-500/10 text-red-400 border-red-500/20': alert.severity === 'critical',
                    'bg-orange-500/10 text-orange-400 border-orange-500/20': alert.severity === 'high',
                    'bg-amber-500/10 text-amber-400 border-amber-500/20': alert.severity === 'medium',
                    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': alert.severity === 'low',
                  }"
                >
                  {{ alert.severity }}
                </span>
              </div>
              <h3 class="text-md font-extrabold mt-1.5 flex items-center space-x-1.5"
                  :class="isDark ? 'text-white' : 'text-slate-800'">
                <MapPin class="w-4 h-4 text-slate-500" />
                <span>{{ alert.nodeName }}</span>
              </h3>
            </div>
            
            <span class="text-[10px] font-mono text-slate-500">{{ alert.timestamp }}</span>
          </div>

          <!-- Alert message box -->
          <div class="my-4 pl-3 flex items-start space-x-3 text-xs leading-relaxed"
               :class="isDark ? 'text-slate-300' : 'text-slate-600'">
            <Flame v-if="alert.type === 'fire'" class="w-5 h-5 text-red-500 shrink-0 animate-pulse" />
            <AlertTriangle v-else-if="alert.type === 'smoke'" class="w-5 h-5 text-orange-500 shrink-0" />
            <Wrench v-else-if="alert.type === 'hardware'" class="w-5 h-5 text-amber-500 shrink-0" />
            <Radio v-else-if="alert.type === 'offline'" class="w-5 h-5 text-red-500 shrink-0" />
            <Info v-else class="w-5 h-5 text-emerald-500 shrink-0" />

            <p>{{ alert.message }}</p>
          </div>

          <!-- Interaction Actions -->
          <div class="flex items-center space-x-3 justify-end border-t pt-3.5"
               :class="isDark ? 'border-slate-900' : 'border-slate-200'">
            <!-- Drone dispatch button (only available if active fire/smoke/offline is unacknowledged) -->
            <button 
              v-if="!alert.acknowledged && (alert.type === 'fire' || alert.type === 'smoke' || alert.type === 'offline')"
              @click="dispatchDrone(alert.nodeName)"
              :disabled="!!activeDroneMission"
              class="px-3.5 py-1.5 border rounded-lg text-[10px] font-mono uppercase transition-all duration-300 flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              :class="isDark 
                ? 'border-cyan-800 text-cyan-400 hover:text-white hover:bg-cyan-500/20 hover:border-cyan-500/50' 
                : 'border-cyan-300 text-cyan-600 hover:text-cyan-800 hover:bg-cyan-50 hover:border-cyan-400'"
            >
              <Send class="w-3.5 h-3.5" />
              <span>Despachar Dron</span>
            </button>

            <!-- Acknowledge ACK Button -->
            <button 
              v-if="!alert.acknowledged"
              @click="store.acknowledgeAlert(alert.id)"
              class="px-3.5 py-1.5 border rounded-lg text-[10px] font-mono uppercase transition-all duration-300 flex items-center space-x-1.5 cursor-pointer font-bold"
              :class="isDark 
                ? 'bg-emerald-950 border-emerald-800 text-emerald-400 hover:text-white hover:bg-emerald-500/20 hover:border-emerald-500/50' 
                : 'bg-emerald-50 border-emerald-250 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300'"
            >
              <Check class="w-3.5 h-3.5" />
              <span>Acusar Alerta (ACK)</span>
            </button>
            <span v-else class="text-[10px] font-mono text-slate-500 flex items-center space-x-1.5 px-3 py-1 rounded border select-none"
                  :class="isDark ? 'bg-slate-950 border-slate-900' : 'bg-slate-50 border-slate-200'">
              <Check class="w-3.5 h-3.5 text-slate-500" />
              <span>ARCHIVADO / ACK</span>
            </span>
          </div>

        </div>

      </section>

      <!-- Empty state -->
      <div 
        v-if="filteredAlerts.length === 0" 
        class="glass-panel p-16 text-center text-slate-500 font-mono border border-dashed border-slate-800 rounded-2xl"
      >
        <span class="block text-lg font-bold text-slate-400 mb-2">No hay incidentes pendientes</span>
        <span>Toda la red forestal IoT de Cusco se reporta en parámetros estables.</span>
      </div>

    </div>
  </div>
</template>
