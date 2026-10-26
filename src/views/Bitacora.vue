<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { ClipboardList, Download, RefreshCw } from 'lucide-vue-next'
import { useFireStore } from '@/stores/fireStore'
import { useTheme } from '@/composables/useTheme'
import { supabase } from '@/supabase'
import {
  BitacoraSchemaError,
  closeCondicion,
  createCondicion,
  fetchBitacora,
  fetchCondiciones,
  updateCondicion,
} from '@/services/bitacoraService'
import type { BitacoraRow, CondicionPrueba } from '@/types/database'
import {
  APP_TIMEZONE,
  formatDateTime,
  formatDeveui,
  formatSeconds,
  formatTime,
  formatValue,
  parseUtcDate,
} from '@/utils/format'
import InfoTip from '@/components/InfoTip.vue'

const store = useFireStore()
const { isDark } = useTheme()

const rows = ref<BitacoraRow[]>([])
const condiciones = ref<CondicionPrueba[]>([])
const loading = ref(false)
const saving = ref(false)
const schemaMissing = ref(false)
const errorMsg = ref('')
const nodeFilter = ref('all')
const nodeFilterTouched = ref(false)
const formDirty = ref(false)

const draftN = ref(1)
const draftNodeId = ref('')
const draftInicio = ref(nowLocalInput())
const draftDistancia = ref('')
const draftObstaculos = ref('')
const draftAltura = ref('')
const draftClima = ref('')
const draftSituacion = ref('')

let channel: RealtimeChannel | null = null

const fieldClass = computed(() =>
  isDark.value
    ? 'bg-slate-950/80 border-slate-800 text-white placeholder-slate-600'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400',
)

const visibleRows = computed(() =>
  nodeFilter.value === 'all' ? rows.value : rows.value.filter((row) => row.node_id === nodeFilter.value),
)

const latest = computed(() => visibleRows.value[0] ?? null)

const cardNodeId = computed(() => latest.value?.node_id ?? null)

const tips = computed(() => {
  const id = cardNodeId.value ?? 'el nodo'
  return {
    subida: `Tiempo que tarda el paquete de ${id} en viajar por el aire hasta el gateway.\nLo calcula TTN a partir del tamaño del paquete y del data rate (SF y ancho de banda). No depende de la distancia.\nSi el nodo mandara su hora de envío, se usaría la diferencia entre esa hora y la hora del gateway.`,
    rssi: `Señal con la que el gateway recibió el último paquete de ${id}.\nRSSI en dBm: siempre negativo; más cerca de 0 es más fuerte. Por debajo de unos −120 dBm el enlace se pierde.\nSNR en dB: cuánto supera la señal al ruido. Positivo es una señal limpia; LoRa todavía decodifica hasta unos −7 a −20 dB según el SF.`,
    pdr: `Porcentaje de paquetes de ${id} que llegaron a la base.\nSe usa el contador de tramas (frame counter) de TTN: recibidos ÷ (contador máximo − contador mínimo + 1).\nCuenta dentro de la prueba abierta, o en las últimas 24 h si no hay prueba. Si el nodo se reinicia, el contador vuelve a 0.`,
    disponibilidad: `Porcentaje de pings HTTP a Supabase que respondieron en las últimas 24 h.\nMide al servidor, no a ${id}: es el mismo valor para los tres nodos.\nSolo se registra mientras esta aplicación está abierta, un ping cada 60 s.`,
  }
})

function nowLocalInput(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

function limaToIso(local: string): string {
  return new Date(`${local}:00-05:00`).toISOString()
}

function nodeLabel(nodeId: string, fallback?: string | null): string {
  return store.nodes.find((node) => node.id === nodeId)?.name ?? fallback ?? nodeId
}

function optionalNumber(raw: string): number | null {
  if (!raw.trim()) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function errorText(error: unknown): string {
  if (error instanceof BitacoraSchemaError) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: string }).message)
    if (/duplicate|unique|23505/i.test(message)) {
      return 'Ese nodo ya tiene una prueba abierta. Ciérrala antes de abrir otra.'
    }
    return message
  }
  return 'No se pudo guardar.'
}

function formatPdr(row: BitacoraRow): string {
  if (row.pdr_pct == null) return '—'
  const counts =
    row.pdr_recibidos != null && row.pdr_esperados != null
      ? ` (${row.pdr_recibidos}/${row.pdr_esperados})`
      : ''
  return `${formatValue(row.pdr_pct, 1)}%${counts}`
}

function setDraftDirty() {
  formDirty.value = true
}

async function reloadAll() {
  loading.value = true
  schemaMissing.value = false
  errorMsg.value = ''
  try {
    const [bits, conds] = await Promise.all([fetchBitacora(), fetchCondiciones()])
    rows.value = bits
    condiciones.value = conds
    if (!nodeFilterTouched.value && nodeFilter.value === 'all' && bits[0]) {
      nodeFilter.value = bits[0].node_id
    }
    if (!formDirty.value) {
      draftN.value = conds.reduce((max, item) => Math.max(max, item.n), 0) + 1
    }
  } catch (error) {
    if (error instanceof BitacoraSchemaError) schemaMissing.value = true
    else errorMsg.value = error instanceof Error ? error.message : 'No se pudo cargar la bitácora'
  } finally {
    loading.value = false
  }
}

async function reloadReadings() {
  try {
    rows.value = await fetchBitacora()
  } catch (error) {
    if (error instanceof BitacoraSchemaError) schemaMissing.value = true
  }
}

async function openPrueba() {
  if (!draftNodeId.value || !Number.isInteger(draftN.value) || draftN.value < 1) {
    errorMsg.value = 'Indica el número de prueba y el nodo.'
    return
  }
  saving.value = true
  errorMsg.value = ''
  try {
    await createCondicion({
      n: draftN.value,
      node_id: draftNodeId.value,
      iniciada_at: limaToIso(draftInicio.value),
      distancia_m: optionalNumber(draftDistancia.value),
      obstaculos: draftObstaculos.value.trim() || null,
      altura_m: optionalNumber(draftAltura.value),
      clima: draftClima.value.trim() || null,
      situacion_real: draftSituacion.value.trim() || null,
    })
    formDirty.value = false
    draftDistancia.value = ''
    draftObstaculos.value = ''
    draftAltura.value = ''
    draftClima.value = ''
    draftSituacion.value = ''
    draftInicio.value = nowLocalInput()
    await reloadAll()
  } catch (error) {
    errorMsg.value = errorText(error)
  } finally {
    saving.value = false
  }
}

async function saveCondicion(item: CondicionPrueba) {
  saving.value = true
  errorMsg.value = ''
  try {
    await updateCondicion(item.id, {
      n: item.n,
      distancia_m: item.distancia_m,
      obstaculos: item.obstaculos,
      altura_m: item.altura_m,
      clima: item.clima,
      situacion_real: item.situacion_real,
    })
    await reloadAll()
  } catch (error) {
    errorMsg.value = errorText(error)
  } finally {
    saving.value = false
  }
}

async function cerrarPrueba(id: string) {
  saving.value = true
  errorMsg.value = ''
  try {
    await closeCondicion(id)
    await reloadAll()
  } catch (error) {
    errorMsg.value = errorText(error)
  } finally {
    saving.value = false
  }
}

function onNumber(item: CondicionPrueba, key: 'distancia_m' | 'altura_m' | 'n', event: Event) {
  const raw = (event.target as HTMLInputElement).value
  if (key === 'n') {
    item.n = Number(raw)
    return
  }
  item[key] = raw.trim() === '' ? null : Number(raw)
}

function onText(item: CondicionPrueba, key: 'obstaculos' | 'clima' | 'situacion_real', event: Event) {
  const raw = (event.target as HTMLInputElement | HTMLTextAreaElement).value
  item[key] = raw.trim() ? raw : null
}

function csvCell(value: string): string {
  if (/[;"\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

function csvNum(value: number | null, digits = 2): string {
  if (value == null || Number.isNaN(value)) return ''
  return value.toFixed(digits).replace('.', ',')
}

/** Fecha y hora de Lima con milisegundos, para que el CSV permita calcular latencias. */
function csvDate(iso: string | null): string {
  const date = parseUtcDate(iso)
  if (!date || Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}.${get('fractionalSecond')}`
}

function intOrDash(value: number | null): string {
  return value == null ? '—' : String(value)
}

interface Columna {
  grupo: string
  titulo: string
  ayuda?: string
  celda: (row: BitacoraRow) => string
  csvTitulos: string[]
  csv: (row: BitacoraRow) => string[]
  clase?: (row: BitacoraRow) => string
}

/** Mismo orden que la bitácora de campo: nodo, prueba, enlace, tiempos, sensores y resultado. */
const columnas: Columna[] = [
  {
    grupo: 'Nodo',
    titulo: 'Nodo (ID TTN)',
    celda: (r) => nodeLabel(r.node_id, r.nodo_nombre),
    csvTitulos: ['Nodo (ID TTN)'],
    csv: (r) => [nodeLabel(r.node_id, r.nodo_nombre)],
    clase: () => 'font-bold',
  },
  {
    grupo: 'Nodo',
    titulo: 'MAC (DevEUI)',
    ayuda: 'Identificador de hardware LoRaWAN del nodo, equivalente a la MAC.',
    celda: (r) => formatDeveui(r.nodo_mac),
    csvTitulos: ['MAC (DevEUI)'],
    csv: (r) => [formatDeveui(r.nodo_mac)],
    clase: () => 'font-mono text-[10px]',
  },
  {
    grupo: 'Prueba',
    titulo: 'N',
    ayuda: 'Número de la prueba abierta cuando llegó el uplink.',
    celda: (r) => intOrDash(r.n),
    csvTitulos: ['N'],
    csv: (r) => [r.n == null ? '' : String(r.n)],
  },
  {
    grupo: 'Prueba',
    titulo: 'Distancia (m)',
    celda: (r) => formatValue(r.distancia_m, 1),
    csvTitulos: ['Distancia (m)'],
    csv: (r) => [csvNum(r.distancia_m, 1)],
  },
  {
    grupo: 'Prueba',
    titulo: 'Obstáculos',
    celda: (r) => r.obstaculos ?? '—',
    csvTitulos: ['Obstáculos'],
    csv: (r) => [r.obstaculos ?? ''],
    clase: () => 'font-sans max-w-[16rem] truncate',
  },
  {
    grupo: 'Prueba',
    titulo: 'Altura (m)',
    celda: (r) => formatValue(r.altura_m, 1),
    csvTitulos: ['Altura (m)'],
    csv: (r) => [csvNum(r.altura_m, 1)],
  },
  {
    grupo: 'Prueba',
    titulo: 'Clima',
    celda: (r) => r.clima ?? '—',
    csvTitulos: ['Clima'],
    csv: (r) => [r.clima ?? ''],
    clase: () => 'font-sans',
  },
  {
    grupo: 'Enlace',
    titulo: 'RSSI gateway (dBm)',
    ayuda: 'Potencia con la que el gateway recibió el paquete (metadatos TTN).',
    celda: (r) => formatValue(r.rssi, 0),
    csvTitulos: ['RSSI gateway (dBm)'],
    csv: (r) => [csvNum(r.rssi, 0)],
  },
  {
    grupo: 'Enlace',
    titulo: 'SNR gateway (dB)',
    ayuda: 'Relación señal/ruido en el gateway (metadatos TTN).',
    celda: (r) => formatValue(r.snr, 1),
    csvTitulos: ['SNR gateway (dB)'],
    csv: (r) => [csvNum(r.snr, 1)],
  },
  {
    grupo: 'Enlace',
    titulo: 'RSSI nodo (dBm)',
    ayuda: 'radio.getRSSI() del nodo. Vacío hasta que el firmware lo envíe en el payload.',
    celda: (r) => formatValue(r.node_rssi, 0),
    csvTitulos: ['RSSI nodo (dBm)'],
    csv: (r) => [csvNum(r.node_rssi, 0)],
  },
  {
    grupo: 'Enlace',
    titulo: 'SNR nodo (dB)',
    ayuda: 'radio.getSNR() del nodo. Vacío hasta que el firmware lo envíe en el payload.',
    celda: (r) => formatValue(r.node_snr, 1),
    csvTitulos: ['SNR nodo (dB)'],
    csv: (r) => [csvNum(r.node_snr, 1)],
  },
  {
    grupo: 'Enlace',
    titulo: 'CRC',
    ayuda: 'crc_status que reporta el gateway: CRC_OK, CRC_ERROR o NO_CRC.',
    celda: (r) => r.crc_status ?? '—',
    csvTitulos: ['CRC'],
    csv: (r) => [r.crc_status ?? ''],
    clase: (r) => (r.crc_status === 'CRC_ERROR' ? 'text-red-500' : ''),
  },
  {
    grupo: 'Enlace',
    titulo: 'PDR',
    ayuda: 'Tramas recibidas ÷ (contador máximo − contador mínimo + 1), de la prueba o de las últimas 24 h.',
    celda: (r) => formatPdr(r),
    csvTitulos: ['PDR (%)', 'PDR recibidos', 'PDR esperados'],
    csv: (r) => [
      csvNum(r.pdr_pct, 1),
      r.pdr_recibidos == null ? '' : String(r.pdr_recibidos),
      r.pdr_esperados == null ? '' : String(r.pdr_esperados),
    ],
  },
  {
    grupo: 'Enlace',
    titulo: 'Frame counter',
    ayuda: 'Contador de tramas (f_cnt) del uplink en TTN.',
    celda: (r) => intOrDash(r.f_cnt),
    csvTitulos: ['Frame counter'],
    csv: (r) => [r.f_cnt == null ? '' : String(r.f_cnt)],
  },
  {
    grupo: 'Enlace',
    titulo: 'Disponibilidad servidor',
    ayuda: 'Pings HTTP a Supabase que respondieron en las 24 h previas al uplink.',
    celda: (r) => (r.disponibilidad_pct == null ? '—' : `${formatValue(r.disponibilidad_pct, 1)}%`),
    csvTitulos: ['Disponibilidad servidor (%)'],
    csv: (r) => [csvNum(r.disponibilidad_pct, 1)],
  },
  {
    grupo: 'Tiempos',
    titulo: 'Envío nodo',
    ayuda: 'Hora en que el nodo envió el paquete. Vacío hasta que el firmware mande su reloj.',
    celda: (r) => formatTime(r.node_sent_at),
    csvTitulos: ['Hora envío nodo'],
    csv: (r) => [csvDate(r.node_sent_at)],
  },
  {
    grupo: 'Tiempos',
    titulo: 'Recepción gateway',
    ayuda: 'Hora en que el gateway recibió el paquete (rx_metadata.time de TTN).',
    celda: (r) => formatTime(r.gateway_received_at),
    csvTitulos: ['Hora recepción gateway'],
    csv: (r) => [csvDate(r.gateway_received_at)],
  },
  {
    grupo: 'Tiempos',
    titulo: 'Recepción BD',
    ayuda: 'Hora en que la fila entró a Supabase.',
    celda: (r) => formatTime(r.db_received_at),
    csvTitulos: ['Hora recepción BD'],
    csv: (r) => [csvDate(r.db_received_at)],
  },
  {
    grupo: 'Tiempos',
    titulo: 'Emisión alerta',
    ayuda: 'Hora en que se registró la alerta generada por este uplink.',
    celda: (r) => formatTime(r.hora_emision_alerta),
    csvTitulos: ['Hora emisión alerta'],
    csv: (r) => [csvDate(r.hora_emision_alerta)],
  },
  {
    grupo: 'Latencias',
    titulo: 'Subida nodo → gateway',
    ayuda: 'Hora gateway − hora envío nodo; si el nodo no manda su hora, es el tiempo al aire que calcula TTN.',
    celda: (r) => formatSeconds(r.tiempo_subida_s),
    csvTitulos: ['Subida nodo-gateway (s)', 'Data rate'],
    csv: (r) => [csvNum(r.tiempo_subida_s, 3), r.datarate ?? ''],
  },
  {
    grupo: 'Latencias',
    titulo: 'Gateway → red',
    ayuda: 'Desde que el gateway recibe hasta que TTN lo procesa.',
    celda: (r) => formatSeconds(r.retraso_gateway_red_s),
    csvTitulos: ['Gateway-red (s)'],
    csv: (r) => [csvNum(r.retraso_gateway_red_s, 3)],
  },
  {
    grupo: 'Latencias',
    titulo: 'Red → BD',
    ayuda: 'Desde que TTN procesa el paquete hasta que entra a Supabase.',
    celda: (r) => formatSeconds(r.retraso_red_bd_s),
    csvTitulos: ['Red-BD (s)'],
    csv: (r) => [csvNum(r.retraso_red_bd_s, 3)],
  },
  {
    grupo: 'Sensores',
    titulo: 'T (°C)',
    ayuda: 'Temperatura del DHT22.',
    celda: (r) => formatValue(r.temp_dht_c, 1),
    csvTitulos: ['T (°C)'],
    csv: (r) => [csvNum(r.temp_dht_c, 1)],
  },
  {
    grupo: 'Sensores',
    titulo: 'H (%)',
    ayuda: 'Humedad relativa del DHT22. 0 % es una lectura fallida.',
    celda: (r) => formatValue(r.humidity_pct, 1),
    csvTitulos: ['H (%)'],
    csv: (r) => [csvNum(r.humidity_pct, 1)],
  },
  {
    grupo: 'Sensores',
    titulo: 'CO₂ · MQ135 (ADC)',
    ayuda: 'Lectura cruda del MQ135 (0 a 4095). No está calibrada: no es ppm de CO₂.',
    celda: (r) => formatValue(r.mq135_adc, 0),
    csvTitulos: ['CO2 MQ135 (ADC)'],
    csv: (r) => [r.mq135_adc == null ? '' : String(Math.round(r.mq135_adc))],
  },
  {
    grupo: 'Resultado',
    titulo: 'Situación real',
    ayuda: 'Anotación de la prueba: si en el lugar había o no una situación crítica.',
    celda: (r) => r.situacion_real ?? '—',
    csvTitulos: ['Situación real'],
    csv: (r) => [r.situacion_real ?? ''],
    clase: () => 'font-sans max-w-[18rem] truncate',
  },
  {
    grupo: 'Resultado',
    titulo: 'Envío de alerta',
    ayuda: 'Sí, si este uplink generó una alerta según los umbrales.',
    celda: (r) => (r.alerta_emitida ? 'Sí' : 'No'),
    csvTitulos: ['Envío de alerta'],
    csv: (r) => [r.alerta_emitida ? 'Sí' : 'No'],
    clase: (r) => (r.alerta_emitida ? 'font-bold text-amber-500' : 'font-bold text-slate-500'),
  },
]

const grupos = columnas.reduce<{ nombre: string; span: number }[]>((acc, col) => {
  const last = acc[acc.length - 1]
  if (last && last.nombre === col.grupo) last.span += 1
  else acc.push({ nombre: col.grupo, span: 1 })
  return acc
}, [])

function exportCsv() {
  const headers = columnas.flatMap((col) => col.csvTitulos)
  const lines = visibleRows.value.map((row) =>
    columnas.flatMap((col) => col.csv(row)).map(csvCell).join(';'),
  )

  const blob = new Blob([`\uFEFF${headers.join(';')}\n${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'bitacora-firetame.csv'
  link.click()
  URL.revokeObjectURL(url)
}

watch(
  () => store.nodes,
  (nodes) => {
    if (!draftNodeId.value && nodes[0]) draftNodeId.value = nodes[0].id
  },
  { immediate: true },
)

onMounted(async () => {
  await store.initializeStore()
  await reloadAll()
  channel = supabase
    .channel('bitacora-readings')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_readings' }, () => {
      void reloadReadings()
    })
    .subscribe()
})

onUnmounted(() => {
  if (channel) void supabase.removeChannel(channel)
})
</script>

<template>
  <div class="lg:pl-72 min-h-screen pb-12 pt-20 lg:pt-6 bg-[var(--bg-base)]">
    <div class="px-4 lg:px-8 space-y-6">
      <header class="glass-panel p-5 lg:p-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p class="text-[10px] font-mono uppercase tracking-widest text-cyan-500 font-bold flex items-center gap-1.5">
            <ClipboardList class="w-3.5 h-3.5" />
            Registro de pruebas LoRaWAN
          </p>
          <h1 class="text-2xl lg:text-3xl font-extrabold mt-1" :class="isDark ? 'text-white' : 'text-slate-900'">
            Bitácora
          </h1>
          <p class="text-sm mt-2 max-w-3xl" :class="isDark ? 'text-slate-400' : 'text-slate-600'">
            Cada fila es un uplink. El tiempo de subida nodo → gateway es el tiempo al aire del paquete.
            La hora del gateway y la hora en que entra a la base quedan aparte. Distancia, obstáculos,
            altura, clima y la situación real se anotan en la prueba y se unen a los paquetes de ese intervalo.
          </p>
        </div>
        <div class="flex gap-2">
          <button
            class="px-3 py-2 rounded-xl border text-xs font-mono font-bold uppercase inline-flex items-center gap-2"
            :class="isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'"
            @click="reloadAll"
          >
            <RefreshCw class="w-3.5 h-3.5" />
            Actualizar
          </button>
          <button
            class="px-3 py-2 rounded-xl border text-xs font-mono font-bold uppercase inline-flex items-center gap-2"
            :class="isDark ? 'border-cyan-800 text-cyan-400' : 'border-cyan-200 text-cyan-700'"
            :disabled="visibleRows.length === 0"
            @click="exportCsv"
          >
            <Download class="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </header>

      <p v-if="errorMsg" class="text-sm text-red-500 font-mono">{{ errorMsg }}</p>

      <section v-if="schemaMissing" class="glass-panel p-5 text-sm space-y-2" :class="isDark ? 'text-slate-300' : 'text-slate-700'">
        <p class="font-bold">La bitácora todavía no está en Supabase.</p>
        <p>Ejecuta <span class="font-mono">supabase/migrations/20261026000000_bitacora_pruebas.sql</span> en el SQL Editor y vuelve a desplegar la función <span class="font-mono">ttn-uplink</span>. Los paquetes nuevos guardarán CRC, contador de trama, tiempo al aire y hora del gateway.</p>
      </section>

      <template v-else>
        <section class="space-y-2">
          <p v-if="cardNodeId" class="text-[11px] font-mono text-slate-500">
            Último uplink de <span class="font-bold text-cyan-600 dark:text-cyan-400">{{ cardNodeId }}</span>
            · {{ formatDateTime(latest?.received_at) }}
          </p>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <article class="glass-panel p-4">
              <p class="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                Tiempo de subida
                <InfoTip :text="tips.subida" />
              </p>
              <p class="text-xl font-extrabold mt-1 font-mono" :class="isDark ? 'text-white' : 'text-slate-900'">
                {{ formatSeconds(latest?.tiempo_subida_s) }}
              </p>
              <p class="text-[10px] text-slate-500 mt-1">Nodo → gateway{{ latest?.datarate ? ` · ${latest.datarate}` : '' }}</p>
            </article>
            <article class="glass-panel p-4">
              <p class="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                RSSI / SNR gateway
                <InfoTip :text="tips.rssi" />
              </p>
              <p class="text-xl font-extrabold mt-1 font-mono" :class="isDark ? 'text-white' : 'text-slate-900'">
                {{ formatValue(latest?.rssi, 0) }} / {{ formatValue(latest?.snr, 1) }}
              </p>
              <p class="text-[10px] text-slate-500 mt-1">dBm / dB</p>
            </article>
            <article class="glass-panel p-4">
              <p class="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                PDR
                <InfoTip :text="tips.pdr" align="right" />
              </p>
              <p class="text-xl font-extrabold mt-1 font-mono" :class="isDark ? 'text-white' : 'text-slate-900'">
                {{ latest ? formatPdr(latest) : '—' }}
              </p>
              <p class="text-[10px] text-slate-500 mt-1">De la prueba, o de las últimas 24 h</p>
            </article>
            <article class="glass-panel p-4">
              <p class="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                Disponibilidad 24 h
                <InfoTip :text="tips.disponibilidad" align="right" />
              </p>
              <p class="text-xl font-extrabold mt-1 font-mono" :class="isDark ? 'text-white' : 'text-slate-900'">
                {{ latest?.disponibilidad_pct == null ? '—' : `${formatValue(latest.disponibilidad_pct, 1)}%` }}
              </p>
              <p class="text-[10px] text-slate-500 mt-1">Servidor Supabase, no el nodo</p>
            </article>
          </div>
        </section>

        <section class="glass-panel overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 class="font-extrabold text-sm" :class="isDark ? 'text-white' : 'text-slate-900'">
                Registros
                <span class="ml-2 text-[11px] font-mono font-normal text-slate-500">{{ visibleRows.length }} uplinks · más reciente primero</span>
              </h2>
              <p class="text-[11px] text-slate-500 mt-1">
                Columnas en el orden de la bitácora de campo. Pasa el cursor sobre un encabezado para ver qué mide.
                Las horas de hoy salen solo con la hora; las de otros días, con la fecha.
              </p>
            </div>
            <select v-model="nodeFilter" class="px-3 py-2 rounded-xl border text-sm font-mono" :class="fieldClass" @change="nodeFilterTouched = true">
              <option value="all">Todos los nodos</option>
              <option v-for="node in store.nodes" :key="node.id" :value="node.id">{{ node.name }}</option>
            </select>
          </div>

          <div class="overflow-auto max-h-[70vh]">
            <table class="w-full text-left text-xs whitespace-nowrap border-separate border-spacing-0">
              <thead class="sticky top-0 z-20 bg-[var(--bg-elevated)]">
                <tr class="text-[10px] font-mono uppercase tracking-wider">
                  <th
                    v-for="(grupo, i) in grupos"
                    :key="grupo.nombre"
                    :colspan="grupo.span"
                    class="px-3 pt-3 pb-1 text-cyan-600 dark:text-cyan-400 border-b border-slate-200 dark:border-slate-800"
                    :class="i > 0 ? 'border-l' : ''"
                  >
                    {{ grupo.nombre }}
                  </th>
                </tr>
                <tr class="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  <th
                    v-for="(col, i) in columnas"
                    :key="col.titulo"
                    :title="col.ayuda"
                    class="px-3 py-2 border-b border-slate-200 dark:border-slate-800"
                    :class="[
                      col.ayuda ? 'cursor-help underline decoration-dotted underline-offset-2' : '',
                      i === 0 ? 'sticky left-0 z-30 bg-[var(--bg-elevated)]' : '',
                    ]"
                  >
                    {{ col.titulo }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in visibleRows"
                  :key="row.reading_id"
                  class="hover:bg-slate-500/5"
                >
                  <td
                    v-for="(col, i) in columnas"
                    :key="col.titulo"
                    class="px-3 py-2 font-mono border-b border-slate-100 dark:border-slate-900/60"
                    :class="[col.clase?.(row) ?? '', i === 0 ? 'sticky left-0 z-10 bg-[var(--bg-elevated)]' : '']"
                  >
                    {{ col.celda(row) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="!loading && visibleRows.length === 0" class="px-5 py-10 text-center text-sm text-slate-500">
              Aún no hay uplinks en la bitácora.
            </p>
          </div>
        </section>

        <section class="glass-panel p-5 space-y-4">
          <h2 class="text-sm font-extrabold" :class="isDark ? 'text-white' : 'text-slate-900'">Abrir prueba</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <label class="text-[10px] uppercase font-bold text-slate-500 space-y-1">
              N
              <input v-model.number="draftN" type="number" min="1" step="1" class="w-full px-3 py-2 rounded-xl border font-mono text-sm" :class="fieldClass" @input="setDraftDirty" />
            </label>
            <label class="text-[10px] uppercase font-bold text-slate-500 space-y-1">
              Nodo
              <select v-model="draftNodeId" class="w-full px-3 py-2 rounded-xl border text-sm" :class="fieldClass" @change="setDraftDirty">
                <option v-for="node in store.nodes" :key="node.id" :value="node.id">{{ node.name }}</option>
              </select>
            </label>
            <label class="text-[10px] uppercase font-bold text-slate-500 space-y-1 md:col-span-2">
              Inicio (hora Lima)
              <input v-model="draftInicio" type="datetime-local" class="w-full px-3 py-2 rounded-xl border font-mono text-sm" :class="fieldClass" @input="setDraftDirty" />
            </label>
            <label class="text-[10px] uppercase font-bold text-slate-500 space-y-1">
              Distancia (m)
              <input v-model="draftDistancia" type="number" min="0" step="any" class="w-full px-3 py-2 rounded-xl border font-mono text-sm" :class="fieldClass" @input="setDraftDirty" />
            </label>
            <label class="text-[10px] uppercase font-bold text-slate-500 space-y-1">
              Altura (m)
              <input v-model="draftAltura" type="number" min="0" step="any" class="w-full px-3 py-2 rounded-xl border font-mono text-sm" :class="fieldClass" @input="setDraftDirty" />
            </label>
            <label class="text-[10px] uppercase font-bold text-slate-500 space-y-1">
              Clima
              <input v-model="draftClima" list="climas-nueva" placeholder="Sol, nubes, lluvia, tormenta" class="w-full px-3 py-2 rounded-xl border text-sm" :class="fieldClass" @input="setDraftDirty" />
            </label>
            <label class="text-[10px] uppercase font-bold text-slate-500 space-y-1">
              Obstáculos
              <input v-model="draftObstaculos" placeholder="Edificios, árboles, línea de vista" class="w-full px-3 py-2 rounded-xl border text-sm" :class="fieldClass" @input="setDraftDirty" />
            </label>
            <label class="text-[10px] uppercase font-bold text-slate-500 space-y-1 md:col-span-2 xl:col-span-4">
              Situación real
              <textarea v-model="draftSituacion" rows="2" placeholder="Describe si en el lugar había una situación de peligro" class="w-full px-3 py-2 rounded-xl border text-sm" :class="fieldClass" @input="setDraftDirty" />
            </label>
          </div>
          <datalist id="climas-nueva">
            <option value="Sol" />
            <option value="Nubes" />
            <option value="Lluvia" />
            <option value="Tormenta" />
            <option value="Niebla" />
          </datalist>
          <p class="text-[11px] text-slate-500">
            Si atrasas el inicio, los uplinks que ya llegaron desde esa hora entran en esta prueba.
            El MAC del nodo es su DevEUI. El gas queda como ADC del MQ135, que es el valor MQ del monitor.
          </p>
          <button
            class="px-4 py-2 rounded-xl border text-xs font-mono font-bold uppercase"
            :class="isDark ? 'border-cyan-800 text-cyan-300' : 'border-cyan-200 text-cyan-800'"
            :disabled="saving"
            @click="openPrueba"
          >
            {{ saving ? 'Guardando…' : 'Abrir prueba' }}
          </button>
        </section>

        <section v-if="condiciones.length" class="space-y-3">
          <article
            v-for="item in condiciones"
            :key="item.id"
            class="glass-panel p-4 space-y-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm font-bold" :class="isDark ? 'text-white' : 'text-slate-900'">
                Prueba {{ item.n }} · {{ nodeLabel(item.node_id) }}
                <span class="ml-2 text-[10px] font-mono uppercase" :class="item.activa ? 'text-emerald-500' : 'text-slate-500'">
                  {{ item.activa ? 'Abierta' : 'Cerrada' }}
                </span>
              </p>
              <p class="text-[11px] font-mono text-slate-500">
                {{ formatDateTime(item.iniciada_at) }}
                <template v-if="item.cerrada_at"> → {{ formatDateTime(item.cerrada_at) }}</template>
              </p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <label class="text-[10px] uppercase font-bold text-slate-500 space-y-1">
                Distancia (m)
                <input type="number" min="0" step="any" class="w-full px-3 py-2 rounded-xl border font-mono text-sm" :class="fieldClass" :value="item.distancia_m ?? ''" @input="onNumber(item, 'distancia_m', $event)" />
              </label>
              <label class="text-[10px] uppercase font-bold text-slate-500 space-y-1">
                Altura (m)
                <input type="number" min="0" step="any" class="w-full px-3 py-2 rounded-xl border font-mono text-sm" :class="fieldClass" :value="item.altura_m ?? ''" @input="onNumber(item, 'altura_m', $event)" />
              </label>
              <label class="text-[10px] uppercase font-bold text-slate-500 space-y-1">
                Clima
                <input class="w-full px-3 py-2 rounded-xl border text-sm" :class="fieldClass" :list="`clima-${item.id}`" :value="item.clima ?? ''" @input="onText(item, 'clima', $event)" />
                <datalist :id="`clima-${item.id}`">
                  <option value="Sol" />
                  <option value="Nubes" />
                  <option value="Lluvia" />
                  <option value="Tormenta" />
                  <option value="Niebla" />
                </datalist>
              </label>
              <label class="text-[10px] uppercase font-bold text-slate-500 space-y-1">
                Obstáculos
                <input class="w-full px-3 py-2 rounded-xl border text-sm" :class="fieldClass" :value="item.obstaculos ?? ''" @input="onText(item, 'obstaculos', $event)" />
              </label>
              <label class="text-[10px] uppercase font-bold text-slate-500 space-y-1 md:col-span-2 xl:col-span-4">
                Situación real
                <textarea rows="2" class="w-full px-3 py-2 rounded-xl border text-sm" :class="fieldClass" :value="item.situacion_real ?? ''" @input="onText(item, 'situacion_real', $event)" />
              </label>
            </div>
            <div class="flex gap-2">
              <button
                class="px-3 py-2 rounded-xl border text-[11px] font-mono font-bold uppercase"
                :class="isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'"
                :disabled="saving"
                @click="saveCondicion(item)"
              >
                Guardar anotación
              </button>
              <button
                v-if="item.activa"
                class="px-3 py-2 rounded-xl border text-[11px] font-mono font-bold uppercase"
                :class="isDark ? 'border-amber-800 text-amber-300' : 'border-amber-200 text-amber-700'"
                :disabled="saving"
                @click="cerrarPrueba(item.id)"
              >
                Cerrar prueba
              </button>
            </div>
          </article>
        </section>

      </template>
    </div>
  </div>
</template>
