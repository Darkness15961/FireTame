<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import Sidebar from '@/components/Sidebar.vue'
import { isSupabaseConfigured } from '@/supabase'
import { useFireStore } from '@/stores/fireStore'
import { useTheme } from '@/composables/useTheme'
import { startHealthMonitor } from '@/services/healthService'

const store = useFireStore()
const { initTheme } = useTheme()
const missingSupabaseEnv = !isSupabaseConfigured
let stopHealth: (() => void) | null = null

onMounted(() => {
  store.initializeStore()
  initTheme()
  if (!missingSupabaseEnv) stopHealth = startHealthMonitor()
})

onUnmounted(() => {
  stopHealth?.()
})
</script>

<template>
  <div class="min-h-screen font-sans antialiased overflow-x-hidden
              bg-[var(--bg-base)] text-[var(--text-primary)]">
    <div
      v-if="missingSupabaseEnv"
      class="fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-xs font-mono
             bg-amber-500 text-slate-950 border-b border-amber-300"
    >
      Falta el archivo <span class="font-bold">.env</span> con
      <span class="font-bold">VITE_SUPABASE_URL</span> y
      <span class="font-bold">VITE_SUPABASE_ANON_KEY</span>.
      Cópialo desde <span class="font-bold">.env.example</span> y reinicia <span class="font-bold">bun run dev</span>.
    </div>

    <!-- Cybernetic Sidebar Nav -->
    <Sidebar />

    <!-- Router view transitions -->
    <router-view v-slot="{ Component }">
      <transition 
        name="fade-slide" 
        mode="out-in"
      >
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<style>
/* Modern cybernetic view-fade-slide animations */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Base custom utility overlays */
.animate-fade-in {
  animation: fadeIn 0.4s ease-out forwards;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
