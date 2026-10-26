<script setup lang="ts">
import type { Component } from 'vue'
import InfoTip from '@/components/InfoTip.vue'

defineProps<{
  label: string
  value: string
  unit?: string
  icon?: Component
  status?: 'ok' | 'warn' | 'error' | 'na'
  subtitle?: string
  info?: string
  infoAlign?: 'left' | 'right'
}>()
</script>

<template>
  <div
    class="p-4 border flex flex-col gap-2"
    :class="{
      'bg-[var(--bg-elevated)] border-[var(--border-subtle)]': status !== 'error' && status !== 'warn',
      'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40': status === 'warn',
      'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/40': status === 'error',
    }"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
        {{ label }}
        <InfoTip v-if="info" :text="info" :align="infoAlign" />
      </span>
      <component v-if="icon" :is="icon" class="w-4 h-4 text-[var(--text-muted)] shrink-0" />
    </div>
    <div class="flex items-baseline gap-1">
      <span
        class="font-display font-semibold tabular-nums tracking-[-0.03em]"
        :class="[
          value.length > 8 ? 'text-base leading-tight' : 'text-2xl',
          status === 'na' ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]',
        ]"
      >
        {{ value }}
      </span>
      <span v-if="unit && value !== '—'" class="text-xs font-mono text-slate-500">{{ unit }}</span>
    </div>
    <span v-if="subtitle" class="text-[10px] text-slate-500 dark:text-slate-500">{{ subtitle }}</span>
  </div>
</template>
