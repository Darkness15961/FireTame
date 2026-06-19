<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  label: string
  value: string
  unit?: string
  icon?: Component
  status?: 'ok' | 'warn' | 'error' | 'na'
  subtitle?: string
}>()
</script>

<template>
  <div
    class="p-4 rounded-2xl border flex flex-col gap-2 transition-colors"
    :class="{
      'bg-slate-50 border-slate-200 dark:bg-slate-950/40 dark:border-slate-900': status !== 'error' && status !== 'warn',
      'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40': status === 'warn',
      'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/40': status === 'error',
    }"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
        {{ label }}
      </span>
      <component v-if="icon" :is="icon" class="w-4 h-4 text-cyan-500 shrink-0" />
    </div>
    <div class="flex items-baseline gap-1">
      <span
        class="text-2xl font-extrabold tabular-nums"
        :class="status === 'na' ? 'text-slate-400' : 'text-slate-900 dark:text-white'"
      >
        {{ value }}
      </span>
      <span v-if="unit && value !== '—'" class="text-xs font-mono text-slate-500">{{ unit }}</span>
    </div>
    <span v-if="subtitle" class="text-[10px] text-slate-500 dark:text-slate-500">{{ subtitle }}</span>
  </div>
</template>
