import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'
import Devices from '@/views/Devices.vue'
import DeviceDetail from '@/views/DeviceDetail.vue'
import Alerts from '@/views/Alerts.vue'
import Simulation from '@/views/Simulation.vue'
import Management from '@/views/Management.vue'

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
      meta: { title: 'Infraestructura IoT - Dispositivos' }
    },
    {
      path: '/devices/:id',
      name: 'device-detail',
      component: DeviceDetail,
      meta: { title: 'Digital Twin - Telemetría Avanzada' }
    },
    {
      path: '/alerts',
      name: 'alerts',
      component: Alerts,
      meta: { title: 'Centro de Alertas Críticas' }
    },
    {
      path: '/simulation',
      name: 'simulation',
      component: Simulation,
      meta: { title: 'Consola de Simulación de Emergencia' }
    },
    {
      path: '/management',
      name: 'management',
      component: Management,
      meta: { title: 'Administración y Despliegue de Nodos' }
    }
  ]
})

// Set document title dynamically
router.beforeEach((to, from, next) => {
  const pageTitle = to.meta.title ? `${to.meta.title} | FireTame` : 'FireTame - IoT Forest Fire Monitoring'
  document.title = pageTitle
  next()
})

export default router
