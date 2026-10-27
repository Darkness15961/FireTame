<script setup lang="ts">
import { computed } from 'vue'
import apexchart from 'vue3-apexcharts'
import { useTheme } from '@/composables/useTheme'
import { formatValue } from '@/utils/format'
import InfoTip from '@/components/InfoTip.vue'

export interface MetricSeries {
  name: string
  color: string
  data: (number | null)[]
}

export interface MetricThreshold {
  value: number
  label: string
  color: string
}

const props = withDefaults(
  defineProps<{
    title: string
    unit: string
    labels: string[]
    /** Fecha y hora completas para el tooltip; el eje usa `labels`. */
    fullLabels?: string[]
    series: MetricSeries[]
    decimals?: number
    info?: string
    thresholds?: MetricThreshold[]
    height?: number
  }>(),
  { decimals: 1, thresholds: () => [], height: 180 },
)

const { isDark } = useTheme()

const stats = computed(() => {
  const main = props.series[0]?.data ?? []
  const valid = main.filter((v): v is number => v != null)
  const last = [...main].reverse().find((v) => v != null) ?? null
  const omitted = main.length - valid.length
  return {
    last,
    min: valid.length ? Math.min(...valid) : null,
    max: valid.length ? Math.max(...valid) : null,
    omitted,
    hasData: props.series.some((s) => s.data.some((v) => v != null)),
  }
})

const options = computed(() => ({
  chart: {
    type: 'line' as const,
    background: 'transparent',
    foreColor: isDark.value ? '#64748b' : '#475569',
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: false },
  },
  stroke: { curve: 'smooth' as const, width: 2 },
  colors: props.series.map((s) => s.color),
  dataLabels: { enabled: false },
  markers: { size: 0, hover: { size: 4 } },
  grid: { borderColor: isDark.value ? '#1e293b' : '#e2e8f0', strokeDashArray: 3 },
  xaxis: {
    categories: props.labels,
    tickAmount: 6,
    labels: { rotate: 0, hideOverlappingLabels: true, style: { fontSize: '9px', fontFamily: 'JetBrains Mono' } },
    tooltip: { enabled: false },
  },
  yaxis: {
    labels: { formatter: (v: number) => (v == null ? '' : v.toFixed(props.decimals)) },
  },
  annotations: {
    yaxis: props.thresholds.map((t) => ({
      y: t.value,
      borderColor: t.color,
      strokeDashArray: 4,
      label: {
        text: t.label,
        position: 'left',
        textAnchor: 'start',
        offsetX: 4,
        borderColor: 'transparent',
        style: { background: 'transparent', color: t.color, fontSize: '9px' },
      },
    })),
  },
  legend: { show: props.series.length > 1, position: 'top' as const, fontSize: '11px' },
  tooltip: {
    theme: isDark.value ? ('dark' as const) : ('light' as const),
    x: {
      formatter: (_value: unknown, opts?: { dataPointIndex?: number }) => {
        const i = opts?.dataPointIndex ?? -1
        return props.fullLabels?.[i] ?? props.labels[i] ?? ''
      },
    },
    y: { formatter: (v: number | null) => (v == null ? 'sin dato' : `${v.toFixed(props.decimals)} ${props.unit}`) },
  },
}))
</script>

<template>
  <article class="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col">
    <header class="flex items-start justify-between gap-2 px-1">
      <div>
        <h3 class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)] flex items-center gap-1.5">
          {{ title }}
          <InfoTip v-if="info" :text="info" />
        </h3>
        <p class="text-[10px] font-mono text-slate-500 mt-0.5">
          <template v-if="stats.min != null">mín {{ formatValue(stats.min, decimals) }} · máx {{ formatValue(stats.max, decimals) }}</template>
          <template v-if="stats.omitted"> · {{ stats.omitted }} sin dato</template>
        </p>
        <p v-if="thresholds.length" class="text-[10px] font-mono mt-0.5 flex flex-wrap gap-x-2">
          <span v-for="t in thresholds" :key="t.label" :style="{ color: t.color }">{{ t.label }}</span>
        </p>
      </div>
      <p class="text-lg font-display font-semibold tabular-nums text-[var(--text-primary)] whitespace-nowrap">
        {{ formatValue(stats.last, decimals) }}
        <span class="text-[11px] text-slate-500 font-normal">{{ unit }}</span>
      </p>
    </header>
    <apexchart v-if="stats.hasData" type="line" :height="height" :options="options" :series="series" />
    <p v-else class="flex-1 grid place-items-center text-xs font-mono text-slate-500 py-10">
      Sin lecturas válidas en este periodo.
    </p>
  </article>
</template>
