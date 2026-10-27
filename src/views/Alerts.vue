<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFireStore } from '@/stores/fireStore'
import type { Alert } from '@/stores/fireStore'
import { useTheme } from '@/composables/useTheme'
import UmbralesPanel from '@/components/UmbralesPanel.vue'
import { 
  Activity,
  BellRing, 
  ShieldAlert, 
  Check, 
  MapPin, 
  AlertTriangle,
  Flame,
  CheckCheck,
  Wrench
} from 'lucide-vue-next'

const store = useFireStore()
const { isDark } = useTheme()
const filterSeverity = ref<string>('all')
const filterType = ref<string>('all')
const showAcknowledged = ref<boolean>(false)

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
</script>

<template>
  <div class="lg:pl-72 min-h-screen pb-12 pt-20 lg:pt-6 bg-[var(--bg-base)]">
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

      <p class="text-xs font-mono text-slate-500 -mt-2 px-1">
        Cada alerta se guarda cuando un uplink supera el puntaje configurado y sigue pendiente hasta que la acuses,
        aunque el nodo ya no envíe datos. Si un nodo se calla justo después de una alerta, puede ser justamente el incidente.
      </p>

      <UmbralesPanel />

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
            <option value="critical">Crítico</option>
            <option value="high">Alto</option>
            <option value="medium">Medio</option>
            <option value="low">Bajo</option>
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
            <option value="environmental">Riesgo ambiental (sensores)</option>
            <option value="tamper">Inclinación / tamper</option>
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
                      :class="isDark ? 'text-slate-500 bg-slate-950 border-slate-900' : 'text-slate-600 bg-slate-100 border-slate-200'">
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
            <Flame v-if="alert.severity === 'critical'" class="w-5 h-5 text-red-500 shrink-0 animate-pulse" />
            <AlertTriangle v-else-if="alert.type === 'tamper'" class="w-5 h-5 text-amber-500 shrink-0" />
            <Wrench v-else class="w-5 h-5 text-orange-500 shrink-0" />

            <p>{{ alert.message }}</p>
          </div>

          <!-- Interaction Actions -->
          <div class="flex items-center space-x-3 justify-end border-t pt-3.5"
               :class="isDark ? 'border-slate-900' : 'border-slate-200'">
            <!-- Acknowledge ACK Button -->
            <button 
              v-if="!alert.acknowledged"
              @click="store.acknowledgeAlert(alert.id)"
              class="px-3.5 py-1.5 border rounded-lg text-[10px] font-mono uppercase transition-all duration-300 flex items-center space-x-1.5 cursor-pointer font-bold"
              :class="isDark 
                ? 'bg-emerald-950 border-emerald-800 text-emerald-400 hover:text-white hover:bg-emerald-500/20 hover:border-emerald-500/50' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300'"
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
        class="glass-panel p-16 text-center font-mono border border-dashed rounded-2xl animate-fade-in"
        :class="isDark ? 'text-slate-500 border-slate-800' : 'text-slate-500 border-slate-300 shadow-sm'"
      >
        <span class="block text-lg font-bold mb-2" :class="isDark ? 'text-slate-400' : 'text-slate-700'">No hay incidentes pendientes</span>
        <span>Ningún nodo superó el puntaje configurado para encender una alerta.</span>
      </div>

    </div>
  </div>
</template>
