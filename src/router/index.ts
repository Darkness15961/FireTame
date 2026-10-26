import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'
import Devices from '@/views/Devices.vue'
import DeviceDetail from '@/views/DeviceDetail.vue'
import Alerts from '@/views/Alerts.vue'
import Management from '@/views/Management.vue'
import Bitacora from '@/views/Bitacora.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: Dashboard,
      meta: { title: 'Centro de Monitoreo - Dashboard' }
    },
    {
      path: '/devices',
      name: 'devices',
      component: Devices,
      meta: { title: 'Nodos LoRaWAN Heltec' }
    },
    {
      path: '/devices/:id',
      name: 'device-detail',
      component: DeviceDetail,
      meta: { title: 'Telemetría ambiental LoRaWAN' }
    },
    {
      path: '/alerts',
      name: 'alerts',
      component: Alerts,
      meta: { title: 'Centro de Alertas Críticas' }
    },
    {
      path: '/management',
      name: 'management',
      component: Management,
      meta: { title: 'Administración y Despliegue de Nodos' }
    },
    {
      path: '/bitacora',
      name: 'bitacora',
      component: Bitacora,
      meta: { title: 'Bitácora de pruebas' }
    }
  ]
})

// Set document title dynamically
router.beforeEach((to) => {
  document.title = to.meta.title
    ? `${to.meta.title} | FireTame`
    : 'FireTame - IoT Forest Fire Monitoring'
})

export default router
