<script setup lang="ts">
import { onMounted } from 'vue'
import Sidebar from '@/components/Sidebar.vue'
import { useFireStore } from '@/stores/fireStore'
import { useTheme } from '@/composables/useTheme'

const store = useFireStore()
const { initTheme } = useTheme()

onMounted(() => {
  store.initializeStore()
  initTheme()
})
</script>

<template>
  <div class="min-h-screen font-sans antialiased overflow-x-hidden
              bg-[#020617] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-300
              dark:bg-[#020617] dark:text-slate-100
              light-mode:bg-slate-100 light-mode:text-slate-800">
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
