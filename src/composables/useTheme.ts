import { ref, watch, onMounted } from 'vue'

// Singleton reactive theme state
const isDark = ref<boolean>(true)

export function useTheme() {
  const applyTheme = (dark: boolean) => {
    const html = document.documentElement
    if (dark) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }

  const initTheme = () => {
    const saved = localStorage.getItem('firetame-theme')
    // Default: dark mode
    isDark.value = saved ? saved === 'dark' : true
    applyTheme(isDark.value)
  }

  const toggleTheme = () => {
    isDark.value = !isDark.value
    localStorage.setItem('firetame-theme', isDark.value ? 'dark' : 'light')
    applyTheme(isDark.value)
  }

  watch(isDark, (val) => applyTheme(val))

  return { isDark, initTheme, toggleTheme }
}
