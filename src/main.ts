import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import App from './App.vue'
import router from './router'
import './index.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark',
    },
  },
  locale: {
    emptyMessage: 'Sin resultados',
    aria: {
      firstPageLabel: 'Primera página',
      lastPageLabel: 'Última página',
      nextPageLabel: 'Página siguiente',
      prevPageLabel: 'Página anterior',
      rowsPerPageLabel: 'Registros por página',
      pageLabel: 'Página {page}',
    },
  },
})

app.mount('#app')
