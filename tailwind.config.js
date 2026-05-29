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
          bg: '#030712', // deep slate/black
          normal: '#10b981', // emerald
          observation: '#f59e0b', // amber
          warning: '#f97316', // orange
          critical: '#ef4444', // red
          tech: '#06b6d4', // cyan
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-green': '0 0 15px -3px rgba(16, 185, 129, 0.4)',
        'glow-yellow': '0 0 15px -3px rgba(245, 158, 11, 0.4)',
        'glow-orange': '0 0 15px -3px rgba(249, 115, 22, 0.4)',
        'glow-red': '0 0 15px -3px rgba(239, 68, 68, 0.4)',
        'glow-cyan': '0 0 15px -3px rgba(6, 182, 212, 0.4)',
        'glow-green-lg': '0 0 25px -2px rgba(16, 185, 129, 0.6)',
        'glow-yellow-lg': '0 0 25px -2px rgba(245, 158, 11, 0.6)',
        'glow-orange-lg': '0 0 25px -2px rgba(249, 115, 22, 0.6)',
        'glow-red-lg': '0 0 25px -2px rgba(239, 68, 68, 0.6)',
        'glow-cyan-lg': '0 0 25px -2px rgba(6, 182, 212, 0.6)',
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
