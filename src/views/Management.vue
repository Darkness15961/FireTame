<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useFireStore } from '@/stores/fireStore'
import type { IoTNode } from '@/stores/fireStore'
import { useTheme } from '@/composables/useTheme'
import { MAP_TILE_OPTIONS, mapTileUrl } from '@/constants/mapTiles'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { 
  Plus, 
  Trash2, 
  MapPin, 
  Check, 
  Settings, 
  Activity, 
  PlusCircle, 
  ToggleLeft, 
  ToggleRight,
  ShieldCheck,
  ShieldAlert,
  Sliders
} from 'lucide-vue-next'

const store = useFireStore()
const { isDark } = useTheme()

// Register form states
const nodeName = ref('')
const nodeLat = ref(-13.4)
const nodeLng = ref(-72.0)
const ttnDeviceId = ref('')
const deveui = ref('')

let minMap: L.Map | null = null
const minMapContainer = ref<HTMLElement | null>(null)
let tempMarker: L.Marker | null = null

onMounted(() => {
  store.initializeStore()
  initMinMap()
})

// Initialize mini coordinate picker map
const initMinMap = () => {
  if (!minMapContainer.value) return

  minMap = L.map(minMapContainer.value, {
    zoomControl: true,
    attributionControl: false
  }).setView([-13.38, -72.15], 8.5)

  L.tileLayer(mapTileUrl(isDark.value), MAP_TILE_OPTIONS).addTo(minMap)

  // Initial picker marker
  tempMarker = L.marker([nodeLat.value, nodeLng.value], {
    draggable: true
  }).addTo(minMap)

  // Update form inputs when marker is dragged
  tempMarker.on('dragend', () => {
    if (tempMarker) {
      const position = tempMarker.getLatLng()
      nodeLat.value = parseFloat(position.lat.toFixed(4))
      nodeLng.value = parseFloat(position.lng.toFixed(4))
    }
  })

  // Capture click events on map to place marker and fill coordinates
  minMap.on('click', (e) => {
    nodeLat.value = parseFloat(e.latlng.lat.toFixed(4))
    nodeLng.value = parseFloat(e.latlng.lng.toFixed(4))
    
    if (tempMarker) {
      tempMarker.setLatLng(e.latlng)
    }
  })
}

// Watch coordinate inputs to move map marker
watch([nodeLat, nodeLng], ([newLat, newLng]) => {
  if (tempMarker && minMap) {
    tempMarker.setLatLng([newLat, newLng])
    // Optionally slide map view
    // minMap.panTo([newLat, newLng])
  }
})

// Form submit action
const submitDeployNode = () => {
  if (!nodeName.value.trim()) return
  
  store.addCustomNode(
    nodeName.value.trim(),
    nodeLat.value,
    nodeLng.value,
    ttnDeviceId.value.trim(),
    deveui.value.trim(),
  )

  nodeName.value = ''
  ttnDeviceId.value = ''
  deveui.value = ''
}

const toggleNode = (id: string) => {
  store.toggleNodeActive(id)
}

const deleteNode = (id: string) => {
  store.deleteNode(id)
}
</script>

<template>
  <div class="lg:pl-72 min-h-screen pb-12 pt-20 lg:pt-6 bg-[var(--bg-base)]">
    <div class="px-4 lg:px-8 space-y-6">

      <!-- Header panel -->
      <header class="flex flex-col md:flex-row justify-between items-start md:items-center p-4 lg:p-6 rounded-2xl glass-panel relative overflow-hidden">
        <div>
          <span class="text-[10px] font-mono tracking-widest uppercase text-cyan-400 font-bold flex items-center space-x-1.5">
            <Sliders class="w-3.5 h-3.5 text-cyan-400" />
            <span>ADMINISTRACIÓN Y CONTRATACIÓN DE NUEVOS HARDWARES</span>
          </span>
          <h2 class="text-2xl lg:text-3xl font-extrabold tracking-wide mt-1"
              :class="isDark ? 'text-white' : 'text-slate-900'">
            Gestión e Instalación de Nodos
          </h2>
        </div>
      </header>

      <!-- Main setup splits: Node deployment form, and interactive picker map -->
      <section class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        <!-- Registration Form (1 Col) -->
        <div class="glass-panel p-5 flex flex-col justify-between min-h-[450px]">
          <span class="text-xs font-sans text-slate-400 font-extrabold block mb-4 flex items-center space-x-2">
            <PlusCircle class="w-4 h-4 text-cyan-500" />
            <span>FORMULARIO DE DESPLIEGUE FÍSICO</span>
          </span>

          <form @submit.prevent="submitDeployNode" class="space-y-4 flex-1 text-xs font-sans">
            <!-- Name -->
            <div class="space-y-1.5">
              <label class="font-bold block" :class="isDark ? 'text-slate-400' : 'text-slate-600'">Nombre de la Ubicación Forestal:</label>
              <input 
                type="text" 
                v-model="nodeName"
                placeholder="Ej. Bosque Pikillacta..."
                required
                class="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none transition-all"
                :class="isDark 
                  ? 'bg-slate-950/80 border-slate-800 focus:border-cyan-500/40 text-white placeholder-slate-600' 
                  : 'bg-white border-slate-200 focus:border-cyan-400 text-slate-800 placeholder-slate-400'"
              />
            </div>

            <!-- Coordinates layout -->
            <div class="grid grid-cols-2 gap-3 font-mono">
              <div class="space-y-1.5">
                <label class="font-bold block font-sans" :class="isDark ? 'text-slate-400' : 'text-slate-600'">Latitud (Y):</label>
                <input 
                  type="number" 
                  step="0.0001"
                  v-model="nodeLat"
                  required
                  class="w-full px-3.5 py-2 rounded-xl focus:outline-none transition-all"
                  :class="isDark 
                    ? 'bg-slate-950/80 border-slate-800 focus:border-cyan-500/40 text-white' 
                    : 'bg-white border-slate-200 focus:border-cyan-400 text-slate-800'"
                />
              </div>
              <div class="space-y-1.5">
                <label class="font-bold block font-sans" :class="isDark ? 'text-slate-400' : 'text-slate-600'">Longitud (X):</label>
                <input 
                  type="number" 
                  step="0.0001"
                  v-model="nodeLng"
                  required
                  class="w-full px-3.5 py-2 rounded-xl focus:outline-none transition-all"
                  :class="isDark 
                    ? 'bg-slate-950/80 border-slate-800 focus:border-cyan-500/40 text-white' 
                    : 'bg-white border-slate-200 focus:border-cyan-400 text-slate-800'"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="font-bold block" :class="isDark ? 'text-slate-400' : 'text-slate-600'">TTN device id:</label>
              <input
                type="text"
                v-model="ttnDeviceId"
                placeholder="heltec-wifi-lora-32-v3"
                class="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none font-mono"
                :class="isDark
                  ? 'bg-slate-950/80 border-slate-800 focus:border-cyan-500/40 text-white placeholder-slate-600'
                  : 'bg-white border-slate-200 focus:border-cyan-400 text-slate-800 placeholder-slate-400'"
              />
            </div>
            <div class="space-y-1.5">
              <label class="font-bold block" :class="isDark ? 'text-slate-400' : 'text-slate-600'">DevEUI (16 hex):</label>
              <input
                type="text"
                v-model="deveui"
                placeholder="0011223344556677"
                maxlength="16"
                class="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none font-mono uppercase"
                :class="isDark
                  ? 'bg-slate-950/80 border-slate-800 focus:border-cyan-500/40 text-white placeholder-slate-600'
                  : 'bg-white border-slate-200 focus:border-cyan-400 text-slate-800 placeholder-slate-400'"
              />
            </div>

            <!-- Deploy node button -->
            <button 
              type="submit" 
              class="w-full py-3 border rounded-xl text-xs font-mono font-bold tracking-widest uppercase transition-all duration-300 flex items-center justify-center space-x-2 cursor-pointer"
              :class="isDark 
                ? 'bg-cyan-950 hover:bg-cyan-500/20 border-cyan-800/80 hover:border-cyan-500 text-cyan-400 hover:text-white shadow-glow-cyan' 
                : 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200 hover:border-cyan-400 text-cyan-700 hover:text-cyan-800 shadow-sm'"
            >
              <Plus class="w-4 h-4 text-cyan-500" />
              <span>Instalar Nodo Forestal</span>
            </button>
          </form>
        </div>

        <!-- Coordinates capture map (2 Cols) -->
        <div class="xl:col-span-2 glass-panel p-5 flex flex-col h-[450px]">
          <div class="flex justify-between items-center mb-4">
            <span class="text-xs font-sans text-slate-400 font-extrabold block flex items-center space-x-2">
              <MapPin class="w-4 h-4 text-cyan-500 animate-bounce" />
              <span>CAPTURA DE COORDENADAS GIS (Haga Click en el Mapa)</span>
            </span>
            <span class="text-[9px] font-mono text-slate-500 uppercase">Marker Arrastrable</span>
          </div>
          <!-- Leaflet Container -->
          <div class="flex-1 w-full rounded-xl overflow-hidden border z-10 animate-fade-in"
               :class="isDark ? 'border-slate-800' : 'border-slate-200'"
               ref="minMapContainer"></div>
        </div>

      </section>

      <!-- Active Deployed Nodes structural Table Grid -->
      <section class="glass-panel p-5">
        <span class="text-xs font-sans text-slate-400 font-extrabold block mb-4 flex items-center space-x-2">
          <Activity class="w-4 h-4 text-cyan-500" />
          <span>INVENTARIO GENERAL DE ENLACES IoT FORESTALES</span>
        </span>

        <!-- Table container responsive scrollable -->
        <div class="overflow-x-auto">
          <table class="w-full text-left font-sans text-xs border-collapse">
            <thead>
              <tr class="text-slate-500 border-b uppercase font-mono tracking-wider text-[10px] pb-3"
                  :class="isDark ? 'border-slate-800/80' : 'border-slate-200'">
                <th class="py-3 px-4 font-bold">ID / Dispositivo</th>
                <th class="py-3 px-4 font-bold">Coordenadas</th>
                <th class="py-3 px-4 font-bold">TTN / DevEUI</th>
                <th class="py-3 px-4 font-bold">Riesgo</th>
                <th class="py-3 px-4 font-bold">Enlace Técnico</th>
                <th class="py-3 px-4 text-right font-bold">Acciones de Red</th>
              </tr>
            </thead>
            <tbody class="divide-y font-mono text-[11px]"
                   :class="isDark ? 'divide-slate-900' : 'divide-slate-200'">
              <tr 
                v-for="node in store.nodes" 
                :key="node.id"
                class="transition-all group"
                :class="isDark ? 'hover:bg-slate-950/40' : 'hover:bg-slate-100/60'"
              >
                <!-- Name and ID -->
                <td class="py-3.5 px-4">
                  <div class="flex items-center space-x-3.5">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" 
                          :class="node.riskStatus === 'red' ? 'bg-red-500 animate-pulse' : node.riskStatus === 'orange' ? 'bg-orange-500' : node.riskStatus === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'"></span>
                    <div>
                      <span class="font-sans font-extrabold text-xs block" :class="isDark ? 'text-white' : 'text-slate-800'">{{ node.name }}</span>
                      <span class="text-[9px] text-slate-500 block uppercase mt-0.5">{{ node.id }}</span>
                    </div>
                  </div>
                </td>

                <!-- Coords -->
                <td class="py-3.5 px-4" :class="isDark ? 'text-slate-400' : 'text-slate-600'">
                  <span v-if="node.lat != null && node.lng != null">{{ node.lat.toFixed(4) }}, {{ node.lng.toFixed(4) }}</span>
                  <span v-else>Sin coordenadas</span>
                </td>

                <!-- Installed list -->
                <td class="py-3.5 px-4 text-slate-500 font-mono">
                  <div>{{ node.ttnDeviceId || '—' }}</div>
                  <div class="text-[9px] uppercase">{{ node.deveui || 'sin DevEUI' }}</div>
                </td>
                <td class="py-3.5 px-4">
                  <span class="font-extrabold" :class="node.riskStatus === 'red' ? 'text-red-400' : node.riskStatus === 'orange' ? 'text-orange-400' : node.riskStatus === 'yellow' ? 'text-amber-400' : 'text-emerald-400'">
                    {{ node.riskScore }}
                  </span>
                </td>

                <!-- Tech tag -->
                <td class="py-3.5 px-4">
                  <span 
                    class="text-[9px] font-mono px-2 py-0.5 rounded border"
                    :class="node.techStatus === 'online'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-500 border-red-500/20'"
                  >
                    {{ node.techStatus === 'online' ? 'CONECTADO' : 'SIN UPLINK' }}
                  </span>
                </td>

                <!-- CRUD Actions -->
                <td class="py-3.5 px-4 text-right">
                  <div class="flex items-center justify-end space-x-2.5">
                    
                    <!-- Deactivate/Connect toggler -->
                    <button 
                      @click="toggleNode(node.id)"
                      class="p-1.5 rounded-lg transition-colors cursor-pointer"
                      :class="isDark ? 'hover:bg-slate-900 text-slate-500 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'"
                      :title="node.enabled ? 'Deshabilitar nodo' : 'Habilitar nodo'"
                    >
                      <ToggleRight class="w-5.5 h-5.5 text-emerald-500" v-if="node.enabled" />
                      <ToggleLeft class="w-5.5 h-5.5 text-red-500 animate-pulse" v-else />
                    </button>

                    <!-- Delete button -->
                    <button 
                      @click="deleteNode(node.id)"
                      class="p-1.5 rounded-lg transition-colors cursor-pointer"
                      :class="isDark ? 'hover:bg-slate-900 text-slate-500 hover:text-red-400' : 'hover:bg-slate-200 text-slate-500 hover:text-red-500'"
                      title="Remover Dispositivo"
                    >
                      <Trash2 class="w-4.5 h-4.5" />
                    </button>

                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </div>
  </div>
</template>
