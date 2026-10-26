<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFireStore } from '@/stores/fireStore'
import SensorCard from '@/components/SensorCard.vue'
import { useTheme } from '@/composables/useTheme'
import { formatDateTime, formatDeveui, formatRelative, formatValue, riskLabel } from '@/utils/format'
import { useNow } from '@/composables/useNow'
import InfoTip from '@/components/InfoTip.vue'
import { SENSOR_INFO } from '@/constants/sensors'
import { connectionLabel, isNodeConnected } from '@/constants/connection'
import apexchart from 'vue3-apexcharts'
import Mpu6050Panel from '@/components/Mpu6050Panel.vue'
import {
  ArrowLeft,
  Thermometer,
  Droplets,
  Activity,
  MapPin,
  History,
  RefreshCw,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const store = useFireStore()
const { isDark } = useTheme()
const now = useNow()

const nodeId = computed(() => route.params.id as string)
const node = computed(() => store.nodes.find((n) => n.id === nodeId.value) ?? null)

onMounted(async () => {
  await store.initializeStore()
  if (node.value) store.selectedNodeId = node.value.id
  else if (nodeId.value) await store.refreshNode(nodeId.value)
})

const chartOptions = computed(() => ({
  chart: {
    type: 'line' as const,
    background: 'transparent',
    foreColor: isDark.value ? '#64748b' : '#475569',
    toolbar: { show: false },
  },
  stroke: { curve: 'smooth' as const, width: 2 },
  colors: ['#38bdf8', '#a855f7', '#f59e0b'],
  dataLabels: { enabled: false },
  grid: { borderColor: isDark.value ? '#1e293b' : '#e2e8f0' },
  xaxis: {
    categories: node.value?.history.map((h) => h.timestamp) ?? [],
    labels: { style: { fontSize: '9px' } },
    tooltip: { enabled: false },
  },
  legend: { fontSize: '11px' },
  tooltip: { theme: isDark.value ? 'dark' as const : 'light' as const },
}))

const chartSeries = computed(() => {
  if (!node.value?.history.length) return []
  const series = [
    { name: 'Temperatura DHT (°C)', data: node.value.history.map((h) => h.tempDht) },
    { name: 'Humedad (%)', data: node.value.history.map((h) => h.humidity) },
    { name: 'MQ135 (ADC)', data: node.value.history.map((h) => h.mq135Adc) },
  ]
  return series
})

const ubicacion = computed(() => {
  if (!node.value || node.value.lat == null || node.value.lng == null) return 'Sin coordenadas registradas'
  return `${node.value.lat.toFixed(4)}, ${node.value.lng.toFixed(4)}`
})

const nodeLogs = computed(() =>
  store.logs.filter(
    (l) =>
      l.message.includes(node.value?.name ?? '') ||
      l.message.includes(node.value?.id ?? '')
  )
)
</script>

<template>
  <div
    class="lg:pl-72 min-h-screen pb-12 pt-20 lg:pt-6 bg-[var(--bg-base)]"
  >
    <div v-if="node" class="px-4 lg:px-8 space-y-6">

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center gap-3">
          <button
            class="p-2.5 border rounded-xl"
            :class="isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'"
            @click="router.push('/devices')"
          >
            <ArrowLeft class="w-4 h-4" />
          </button>
          <div>
            <p class="text-[10px] font-mono text-cyan-500 font-bold uppercase">{{ node.ttnDeviceId || node.id }}</p>
            <h1 class="text-2xl font-extrabold" :class="isDark ? 'text-white' : 'text-slate-900'">{{ node.name }}</h1>
            <p class="text-[11px] font-mono text-slate-500">DevEUI {{ formatDeveui(node.deveui) }}</p>
          </div>
        </div>
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-mono font-bold uppercase"
          :class="isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'"
          @click="store.refreshNode(node.id)"
        >
          <RefreshCw class="w-4 h-4" />
          Actualizar datos
        </button>
      </div>

      <!-- Estado general -->
      <div class="glass-panel p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <span class="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
            Estado operativo
            <InfoTip :text="SENSOR_INFO.connection" />
          </span>
          <p class="font-bold mt-1" :class="isNodeConnected(node) ? 'text-emerald-500' : 'text-slate-500'">
            {{ connectionLabel(node) }}
          </p>
          <p class="text-[11px] font-mono text-slate-500 mt-0.5">
            Último uplink: {{ formatDateTime(node.lastReadingAt) }}
            <template v-if="node.lastReadingAt">({{ formatRelative(node.lastReadingAt, now) }})</template>
          </p>
        </div>
        <div>
          <span class="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
            Nivel de riesgo
            <InfoTip text="Se calcula con la última lectura del nodo y los umbrales configurados en Centro de Alertas.
Normal: menos de 25 puntos. Observación: 25 a 49. Riesgo alto: 50 a 74. Crítico: 75 o más." />
          </span>
          <p class="font-bold mt-1">{{ riskLabel(node.riskStatus) }} <span class="font-mono text-xs text-slate-500">({{ node.riskScore }} pts)</span></p>
        </div>
        <div>
          <span class="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
            <MapPin class="w-3 h-3" /> Ubicación
            <InfoTip text="Coordenadas guardadas en la base para este nodo. Se cargan en Registro de Nodos; el nodo no las envía." align="right" />
          </span>
          <p class="font-mono mt-1 text-slate-700 dark:text-slate-300">{{ ubicacion }}</p>
        </div>
      </div>

      <!-- Sensores activos -->
      <section>
        <h2 class="text-sm font-extrabold mb-1" :class="isDark ? 'text-white' : 'text-slate-800'">
          {{ isNodeConnected(node) ? 'Lecturas actuales' : 'Última lectura recibida' }}
        </h2>
        <p v-if="!isNodeConnected(node) && node.lastReadingAt" class="text-[11px] font-mono text-amber-500 mb-3">
          Estos valores son del {{ formatDateTime(node.lastReadingAt) }} ({{ formatRelative(node.lastReadingAt, now) }}); el nodo no ha enviado datos desde entonces.
        </p>
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-4" :class="isNodeConnected(node) || !node.lastReadingAt ? 'mt-3' : ''">
          <SensorCard
            label="Temperatura DHT"
            :value="formatValue(node.telemetry.tempDht)"
            unit="°C"
            :icon="Thermometer"
            :status="node.sensorsHealth.tempDht === 'OK' ? 'ok' : 'na'"
            subtitle="DHT22"
            :info="SENSOR_INFO.tempDht"
          />
          <SensorCard
            label="Humedad"
            :value="formatValue(node.telemetry.humidity)"
            unit="%"
            :icon="Droplets"
            :status="node.sensorsHealth.humidity === 'OK' ? 'ok' : 'na'"
            subtitle="DHT22"
            :info="SENSOR_INFO.humidity"
          />
          <SensorCard
            label="Índice gas/humo"
            :value="formatValue(node.telemetry.mq135Adc, 0)"
            unit="ADC"
            :icon="Activity"
            :status="node.sensorsHealth.mq135 === 'OK' ? 'ok' : 'na'"
            subtitle="MQ135 relativo · no es ppm"
            :info="SENSOR_INFO.mq135"
          />
          <SensorCard
            label="Temp BMP"
            :value="formatValue(node.telemetry.tempBmp)"
            unit="°C"
            :icon="Thermometer"
            :status="node.sensorsHealth.tempBmp === 'OK' ? 'ok' : 'na'"
            subtitle="BMP280 (GY-91)"
            :info="SENSOR_INFO.tempBmp"
          />
          <SensorCard
            label="Presión"
            :value="formatValue(node.telemetry.pressureHpa)"
            unit="hPa"
            :icon="Activity"
            :status="node.sensorsHealth.pressure === 'OK' ? 'ok' : 'na'"
            subtitle="BMP280 (GY-91)"
            :info="SENSOR_INFO.pressure"
          />
          <SensorCard
            label="RSSI / SNR"
            :value="`${formatValue(node.telemetry.rssi, 0)} / ${formatValue(node.telemetry.snr)}`"
            :icon="Activity"
            :status="node.telemetry.rssi != null ? 'ok' : 'na'"
            subtitle="Metadatos TTN"
            :info="SENSOR_INFO.radio"
          />
        </div>
      </section>

      <Mpu6050Panel :telemetry="node.telemetry" />

      <!-- Gráfico historial -->
      <section class="glass-panel p-5">
        <div class="flex items-center gap-2 mb-4">
          <History class="w-4 h-4 text-cyan-500" />
          <h2 class="text-sm font-extrabold" :class="isDark ? 'text-white' : 'text-slate-800'">
            Historial de lecturas
          </h2>
        </div>
        <div v-if="chartSeries.length" class="rounded-xl border p-3 border-slate-200 dark:border-slate-800">
          <apexchart type="line" height="260" :options="chartOptions" :series="chartSeries" />
        </div>
        <p v-else class="text-center py-12 text-slate-500 text-sm">Sin historial disponible.</p>
      </section>

      <!-- Eventos del nodo -->
      <section class="glass-panel p-5 max-h-[280px] flex flex-col">
        <h2 class="text-sm font-extrabold mb-3" :class="isDark ? 'text-white' : 'text-slate-800'">
          Eventos del dispositivo
        </h2>
        <div class="flex-1 overflow-y-auto space-y-2 text-xs font-mono">
          <div
            v-for="log in nodeLogs"
            :key="log.id"
            class="p-2 rounded border border-slate-200 dark:border-slate-800"
          >
            [{{ log.timestamp }}] {{ log.message }}
          </div>
          <p v-if="!nodeLogs.length" class="text-slate-500 text-center py-6">Sin eventos para este nodo.</p>
        </div>
      </section>
    </div>

    <div v-else class="text-center py-24 text-slate-500 font-mono">
      <p>Cargando nodo…</p>
    </div>
  </div>
</template>
