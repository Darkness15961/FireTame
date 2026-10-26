<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SlidersHorizontal } from 'lucide-vue-next'
import { useFireStore } from '@/stores/fireStore'
import { useTheme } from '@/composables/useTheme'
import { DEFAULT_UMBRALES, RISK_POINTS, type UmbralesAlerta } from '@/constants/risk'
import { formatDateTime } from '@/utils/format'
import InfoTip from '@/components/InfoTip.vue'

const store = useFireStore()
const { isDark } = useTheme()

const draft = ref<UmbralesAlerta>({ ...store.umbrales })
const saving = ref(false)
const message = ref('')
const error = ref('')

watch(
  () => store.umbrales,
  (value) => {
    draft.value = { ...value }
  },
)

const fieldClass = computed(() =>
  isDark.value
    ? 'bg-slate-950/80 border-slate-800 text-white'
    : 'bg-white border-slate-200 text-slate-800',
)

type NumericKey = Exclude<keyof UmbralesAlerta, 'inclinacion_activa' | 'updated_at'>

interface Field {
  key: NumericKey
  label: string
  unit: string
  step: string
  tip: string
}

const groups: { title: string; fields: Field[] }[] = [
  {
    title: 'Temperatura (DHT22)',
    fields: [
      {
        key: 'temp_observacion_c',
        label: 'Observación desde',
        unit: '°C',
        step: '0.5',
        tip: `Si la temperatura del DHT22 llega o pasa este valor, suma ${RISK_POINTS.tempObservacion} puntos.`,
      },
      {
        key: 'temp_critica_c',
        label: 'Crítica desde',
        unit: '°C',
        step: '0.5',
        tip: `Si además llega o pasa este valor, suma ${RISK_POINTS.tempCritica} puntos más.`,
      },
    ],
  },
  {
    title: 'Humedad (DHT22)',
    fields: [
      {
        key: 'humedad_observacion_pct',
        label: 'Observación por debajo de',
        unit: '%',
        step: '1',
        tip: `Si la humedad baja a este valor o menos, suma ${RISK_POINTS.humedadObservacion} puntos.\nUna humedad de 0 % se toma como lectura fallida del DHT22 y no suma.`,
      },
      {
        key: 'humedad_critica_pct',
        label: 'Crítica por debajo de',
        unit: '%',
        step: '1',
        tip: `Si además baja a este valor o menos, suma ${RISK_POINTS.humedadCritica} puntos más.`,
      },
    ],
  },
  {
    title: 'Gas / humo (MQ135, ADC)',
    fields: [
      {
        key: 'mq135_delta_observacion',
        label: 'Subida para observación',
        unit: 'ADC',
        step: '10',
        tip: `Cuántas unidades ADC tiene que subir el MQ135 sobre su línea base para sumar ${RISK_POINTS.mqObservacion} puntos.\nLa línea base es el promedio de las primeras 10 lecturas de cada nodo.`,
      },
      {
        key: 'mq135_delta_critico',
        label: 'Subida crítica',
        unit: 'ADC',
        step: '10',
        tip: `Si sube esta cantidad o más sobre la línea base, suma ${RISK_POINTS.mqCritico} puntos más.`,
      },
      {
        key: 'mq135_baseline_defecto',
        label: 'Línea base inicial',
        unit: 'ADC',
        step: '10',
        tip: 'Solo se usa mientras el nodo todavía no tiene lecturas del MQ135 para calcular su propia línea base.',
      },
    ],
  },
]

const scoreTip = computed(
  () =>
    `Cada lectura suma puntos según los umbrales de abajo (máximo 100).\nLa alerta se enciende y se guarda cuando la suma llega a este valor.\n\nNiveles: 25 medio, 50 alto, 75 crítico.\nCon ${draft.value.score_minimo_alerta}, una sola condición de ${RISK_POINTS.tempObservacion} puntos ${draft.value.score_minimo_alerta <= RISK_POINTS.tempObservacion ? 'ya enciende' : 'no basta para encender'} la alerta.`,
)

function setNumber(key: NumericKey, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value)) draft.value[key] = value
}

function validate(): string | null {
  const u = draft.value
  if (u.temp_critica_c < u.temp_observacion_c) return 'La temperatura crítica debe ser mayor o igual que la de observación.'
  if (u.humedad_critica_pct > u.humedad_observacion_pct) return 'La humedad crítica debe ser menor o igual que la de observación.'
  if (u.mq135_delta_critico < u.mq135_delta_observacion) return 'La subida crítica del MQ135 debe ser mayor o igual que la de observación.'
  if (u.score_minimo_alerta < 1 || u.score_minimo_alerta > 100) return 'El puntaje para encender la alerta debe estar entre 1 y 100.'
  return null
}

async function save() {
  message.value = ''
  error.value = validate() ?? ''
  if (error.value) return
  saving.value = true
  try {
    await store.updateUmbrales({ ...draft.value, score_minimo_alerta: Math.round(draft.value.score_minimo_alerta) })
    message.value = 'Guardado. Se aplica desde el siguiente uplink.'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar.'
  } finally {
    saving.value = false
  }
}

function resetDefaults() {
  draft.value = { ...DEFAULT_UMBRALES, updated_at: store.umbrales.updated_at }
  message.value = 'Valores por defecto cargados. Pulsa Guardar para aplicarlos.'
  error.value = ''
}
</script>

<template>
  <section class="glass-panel p-5 space-y-5">
    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div>
        <h2 class="text-sm font-extrabold flex items-center gap-2" :class="isDark ? 'text-white' : 'text-slate-900'">
          <SlidersHorizontal class="w-4 h-4 text-cyan-500" />
          Umbrales de alerta
        </h2>
        <p class="text-xs mt-1" :class="isDark ? 'text-slate-400' : 'text-slate-600'">
          Se aplican a los tres nodos. El cambio vale para los uplinks nuevos; las alertas ya guardadas no se recalculan.
        </p>
      </div>
      <p v-if="store.umbrales.updated_at" class="text-[11px] font-mono text-slate-500">
        Última edición {{ formatDateTime(store.umbrales.updated_at) }}
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label class="text-[10px] uppercase font-bold text-slate-500 space-y-1">
        <span class="flex items-center gap-1.5">
          Encender alerta desde
          <InfoTip :text="scoreTip" />
        </span>
        <div class="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="100"
            step="1"
            class="w-28 px-3 py-2 rounded-xl border font-mono text-sm"
            :class="fieldClass"
            :value="draft.score_minimo_alerta"
            @input="setNumber('score_minimo_alerta', $event)"
          />
          <span class="text-xs normal-case font-normal">puntos de 100</span>
        </div>
      </label>

      <div class="text-[10px] uppercase font-bold text-slate-500 space-y-1">
        <span class="flex items-center gap-1.5">
          Inclinación del nodo (MPU)
          <InfoTip
            :text="`Si el pitch o el roll pasan este ángulo, suma ${RISK_POINTS.inclinacion} puntos.\nSirve para detectar si movieron o tumbaron el nodo. Si el nodo está montado de costado, desactívalo o sube el ángulo.`"
            align="right"
          />
        </span>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 normal-case font-normal text-xs cursor-pointer">
            <input v-model="draft.inclinacion_activa" type="checkbox" class="w-4 h-4" />
            Activa
          </label>
          <input
            type="number"
            min="0"
            max="180"
            step="1"
            class="w-24 px-3 py-2 rounded-xl border font-mono text-sm"
            :class="fieldClass"
            :disabled="!draft.inclinacion_activa"
            :value="draft.inclinacion_deg"
            @input="setNumber('inclinacion_deg', $event)"
          />
          <span class="text-xs normal-case font-normal">°</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <fieldset
        v-for="group in groups"
        :key="group.title"
        class="border p-4 space-y-3"
        :class="isDark ? 'border-slate-800' : 'border-slate-200'"
      >
        <legend class="px-1 text-xs font-bold" :class="isDark ? 'text-slate-300' : 'text-slate-700'">{{ group.title }}</legend>
        <label
          v-for="field in group.fields"
          :key="field.key"
          class="block text-[10px] uppercase font-bold text-slate-500 space-y-1"
        >
          <span class="flex items-center gap-1.5">
            {{ field.label }}
            <InfoTip :text="field.tip" />
          </span>
          <div class="flex items-center gap-2">
            <input
              type="number"
              :step="field.step"
              class="w-full px-3 py-2 rounded-xl border font-mono text-sm"
              :class="fieldClass"
              :value="draft[field.key]"
              @input="setNumber(field.key, $event)"
            />
            <span class="text-xs normal-case font-normal w-8">{{ field.unit }}</span>
          </div>
        </label>
      </fieldset>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <button
        class="px-4 py-2 rounded-xl border text-xs font-mono font-bold uppercase"
        :class="isDark ? 'border-cyan-800 text-cyan-300' : 'border-cyan-200 text-cyan-800'"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? 'Guardando…' : 'Guardar umbrales' }}
      </button>
      <button
        class="px-4 py-2 rounded-xl border text-xs font-mono font-bold uppercase"
        :class="isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'"
        :disabled="saving"
        @click="resetDefaults"
      >
        Valores por defecto
      </button>
      <p v-if="error" class="text-xs text-red-500 font-mono">{{ error }}</p>
      <p v-else-if="message" class="text-xs text-emerald-500 font-mono">{{ message }}</p>
    </div>
  </section>
</template>
