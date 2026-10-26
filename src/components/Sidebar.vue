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
  Moon,
  ClipboardList,
} from 'lucide-vue-next'

const store = useFireStore()
const route = useRoute()
const { isDark, toggleTheme } = useTheme()

const isActive = (path: string) => route.path === path

const navigationItems = [
  { name: 'NOC Dashboard',        path: '/',          icon: LayoutDashboard },
  { name: 'Dispositivos LoRaWAN', path: '/devices',   icon: Cpu },
  { name: 'Centro de Alertas',    path: '/alerts',    icon: BellRing, badge: computed(() => store.activeAlertsCount) },
  { name: 'Registro de Nodos',    path: '/management',icon: PlusCircle },
  { name: 'Bitácora de pruebas',  path: '/bitacora',  icon: ClipboardList },
]

const currentYear = new Date().getFullYear()
</script>

<template>
  <aside
    class="hidden lg:flex flex-col w-72 h-screen fixed left-0 top-0 z-40 border-r"
    :class="isDark ? 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                   : 'bg-white border-[var(--border-subtle)] text-[var(--text-primary)]'"
  >
    <!-- Header / Logo -->
    <div class="p-6 border-b"
         :class="isDark ? 'border-slate-800/80' : 'border-slate-200'">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="flex items-center justify-center w-10 h-10 border"
               :class="isDark ? 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]' : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'">
            <Flame class="w-5 h-5 text-cyan-500" />
          </div>
          <div>
            <h1 class="text-xl font-semibold font-display"
                :class="isDark ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'">
              FireTame
            </h1>
            <span class="text-[10px] tracking-[0.16em] uppercase font-semibold text-cyan-500">
              Wildfire NOC
            </span>
          </div>
        </div>

        <!-- Theme toggle button -->
        <button
          @click="toggleTheme"
          class="p-2 border transition-colors"
          :class="isDark
            ? 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
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
      <div class="flex items-center justify-between p-3 border"
           :class="isDark ? 'bg-[var(--bg-base)] border-[var(--border-subtle)]' : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'">
        <div class="flex items-center space-x-3">
          <span class="inline-flex rounded-full h-2.5 w-2.5"
                :class="store.activeFiresCount > 0 ? 'bg-red-500' : 'bg-emerald-500'"></span>
          <span class="text-[11px] font-semibold tracking-[0.12em] uppercase"
                :class="store.activeFiresCount > 0 ? 'text-red-400' : 'text-emerald-500'">
            {{ store.activeFiresCount > 0 ? 'Alerta incendio' : 'Sistema operativo' }}
          </span>
        </div>
        <div class="flex items-center space-x-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase px-2 py-0.5 border text-cyan-500"
             :class="isDark ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]'">
          <Radio class="w-3.5 h-3.5" />
          <span>Live</span>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
      <router-link
        v-for="item in navigationItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center justify-between px-4 py-3 font-medium transition-colors relative overflow-hidden group border"
        :class="[
          isActive(item.path)
            ? (isDark
                ? 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]')
            : (isDark
                ? 'hover:bg-[var(--bg-elevated)] border-transparent hover:text-[var(--text-primary)]'
                : 'hover:bg-[var(--bg-elevated)] border-transparent hover:text-[var(--text-primary)]')
        ]"
      >
        <span
          v-if="isActive(item.path)"
          class="absolute left-0 top-0 bottom-0 w-[3px] bg-cyan-500"
        ></span>

        <div class="flex items-center space-x-3.5">
          <component
            :is="item.icon"
            class="w-5 h-5"
            :class="isActive(item.path)
              ? 'text-cyan-500'
              : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'"
          />
          <span class="text-sm font-sans tracking-wide">{{ item.name }}</span>
        </div>

        <!-- Alert badge -->
        <div
          v-if="item.badge && item.badge.value > 0"
          class="px-2 py-0.5 text-xxs font-mono font-semibold border"
          :class="isActive(item.path)
            ? 'bg-red-500/15 text-red-400 border-red-500/30'
            : 'bg-red-500/10 text-red-500 border-red-500/20'"
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

      <div class="h-1.5 w-full overflow-hidden"
           :class="isDark ? 'bg-[var(--bg-base)]' : 'bg-[var(--grid-gap)]'">
        <div
          class="h-full transition-all duration-700"
          :class="{
            'bg-emerald-500': store.globalRiskScore < 25,
            'bg-amber-500': store.globalRiskScore >= 25 && store.globalRiskScore < 60,
            'bg-orange-500': store.globalRiskScore >= 60 && store.globalRiskScore < 85,
            'bg-red-500': store.globalRiskScore >= 85,
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
    class="lg:hidden fixed top-0 left-0 right-0 h-16 border-b z-50 px-4 flex items-center justify-between"
    :class="isDark
      ? 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
      : 'bg-white border-[var(--border-subtle)] text-[var(--text-primary)]'"
  >
    <div class="flex items-center space-x-2">
      <Flame class="w-5 h-5 text-cyan-500" />
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
          class="p-2.5 border transition-colors"
          :class="isActive(item.path)
            ? 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-cyan-500'
            : 'border-transparent text-[var(--text-muted)]'"
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
