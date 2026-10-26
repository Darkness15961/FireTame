<script setup lang="ts">
import type { HeltecTelemetry } from '@/constants/sensors'
import { hasTiltData } from '@/constants/sensors'
import { formatValue } from '@/utils/format'
import { Gauge } from 'lucide-vue-next'
import InfoTip from '@/components/InfoTip.vue'

defineProps<{
  telemetry: HeltecTelemetry
}>()
</script>

<template>
  <div class="border border-[var(--border-subtle)] p-4">
    <div class="flex items-center gap-2 mb-3">
      <Gauge class="w-4 h-4 text-[var(--text-muted)]" />
      <h3 class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        Inclinación (pitch / roll)
      </h3>
      <InfoTip
        text="Ángulos del nodo medidos por el MPU del módulo GY-91.
Sirven para saber si el nodo se movió, se cayó o lo manipularon.
Si el pitch o el roll pasan el ángulo configurado en Centro de Alertas, suman puntos de riesgo."
      />
    </div>

    <div v-if="hasTiltData(telemetry)" class="grid grid-cols-2 gap-2">
      <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
        <p class="text-[9px] font-mono uppercase text-slate-500 font-bold flex items-center gap-1.5">
          Pitch
          <InfoTip text="Inclinación hacia adelante o hacia atrás, en grados. 0° es el nodo plano." />
        </p>
        <p class="text-lg font-display font-semibold tabular-nums mt-0.5 text-[var(--text-primary)]">
          {{ telemetry.pitchDeg != null ? formatValue(telemetry.pitchDeg) : '—' }}
        </p>
        <p class="text-[8px] font-mono text-slate-400">grados</p>
      </div>
      <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
        <p class="text-[9px] font-mono uppercase text-slate-500 font-bold flex items-center gap-1.5">
          Roll
          <InfoTip text="Inclinación hacia un costado, en grados. 0° es el nodo plano; cerca de ±90° está de lado." align="right" />
        </p>
        <p class="text-lg font-display font-semibold tabular-nums mt-0.5 text-[var(--text-primary)]">
          {{ telemetry.rollDeg != null ? formatValue(telemetry.rollDeg) : '—' }}
        </p>
        <p class="text-[8px] font-mono text-slate-400">grados</p>
      </div>
    </div>

    <p v-else class="text-xs text-slate-500 font-mono text-center py-4">
      Sin pitch/roll. El nodo Heltec aún no ha enviado un uplink.
    </p>
  </div>
</template>
