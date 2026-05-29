<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useFireStore } from '@/stores/fireStore'
import type { IoTNode } from '@/stores/fireStore'
import AICamera from '@/components/AICamera.vue'
import { useTheme } from '@/composables/useTheme'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import apexchart from 'vue3-apexcharts'
import { 
  Flame, 
  Cpu, 
  AlertTriangle, 
  Thermometer, 
  Activity, 
  Radio, 
  Maximize2,
  Calendar,
  CloudLightning
} from 'lucide-vue-next'

const store = useFireStore()
const { isDark } = useTheme()
let map: L.Map | null = null
const mapContainer = ref<HTMLElement | null>(null)
const markersMap = new Map<string, L.Marker>()

// Tile layer reference so we can swap it on theme change
let tileLayer: L.TileLayer | null = null

const getDarkTile = () => 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const getLightTile = () => 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

// Initialize CartoDB map – tile chosen by current theme
const initMap = () => {
  if (!mapContainer.value) return

  map = L.map(mapContainer.value, {
    zoomControl: true,
    attributionControl: false
  }).setView([-13.38, -72.15], 9.2)

  tileLayer = L.tileLayer(isDark.value ? getDarkTile() : getLightTile(), { maxZoom: 20 }).addTo(map)

  updateMapMarkers()
}

// Custom CSS markers
const createCustomIcon = (node: IoTNode) => {
  let pulseClass = 'pulse-green'
  let bgClass = 'bg-emerald-500'
  
  if (node.riskStatus === 'yellow') {
    pulseClass = 'pulse-yellow'
    bgClass = 'bg-amber-500'
  } else if (node.riskStatus === 'orange') {
    pulseClass = 'pulse-orange'
    bgClass = 'bg-orange-500'
  } else if (node.riskStatus === 'red') {
    pulseClass = 'pulse-red'
    bgClass = 'bg-red-500'
  }

  if (node.techStatus === 'offline') {
    pulseClass = ''
    bgClass = 'bg-slate-700 border-slate-600'
  }

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        <div class="absolute inset-0 rounded-full ${pulseClass} opacity-60"></div>
        <div class="w-3.5 h-3.5 rounded-full border border-slate-950 flex items-center justify-center ${bgClass} shadow-lg z-10">
          <div class="w-1 h-1 bg-white rounded-full"></div>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  })
}

// Synchronize node markers and update danger blooms
const updateMapMarkers = () => {
  if (!map) return

  store.nodes.forEach((node) => {
    const icon = createCustomIcon(node)
    
    if (markersMap.has(node.id)) {
      // Update existing marker
      const marker = markersMap.get(node.id)!
      marker.setIcon(icon)
      
      // Update popups dynamically
      marker.setPopupContent(`
        <div class="p-2 font-sans w-52">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1 mb-2">
            <span class="font-extrabold text-sm text-slate-850 dark:text-white">${node.name}</span>
            <span class="text-[9px] font-mono uppercase bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded text-cyan-600 dark:text-cyan-400 font-bold">${node.id}</span>
          </div>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between"><span class="text-slate-500 dark:text-slate-400">Estado:</span> <span class="font-bold uppercase ${node.riskStatus === 'red' ? 'text-red-500 animate-pulse' : node.riskStatus === 'orange' ? 'text-orange-500' : node.riskStatus === 'yellow' ? 'text-amber-500' : 'text-emerald-500'}">${node.riskStatus === 'red' ? 'Incendio' : node.riskStatus === 'orange' ? 'Posible' : node.riskStatus === 'yellow' ? 'Observación' : 'Normal'}</span></div>
            <div class="flex justify-between"><span class="text-slate-500 dark:text-slate-400">Salud Nodo:</span> <span class="font-mono font-extrabold ${node.healthScore < 40 ? 'text-red-500' : node.healthScore < 75 ? 'text-amber-500' : 'text-emerald-500'}">${node.healthScore}%</span></div>
            <div class="flex justify-between"><span class="text-slate-500 dark:text-slate-400">Temp:</span> <span class="font-mono font-bold text-slate-800 dark:text-white">${node.telemetry.temperature}°C</span></div>
            <div class="flex justify-between"><span class="text-slate-500 dark:text-slate-400">CO2:</span> <span class="font-mono font-bold text-slate-800 dark:text-white">${node.telemetry.co2} ppm</span></div>
          </div>
          <button onclick="window.selectNodeFromMap('${node.id}')" class="mt-2.5 w-full text-center py-1 bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-800/40 text-cyan-700 dark:text-cyan-300 rounded font-mono text-[10px] uppercase font-bold hover:bg-cyan-100 dark:hover:bg-cyan-500/20 hover:text-cyan-800 dark:hover:text-white transition-all">Ver Digital Twin</button>
        </div>
      `)
    } else {
      // Create new marker
      const marker = L.marker([node.lat, node.lng], { icon })
        .addTo(map!)
        .bindPopup(`
          <div class="p-2 font-sans w-52">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1 mb-2">
              <span class="font-extrabold text-sm text-slate-800 dark:text-white">${node.name}</span>
              <span class="text-[9px] font-mono uppercase bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded text-cyan-600 dark:text-cyan-400 font-bold">${node.id}</span>
            </div>
            <div class="space-y-1 text-xs">
              <div class="flex justify-between"><span class="text-slate-500 dark:text-slate-400">Estado:</span> <span class="font-bold uppercase ${node.riskStatus === 'red' ? 'text-red-500 animate-pulse' : node.riskStatus === 'orange' ? 'text-orange-500' : node.riskStatus === 'yellow' ? 'text-amber-500' : 'text-emerald-500'}">${node.riskStatus === 'red' ? 'Incendio' : node.riskStatus === 'orange' ? 'Posible' : node.riskStatus === 'yellow' ? 'Observación' : 'Normal'}</span></div>
              <div class="flex justify-between"><span class="text-slate-500 dark:text-slate-400">Salud:</span> <span class="font-mono font-extrabold ${node.healthScore < 40 ? 'text-red-500' : 'text-emerald-500'}">${node.healthScore}%</span></div>
            </div>
            <button onclick="window.selectNodeFromMap('${node.id}')" class="mt-2.5 w-full text-center py-1 bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-800/40 text-cyan-700 dark:text-cyan-300 rounded font-mono text-[10px] uppercase font-bold hover:bg-cyan-100 dark:hover:bg-cyan-500/20 hover:text-cyan-800 dark:hover:text-white transition-all">Ver Digital Twin</button>
          </div>
        `)
      
      marker.on('click', () => {
        store.selectedNodeId = node.id
      })

      markersMap.set(node.id, marker)
    }
  })
}

// Expose map selection globally so popups can invoke store events
onMounted(() => {
  store.initializeStore()
  initMap()

  // Register map event handler window binding
  ;(window as any).selectNodeFromMap = (nodeId: string) => {
    store.selectedNodeId = nodeId
    const node = store.nodes.find(n => n.id === nodeId)
    if (node && map) {
      map.setView([node.lat, node.lng], 11, { animate: true })
      markersMap.get(nodeId)?.openPopup()
    }
  }
})

// Swap map tile when theme changes
watch(isDark, (dark) => {
  if (!map || !tileLayer) return
  map.removeLayer(tileLayer)
  tileLayer = L.tileLayer(dark ? getDarkTile() : getLightTile(), { maxZoom: 20 }).addTo(map)
})

// Deep-watch Pinia state changes (drives live updates on Leaflet map)
watch(
  () => store.nodes,
  () => {
    updateMapMarkers()
  },
  { deep: true }
)

watch(
  () => store.selectedNodeId,
  (newId) => {
    if (!newId || !map) return
    const node = store.nodes.find(n => n.id === newId)
    if (node) {
      map.setView([node.lat, node.lng], map.getZoom(), { animate: true })
      markersMap.get(newId)?.openPopup()
    }
  }
)

// Primary Area Charts configurations for ApexCharts
const tempHumOptions = computed(() => ({
  chart: {
    id: 'temp-hum-chart',
    type: 'area' as const,
    background: 'transparent',
    foreColor: isDark.value ? '#64748b' : '#475569',
    toolbar: { show: false },
    animations: { enabled: true, easing: 'linear', dynamicAnimation: { speed: 800 } }
  },
  dataLabels: { enabled: false },
  colors: ['#38bdf8', '#a855f7'], // blue (temp) & purple (hum)
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.25,
      opacityTo: 0.02,
      stops: [0, 95]
    }
  },
  stroke: { curve: 'smooth' as const, width: 2 },
  grid: { borderColor: isDark.value ? '#1e293b' : '#cbd5e1', strokeDashArray: 3 },
  xaxis: {
    categories: store.selectedNode ? store.selectedNode.history.map(h => h.timestamp) : [],
    labels: { show: false },
    axisBorder: { show: false },
    axisTicks: { show: false }
  },
  yaxis: [
    {
      title: { text: 'Temp (°C)', style: { color: '#38bdf8', fontFamily: 'Outfit' } },
      labels: { formatter: (val: number) => `${val.toFixed(1)}°C` }
    },
    {
      opposite: true,
      title: { text: 'Humedad (%)', style: { color: '#a855f7', fontFamily: 'Outfit' } },
      labels: { formatter: (val: number) => `${Math.round(val)}%` }
    }
  ],
  tooltip: { theme: isDark.value ? 'dark' as const : 'light' as const }
}))

const tempHumSeries = computed(() => {
  if (!store.selectedNode) return []
  return [
    { name: 'Temperatura', data: store.selectedNode.history.map(h => h.temperature) },
    { name: 'Humedad Relativa', data: store.selectedNode.history.map(h => h.humidity) }
  ]
})

const gasOptions = computed(() => ({
  chart: {
    id: 'gas-pm-chart',
    type: 'area' as const,
    background: 'transparent',
    foreColor: isDark.value ? '#64748b' : '#475569',
    toolbar: { show: false },
    animations: { enabled: true, easing: 'linear', dynamicAnimation: { speed: 800 } }
  },
  dataLabels: { enabled: false },
  colors: ['#06b6d4', '#f43f5e'], // cyan (co2) & rose (pm25)
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.25,
      opacityTo: 0.02,
      stops: [0, 95]
    }
  },
  stroke: { curve: 'smooth' as const, width: 2 },
  grid: { borderColor: isDark.value ? '#1e293b' : '#cbd5e1', strokeDashArray: 3 },
  xaxis: {
    categories: store.selectedNode ? store.selectedNode.history.map(h => h.timestamp) : [],
    labels: { show: false },
    axisBorder: { show: false },
    axisTicks: { show: false }
  },
  yaxis: [
    {
      title: { text: 'CO2 (ppm)', style: { color: '#06b6d4', fontFamily: 'Outfit' } },
      labels: { formatter: (val: number) => `${Math.round(val)} ppm` }
    },
    {
      opposite: true,
      title: { text: 'Partículas (PM2.5)', style: { color: '#f43f5e', fontFamily: 'Outfit' } },
      labels: { formatter: (val: number) => `${Math.round(val)} µg` }
    }
  ],
  tooltip: { theme: isDark.value ? 'dark' as const : 'light' as const }
}))

const gasSeries = computed(() => {
  if (!store.selectedNode) return []
  return [
    { name: 'CO2 / Humo', data: store.selectedNode.history.map(h => h.co2) },
    { name: 'Partículas PM2.5', data: store.selectedNode.history.map(h => h.pm25) }
  ]
})
</script>

<template>
  <div class="lg:pl-72 min-h-screen bg-cyber-grid pb-8 pt-20 lg:pt-6 transition-colors duration-300"
       :class="isDark ? 'bg-[#030712]' : 'bg-slate-100'">
    <div class="px-4 lg:px-8 space-y-6">
      
      <!-- Top Title Panel -->
      <header class="flex flex-col md:flex-row justify-between items-start md:items-center p-4 lg:p-6 rounded-2xl glass-panel relative overflow-hidden">
        <div class="absolute top-0 right-0 h-40 w-40 radar-glow pointer-events-none"></div>
        <div>
          <span class="text-[10px] font-mono tracking-widest uppercase text-cyan-400 font-bold flex items-center space-x-1.5">
            <Radio class="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>CENTRO DE OPERACIONES FORESTALES (NOC)</span>
          </span>
          <h2 class="text-2xl lg:text-3xl font-extrabold tracking-wide mt-1"
              :class="isDark ? 'text-white' : 'text-slate-900'">
            Cusco FireTame Command
          </h2>
        </div>
        <div class="mt-3 md:mt-0 flex items-center space-x-3 text-xs font-mono">
          <div class="px-3 py-2 rounded-xl flex items-center space-x-2 border"
               :class="isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'">
            <Calendar class="w-4 h-4 text-slate-400" />
            <span :class="isDark ? 'text-slate-400' : 'text-slate-500'">TELEMETRÍA ACTUAL: </span>
            <span class="text-cyan-400 font-bold">{{ store.nodes[0]?.lastConnection || 'N/A' }}</span>
          </div>
          <button 
            @click="store.restoreAllNodesNormal"
            class="px-4 py-2 bg-emerald-950/40 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 hover:text-white rounded-xl transition-all duration-300 flex items-center space-x-2 font-bold cursor-pointer"
          >
            <span>RESTABLECER RED</span>
          </button>
        </div>
      </header>

      <!-- Upper Deployed KPIs grid -->
      <section class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        <!-- KPI 1: Active Fires -->
        <div class="glass-panel p-4 flex flex-col justify-between relative overflow-hidden"
             :class="store.activeFiresCount > 0 ? 'border-red-500/40 bg-red-500/5' : ''">
          <div class="flex justify-between items-center text-secondary">
            <span class="text-[10px] uppercase font-bold tracking-wider">Incendios Activos</span>
            <Flame class="w-5 h-5" :class="store.activeFiresCount > 0 ? 'text-red-400 animate-bounce' : 'text-slate-600'" />
          </div>
          <div class="mt-4 flex items-baseline space-x-1">
            <span class="text-2xl font-extrabold"
                  :class="store.activeFiresCount > 0 ? 'text-red-500 animate-pulse' : (isDark ? 'text-white' : 'text-slate-800')">
              {{ store.activeFiresCount }}
            </span>
            <span class="text-[10px] text-secondary">FOCOS</span>
          </div>
          <!-- Pulse warning if fire active -->
          <div v-if="store.activeFiresCount > 0" class="absolute bottom-0 left-0 right-0 h-1 bg-red-500 animate-pulse"></div>
        </div>

        <!-- KPI 2: Connected Nodes -->
        <div class="glass-panel p-4 flex flex-col justify-between">
          <div class="flex justify-between items-center text-secondary">
            <span class="text-[10px] uppercase font-bold tracking-wider">Nodos Enlace</span>
            <Cpu class="w-5 h-5 text-emerald-500" />
          </div>
          <div class="mt-4 flex items-baseline space-x-1">
            <span class="text-2xl font-extrabold" :class="isDark ? 'text-white' : 'text-slate-800'">
              {{ store.connectedNodesCount }}
            </span>
            <span class="text-[10px] text-secondary">/ {{ store.nodes.length }} ONLINE</span>
          </div>
        </div>

        <!-- KPI 3: Offline Nodes -->
        <div class="glass-panel p-4 flex flex-col justify-between"
             :class="store.offlineNodesCount > 0 ? 'border-amber-500/40 bg-amber-500/5' : ''">
          <div class="flex justify-between items-center text-secondary">
            <span class="text-[10px] uppercase font-bold tracking-wider">Nodos Caídos</span>
            <AlertTriangle class="w-5 h-5" :class="store.offlineNodesCount > 0 ? 'text-amber-500 animate-pulse' : (isDark ? 'text-slate-600' : 'text-slate-400')" />
          </div>
          <div class="mt-4 flex items-baseline space-x-1">
            <span class="text-2xl font-extrabold"
                  :class="store.offlineNodesCount > 0 ? 'text-amber-500' : (isDark ? 'text-white' : 'text-slate-800')">
              {{ store.offlineNodesCount }}
            </span>
            <span class="text-[10px] text-secondary">OFFLINE</span>
          </div>
        </div>

        <!-- KPI 4: Active Alerts -->
        <div class="glass-panel p-4 flex flex-col justify-between"
             :class="store.activeAlertsCount > 0 ? 'border-orange-500/40 bg-orange-500/5' : ''">
          <div class="flex justify-between items-center text-secondary">
            <span class="text-[10px] uppercase font-bold tracking-wider">Alertas Activas</span>
            <Activity class="w-5 h-5" :class="store.activeAlertsCount > 0 ? 'text-orange-500 animate-pulse' : (isDark ? 'text-slate-600' : 'text-slate-400')" />
          </div>
          <div class="mt-4 flex items-baseline space-x-1">
            <span class="text-2xl font-extrabold"
                  :class="store.activeAlertsCount > 0 ? 'text-orange-500' : (isDark ? 'text-white' : 'text-slate-800')">
              {{ store.activeAlertsCount }}
            </span>
            <span class="text-[10px] text-secondary">COLA</span>
          </div>
        </div>

        <!-- KPI 5: Average Temp -->
        <div class="glass-panel p-4 flex flex-col justify-between">
          <div class="flex justify-between items-center text-secondary">
            <span class="text-[10px] uppercase font-bold tracking-wider">Temp Promedio</span>
            <Thermometer class="w-5 h-5 text-cyan-500" />
          </div>
          <div class="mt-4 flex items-baseline space-x-1">
            <span class="text-2xl font-extrabold" :class="isDark ? 'text-white' : 'text-slate-800'">
              {{ store.averageTemperature }}
            </span>
            <span class="text-[10px] text-secondary">°C</span>
          </div>
        </div>

        <!-- KPI 6: Cusco Hazard Rating -->
        <div class="glass-panel p-4 flex flex-col justify-between"
             :class="store.globalRiskScore >= 60 ? 'border-red-500/40 bg-red-500/5' : ''">
          <div class="flex justify-between items-center text-secondary">
            <span class="text-[10px] uppercase font-bold tracking-wider">Índice Peligro</span>
            <CloudLightning class="w-5 h-5" :class="store.globalRiskScore >= 60 ? 'text-red-400 animate-bounce' : 'text-slate-600'" />
          </div>
          <div class="mt-4 flex items-baseline space-x-1">
            <span class="text-2xl font-extrabold"
                  :class="{
                    'text-emerald-400': store.globalRiskScore < 25,
                    'text-amber-400': store.globalRiskScore >= 25 && store.globalRiskScore < 60,
                    'text-orange-400': store.globalRiskScore >= 60 && store.globalRiskScore < 85,
                    'text-red-400 animate-pulse': store.globalRiskScore >= 85,
                  }">
              {{ store.globalRiskScore }}%
            </span>
            <span class="text-[10px] text-secondary">SEVERIDAD</span>
          </div>
        </div>

      </section>

      <!-- Central Map and Side HUD Panel Grid -->
      <section class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        <!-- Central Interactive Map Panel (2 Cols) -->
        <div class="xl:col-span-2 glass-panel p-4 lg:p-6 flex flex-col h-[520px]">
          <div class="flex justify-between items-center mb-4">
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 bg-cyan-500 rounded-full shadow-glow-cyan animate-pulse"></span>
              <span class="font-sans font-extrabold text-md tracking-wide"
                    :class="isDark ? 'text-white' : 'text-slate-800'">MAPA GIS - DESPLIEGUE GEOGRÁFICO CUSCO</span>
            </div>
            <div class="flex items-center space-x-4 text-[10px] font-mono text-slate-500">
              <div class="flex items-center space-x-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> <span>Normal</span></div>
              <div class="flex items-center space-x-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span> <span>Obs</span></div>
              <div class="flex items-center space-x-1.5"><span class="w-2 h-2 rounded-full bg-orange-500"></span> <span>Riesgo</span></div>
              <div class="flex items-center space-x-1.5"><span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> <span>Incendio</span></div>
            </div>
          </div>
          <!-- Leaflet Container -->
          <div class="flex-1 w-full rounded-xl overflow-hidden border border-slate-800/80 z-10" ref="mapContainer"></div>
        </div>

        <!-- Right Side Panel: selected node digital twin telemetry & procedural AI stream (1 Col) -->
        <div class="glass-panel p-4 lg:p-6 flex flex-col h-[520px] justify-between">
          <div class="flex items-center justify-between pb-3 border-b"
               :class="isDark ? 'border-slate-800/80' : 'border-slate-200'">
            <div>
              <span class="text-[9px] font-mono text-cyan-500 font-extrabold block">SELECTED DIGITAL TWIN</span>
              <h3 class="text-lg font-extrabold truncate max-w-[190px]"
                  :class="isDark ? 'text-white' : 'text-slate-800'">
                {{ store.selectedNode ? store.selectedNode.name : 'Ningún nodo' }}
              </h3>
            </div>
            <router-link 
              v-if="store.selectedNode"
              :to="`/devices/${store.selectedNodeId}`"
              class="p-2 rounded-xl border transition-all hover:text-cyan-500"
              :class="isDark ? 'bg-slate-950 border-slate-800 hover:border-cyan-500/40 text-slate-400' : 'bg-slate-100 border-slate-200 hover:border-cyan-400/50 text-slate-500'"
              title="Expandir Telemetría"
            >
              <Maximize2 class="w-4 h-4" />
            </router-link>
          </div>

          <!-- Live Procedural camera canvas -->
          <div class="flex-1 my-4 overflow-hidden rounded-xl border"
               :class="isDark ? 'border-slate-800' : 'border-slate-200'">
            <AICamera :node="store.selectedNode" />
          </div>

          <!-- Highlight telemetry panel -->
          <div v-if="store.selectedNode" class="grid grid-cols-2 gap-2 text-xs font-mono">
            <div class="p-2.5 rounded-xl border flex flex-col justify-between"
                 :class="isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-slate-50 border-slate-200'">
              <span class="uppercase text-[9px] font-bold text-secondary">Temperatura</span>
              <span class="text-base font-extrabold mt-1 block" :class="isDark ? 'text-white' : 'text-slate-800'">
                {{ store.selectedNode.telemetry.temperature }}°C
              </span>
            </div>
            <div class="p-2.5 rounded-xl border flex flex-col justify-between"
                 :class="isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-slate-50 border-slate-200'">
              <span class="uppercase text-[9px] font-bold text-secondary">Humedad</span>
              <span class="text-base font-extrabold mt-1 block" :class="isDark ? 'text-white' : 'text-slate-800'">
                {{ store.selectedNode.telemetry.humidity }}%
              </span>
            </div>
            <div class="p-2.5 rounded-xl border flex flex-col justify-between"
                 :class="isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-slate-50 border-slate-200'">
              <span class="uppercase text-[9px] font-bold text-secondary">Química CO2</span>
              <span class="text-base font-extrabold mt-1 block"
                    :class="store.selectedNode.riskStatus === 'red' ? 'text-red-400' : (isDark ? 'text-white' : 'text-slate-800')">
                {{ store.selectedNode.telemetry.co2 }} ppm
              </span>
            </div>
            <div class="p-2.5 rounded-xl border flex flex-col justify-between"
                 :class="isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-slate-50 border-slate-200'">
              <span class="uppercase text-[9px] font-bold text-secondary">Salud General</span>
              <span class="text-base font-extrabold mt-1 block"
                    :class="store.selectedNode.healthScore < 40 ? 'text-red-400' : store.selectedNode.healthScore < 75 ? 'text-amber-400' : 'text-emerald-400'">
                {{ store.selectedNode.healthScore }}%
              </span>
            </div>
          </div>
          <div v-else class="text-center py-10 font-mono text-secondary">
            <span>Selecciona un nodo para activar transmisión satelital.</span>
          </div>
        </div>

      </section>

      <!-- Charts panel and Event log terminal bottom grid -->
      <section class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        <!-- Synchronous Graphs Grid (2 Cols) -->
        <div class="xl:col-span-2 glass-panel p-4 lg:p-6 flex flex-col">
          <div class="flex justify-between items-center mb-6">
            <span class="font-sans font-extrabold text-md tracking-wide"
                  :class="isDark ? 'text-white' : 'text-slate-800'">HISTORIAL TELEMÉTRICO DE SENSORES</span>
            <span class="text-[10px] font-mono text-cyan-500 uppercase tracking-widest font-extrabold">Filtro: Ventana 1h</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6" v-if="store.selectedNode">
            <!-- Temperature and Humidity Area Chart -->
            <div class="p-4 rounded-2xl border"
                 :class="isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-slate-50 border-slate-200'">
              <span class="text-xs font-sans font-extrabold block mb-2"
                    :class="isDark ? 'text-slate-400' : 'text-slate-500'">Atmósfera: Temperatura y Humedad</span>
              <apexchart type="area" height="180" :options="tempHumOptions" :series="tempHumSeries" />
            </div>
            
            <!-- CO2 and Particulates PM2.5 Area Chart -->
            <div class="p-4 rounded-2xl border"
                 :class="isDark ? 'bg-slate-950/40 border-slate-900' : 'bg-slate-50 border-slate-200'">
              <span class="text-xs font-sans font-extrabold block mb-2"
                    :class="isDark ? 'text-slate-400' : 'text-slate-500'">Gases: Densidad CO2 y PM2.5</span>
              <apexchart type="area" height="180" :options="gasOptions" :series="gasSeries" />
            </div>
          </div>
          <div v-else class="text-center py-20 font-mono rounded-2xl border border-dashed"
               :class="isDark ? 'text-slate-500 border-slate-800' : 'text-slate-400 border-slate-300'">
            <span>No hay datos históricos disponibles. Seleccione un nodo en el panel.</span>
          </div>
        </div>

        <!-- Scrolling Event Log Terminal (1 Col) -->
        <div class="glass-panel p-4 lg:p-6 flex flex-col h-[280px]">
          <div class="flex justify-between items-center pb-3 mb-3 border-b"
               :class="isDark ? 'border-slate-800' : 'border-slate-200'">
            <span class="font-sans font-extrabold text-md tracking-wide"
                  :class="isDark ? 'text-white' : 'text-slate-800'">TERMINAL DE EVENTOS</span>
            <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-glow-green"></span>
          </div>

          <!-- Log entries feed -->
          <div class="flex-1 overflow-y-auto space-y-2.5 font-mono text-[10.5px] pr-2">
            <div 
              v-for="log in store.logs" 
              :key="log.id"
              class="p-2 rounded-lg flex items-start space-x-2 border"
              :class="isDark ? 'bg-slate-950/80 border-slate-900/60' : 'bg-slate-50 border-slate-200'"
            >
              <span class="select-none text-[9.5px] font-bold text-secondary">[{{ log.timestamp }}]</span>
              <div class="flex-1">
                <span 
                  :class="{
                    'text-cyan-500 font-bold': log.type === 'info',
                    'text-amber-500 font-bold': log.type === 'warning',
                    'text-red-500 font-bold animate-pulse': log.type === 'error',
                    'text-emerald-500 font-bold': log.type === 'success'
                  }"
                  class="uppercase tracking-wider mr-1"
                >
                  {{ log.type }}:
                </span>
                <span class="leading-relaxed" :class="isDark ? 'text-slate-300' : 'text-slate-600'">{{ log.message }}</span>
              </div>
            </div>
          </div>
        </div>

      </section>

    </div>
  </div>
</template>

<style>
/* Leaflet custom modifications matching cybernetic HUD colors */
.custom-leaflet-marker {
  transition: all 0.5s ease;
}
</style>
