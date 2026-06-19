<script setup lang="ts">
import type { Mpu6050Readings } from '@/constants/sensors'
import { hasMpuData } from '@/constants/sensors'
import { formatValue } from '@/utils/format'
import { Gauge } from 'lucide-vue-next'

defineProps<{
  mpu: Mpu6050Readings
}>()

const axes = [
  { key: 'accX' as const, label: 'Accel X', unit: 'acc_x', color: 'text-sky-500' },
  { key: 'accY' as const, label: 'Accel Y', unit: 'acc_y', color: 'text-sky-400' },
  { key: 'accZ' as const, label: 'Accel Z', unit: 'acc_z', color: 'text-sky-300' },
  { key: 'gyroX' as const, label: 'Gyro X', unit: 'gyro_x', color: 'text-violet-500' },
  { key: 'gyroY' as const, label: 'Gyro Y', unit: 'gyro_y', color: 'text-violet-400' },
  { key: 'gyroZ' as const, label: 'Gyro Z', unit: 'gyro_z', color: 'text-violet-300' },
]
</script>

<template>
  <div class="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
    <div class="flex items-center gap-2 mb-3">
      <Gauge class="w-4 h-4 text-amber-500" />
      <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
        MPU6050 — 6 ejes
      </h3>
    </div>

    <div v-if="hasMpuData(mpu)" class="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <div
        v-for="axis in axes"
        :key="axis.key"
        class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800"
      >
        <p class="text-[9px] font-mono uppercase text-slate-500 font-bold">{{ axis.label }}</p>
        <p class="text-lg font-extrabold tabular-nums mt-0.5" :class="axis.color">
          {{ mpu[axis.key] != null ? formatValue(mpu[axis.key]!, 0) : '—' }}
        </p>
        <p class="text-[8px] font-mono text-slate-400">{{ axis.unit }}</p>
      </div>
    </div>

    <p v-else class="text-xs text-slate-500 font-mono text-center py-4">
      Sin datos MPU6050. Ejecuta migración 003 y actualiza el firmware.
    </p>
  </div>
</template>
