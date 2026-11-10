<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { ClipboardList, Download, FileSpreadsheet, RefreshCw } from 'lucide-vue-next'
import Column from 'primevue/column'
import ColumnGroup from 'primevue/columngroup'
import DataTable from 'primevue/datatable'
import Row from 'primevue/row'
import Select from 'primevue/select'
import { useFireStore } from '@/stores/fireStore'
import { useTheme } from '@/composables/useTheme'
import { supabase } from '@/supabase'
import {
  BitacoraSchemaError,
  closeCondicion,
  contarBitacora,
  fetchBitacora,
  fetchCondiciones,
  updateCondicion,
} from '@/services/bitacoraService'
import type { BitacoraRow, CondicionPrueba } from '@/types/database'
import {
  formatDateTime,
  formatDeveui,
  formatSeconds,
  formatTime,
  formatValue,
} from '@/utils/format'
import {
  armarHojas,
  columnasReporte,
  descargarReporteCsv,
  descargarReporteExcel,
  marcaTiempo,
  tablasReporte,
  type ModoColumnas,
} from '@/utils/reporteNodos'
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
const vistaRegistros = ref<'bitacora' | 'reporte'>('reporte')
const modoColumnas = ref<ModoColumnas>('campo')
const modoDatos = ref<'completa' | 'con-datos'>('con-datos')
const opcionesCantidad = [
  { label: '100', value: '100' },
  { label: '250', value: '250' },
  { label: '500', value: '500' },
  { label: '1.000', value: '1000' },
  { label: '2.500', value: '2500' },
  { label: '5.000', value: '5000' },
  { label: 'Todos', value: 'todos' },
]
const cantidad = ref('1000')
const totalEnBase = ref(0)
const filasPorPagina = ref(100)
const opcionesFilas = [50, 100, 250, 500, 1000]

let channel: RealtimeChannel | null = null

const fieldClass = computed(() =>
  isDark.value
    ? 'bg-slate-950/80 border-slate-800 text-white placeholder-slate-600'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400',
)

const visibleRows = computed(() =>
  nodeFilter.value === 'all' ? rows.value : rows.value.filter((row) => row.node_id === nodeFilter.value),
)

const hojasReporte = computed(() =>
  armarHojas(visibleRows.value, (id, nombre) => nodeLabel(id, nombre)),
)

const columnasActivas = computed(() => columnasReporte(modoColumnas.value))

const tablasVisibles = computed(() =>
  tablasReporte(
    hojasReporte.value,
    columnasActivas.value,
    modoDatos.value === 'con-datos' && modoColumnas.value !== 'campo',
  ),
)

const totalReporte = computed(() =>
  tablasVisibles.value.reduce((total, tabla) => total + tabla.hoja.filas.length, 0),
)

function formatoCantidad(valor: number): string {
  return new Intl.NumberFormat('es-PE').format(valor)
}

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

function nodeLabel(nodeId: string, fallback?: string | null): string {
  return store.nodes.find((node) => node.id === nodeId)?.name ?? fallback ?? nodeId
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

let cargaId = 0

async function cargarLecturas(): Promise<void> {
  const id = ++cargaId
  const total = await contarBitacora()
  if (id !== cargaId) return
  const pedido = cantidad.value === 'todos' ? total : Math.min(Number(cantidad.value), total)
  const bits = pedido > 0 ? await fetchBitacora(pedido) : []
  if (id !== cargaId) return
  totalEnBase.value = total
  rows.value = bits
}

async function reloadAll() {
  loading.value = true
  schemaMissing.value = false
  errorMsg.value = ''
  try {
    const [, conds] = await Promise.all([cargarLecturas(), fetchCondiciones()])
    condiciones.value = conds
    if (
      vistaRegistros.value === 'bitacora' &&
      !nodeFilterTouched.value &&
      nodeFilter.value === 'all' &&
      rows.value[0]
    ) {
      nodeFilter.value = rows.value[0].node_id
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
    await cargarLecturas()
  } catch (error) {
    if (error instanceof BitacoraSchemaError) schemaMissing.value = true
  }
}

watch(cantidad, () => {
  void reloadAll()
})

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

function csvDate(iso: string | null): string {
  return marcaTiempo(iso)
}

function verReporte() {
  vistaRegistros.value = 'reporte'
  if (!nodeFilterTouched.value) nodeFilter.value = 'all'
}

function exportExcel() {
  descargarReporteExcel(tablasVisibles.value)
}

function exportCsvReporte() {
  descargarReporteCsv(tablasVisibles.value)
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
  if (vistaRegistros.value === 'reporte') {
    exportCsvReporte()
    return
  }
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
        <div class="flex flex-wrap gap-2">
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
          <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <h2 class="font-extrabold text-sm" :class="isDark ? 'text-white' : 'text-slate-900'">
                  Registros
                  <span class="ml-2 text-[11px] font-mono font-normal text-slate-500">
                    {{ vistaRegistros === 'reporte'
                      ? `${formatoCantidad(totalReporte)} uplinks · ${tablasVisibles.length} ${tablasVisibles.length === 1 ? 'tabla' : 'tablas'}`
                      : `${formatoCantidad(visibleRows.length)} uplinks` }}
                    · {{ formatoCantidad(rows.length) }} cargados de {{ formatoCantidad(totalEnBase) }}
                  </span>
                </h2>
                <p class="text-[11px] text-slate-500 mt-1">
                  <template v-if="vistaRegistros === 'reporte'">
                    Una tabla por nodo. Cargar define cuántos uplinks entran desde la base. El paginador define cuántos se ven por página. CSV y Excel llevan los cargados, con las columnas que se ven.
                  </template>
                  <template v-else>
                    Columnas en el orden de la bitácora de campo. Pasa el cursor sobre un encabezado para ver qué mide.
                  </template>
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <div class="inline-flex rounded-xl border overflow-hidden text-[11px] font-mono font-bold uppercase" :class="isDark ? 'border-slate-700' : 'border-slate-300'">
                  <button
                    class="px-3 py-2"
                    :class="vistaRegistros === 'bitacora'
                      ? 'bg-cyan-600 text-white'
                      : (isDark ? 'text-slate-300' : 'text-slate-600')"
                    @click="vistaRegistros = 'bitacora'"
                  >
                    Bitácora
                  </button>
                  <button
                    class="px-3 py-2"
                    :class="vistaRegistros === 'reporte'
                      ? 'bg-cyan-600 text-white'
                      : (isDark ? 'text-slate-300' : 'text-slate-600')"
                    @click="verReporte"
                  >
                    Reporte
                  </button>
                </div>
                <label class="inline-flex items-center gap-2 text-[11px] font-mono uppercase text-slate-500">
                  Cargar
                  <Select
                    v-model="cantidad"
                    :options="opcionesCantidad"
                    option-label="label"
                    option-value="value"
                    size="small"
                    class="w-32"
                  />
                </label>
                <select v-model="nodeFilter" class="px-3 py-2 rounded-xl border text-sm font-mono" :class="fieldClass" @change="nodeFilterTouched = true">
                  <option value="all">Todos los nodos</option>
                  <option v-for="node in store.nodes" :key="node.id" :value="node.id">{{ node.name }}</option>
                </select>
                <select
                  v-if="vistaRegistros === 'reporte'"
                  v-model="modoColumnas"
                  class="px-3 py-2 rounded-xl border text-sm font-mono"
                  :class="fieldClass"
                >
                  <option value="campo">Señal y sensores</option>
                  <option value="completo">Reporte completo</option>
                  <option value="sensores">Solo sensores</option>
                </select>
                <select
                  v-if="vistaRegistros === 'reporte'"
                  v-model="modoDatos"
                  class="px-3 py-2 rounded-xl border text-sm font-mono"
                  :class="fieldClass"
                >
                  <option value="completa">Data completa</option>
                  <option value="con-datos">Solo con datos</option>
                </select>
                <button
                  class="px-3 py-2 rounded-xl border text-xs font-mono font-bold uppercase inline-flex items-center gap-2 disabled:opacity-40"
                  :class="isDark ? 'border-cyan-800 text-cyan-300' : 'border-cyan-300 text-cyan-800'"
                  :disabled="tablasVisibles.length === 0"
                  @click="exportCsvReporte"
                >
                  <Download class="w-3.5 h-3.5" />
                  CSV
                </button>
                <button
                  class="px-3 py-2 rounded-xl border text-xs font-mono font-bold uppercase inline-flex items-center gap-2 disabled:opacity-40"
                  :class="isDark ? 'border-emerald-800 text-emerald-300' : 'border-emerald-300 text-emerald-800'"
                  :disabled="tablasVisibles.length === 0"
                  @click="exportExcel"
                >
                  <FileSpreadsheet class="w-3.5 h-3.5" />
                  Excel
                </button>
              </div>
            </div>
          </div>

          <div v-if="vistaRegistros === 'reporte'" class="p-4 space-y-4 bg-slate-100 dark:bg-slate-950/40">
            <p class="text-[11px] text-slate-600 dark:text-slate-400 max-w-3xl">
              <template v-if="modoColumnas === 'campo'">
                Vista inicial: N, RSSI, SNR, temperatura, humedad, MQ135 y las horas de recepción del gateway y de la base.
              </template>
              <template v-else-if="modoDatos === 'con-datos'">
                Cada tabla muestra solo las columnas que tienen algún valor. Las que salen vacías o en 0 no entran, y tampoco el archivo.
              </template>
              <template v-else-if="modoColumnas === 'sensores'">
                Solo las lecturas de los sensores, con N para ordenar cada paquete.
              </template>
              <template v-else>
                Incluye la prueba, el enlace, la temperatura y el resto de sensores, también las columnas vacías.
              </template>
            </p>
            <p v-if="!tablasVisibles.length" class="bg-white text-slate-500 border border-slate-200 rounded-xl px-5 py-10 text-center text-sm">
              Aún no hay tablas con datos para el reporte.
            </p>
            <article
              v-for="tabla in tablasVisibles"
              :key="tabla.hoja.nodeId"
              class="rounded-xl overflow-hidden border"
              :class="isDark ? 'border-slate-800' : 'border-slate-200 bg-white text-slate-900'"
            >
              <div class="px-4 py-3 border-b flex flex-wrap items-baseline justify-between gap-2" :class="isDark ? 'border-slate-800' : 'border-slate-200'">
                <h3 class="font-extrabold" :class="isDark ? 'text-white' : 'text-slate-900'">{{ tabla.hoja.nombre }}</h3>
                <p class="text-[11px] font-mono text-slate-500">
                  {{ formatoCantidad(tabla.hoja.filas.length) }} uplinks
                </p>
              </div>
              <DataTable
                :value="tabla.hoja.filas"
                data-key="n"
                size="small"
                striped-rows
                scrollable
                scroll-height="60vh"
                paginator
                v-model:rows="filasPorPagina"
                :rows-per-page-options="opcionesFilas"
                paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                current-page-report-template="{first}–{last} de {totalRecords}"
              >
                <Column
                  v-for="columna in tabla.columnas"
                  :key="columna.id"
                  :header="columna.titulo"
                >
                  <template #body="{ data }">
                    <span class="font-mono tabular-nums">{{ columna.valor(data) }}</span>
                  </template>
                </Column>
              </DataTable>
            </article>
          </div>

          <div v-else>
            <DataTable
              :value="visibleRows"
              data-key="reading_id"
              size="small"
              scrollable
              scroll-height="70vh"
              :loading="loading"
              paginator
              v-model:rows="filasPorPagina"
              :rows-per-page-options="opcionesFilas"
              paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
              current-page-report-template="{first}–{last} de {totalRecords}"
            >
              <template #empty>
                <p class="px-5 py-10 text-center text-sm text-slate-500">Aún no hay uplinks en la bitácora.</p>
              </template>
              <ColumnGroup type="header">
                <Row>
                  <Column
                    v-for="grupo in grupos"
                    :key="grupo.nombre"
                    :header="grupo.nombre"
                    :colspan="grupo.span"
                  />
                </Row>
                <Row>
                  <Column v-for="col in columnas" :key="col.titulo" :header="col.titulo" />
                </Row>
              </ColumnGroup>
              <Column v-for="col in columnas" :key="col.titulo">
                <template #body="{ data }">
                  <span class="font-mono whitespace-nowrap" :class="col.clase?.(data)" :title="col.ayuda">
                    {{ col.celda(data) }}
                  </span>
                </template>
              </Column>
            </DataTable>
          </div>
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
