<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useFireStore } from '@/stores/fireStore'
import type { IoTNode } from '@/stores/fireStore'
import AICamera from '@/components/AICamera.vue'
import SensorCard from '@/components/SensorCard.vue'
import NodeReportTable from '@/components/NodeReportTable.vue'
import Mpu6050Panel from '@/components/Mpu6050Panel.vue'
import { hasMpuData } from '@/constants/sensors'
import { useTheme } from '@/composables/useTheme'
import { formatDateTime, formatValue } from '@/utils/format'
import { connectionLabel, isNodeConnected } from '@/constants/connection'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import apexchart from 'vue3-apexcharts'
import {
  Cpu,
  AlertTriangle,
  Thermometer,
  Activity,
  Radio,
  Droplets,
  RefreshCw,
  Clock,
} from 'lucide-vue-next'

const store = useFireStore()
const { isDark } = useTheme()
let map: L.Map | null = null
const mapContainer = ref<HTMLElement | null>(null)
const markersMap = new Map<string, L.Marker>()
let tileLayer: L.TileLayer | null = null

const getDarkTile = () => 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const getLightTile = () => 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

const hasCo2Data = computed(() =>
  store.nodes.some((n) => n.sensorsHealth.co2 === 'OK' && n.telemetry.co2 > 0)
)

const createCustomIcon = (node: IoTNode) => {
  let pulseClass = 'pulse-green'
  let bgClass = 'bg-emerald-500'

  if (node.riskStatus === 'yellow') { pulseClass = 'pulse-yellow'; bgClass = 'bg-amber-500' }
  else if (node.riskStatus === 'orange') { pulseClass = 'pulse-orange'; bgClass = 'bg-orange-500' }
  else if (node.riskStatus === 'red') { pulseClass = 'pulse-red'; bgClass = 'bg-red-500' }
  if (!isNodeConnected(node)) { pulseClass = ''; bgClass = 'bg-slate-500' }

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="relative flex items-center justify-center w-8 h-8">
      <div class="absolute inset-0 rounded-full ${pulseClass} opacity-60"></div>
      <div class="w-3.5 h-3.5 rounded-full border border-slate-950 ${bgClass} shadow-lg z-10"></div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

const popupHtml = (node: IoTNode) => `
  <div class="p-2 font-sans w-52 text-sm">
    <div class="font-extrabold text-slate-800 dark:text-white mb-1">${node.name}</div>
    <div class="text-[10px] font-mono text-cyan-600 mb-2">${node.id}</div>
    <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
      <div>🌡️ ${formatValue(node.telemetry.temperature)} °C</div>
      <div>💧 ${formatValue(node.telemetry.humidity)} %</div>
      ${hasMpuData(node.telemetry.mpu) ? `<div>📐 MPU: X=${formatValue(node.telemetry.mpu.accX ?? 0, 0)} Y=${formatValue(node.telemetry.mpu.accY ?? 0, 0)} Z=${formatValue(node.telemetry.mpu.accZ ?? 0, 0)}</div>` : ''}
    </div>
  </div>`

const updateMapMarkers = () => {
  if (!map) return
  store.nodes.forEach((node) => {
    const icon = createCustomIcon(node)
    if (markersMap.has(node.id)) {
      markersMap.get(node.id)!.setIcon(icon).setPopupContent(popupHtml(node))
    } else {
      const marker = L.marker([node.lat, node.lng], { icon })
        .addTo(map!)
        .bindPopup(popupHtml(node))
      marker.on('click', () => { store.selectedNodeId = node.id })
      markersMap.set(node.id, marker)
    }
  })
}

const initMap = () => {
  if (!mapContainer.value) return
  map = L.map(mapContainer.value, { zoomControl: true, attributionControl: false }).setView([-13.38, -72.15], 9.2)
  tileLayer = L.tileLayer(isDark.value ? getDarkTile() : getLightTile(), { maxZoom: 20 }).addTo(map)
  updateMapMarkers()
}

onMounted(() => {
  store.initializeStore()
  initMap()
})

watch(isDark, (dark) => {
  if (!map || !tileLayer) return
  map.removeLayer(tileLayer)
  tileLayer = L.tileLayer(dark ? getDarkTile() : getLightTile(), { maxZoom: 20 }).addTo(map)
})

watch(() => store.nodes, updateMapMarkers, { deep: true })

watch(() => store.selectedNodeId, (newId) => {
  if (!newId || !map) return
  const node = store.nodes.find((n) => n.id === newId)
  if (node) {
    map.setView([node.lat, node.lng], 11, { animate: true })
    markersMap.get(newId)?.openPopup()
  }
})

const chartOptions = computed(() => ({
  chart: {
    type: 'line' as const,
    background: 'transparent',
    foreColor: isDark.value ? '#64748b' : '#475569',
    toolbar: { show: false },
    animations: { enabled: true, dynamicAnimation: { speed: 600 } },
  },
  stroke: { curve: 'smooth' as const, width: 2 },
  colors: ['#38bdf8', '#a855f7'],
  dataLabels: { enabled: false },
  grid: { borderColor: isDark.value ? '#1e293b' : '#e2e8f0', strokeDashArray: 3 },
  xaxis: {
    categories: store.selectedNode?.history.map((h) => h.timestamp) ?? [],
    labels: { style: { fontSize: '9px', fontFamily: 'JetBrains Mono' } },
  },
  yaxis: [
    { title: { text: '°C' }, labels: { formatter: (v: number) => `${v.toFixed(1)}` } },
    { opposite: true, title: { text: '%' }, labels: { formatter: (v: number) => `${Math.round(v)}` } },
  ],
  legend: { position: 'top' as const, fontSize: '11px' },
  tooltip: { theme: isDark.value ? 'dark' as const : 'light' as const },
}))

const chartSeries = computed(() => {
  if (!store.selectedNode?.history.length) return []
  return [
    { name: 'Temperatura (°C)', data: store.selectedNode.history.map((h) => h.temperature) },
    { name: 'Humedad (%)', data: store.selectedNode.history.map((h) => h.humidity) },
  ]
})

const refreshAll = () => store.refreshFromServer()
</script>

<template>
  <div
    class="lg:pl-72 min-h-screen bg-cyber-grid pb-8 pt-20 lg:pt-6 transition-colors duration-300"
    :class="isDark ? 'bg-[#030712]' : 'bg-slate-100'"
  >
    <div class="px-4 lg:px-8 space-y-6">

      <!-- Encabezado del reporte -->
      <header class="glass-panel p-5 lg:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p class="text-[10px] font-mono uppercase tracking-widest text-cyan-500 font-bold flex items-center gap-1.5">
            <Radio class="w-3.5 h-3.5" />
            Reporte IoT · Datos en vivo
          </p>
          <h1 class="text-2xl lg:text-3xl font-extrabold mt-1" :class="isDark ? 'text-white' : 'text-slate-900'">
            Centro de Monitoreo FireTame
          </h1>
          <p class="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <Clock class="w-3.5 h-3.5" />
            Última lectura:
            <span class="font-mono font-bold text-cyan-600 dark:text-cyan-400">
              {{ formatDateTime(store.resumen.ultima_lectura_at) }}
            </span>
          </p>
        </div>
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-mono font-bold uppercase transition-colors"
          :class="isDark ? 'border-slate-700 hover:border-cyan-600 text-slate-300' : 'border-slate-300 hover:border-cyan-500 text-slate-600'"
          :disabled="store.initializing"
          @click="refreshAll"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': store.initializing }" />
          Actualizar
        </button>
      </header>

      <!-- KPIs desde get_resumen_global() -->
      <section class="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div class="glass-panel p-4">
          <div class="flex justify-between items-start">
            <span class="text-[10px] uppercase font-bold text-slate-500">Nodos totales</span>
            <Cpu class="w-4 h-4 text-cyan-500" />
          </div>
          <p class="text-3xl font-extrabold mt-2" :class="isDark ? 'text-white' : 'text-slate-900'">
            {{ store.resumen.total_nodos }}
          </p>
        </div>

        <div class="glass-panel p-4">
          <div class="flex justify-between items-start">
            <span class="text-[10px] uppercase font-bold text-slate-500">En línea</span>
            <Activity class="w-4 h-4 text-emerald-500" />
          </div>
          <p class="text-3xl font-extrabold mt-2 text-emerald-500">{{ store.connectedNodesCount }}</p>
        </div>

        <div class="glass-panel p-4">
          <div class="flex justify-between items-start">
            <span class="text-[10px] uppercase font-bold text-slate-500">Desconectados</span>
            <AlertTriangle class="w-4 h-4 text-amber-500" />
          </div>
          <p class="text-3xl font-extrabold mt-2" :class="store.offlineNodesCount > 0 ? 'text-amber-500' : ''">
            {{ store.offlineNodesCount }}
          </p>
        </div>

        <div class="glass-panel p-4">
          <div class="flex justify-between items-start">
            <span class="text-[10px] uppercase font-bold text-slate-500">Alertas activas</span>
            <AlertTriangle class="w-4 h-4 text-orange-500" />
          </div>
          <p class="text-3xl font-extrabold mt-2" :class="store.resumen.alertas_activas > 0 ? 'text-orange-500' : ''">
            {{ store.resumen.alertas_activas }}
          </p>
        </div>

        <div class="glass-panel p-4 col-span-2 lg:col-span-1">
          <div class="flex justify-between items-start">
            <span class="text-[10px] uppercase font-bold text-slate-500">Temp. promedio</span>
            <Thermometer class="w-4 h-4 text-sky-500" />
          </div>
          <p class="text-3xl font-extrabold mt-2" :class="isDark ? 'text-white' : 'text-slate-900'">
            {{ store.resumen.temp_promedio != null ? formatValue(store.resumen.temp_promedio) : '—' }}
            <span v-if="store.resumen.temp_promedio != null" class="text-base text-slate-500">°C</span>
          </p>
        </div>
      </section>

      <!-- Mapa + panel del nodo seleccionado -->
      <section class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="xl:col-span-2 glass-panel p-4 lg:p-5 flex flex-col h-[480px]">
          <h2 class="text-sm font-extrabold mb-3" :class="isDark ? 'text-white' : 'text-slate-800'">
            Ubicación de nodos
          </h2>
          <div ref="mapContainer" class="flex-1 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800" />
        </div>

        <div class="glass-panel p-4 lg:p-5 flex flex-col gap-4">
          <div>
            <p class="text-[10px] font-mono uppercase text-cyan-500 font-bold">Nodo seleccionado</p>
            <h3 class="text-lg font-extrabold truncate" :class="isDark ? 'text-white' : 'text-slate-900'">
              {{ store.selectedNode?.name ?? 'Selecciona un nodo en el mapa' }}
            </h3>
            <p v-if="store.selectedNode" class="text-[10px] font-mono text-slate-500">{{ store.selectedNode.id }}</p>
          </div>

          <template v-if="store.selectedNode">
            <div class="grid grid-cols-2 gap-3">
              <SensorCard
                label="Temperatura"
                :value="formatValue(store.selectedNode.telemetry.temperature)"
                unit="°C"
                :icon="Thermometer"
                :status="store.selectedNode.sensorsHealth.temperature === 'OK' ? 'ok' : 'na'"
                subtitle="DHT22 · tipo_sensor 1"
              />
              <SensorCard
                label="Humedad"
                :value="formatValue(store.selectedNode.telemetry.humidity)"
                unit="%"
                :icon="Droplets"
                :status="store.selectedNode.sensorsHealth.humidity === 'OK' ? 'ok' : 'na'"
                subtitle="DHT22 · tipo_sensor 2"
              />
              <SensorCard
                label="Conexión"
                :value="connectionLabel(store.selectedNode)"
                :icon="Activity"
                :status="isNodeConnected(store.selectedNode) ? 'ok' : 'warn'"
                :subtitle="`Última lectura: ${store.selectedNode.lastConnection}`"
              />
            </div>

            <Mpu6050Panel :mpu="store.selectedNode.telemetry.mpu" />

            <div class="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 h-36">
              <AICamera :node="store.selectedNode" />
            </div>

            <router-link
              :to="`/devices/${store.selectedNode.id}`"
              class="text-center text-xs font-mono font-bold uppercase text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Ver reporte completo del nodo →
            </router-link>
          </template>
        </div>
      </section>

      <!-- Gráfico + eventos -->
      <section class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="xl:col-span-2 glass-panel p-5">
          <h2 class="text-sm font-extrabold mb-1" :class="isDark ? 'text-white' : 'text-slate-800'">
            Historial de temperatura y humedad
          </h2>
          <p class="text-xs text-slate-500 mb-4">Últimas 20 lecturas · get_historial_nodo()</p>

          <div v-if="store.selectedNode && chartSeries.length" class="rounded-xl border p-3 border-slate-200 dark:border-slate-800">
            <apexchart type="line" height="220" :options="chartOptions" :series="chartSeries" />
          </div>
          <div v-else class="py-16 text-center text-sm text-slate-500 font-mono border border-dashed rounded-xl">
            Selecciona un nodo con lecturas registradas.
          </div>

          <p v-if="!hasCo2Data" class="mt-3 text-[11px] text-slate-500 font-mono">
            CO₂ y PM2.5 no tienen lecturas aún (sensores tipo 3 y 4 no reportan desde el firmware).
          </p>
        </div>

        <div class="glass-panel p-5 flex flex-col max-h-[320px]">
          <h2 class="text-sm font-extrabold mb-3" :class="isDark ? 'text-white' : 'text-slate-800'">
            Eventos recientes
          </h2>
          <div class="flex-1 overflow-y-auto space-y-2 font-mono text-[11px]">
            <div
              v-for="log in store.logs.slice(0, 20)"
              :key="log.id"
              class="p-2 rounded-lg border border-slate-200 dark:border-slate-800"
            >
              <span class="text-slate-500">[{{ log.timestamp }}]</span>
              <span
                class="ml-1 font-bold uppercase"
                :class="{
                  'text-cyan-500': log.type === 'info',
                  'text-amber-500': log.type === 'warning',
                  'text-red-500': log.type === 'error',
                  'text-emerald-500': log.type === 'success',
                }"
              >{{ log.type }}</span>
              <span class="text-slate-600 dark:text-slate-300 ml-1">{{ log.message }}</span>
            </div>
            <p v-if="!store.logs.length" class="text-slate-500 text-center py-8">Sin eventos registrados.</p>
          </div>
        </div>
      </section>

      <!-- Tabla resumen de todos los nodos -->
      <NodeReportTable :nodes="store.nodes" />

    </div>
  </div>
</template>

<style>
.custom-leaflet-marker { transition: all 0.4s ease; }
</style>
