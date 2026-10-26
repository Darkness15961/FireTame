/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#06141f',
          normal: '#10b981',
          observation: '#f59e0b',
          warning: '#f97316',
          critical: '#ef4444',
          tech: '#ff6a00',
        },
        // El cian anterior era el acento de marca. Ahora es el naranja del sistema.
        cyan: {
          50: '#fff4ec',
          100: '#ffe6d4',
          200: '#ffc9a3',
          300: '#ffa366',
          400: '#ff8533',
          500: '#ff6a00',
          600: '#d45500',
          700: '#a34100',
          800: '#6e2e08',
          900: '#3d1a06',
          950: '#241006',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'Segoe UI', 'sans-serif'],
        display: ['Space Grotesk', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sharp: '2px',
      },
      boxShadow: {
        'glow-green': 'none',
        'glow-yellow': 'none',
        'glow-orange': 'none',
        'glow-red': 'none',
        'glow-cyan': 'none',
        'glow-green-lg': 'none',
        'glow-yellow-lg': 'none',
        'glow-orange-lg': 'none',
        'glow-red-lg': 'none',
        'glow-cyan-lg': 'none',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'radar 8s linear infinite',
        'scanlines': 'scanlines 10s linear infinite',
      },
      keyframes: {
        radar: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        scanlines: {
          '0%': { transform: 'translateY(0%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      }
    },
  },
  plugins: [],
}
