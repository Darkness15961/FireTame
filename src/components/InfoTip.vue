<script setup lang="ts">
import { Info } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    text: string
    align?: 'left' | 'right'
  }>(),
  { align: 'left' },
)
</script>

<template>
  <span class="relative inline-flex group align-middle">
    <button
      type="button"
      class="inline-flex text-slate-400 hover:text-cyan-500 focus:text-cyan-500 focus:outline-none"
      :aria-label="text"
    >
      <Info class="w-3.5 h-3.5" />
    </button>
    <span
      role="tooltip"
      class="pointer-events-none absolute top-full mt-2 z-50 w-72 max-w-[80vw] p-3 text-[11px] leading-relaxed normal-case tracking-normal font-sans font-normal whitespace-pre-line border opacity-0 invisible transition-opacity duration-150 group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
      :class="align === 'right' ? 'right-0' : 'left-0'"
    >
      {{ text }}
    </span>
  </span>
</template>
