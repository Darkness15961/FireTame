<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFireStore } from '@/stores/fireStore'
import { useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { formatValue, riskLabel } from '@/utils/format'
import { connectionLabel, isNodeConnected } from '@/constants/connection'
import { hasMpuData } from '@/constants/sensors'
import {
  Search,
  Cpu,
  ExternalLink,
  Activity,
} from 'lucide-vue-next'

const store = useFireStore()
const router = useRouter()
const { isDark } = useTheme()
const searchQuery = ref('')

onMounted(() => store.initializeStore())

const filteredNodes = computed(() => {
  if (!searchQuery.value) return store.nodes
  const q = searchQuery.value.toLowerCase()
  return store.nodes.filter(
    (n) => n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
  )
})

const goToDetail = (id: string) => {
  store.selectedNodeId = id
  router.push(`/devices/${id}`)
}
</script>

<template>
  <div
    class="lg:pl-72 min-h-screen bg-cyber-grid pb-12 pt-20 lg:pt-6 transition-colors duration-300"
    :class="isDark ? 'bg-[#030712]' : 'bg-slate-100'"
  >
    <div class="px-4 lg:px-8 space-y-6">

      <header class="glass-panel p-5 lg:p-6">
        <p class="text-[10px] font-mono uppercase tracking-widest text-cyan-500 font-bold flex items-center gap-1.5">
          <Cpu class="w-3.5 h-3.5" />
          Red IoT · {{ store.connectedNodesCount }} de {{ store.nodes.length }} en línea
        </p>
        <h1 class="text-2xl lg:text-3xl font-extrabold mt-1" :class="isDark ? 'text-white' : 'text-slate-900'">
          Dispositivos conectados
        </h1>
      </header>

      <div class="glass-panel p-4">
        <div class="relative max-w-md">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por nombre o ID…"
            class="w-full pl-10 pr-4 py-2 rounded-xl border text-sm focus:outline-none"
            :class="isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200'"
          />
        </div>
      </div>

      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <article
          v-for="node in filteredNodes"
          :key="node.id"
          class="glass-panel p-5 flex flex-col gap-4 hover:shadow-lg transition-shadow"
        >
          <div class="flex justify-between items-start gap-2">
            <div>
              <span class="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">{{ node.id }}</span>
              <h2 class="text-lg font-extrabold" :class="isDark ? 'text-white' : 'text-slate-900'">{{ node.name }}</h2>
            </div>
            <span
              class="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border shrink-0"
              :class="isNodeConnected(node)
                ? 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800/40'
                : 'text-slate-500 border-slate-200 bg-slate-100 dark:border-slate-700'"
            >
              {{ connectionLabel(node) }}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2 text-center text-[10px] font-mono text-slate-500 border-t pt-3 border-slate-200 dark:border-slate-800">
            <div>
              <p class="text-lg font-extrabold tabular-nums text-slate-800 dark:text-white">
                {{ formatValue(node.telemetry.temperature) }}°C
              </p>
              <p>Temp</p>
            </div>
            <div>
              <p class="text-lg font-extrabold tabular-nums text-slate-800 dark:text-white">
                {{ formatValue(node.telemetry.humidity) }}%
              </p>
              <p>Hum</p>
            </div>
            <div v-if="hasMpuData(node.telemetry.mpu)" class="col-span-2 text-left pt-1">
              <p class="text-[9px] uppercase font-bold text-amber-600 dark:text-amber-400 mb-1">MPU6050</p>
              <p>ACC: {{ formatValue(node.telemetry.mpu.accX ?? 0, 0) }}, {{ formatValue(node.telemetry.mpu.accY ?? 0, 0) }}, {{ formatValue(node.telemetry.mpu.accZ ?? 0, 0) }}</p>
              <p>GYRO: {{ formatValue(node.telemetry.mpu.gyroX ?? 0, 0) }}, {{ formatValue(node.telemetry.mpu.gyroY ?? 0, 0) }}, {{ formatValue(node.telemetry.mpu.gyroZ ?? 0, 0) }}</p>
            </div>
          </div>

          <div class="flex items-center justify-between text-xs text-slate-500 font-mono border-t pt-3 border-slate-200 dark:border-slate-800">
            <span class="flex items-center gap-1">
              <Activity class="w-3.5 h-3.5" />
              {{ riskLabel(node.riskStatus) }}
            </span>
            <span>Última: {{ node.lastConnection }}</span>
          </div>

          <button
            class="w-full py-2.5 rounded-xl border text-xs font-mono font-bold uppercase flex items-center justify-center gap-2 transition-colors"
            :class="isDark ? 'border-cyan-800 text-cyan-400 hover:bg-cyan-950/40' : 'border-cyan-200 text-cyan-700 hover:bg-cyan-50'"
            @click="goToDetail(node.id)"
          >
            Ver reporte
            <ExternalLink class="w-3.5 h-3.5" />
          </button>
        </article>
      </section>

      <div
        v-if="!filteredNodes.length"
        class="glass-panel p-16 text-center text-slate-500 font-mono border-dashed"
      >
        {{ store.initializing ? 'Cargando dispositivos…' : 'No hay nodos que coincidan con la búsqueda.' }}
      </div>

    </div>
  </div>
</template>
