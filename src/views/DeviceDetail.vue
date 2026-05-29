<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFireStore } from '@/stores/fireStore'
import type { IoTNode } from '@/stores/fireStore'
import AICamera from '@/components/AICamera.vue'
import { useTheme } from '@/composables/useTheme'
import apexchart from 'vue3-apexcharts'
import { 
  ArrowLeft, 
  Battery, 
  Wifi, 
  Cpu, 
  ShieldCheck,
  ShieldAlert,
  Flame, 
  AlertTriangle,
  History,
  Activity,
  Wind,
  Wrench,
  Camera,
  Signal
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const store = useFireStore()
const { isDark } = useTheme()

const nodeId = computed(() => route.params.id as string)
const node = computed(() => store.nodes.find(n => n.id === nodeId.value) || null)

onMounted(() => {
  store.initializeStore()
  if (node.value) {
    store.selectedNodeId = node.value.id
  }
})

// Navigation back handler
const goBack = () => {
  router.push('/devices')
}

// Watch route changes to sync Pinia selected node
watch(nodeId, (newId) => {
  if (newId) {
    store.selectedNodeId = newId
  }
})

// Node specific timeline logs
const nodeLogs = computed(() => {
  return store.logs.filter(log => log.message.includes(`[${node.value?.name}]`) || log.message.includes(`[${node.value?.id}]`) || log.message.includes(node.value?.name || ''))
})

// ApexCharts Options for Single Digital Twin
const singleChartOptions = computed(() => ({
  chart: {
    id: 'single-node-full-chart',
    type: 'area' as const,
    background: 'transparent',
    foreColor: isDark.value ? '#64748b' : '#475569',
    toolbar: { show: false },
    animations: { enabled: true, easing: 'linear', dynamicAnimation: { speed: 800 } }
  },
  dataLabels: { enabled: false },
  colors: ['#10b981', '#f59e0b', '#06b6d4', '#f43f5e'], // emerald (temp), amber (hum), cyan (co2), rose (pm25)
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.2,
      opacityTo: 0.01,
      stops: [0, 95]
    }
  },
  stroke: { curve: 'smooth' as const, width: 2 },
  grid: { borderColor: isDark.value ? '#1e293b' : '#cbd5e1', strokeDashArray: 3 },
  xaxis: {
    categories: node.value ? node.value.history.map(h => h.timestamp) : [],
    labels: { show: true, style: { fontSize: '9px', fontFamily: 'JetBrains Mono' } },
    axisBorder: { show: false },
    axisTicks: { show: false }
  },
  yaxis: [
    {
      title: { text: 'Temp (°C) / Hum (%)', style: { color: '#10b981', fontFamily: 'Outfit' } },
      labels: { formatter: (val: number) => `${val.toFixed(0)}` }
    },
    {
      opposite: true,
      title: { text: 'CO2 (ppm) / PM2.5 (µg)', style: { color: '#06b6d4', fontFamily: 'Outfit' } },
      labels: { formatter: (val: number) => `${Math.round(val)}` }
    }
  ],
  tooltip: { theme: isDark.value ? 'dark' as const : 'light' as const }
}))

const singleChartSeries = computed(() => {
  if (!node.value) return []
  return [
    { name: 'Temperatura (°C)', data: node.value.history.map(h => h.temperature) },
    { name: 'Humedad (%)', data: node.value.history.map(h => h.humidity) },
    { name: 'CO2 (ppm)', data: node.value.history.map(h => h.co2) },
    { name: 'Partículas (PM2.5)', data: node.value.history.map(h => h.pm25) }
  ]
})
</script>

<template>
  <div class="lg:pl-72 min-h-screen bg-cyber-grid pb-12 pt-20 lg:pt-6 transition-colors duration-300"
       :class="isDark ? 'bg-[#030712]' : 'bg-slate-100'">
    <div class="px-4 lg:px-8 space-y-6" v-if="node">

      <!-- Breadcrumbs and Header -->
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div class="flex items-center space-x-4">
          <button 
            @click="goBack" 
            class="p-2.5 border rounded-xl transition-all cursor-pointer"
            :class="isDark ? 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 hover:border-slate-400 text-slate-500 hover:text-slate-800'"
          >
            <ArrowLeft class="w-4 h-4" />
          </button>
          <div>
            <div class="flex items-center space-x-2.5">
              <span class="text-[9px] font-mono px-2 py-0.5 rounded text-cyan-500 font-extrabold border"
                    :class="isDark ? 'bg-slate-950 border-slate-900' : 'bg-slate-100 border-slate-200'">{{ node.id }}</span>
              <span class="w-2 h-2 rounded-full shadow-glow-green" 
                    :class="node.riskStatus === 'red' ? 'bg-red-500 animate-pulse' : node.riskStatus === 'orange' ? 'bg-orange-500 animate-pulse' : node.riskStatus === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'"></span>
              <span class="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">DISEÑO DE GEMELO DIGITAL</span>
            </div>
            <h2 class="text-2xl font-extrabold mt-1" :class="isDark ? 'text-white' : 'text-slate-900'">{{ node.name }}</h2>
          </div>
        </div>

        <!-- Node controls panel -->
        <div class="flex items-center space-x-3 font-mono text-xs">
          <button 
            @click="store.restoreNodeNormalState(node.id)"
            class="px-4.5 py-2.5 bg-emerald-950/40 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:text-white rounded-xl transition-all duration-300 font-bold cursor-pointer"
          >
            RESTABLECER NODO
          </button>
        </div>
      </div>

      <!-- Main Twin Dashboard Grid -->
      <section class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        <!-- Left Panel: Procedural camera stream and physical micro-controller diagnostics specs -->
        <div class="space-y-6 flex flex-col">
          <!-- FLIR AI Camera card -->
          <div class="glass-panel p-5 flex flex-col">
            <span class="text-xs font-sans text-slate-400 font-extrabold block mb-4 flex items-center space-x-2">
              <Camera class="w-4 h-4 text-cyan-500" />
              <span>TRANSMISIÓN FLIR TÉRMICA EN TIEMPO REAL</span>
            </span>
            <div class="h-64 rounded-xl overflow-hidden border border-slate-800">
              <AICamera :node="node" />
            </div>
          </div>

          <!-- Micro specs panel -->
          <div class="glass-panel p-5 flex-1">
            <span class="text-xs font-sans text-slate-400 font-extrabold block mb-4 flex items-center space-x-2">
              <Cpu class="w-4 h-4 text-cyan-500" />
              <span>DIAGNÓSTICO FÍSICO DEL HARDWARE IOT</span>
            </span>
            
            <div class="space-y-2.5 font-mono text-xs">
              <div class="flex justify-between border-b border-slate-900 pb-1.5"><span class="text-slate-500">Módulo Core</span> <span class="text-white">ESP32-S3 RISC-V Dual</span></div>
              <div class="flex justify-between border-b border-slate-900 pb-1.5"><span class="text-slate-500">Frecuencia CPU</span> <span class="text-white">240 MHz (Low Power)</span></div>
              <div class="flex justify-between border-b border-slate-900 pb-1.5"><span class="text-slate-500">Dirección MAC</span> <span class="text-white">74:E8:92:DF:{{ node.id.replace('-','') }}:AB</span></div>
              <div class="flex justify-between border-b border-slate-900 pb-1.5"><span class="text-slate-500">Firmware OS</span> <span class="text-cyan-400 font-bold">FireTame IoT v4.1.6</span></div>
              <div class="flex justify-between border-b border-slate-900 pb-1.5"><span class="text-slate-500">Voltaje Panel</span> <span class="text-white">4.82 V [SOLAR COMPAT]</span></div>
              <div class="flex justify-between border-b border-slate-900 pb-1.5"><span class="text-slate-500">Corriente Panel</span> <span class="text-white">185 mA [CARGANDO]</span></div>
              <div class="flex justify-between border-b border-slate-900 pb-1.5"><span class="text-slate-500">Potencia Emisión</span> <span class="text-white">+14 dBm [Transceptor RF]</span></div>
              <div class="flex justify-between border-b border-slate-900 pb-1.5"><span class="text-slate-500">Memoria FLASH</span> <span class="text-white">32.4% Utilizada</span></div>
              <div class="flex justify-between"><span class="text-slate-500">Diagnóstico Enlace</span> <span class="text-emerald-400 font-bold flex items-center space-x-1"><ShieldCheck class="w-3.5 h-3.5 mr-1" /><span>SISTEMA OK</span></span></div>
            </div>
          </div>
        </div>

        <!-- Middle Panel: analog telemetry meters, micro-simulators specific to this node -->
        <div class="xl:col-span-2 space-y-6 flex flex-col justify-between">
          
          <!-- Gauges block -->
          <div class="glass-panel p-5">
            <span class="text-xs font-sans text-slate-400 font-extrabold block mb-6 flex items-center space-x-2">
              <Activity class="w-4 h-4 text-cyan-500" />
              <span>MEDIDORES DE TELEMETRÍA AMBIENTAL ANÁLOGA</span>
            </span>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
              
              <!-- Thermo Gauge -->
              <div class="bg-slate-950/40 p-4 rounded-2xl border border-slate-900 flex flex-col items-center justify-between">
                <span class="text-slate-500 text-[10px] font-mono uppercase tracking-wider block">Temperatura</span>
                <span class="text-2xl font-extrabold text-white mt-3 block"
                      :class="node.telemetry.temperature > 45 ? 'text-red-400 animate-pulse' : 'text-white'">
                  {{ node.telemetry.temperature }}°C
                </span>
                <span class="text-[9px] font-mono text-slate-600 block mt-2">Umbral Crit: 55°C</span>
              </div>

              <!-- Humidity Gauge -->
              <div class="bg-slate-950/40 p-4 rounded-2xl border border-slate-900 flex flex-col items-center justify-between">
                <span class="text-slate-500 text-[10px] font-mono uppercase tracking-wider block">Humedad</span>
                <span class="text-2xl font-extrabold text-white mt-3 block"
                      :class="node.telemetry.humidity < 25 ? 'text-red-400 animate-pulse' : 'text-white'">
                  {{ node.telemetry.humidity }}%
                </span>
                <span class="text-[9px] font-mono text-slate-600 block mt-2">Umbral Crit: &lt;20%</span>
              </div>

              <!-- Carbon Monoxide CO2 -->
              <div class="bg-slate-950/40 p-4 rounded-2xl border border-slate-900 flex flex-col items-center justify-between">
                <span class="text-slate-500 text-[10px] font-mono uppercase tracking-wider block">Química CO2</span>
                <span class="text-2xl font-extrabold mt-3 block"
                      :class="node.telemetry.co2 > 800 ? 'text-red-400 animate-pulse font-bold' : node.telemetry.co2 > 500 ? 'text-orange-400' : 'text-white'">
                  {{ node.telemetry.co2 }} ppm
                </span>
                <span class="text-[9px] font-mono text-slate-600 block mt-2">Umbral Crit: 850ppm</span>
              </div>

              <!-- Particulates PM2.5 -->
              <div class="bg-slate-950/40 p-4 rounded-2xl border border-slate-900 flex flex-col items-center justify-between">
                <span class="text-slate-500 text-[10px] font-mono uppercase tracking-wider block">Partículas</span>
                <span class="text-2xl font-extrabold text-white mt-3 block"
                      :class="node.telemetry.pm25 > 120 ? 'text-red-400 animate-pulse' : 'text-white'">
                  {{ node.telemetry.pm25 }} µg
                </span>
                <span class="text-[9px] font-mono text-slate-600 block mt-2">Umbral Crit: 120µg</span>
              </div>

            </div>

            <!-- Wind vector speed and direction -->
            <div class="mt-4 p-4 bg-slate-950/40 border border-slate-900 rounded-2xl flex items-center justify-between">
              <div class="flex items-center space-x-3.5">
                <div class="p-3 bg-cyan-950/50 rounded-xl border border-cyan-800/40">
                  <Wind class="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <span class="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Vector Viento</span>
                  <span class="text-sm font-extrabold text-white mt-0.5 block">
                    {{ node.telemetry.windSpeed }} km/h
                  </span>
                </div>
              </div>
              
              <div class="flex items-center space-x-3">
                <span class="text-[10px] font-mono text-slate-500 uppercase">DIRECCIÓN:</span>
                <span class="font-mono font-extrabold text-sm text-cyan-400 bg-slate-900 px-3 py-1 rounded border border-slate-800">
                  {{ node.telemetry.windDirection }}
                </span>
              </div>
            </div>
          </div>

          <!-- Micro-Simulators injected directly on this node -->
          <div class="glass-panel p-5">
            <span class="text-xs font-sans text-slate-400 font-extrabold block mb-4 flex items-center space-x-2">
              <Wrench class="w-4 h-4 text-cyan-500" />
              <span>INYECTOR DE ANOMALÍAS ESPECÍFICO DE ESTE NODO</span>
            </span>

            <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
              
              <button 
                @click="store.triggerFireSimulation(node.id)"
                class="px-2 py-3 bg-red-950/20 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl font-mono text-[10px] uppercase font-bold tracking-wider hover:text-white transition-all cursor-pointer flex flex-col items-center justify-center space-y-1.5"
              >
                <Flame class="w-4 h-4 text-red-500" />
                <span>Inyectar Incendio</span>
              </button>

              <button 
                @click="store.triggerSmokeSimulation(node.id)"
                class="px-2 py-3 bg-orange-950/20 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-xl font-mono text-[10px] uppercase font-bold tracking-wider hover:text-white transition-all cursor-pointer flex flex-col items-center justify-center space-y-1.5"
              >
                <Activity class="w-4 h-4 text-orange-400" />
                <span>Inyectar Humo</span>
              </button>

              <button 
                @click="store.triggerFalsePositiveSimulation(node.id)"
                class="px-2 py-3 bg-amber-950/20 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl font-mono text-[10px] uppercase font-bold tracking-wider hover:text-white transition-all cursor-pointer flex flex-col items-center justify-center space-y-1.5"
              >
                <ShieldAlert class="w-4 h-4 text-amber-500" />
                <span>Falso Positivo</span>
              </button>

              <button 
                @click="store.triggerSensorFreezeSimulation(node.id)"
                class="px-2 py-3 bg-yellow-950/20 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 rounded-xl font-mono text-[10px] uppercase font-bold tracking-wider hover:text-white transition-all cursor-pointer flex flex-col items-center justify-center space-y-1.5"
              >
                <AlertTriangle class="w-4 h-4 text-yellow-500" />
                <span>Falla Sensor</span>
              </button>

              <button 
                @click="store.triggerOfflineSimulation(node.id)"
                class="px-2 py-3 bg-slate-900/60 hover:bg-slate-700/20 border border-slate-800 text-slate-400 rounded-xl font-mono text-[10px] uppercase font-bold tracking-wider hover:text-white transition-all cursor-pointer flex flex-col items-center justify-center space-y-1.5"
              >
                <Signal class="w-4 h-4 text-slate-500" />
                <span>Desconectar</span>
              </button>

            </div>
          </div>

        </div>

      </section>

      <!-- Advanced Multi-axis line Area charts -->
      <section class="glass-panel p-5">
        <div class="flex items-center justify-between mb-4 pb-3 border-b"
             :class="isDark ? 'border-slate-800' : 'border-slate-200'">
          <span class="font-sans font-extrabold text-md tracking-wide flex items-center space-x-2"
                :class="isDark ? 'text-white' : 'text-slate-800'">
            <History class="w-4 h-4 text-cyan-500" />
            <span>CRONOLOGÍA Y CURVAS DE TENDENCIA DEL GEMELO DIGITAL</span>
          </span>
          <span class="text-[10px] font-mono text-slate-500 uppercase">Muestreo: Cada 3 segundos</span>
        </div>

        <div class="bg-slate-950/40 p-4 rounded-2xl border border-slate-900">
          <apexchart 
            type="area" 
            height="260" 
            :options="singleChartOptions" 
            :series="singleChartSeries"
          />
        </div>
      </section>

      <!-- Specific node event log timeline -->
      <section class="glass-panel p-5 flex flex-col h-[280px]">
        <div class="flex justify-between items-center pb-3 mb-3 border-b"
             :class="isDark ? 'border-slate-800' : 'border-slate-200'">
          <span class="font-sans font-extrabold text-md tracking-wide"
                :class="isDark ? 'text-white' : 'text-slate-800'">HISTORIAL DE EVENTOS DEL DISPOSITIVO</span>
          <span class="text-[10px] font-mono text-slate-500 uppercase">Log total: {{ nodeLogs.length }} eventos</span>
        </div>

        <!-- Timeline container -->
        <div class="flex-1 overflow-y-auto space-y-2.5 font-mono text-xs pr-2">
          <div 
            v-for="log in nodeLogs" 
            :key="log.id"
            class="p-2 rounded-lg bg-slate-950/80 border border-slate-900/60 flex items-start space-x-2"
          >
            <span class="text-slate-500 select-none text-[9.5px] font-bold">[{{ log.timestamp }}]</span>
            <div class="flex-1">
              <span 
                :class="{
                  'text-cyan-400 font-bold': log.type === 'info',
                  'text-amber-400 font-bold': log.type === 'warning',
                  'text-red-400 font-bold animate-pulse': log.type === 'error',
                  'text-emerald-400 font-bold': log.type === 'success'
                }"
                class="uppercase tracking-wider mr-1"
              >
                {{ log.type }}:
              </span>
              <span class="text-slate-300 leading-relaxed">{{ log.message }}</span>
            </div>
          </div>

          <div 
            v-if="nodeLogs.length === 0" 
            class="text-center text-slate-600 py-10"
          >
            <span>No hay alarmas de emergencia registradas para este nodo. Operativo basal limpio.</span>
          </div>
        </div>
      </section>

    </div>
    
    <!-- Fallback if node not found -->
    <div v-else class="text-center py-20 font-mono text-slate-400">
      <span>Nodo no encontrado o cargando gemelo digital...</span>
    </div>
  </div>
</template>
