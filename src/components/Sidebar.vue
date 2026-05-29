<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useFireStore } from '@/stores/fireStore'
import { useTheme } from '@/composables/useTheme'
import { 
  LayoutDashboard, 
  Cpu, 
  BellRing, 
  Flame, 
  PlusCircle, 
  Radio, 
  Sun,
  Moon
} from 'lucide-vue-next'

const store = useFireStore()
const route = useRoute()
const { isDark, toggleTheme } = useTheme()

const isActive = (path: string) => route.path === path

const navigationItems = [
  { name: 'NOC Dashboard',        path: '/',          icon: LayoutDashboard },
  { name: 'Dispositivos IoT',     path: '/devices',   icon: Cpu },
  { name: 'Centro de Alertas',    path: '/alerts',    icon: BellRing, badge: computed(() => store.activeAlertsCount) },
  { name: 'Consola Simulación',   path: '/simulation',icon: Flame },
  { name: 'Registro de Nodos',    path: '/management',icon: PlusCircle },
]

const currentYear = new Date().getFullYear()
</script>

<template>
  <aside
    class="hidden lg:flex flex-col w-72 h-screen fixed left-0 top-0 z-40 backdrop-blur-md border-r transition-colors duration-300"
    :class="isDark ? 'bg-[#070b19]/90 border-slate-800/80 text-slate-300'
                   : 'bg-white/90 border-slate-200 text-slate-700'"
  >
    <!-- Header / Logo -->
    <div class="p-6 border-b"
         :class="isDark ? 'border-slate-800/80' : 'border-slate-200'">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="relative flex items-center justify-center w-10 h-10 rounded-xl border shadow-glow-cyan"
               :class="isDark ? 'bg-cyan-950/60 border-cyan-500/40' : 'bg-cyan-50 border-cyan-400/60'">
            <Flame class="w-6 h-6 text-cyan-400 animate-pulse" />
            <div class="absolute inset-0 rounded-xl border border-cyan-400/20 animate-ping opacity-30"></div>
          </div>
          <div>
            <h1 class="text-xl font-extrabold tracking-wider font-sans bg-clip-text bg-gradient-to-r"
                :class="isDark
                  ? 'text-transparent from-white via-cyan-200 to-cyan-400'
                  : 'text-transparent from-slate-900 via-cyan-700 to-cyan-500'">
              FireTame
            </h1>
            <span class="text-[9px] tracking-widest uppercase font-mono font-bold text-cyan-500">
              Smart IoT Wildfire NOC
            </span>
          </div>
        </div>

        <!-- Theme toggle button -->
        <button
          @click="toggleTheme"
          class="p-2 rounded-xl border transition-all duration-300"
          :class="isDark
            ? 'bg-slate-900/60 border-slate-700 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/40'
            : 'bg-slate-100 border-slate-300 text-slate-500 hover:bg-cyan-50 hover:border-cyan-400/50 hover:text-cyan-600'"
          :title="isDark ? 'Activar modo claro' : 'Activar modo oscuro'"
        >
          <Sun v-if="isDark" class="w-4 h-4" />
          <Moon v-else class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- System Pulse Monitor -->
    <div class="px-6 py-4 border-b"
         :class="isDark ? 'border-slate-800/40 bg-slate-900/20' : 'border-slate-200 bg-slate-50/60'">
      <div class="flex items-center justify-between p-3 rounded-xl border"
           :class="isDark ? 'bg-slate-950/40 border-slate-800/50' : 'bg-white border-slate-200'">
        <div class="flex items-center space-x-3">
          <div class="relative flex h-3.5 w-3.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  :class="store.activeFiresCount > 0 ? 'bg-red-500' : 'bg-emerald-400'"></span>
            <span class="relative inline-flex rounded-full h-3.5 w-3.5"
                  :class="store.activeFiresCount > 0 ? 'bg-red-500 shadow-glow-red' : 'bg-emerald-500 shadow-glow-green'"></span>
          </div>
          <span class="text-xs font-mono font-bold tracking-wide"
                :class="store.activeFiresCount > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'">
            {{ store.activeFiresCount > 0 ? 'ALERTA INCENDIO' : 'SISTEMA OPERATIVO' }}
          </span>
        </div>
        <div class="flex items-center space-x-1.5 text-[10px] font-mono px-2 py-0.5 rounded border"
             :class="isDark ? 'text-slate-500 bg-slate-900/60 border-slate-800' : 'text-slate-400 bg-slate-100 border-slate-300'">
          <Radio class="w-3.5 h-3.5 text-cyan-500 animate-pulse" />
          <span>LIVE</span>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
      <router-link
        v-for="item in navigationItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center justify-between px-4 py-3.5 rounded-xl font-medium transition-all duration-300 relative overflow-hidden group border"
        :class="[
          isActive(item.path)
            ? (isDark
                ? 'bg-gradient-to-r from-cyan-950/60 to-slate-900/40 border-cyan-800/60 text-cyan-400 shadow-glow-cyan'
                : 'bg-gradient-to-r from-cyan-50 to-slate-50 border-cyan-400/50 text-cyan-600 shadow-sm')
            : (isDark
                ? 'hover:bg-slate-900/50 border-transparent hover:text-white'
                : 'hover:bg-slate-50 border-transparent hover:text-slate-900')
        ]"
      >
        <!-- Active indicator line -->
        <span
          v-if="isActive(item.path)"
          class="absolute left-0 top-0 bottom-0 w-1 rounded-r"
          :class="isDark ? 'bg-cyan-400 shadow-glow-cyan' : 'bg-cyan-500'"
        ></span>

        <div class="flex items-center space-x-3.5">
          <component
            :is="item.icon"
            class="w-5 h-5 transition-transform duration-300 group-hover:scale-110"
            :class="isActive(item.path)
              ? (isDark ? 'text-cyan-400' : 'text-cyan-500')
              : (isDark ? 'text-slate-400 group-hover:text-cyan-300' : 'text-slate-400 group-hover:text-cyan-500')"
          />
          <span class="text-sm font-sans tracking-wide">{{ item.name }}</span>
        </div>

        <!-- Alert badge -->
        <div
          v-if="item.badge && item.badge.value > 0"
          class="px-2 py-0.5 text-xxs font-mono font-extrabold rounded-md border"
          :class="[
            isActive(item.path)
              ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
              : 'bg-red-500/10 text-red-500 border-red-500/20 animate-bounce'
          ]"
        >
          {{ item.badge.value }}
        </div>
      </router-link>
    </nav>

    <!-- Global risk metrics panel -->
    <div class="p-4 m-4 rounded-2xl flex flex-col space-y-4 border"
         :class="isDark ? 'bg-slate-950/60 border-slate-900' : 'bg-slate-50 border-slate-200'">
      <div class="flex items-center justify-between text-xs font-mono">
        <span class="uppercase tracking-wider font-bold text-secondary">Riesgo Global</span>
        <span
          class="font-extrabold px-2 py-0.5 rounded text-xs border"
          :class="{
            'bg-emerald-500/10 text-emerald-500 border-emerald-500/20': store.globalRiskScore < 25,
            'bg-amber-500/10 text-amber-500 border-amber-500/20': store.globalRiskScore >= 25 && store.globalRiskScore < 60,
            'bg-orange-500/10 text-orange-500 border-orange-500/20': store.globalRiskScore >= 60 && store.globalRiskScore < 85,
            'bg-red-500/10 text-red-500 border-red-500/20': store.globalRiskScore >= 85,
          }"
        >
          {{ store.globalRiskScore }}%
        </span>
      </div>

      <div class="h-2 w-full rounded-full overflow-hidden border"
           :class="isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-200 border-slate-300'">
        <div
          class="h-full rounded-full transition-all duration-1000 shadow-lg"
          :class="{
            'bg-emerald-500 shadow-glow-green': store.globalRiskScore < 25,
            'bg-amber-500 shadow-glow-yellow': store.globalRiskScore >= 25 && store.globalRiskScore < 60,
            'bg-orange-500 shadow-glow-orange': store.globalRiskScore >= 60 && store.globalRiskScore < 85,
            'bg-red-500 shadow-glow-red animate-pulse-fast': store.globalRiskScore >= 85,
          }"
          :style="{ width: `${store.globalRiskScore}%` }"
        ></div>
      </div>

      <div class="grid grid-cols-2 gap-2 text-center text-xs font-mono">
        <div class="p-2 rounded-xl border"
             :class="isDark ? 'bg-slate-900/40 border-slate-900' : 'bg-white border-slate-200'">
          <span class="block text-[9px] uppercase tracking-wider text-secondary">Activos</span>
          <span class="text-sm font-extrabold text-emerald-500 mt-0.5 block">
            {{ store.connectedNodesCount }} / {{ store.nodes.length }}
          </span>
        </div>
        <div class="p-2 rounded-xl border"
             :class="isDark ? 'bg-slate-900/40 border-slate-900' : 'bg-white border-slate-200'">
          <span class="block text-[9px] uppercase tracking-wider text-secondary">Offline</span>
          <span class="text-sm font-extrabold mt-0.5 block"
                :class="store.offlineNodesCount > 0 ? 'text-red-400 animate-pulse' : (isDark ? 'text-slate-400' : 'text-slate-500')">
            {{ store.offlineNodesCount }}
          </span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="p-4 text-center border-t text-[10px] font-mono"
         :class="isDark ? 'border-slate-800/30 text-slate-600' : 'border-slate-200 text-slate-400'">
      <span>FireTame v1.0.0 &copy; {{ currentYear }}</span>
    </div>
  </aside>

  <!-- ── Mobile header bar ── -->
  <header
    class="lg:hidden fixed top-0 left-0 right-0 h-16 backdrop-blur-md border-b z-50 px-4 flex items-center justify-between"
    :class="isDark
      ? 'bg-[#070b19]/90 border-slate-800/80 text-slate-300'
      : 'bg-white/90 border-slate-200 text-slate-700'"
  >
    <div class="flex items-center space-x-2">
      <Flame class="w-5 h-5 text-cyan-400 animate-pulse" />
      <span class="text-md font-extrabold tracking-widest"
            :class="isDark ? 'text-white' : 'text-slate-900'">FireTame</span>
    </div>

    <div class="flex items-center space-x-2">
      <!-- Mobile theme toggle -->
      <button
        @click="toggleTheme"
        class="p-2 rounded-lg border transition-all"
        :class="isDark
          ? 'bg-slate-900/60 border-slate-700 text-amber-400'
          : 'bg-slate-100 border-slate-300 text-slate-500'"
      >
        <Sun v-if="isDark" class="w-4 h-4" />
        <Moon v-else class="w-4 h-4" />
      </button>

      <!-- Horizontal nav -->
      <nav class="flex items-center space-x-1">
        <router-link
          v-for="item in navigationItems"
          :key="item.path"
          :to="item.path"
          class="p-2.5 rounded-lg transition-all border"
          :class="isActive(item.path)
            ? (isDark ? 'bg-cyan-950/60 border-cyan-800/40 text-cyan-400' : 'bg-cyan-50 border-cyan-300 text-cyan-600')
            : 'border-transparent text-slate-400'"
          :title="item.name"
        >
          <div class="relative">
            <component :is="item.icon" class="w-5 h-5" />
            <span
              v-if="item.badge && item.badge.value > 0"
              class="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-mono text-[8px] font-bold h-4 w-4 flex items-center justify-center rounded-full"
            >
              {{ item.badge.value }}
            </span>
          </div>
        </router-link>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.text-xxs {
  font-size: 0.65rem;
  line-height: 1rem;
}
</style>
