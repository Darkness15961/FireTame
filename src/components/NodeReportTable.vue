<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { IoTNode } from '@/stores/fireStore'
import { formatValue, riskLabel } from '@/utils/format'
import { connectionLabel, isNodeConnected } from '@/constants/connection'
import { hasMpuData } from '@/constants/sensors'

defineProps<{
  nodes: IoTNode[]
}>()

const router = useRouter()

const goToNode = (id: string) => router.push(`/devices/${id}`)

const sensorDisplay = (ok: boolean, value: number, unit: string) =>
  ok ? `${formatValue(value)} ${unit}` : 'Sin datos'
</script>

<template>
  <div class="glass-panel overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
      <h3 class="font-extrabold text-sm tracking-wide text-slate-900 dark:text-white">
        Reporte por nodo
      </h3>
      <p class="text-xs text-slate-500 mt-0.5">Lecturas en tiempo real desde Supabase</p>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="text-[10px] font-mono uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
            <th class="px-5 py-3 font-bold">Nodo</th>
            <th class="px-3 py-3 font-bold">Estado</th>
            <th class="px-3 py-3 font-bold">Temp (DHT22)</th>
            <th class="px-3 py-3 font-bold">Humedad</th>
            <th class="px-3 py-3 font-bold">MPU6050 (ACC / GYRO)</th>
            <th class="px-3 py-3 font-bold">CO₂ / PM2.5</th>
            <th class="px-3 py-3 font-bold">Última conexión</th>
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
              <div class="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">{{ node.id }}</div>
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
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  :class="isNodeConnected(node) ? 'bg-emerald-500' : 'bg-slate-400'"
                />
                {{ !isNodeConnected(node) ? connectionLabel(node) : riskLabel(node.riskStatus) }}
              </span>
            </td>
            <td class="px-3 py-3 font-mono tabular-nums text-slate-800 dark:text-slate-200">
              {{ sensorDisplay(node.sensorsHealth.temperature === 'OK', node.telemetry.temperature, '°C') }}
            </td>
            <td class="px-3 py-3 font-mono tabular-nums text-slate-800 dark:text-slate-200">
              {{ sensorDisplay(node.sensorsHealth.humidity === 'OK', node.telemetry.humidity, '%') }}
            </td>
            <td class="px-3 py-3 text-[10px] font-mono text-slate-600 dark:text-slate-300">
              <template v-if="hasMpuData(node.telemetry.mpu)">
                <div>ACC: {{ formatValue(node.telemetry.mpu.accX ?? 0, 0) }}, {{ formatValue(node.telemetry.mpu.accY ?? 0, 0) }}, {{ formatValue(node.telemetry.mpu.accZ ?? 0, 0) }}</div>
                <div>GYRO: {{ formatValue(node.telemetry.mpu.gyroX ?? 0, 0) }}, {{ formatValue(node.telemetry.mpu.gyroY ?? 0, 0) }}, {{ formatValue(node.telemetry.mpu.gyroZ ?? 0, 0) }}</div>
              </template>
              <span v-else class="text-slate-400">—</span>
            </td>
            <td class="px-3 py-3 text-[11px] font-mono text-slate-500">
              <span v-if="node.sensorsHealth.co2 === 'OK'">{{ formatValue(node.telemetry.co2, 0) }} ppm</span>
              <span v-else class="text-slate-400">CO₂ N/A</span>
              <span class="mx-1">·</span>
              <span v-if="node.sensorsHealth.pm25 === 'OK'">{{ formatValue(node.telemetry.pm25, 0) }} µg/m³</span>
              <span v-else class="text-slate-400">PM2.5 N/A</span>
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
        No hay nodos registrados en la base de datos.
      </div>
    </div>
  </div>
</template>
