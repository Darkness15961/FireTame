<script setup lang="ts">
import { computed } from 'vue'
import MetricChart, { type MetricSeries, type MetricThreshold } from '@/components/MetricChart.vue'
import type { NodeHistoryEntry } from '@/stores/fireStore'
import type { UmbralesAlerta } from '@/constants/risk'
import { SENSOR_INFO, sinValoresEnFalla } from '@/constants/sensors'
import { formatDateTime, formatHourMinute } from '@/utils/format'

type Metrica = 'tempDht' | 'humidity' | 'mq135' | 'tempBmp' | 'pressure' | 'tilt'

const props = withDefaults(
  defineProps<{
    history: NodeHistoryEntry[]
    umbrales: UmbralesAlerta
    metrics?: Metrica[]
  }>(),
  { metrics: () => ['tempDht', 'humidity', 'mq135', 'tempBmp', 'pressure', 'tilt'] },
)

const AVISO_FALLAS = '\nLos huecos en la curva son lecturas en falla (sensor sin respuesta), no valores reales.'

const OBS = '#f59e0b'
const CRIT = '#ef4444'

const limpio = computed(() => props.history.map((h) => sinValoresEnFalla(h)))
const labels = computed(() => props.history.map((h) => formatHourMinute(h.receivedAt)))
const fullLabels = computed(() => props.history.map((h) => formatDateTime(h.receivedAt)))

interface Grafica {
  key: Metrica
  title: string
  unit: string
  decimals: number
  info: string
  series: MetricSeries[]
  thresholds: MetricThreshold[]
}

const graficas = computed<Grafica[]>(() => {
  const rows = limpio.value
  const u = props.umbrales
  const all: Record<Metrica, Grafica> = {
    tempDht: {
      key: 'tempDht',
      title: 'Temperatura DHT22',
      unit: '°C',
      decimals: 1,
      info: SENSOR_INFO.tempDht + AVISO_FALLAS,
      series: [{ name: 'Temperatura', color: '#ff6a00', data: rows.map((r) => r.tempDht) }],
      thresholds: [
        { value: u.temp_observacion_c, label: `Observación ${u.temp_observacion_c} °C`, color: OBS },
        { value: u.temp_critica_c, label: `Crítica ${u.temp_critica_c} °C`, color: CRIT },
      ],
    },
    humidity: {
      key: 'humidity',
      title: 'Humedad DHT22',
      unit: '%',
      decimals: 1,
      info: SENSOR_INFO.humidity + AVISO_FALLAS,
      series: [{ name: 'Humedad', color: '#38bdf8', data: rows.map((r) => r.humidity) }],
      thresholds: [
        { value: u.humedad_observacion_pct, label: `Observación ${u.humedad_observacion_pct} %`, color: OBS },
        { value: u.humedad_critica_pct, label: `Crítica ${u.humedad_critica_pct} %`, color: CRIT },
      ],
    },
    mq135: {
      key: 'mq135',
      title: 'Gas / humo MQ135',
      unit: 'ADC',
      decimals: 0,
      info: SENSOR_INFO.mq135 + AVISO_FALLAS,
      series: [{ name: 'MQ135', color: '#a855f7', data: rows.map((r) => r.mq135Adc) }],
      thresholds: [],
    },
    tempBmp: {
      key: 'tempBmp',
      title: 'Temperatura BMP280',
      unit: '°C',
      decimals: 1,
      info: SENSOR_INFO.tempBmp + AVISO_FALLAS,
      series: [{ name: 'Temperatura BMP', color: '#fb923c', data: rows.map((r) => r.tempBmp) }],
      thresholds: [],
    },
    pressure: {
      key: 'pressure',
      title: 'Presión BMP280',
      unit: 'hPa',
      decimals: 1,
      info: SENSOR_INFO.pressure + AVISO_FALLAS,
      series: [{ name: 'Presión', color: '#22c55e', data: rows.map((r) => r.pressureHpa) }],
      thresholds: [],
    },
    tilt: {
      key: 'tilt',
      title: 'Inclinación MPU',
      unit: '°',
      decimals: 1,
      info:
        'Pitch (adelante/atrás) y roll (de costado) del nodo, en grados. Un cambio brusco indica que el nodo se movió o cayó.' +
        AVISO_FALLAS,
      series: [
        { name: 'Pitch', color: '#14b8a6', data: rows.map((r) => r.pitchDeg) },
        { name: 'Roll', color: '#eab308', data: rows.map((r) => r.rollDeg) },
      ],
      thresholds: u.inclinacion_activa
        ? [
            { value: u.inclinacion_deg, label: `Límite +${u.inclinacion_deg}°`, color: OBS },
            { value: -u.inclinacion_deg, label: `Límite −${u.inclinacion_deg}°`, color: OBS },
          ]
        : [],
    },
  }
  return props.metrics.map((m) => all[m])
})
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <MetricChart
      v-for="g in graficas"
      :key="g.key"
      :title="g.title"
      :unit="g.unit"
      :decimals="g.decimals"
      :info="g.info"
      :labels="labels"
      :full-labels="fullLabels"
      :series="g.series"
      :thresholds="g.thresholds"
    />
  </div>
</template>
