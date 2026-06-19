<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFireStore } from '@/stores/fireStore'
import SensorCard from '@/components/SensorCard.vue'
import { useTheme } from '@/composables/useTheme'
import { formatValue, riskLabel } from '@/utils/format'
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
  },
  legend: { fontSize: '11px' },
  tooltip: { theme: isDark.value ? 'dark' as const : 'light' as const },
}))

const chartSeries = computed(() => {
  if (!node.value?.history.length) return []
  const series = [
    { name: 'Temperatura (°C)', data: node.value.history.map((h) => h.temperature) },
    { name: 'Humedad (%)', data: node.value.history.map((h) => h.humidity) },
  ]
  return series
})

const ubicacion = computed(() => {
  if (!node.value) return '—'
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
    class="lg:pl-72 min-h-screen bg-cyber-grid pb-12 pt-20 lg:pt-6 transition-colors duration-300"
    :class="isDark ? 'bg-[#030712]' : 'bg-slate-100'"
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
            <p class="text-[10px] font-mono text-cyan-500 font-bold uppercase">{{ node.id }}</p>
            <h1 class="text-2xl font-extrabold" :class="isDark ? 'text-white' : 'text-slate-900'">{{ node.name }}</h1>
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
          <span class="text-[10px] uppercase font-bold text-slate-500">Estado operativo</span>
          <p class="font-bold mt-1" :class="isNodeConnected(node) ? 'text-emerald-500' : 'text-slate-500'">
            {{ connectionLabel(node) }}
          </p>
        </div>
        <div>
          <span class="text-[10px] uppercase font-bold text-slate-500">Nivel de riesgo</span>
          <p class="font-bold mt-1">{{ riskLabel(node.riskStatus) }}</p>
        </div>
        <div>
          <span class="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
            <MapPin class="w-3 h-3" /> Ubicación
          </span>
          <p class="font-mono mt-1 text-slate-700 dark:text-slate-300">{{ ubicacion }}</p>
        </div>
      </div>

      <!-- Sensores activos -->
      <section>
        <h2 class="text-sm font-extrabold mb-3" :class="isDark ? 'text-white' : 'text-slate-800'">
          Lecturas actuales
        </h2>
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <SensorCard
            label="Temperatura"
            :value="formatValue(node.telemetry.temperature)"
            unit="°C"
            :icon="Thermometer"
            :status="node.sensorsHealth.temperature === 'OK' ? 'ok' : 'na'"
            subtitle="Sensor DHT22 (id: 1)"
          />
          <SensorCard
            label="Humedad relativa"
            :value="formatValue(node.telemetry.humidity)"
            unit="%"
            :icon="Droplets"
            :status="node.sensorsHealth.humidity === 'OK' ? 'ok' : 'na'"
            subtitle="Sensor DHT22 (id: 2)"
          />
          <SensorCard
            label="Salud del nodo"
            :value="`${node.healthScore}%`"
            :icon="Activity"
            :status="node.healthScore >= 75 ? 'ok' : node.healthScore >= 40 ? 'warn' : 'error'"
            :subtitle="`Conexión: ${node.lastConnection}`"
          />
        </div>
      </section>

      <Mpu6050Panel :mpu="node.telemetry.mpu" />

      <!-- Sensores no instalados -->
      <div
        v-if="node.sensorsHealth.co2 === 'ERR' && node.sensorsHealth.pm25 === 'ERR'"
        class="glass-panel p-4 text-sm text-slate-500 font-mono border-dashed"
      >
        CO₂ (MQ-135, id: 3) y PM2.5 (id: 4) no reportan datos desde este nodo.
      </div>

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
