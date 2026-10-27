<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useFireStore } from '@/stores/fireStore'
import type { IoTNode } from '@/stores/fireStore'
import SensorCard from '@/components/SensorCard.vue'
import NodeReportTable from '@/components/NodeReportTable.vue'
import Mpu6050Panel from '@/components/Mpu6050Panel.vue'
import { useTheme } from '@/composables/useTheme'
import { formatDateTime, formatDeveui, formatRelative, formatValue } from '@/utils/format'
import { useNow } from '@/composables/useNow'
import { connectionLabel, isNodeConnected } from '@/constants/connection'
import { SENSOR_INFO } from '@/constants/sensors'
import { MAP_TILE_OPTIONS, mapTileUrl } from '@/constants/mapTiles'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import NodeHistoryCharts from '@/components/NodeHistoryCharts.vue'
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
const now = useNow()
const { isDark } = useTheme()
let map: L.Map | null = null
const mapContainer = ref<HTMLElement | null>(null)
const markersMap = new Map<string, L.Marker>()
let tileLayer: L.TileLayer | null = null

const createCustomIcon = (node: IoTNode) => {
  const online = isNodeConnected(node)
  const pulseClass = online ? 'pulse-green' : ''
  const bgClass = online ? 'bg-emerald-500' : 'bg-slate-500'

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="relative flex items-center justify-center w-8 h-8">
      <div class="absolute inset-0 rounded-full ${pulseClass} opacity-60"></div>
      <div class="w-3.5 h-3.5 rounded-full border-2 border-white ${bgClass} z-10"></div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

/** Nodos sin coordenadas propias comparten el mismo punto y se tapan. */
const markerLatLng = (lat: number, lng: number, slot: number): [number, number] => {
  if (slot === 0) return [lat, lng]
  const angle = slot * 0.9
  const radius = 0.16 * slot
  return [lat + Math.sin(angle) * radius, lng + Math.cos(angle) * radius]
}

const popupHtml = (node: IoTNode) => `
  <div class="p-2 font-sans w-52 text-sm">
    <div class="font-extrabold text-slate-800 dark:text-white mb-1">${node.name}</div>
    <div class="text-[10px] font-mono text-cyan-600 mb-1">${node.ttnDeviceId || node.id}</div>
    <div class="text-[10px] font-mono text-slate-500 mb-2">DevEUI ${formatDeveui(node.deveui)}</div>
    <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
      <div>🌡️ ${formatValue(node.telemetry.tempDht)} °C</div>
      <div>💧 ${formatValue(node.telemetry.humidity)} %</div>
      <div>💨 MQ135 ${formatValue(node.telemetry.mq135Adc, 0)} ADC</div>
    </div>
  </div>`

const updateMapMarkers = () => {
  if (!map) return
  const slots = new Map<string, number>()
  store.nodes.forEach((node) => {
    if (node.lat == null || node.lng == null) {
      markersMap.get(node.id)?.remove()
      markersMap.delete(node.id)
      return
    }
    const key = `${node.lat.toFixed(4)},${node.lng.toFixed(4)}`
    const slot = slots.get(key) ?? 0
    slots.set(key, slot + 1)
    const latLng = markerLatLng(node.lat, node.lng, slot)
    const icon = createCustomIcon(node)
    const online = isNodeConnected(node)
    if (markersMap.has(node.id)) {
      const marker = markersMap.get(node.id)!
      marker.setLatLng(latLng)
      marker.setZIndexOffset(online ? 600 : 0)
      marker.setIcon(icon)
      marker.setPopupContent(popupHtml(node))
    } else {
      const marker = L.marker(latLng, { icon, zIndexOffset: online ? 600 : 0 })
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
  tileLayer = L.tileLayer(mapTileUrl(isDark.value), MAP_TILE_OPTIONS).addTo(map)
  updateMapMarkers()
}

onMounted(() => {
  store.initializeStore()
  initMap()
})

watch(isDark, (dark) => {
  if (!map || !tileLayer) return
  map.removeLayer(tileLayer)
  tileLayer = L.tileLayer(mapTileUrl(dark), MAP_TILE_OPTIONS).addTo(map)
})

watch(() => store.nodes, updateMapMarkers, { deep: true })

watch(() => store.selectedNodeId, (newId) => {
  if (!newId || !map) return
  const node = store.nodes.find((n) => n.id === newId)
  if (node && node.lat != null && node.lng != null) {
    map.setView([node.lat, node.lng], 11, { animate: true })
    markersMap.get(newId)?.openPopup()
  }
})

const refreshAll = () => store.refreshFromServer()
</script>

<template>
  <div
    class="lg:pl-72 min-h-screen pb-8 pt-20 lg:pt-6 bg-[var(--bg-base)]"
  >
    <div class="px-4 lg:px-8 space-y-6">

      <!-- Encabezado del reporte -->
      <header class="glass-panel p-5 lg:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p class="text-[11px] uppercase tracking-[0.16em] text-cyan-500 font-semibold flex items-center gap-1.5">
            <Radio class="w-3.5 h-3.5" />
            Telemetría LoRaWAN · actualización ~1 min
          </p>
          <h1 class="text-2xl lg:text-3xl font-semibold mt-1 font-display" :class="isDark ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'">
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
          class="flex items-center gap-2 px-4 py-2 border border-transparent text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-60"
          :disabled="store.initializing"
          @click="refreshAll"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': store.initializing }" />
          Actualizar
        </button>
      </header>

      <!-- KPIs calculados con los nodos cargados (resumenService) -->
      <section class="grid grid-cols-2 lg:grid-cols-5 gap-[3px] bg-[var(--grid-gap)]">
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
            <p class="text-[11px] uppercase tracking-[0.16em] text-cyan-500 font-semibold">Nodo seleccionado</p>
            <h3 class="text-lg font-semibold font-display truncate text-[var(--text-primary)]">
              {{ store.selectedNode?.name ?? 'Selecciona un nodo en el mapa' }}
            </h3>
            <p v-if="store.selectedNode" class="text-[10px] font-mono text-slate-500">
              {{ store.selectedNode.ttnDeviceId || store.selectedNode.id }}
            </p>
            <p v-if="store.selectedNode" class="text-[10px] font-mono text-[var(--text-secondary)]">
              DevEUI {{ formatDeveui(store.selectedNode.deveui) }}
            </p>
          </div>

          <template v-if="store.selectedNode">
            <div class="grid grid-cols-2 gap-3">
              <SensorCard
                label="Temperatura DHT"
                :value="formatValue(store.selectedNode.telemetry.tempDht)"
                unit="°C"
                :icon="Thermometer"
                :status="store.selectedNode.sensorsHealth.tempDht === 'OK' ? 'ok' : 'na'"
                subtitle="DHT22 · Heltec V3"
                :info="SENSOR_INFO.tempDht"
              />
              <SensorCard
                label="Humedad"
                :value="formatValue(store.selectedNode.telemetry.humidity)"
                unit="%"
                :icon="Droplets"
                :status="store.selectedNode.sensorsHealth.humidity === 'OK' ? 'ok' : 'na'"
                subtitle="DHT22"
                :info="SENSOR_INFO.humidity"
              />
              <SensorCard
                label="Índice gas/humo"
                :value="formatValue(store.selectedNode.telemetry.mq135Adc, 0)"
                unit="ADC"
                :icon="Activity"
                :status="store.selectedNode.sensorsHealth.mq135 === 'OK' ? 'ok' : 'na'"
                subtitle="MQ135 relativo · no es ppm"
                :info="SENSOR_INFO.mq135"
              />
              <SensorCard
                label="Conexión"
                :value="connectionLabel(store.selectedNode)"
                :icon="Activity"
                :status="isNodeConnected(store.selectedNode) ? 'ok' : 'warn'"
                :subtitle="store.selectedNode.lastReadingAt
                  ? `Último uplink: ${formatDateTime(store.selectedNode.lastReadingAt)} (${formatRelative(store.selectedNode.lastReadingAt, now)})`
                  : 'Último uplink: —'"
                :info="SENSOR_INFO.connection"
              />
            </div>

            <Mpu6050Panel :telemetry="store.selectedNode.telemetry" />

            <router-link
              :to="`/devices/${store.selectedNode.id}`"
              class="text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-500 hover:text-cyan-600"
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
            Historial del nodo seleccionado
          </h2>
          <p class="text-xs text-slate-500 mb-4">Últimos uplinks LoRaWAN (~1 min) · los umbrales se dibujan como línea punteada cuando caen dentro de la escala</p>

          <NodeHistoryCharts
            v-if="store.selectedNode?.history.length"
            :history="store.selectedNode.history"
            :umbrales="store.umbrales"
            :metrics="['tempDht', 'humidity', 'mq135', 'tilt']"
          />
          <div v-else class="py-16 text-center text-sm text-slate-500 font-mono border border-dashed rounded-xl">
            Selecciona un nodo con lecturas registradas.
          </div>

          <p class="mt-3 text-[11px] text-slate-500 font-mono">
            MQ135 se muestra como ADC relativo (no concentración calibrada).
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
