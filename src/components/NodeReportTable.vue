<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { IoTNode } from '@/stores/fireStore'
import { formatDeveui, formatValue, riskLabel } from '@/utils/format'
import { connectionLabel, isNodeConnected } from '@/constants/connection'

defineProps<{
  nodes: IoTNode[]
}>()

const router = useRouter()

const goToNode = (id: string) => router.push(`/devices/${id}`)
</script>

<template>
  <div class="glass-panel overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
      <h3 class="font-extrabold text-sm tracking-wide text-slate-900 dark:text-white">
        Reporte por nodo
      </h3>
      <p class="text-xs text-slate-500 mt-0.5">Telemetría LoRaWAN en tiempo real · intervalo ~1 min</p>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="text-[10px] font-mono uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
            <th class="px-5 py-3 font-bold">Nodo</th>
            <th class="px-3 py-3 font-bold">Estado</th>
            <th class="px-3 py-3 font-bold">Temp DHT</th>
            <th class="px-3 py-3 font-bold">Humedad</th>
            <th class="px-3 py-3 font-bold">MQ135 (ADC)</th>
            <th class="px-3 py-3 font-bold">Presión</th>
            <th class="px-3 py-3 font-bold">Pitch / Roll</th>
            <th class="px-3 py-3 font-bold">Último uplink</th>
            <th class="px-5 py-3 font-bold"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="node in nodes"
            :key="node.id"
            class="border-b border-slate-100 dark:border-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
          >
            <td class="px-5 py-3">
              <div class="font-bold text-slate-900 dark:text-white">{{ node.name }}</div>
              <div class="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
                {{ node.ttnDeviceId || node.id }}
              </div>
              <div class="text-[10px] font-mono text-slate-500">
                {{ formatDeveui(node.deveui) }}
              </div>
            </td>
            <td class="px-3 py-3">
              <span
                class="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border"
                :class="{
                  'text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800/40 dark:bg-emerald-950/30': node.riskStatus === 'green' && isNodeConnected(node),
                  'text-slate-500 border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900': !isNodeConnected(node),
                  'text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800/40': node.riskStatus === 'yellow',
                  'text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-800/40': node.riskStatus === 'orange',
                  'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800/40': node.riskStatus === 'red',
                }"
              >
                {{ !isNodeConnected(node) ? connectionLabel(node) : riskLabel(node.riskStatus) }}
              </span>
            </td>
            <td class="px-3 py-3 font-mono tabular-nums">{{ formatValue(node.telemetry.tempDht) }} °C</td>
            <td class="px-3 py-3 font-mono tabular-nums">{{ formatValue(node.telemetry.humidity) }} %</td>
            <td class="px-3 py-3 font-mono tabular-nums">{{ formatValue(node.telemetry.mq135Adc, 0) }}</td>
            <td class="px-3 py-3 font-mono tabular-nums">{{ formatValue(node.telemetry.pressureHpa) }} hPa</td>
            <td class="px-3 py-3 font-mono tabular-nums text-[11px]">
              {{ formatValue(node.telemetry.pitchDeg) }}° / {{ formatValue(node.telemetry.rollDeg) }}°
            </td>
            <td class="px-3 py-3 text-[11px] font-mono text-slate-500">{{ node.lastConnection }}</td>
            <td class="px-5 py-3 text-right">
              <button
                class="text-[10px] font-mono font-bold uppercase text-cyan-600 dark:text-cyan-400 hover:underline"
                @click="goToNode(node.id)"
              >
                Ver detalle →
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div
        v-if="nodes.length === 0"
        class="px-5 py-12 text-center text-sm text-slate-500 font-mono"
      >
        No hay nodos registrados.
      </div>
    </div>
  </div>
</template>
