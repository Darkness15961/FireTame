<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { IoTNode } from '@/stores/fireStore'
import { Camera, RefreshCw, AlertOctagon } from 'lucide-vue-next'

const props = defineProps<{
  node: IoTNode | null
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationFrameId: number | null = null
let sweepY = 0
let noiseOffset = 0
let frameCounter = 0
let glitchTimer = 0
let isGlitching = false

// Random landscape generator seed
const landscapeSeed = Array.from({ length: 40 }, () => Math.random())

// Procedural visual rendering engine
const startRendering = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const render = () => {
    frameCounter++
    const width = canvas.width = canvas.parentElement?.clientWidth || 400
    const height = canvas.height = canvas.parentElement?.clientHeight || 280

    // Set black base
    ctx.fillStyle = '#020617'
    ctx.fillRect(0, 0, width, height)

    if (!props.node || props.node.techStatus === 'offline') {
      // 1. OFFLINE / CAMERA ERROR STATE
      renderOfflineStatic(ctx, width, height)
    } else {
      // 2. ACTIVE NODE RENDER
      renderActiveCamera(ctx, width, height)
    }

    // Dynamic horizontal scanline sweep
    sweepY = (sweepY + 1.2) % height
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, sweepY)
    ctx.lineTo(width, sweepY)
    ctx.stroke()

    // Scanning visual sweep bar
    ctx.fillStyle = 'rgba(6, 182, 212, 0.04)'
    ctx.fillRect(0, Math.max(0, sweepY - 15), width, Math.min(15, sweepY))

    animationFrameId = requestAnimationFrame(render)
  }

  render()
}

// Render grey/white TV static noise overlay
const renderOfflineStatic = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data
  
  for (let i = 0; i < data.length; i += 4) {
    const noiseVal = Math.random() * 255
    data[i] = noiseVal     // R
    data[i + 1] = noiseVal // G
    data[i + 2] = noiseVal // B
    data[i + 3] = 45       // A (opacity)
  }
  
  ctx.putImageData(imageData, 0, 0)

  // Cyber diagnostic box overlay
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'
  ctx.lineWidth = 2
  ctx.strokeRect(15, 15, width - 30, height - 30)

  // Flashing HUD error message
  if (Math.floor(frameCounter / 15) % 2 === 0) {
    ctx.fillStyle = '#ef4444'
    ctx.font = 'bold 12px "Share Tech Mono", "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('⚠️ ENLACE SATELITAL DE CÁMARA CAÍDO ⚠️', width / 2, height / 2 - 10)
    ctx.font = '10px "Share Tech Mono", monospace'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText('INTENTO DE RECONEXIÓN: CÁMARA FUERA DE LÍNEA', width / 2, height / 2 + 15)
  }
}

// Render active procedural thermal view based on risk
const renderActiveCamera = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const status = props.node?.riskStatus || 'green'
  
  // Decide base colors based on alert state
  let themeColor = 'rgba(16, 185, 129, 0.7)' // green (normal)
  let forestColor = 'rgba(6, 78, 59, 0.5)'
  let skyColor = 'rgba(2, 44, 34, 0.8)'

  if (status === 'yellow') {
    themeColor = 'rgba(245, 158, 11, 0.7)' // yellow
    forestColor = 'rgba(120, 53, 4, 0.5)'
    skyColor = 'rgba(69, 26, 3, 0.8)'
  } else if (status === 'orange') {
    themeColor = 'rgba(249, 115, 22, 0.8)' // orange
    forestColor = 'rgba(124, 45, 18, 0.5)'
    skyColor = 'rgba(124, 45, 18, 0.2)'
  } else if (status === 'red') {
    themeColor = 'rgba(239, 68, 68, 0.9)' // red
    forestColor = 'rgba(153, 27, 27, 0.5)'
    skyColor = 'rgba(220, 38, 38, 0.1)'
  }

  // Draw Sky Gradients
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height)
  skyGrad.addColorStop(0, '#030712')
  skyGrad.addColorStop(1, skyColor)
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, width, height)

  // Draw procedural mountain layers (creates forestry depth)
  ctx.fillStyle = forestColor
  ctx.beginPath()
  ctx.moveTo(0, height)
  
  for (let x = 0; x <= width; x += 10) {
    const seedIndex = Math.floor((x / width) * 20) % 20
    const val = landscapeSeed[seedIndex] || 0
    const y = height - 60 - val * 45 - Math.sin(x * 0.02) * 15
    ctx.lineTo(x, y)
  }
  ctx.lineTo(width, height)
  ctx.fill()

  // Draw thermal spots / heat blooms
  if (props.node && props.node.aiCamera.thermalHotspots.length > 0) {
    props.node.aiCamera.thermalHotspots.forEach((spot) => {
      // Map logical percent coordinates (0-100) to actual canvas pixels
      const actualX = (spot.x / 100) * width
      const actualY = (spot.y / 100) * height
      const pulseSize = spot.r + Math.sin(frameCounter * 0.1) * (spot.r * 0.15)

      const radGrad = ctx.createRadialGradient(actualX, actualY, 2, actualX, actualY, pulseSize)
      if (status === 'red') {
        radGrad.addColorStop(0, '#ffffff')          // white hot center
        radGrad.addColorStop(0.2, '#facc15')        // yellow
        radGrad.addColorStop(0.5, '#ef4444')        // crimson core
        radGrad.addColorStop(1, 'rgba(239, 68, 68, 0)') // fade
      } else if (status === 'orange') {
        radGrad.addColorStop(0, '#facc15')          // yellow hot center
        radGrad.addColorStop(0.4, '#f97316')        // orange
        radGrad.addColorStop(1, 'rgba(249, 115, 22, 0)')
      } else {
        // Cyan / Warm Wildlife for yellow/normal false alarm
        radGrad.addColorStop(0, '#22d3ee')          // cyan
        radGrad.addColorStop(0.5, '#06b6d4')        // blue-green
        radGrad.addColorStop(1, 'rgba(6, 182, 212, 0)')
      }

      ctx.fillStyle = radGrad
      ctx.beginPath()
      ctx.arc(actualX, actualY, pulseSize, 0, Math.PI * 2)
      ctx.fill()

      // Target bounding boxes around heat source
      ctx.strokeStyle = themeColor
      ctx.lineWidth = 1.5
      
      const boxSize = pulseSize * 1.5
      const bX = actualX - boxSize / 2
      const bY = actualY - boxSize / 2
      
      // Draw futuristic corner brackets
      ctx.beginPath()
      // Top Left
      ctx.moveTo(bX, bY + 8)
      ctx.lineTo(bX, bY)
      ctx.lineTo(bX + 8, bY)
      // Top Right
      ctx.moveTo(bX + boxSize - 8, bY)
      ctx.lineTo(bX + boxSize, bY)
      ctx.lineTo(bX + boxSize, bY + 8)
      // Bottom Left
      ctx.moveTo(bX, bY + boxSize - 8)
      ctx.lineTo(bX, bY + boxSize)
      ctx.lineTo(bX + 8, bY + boxSize)
      // Bottom Right
      ctx.moveTo(bX + boxSize - 8, bY + boxSize)
      ctx.lineTo(bX + boxSize, bY + boxSize)
      ctx.lineTo(bX + boxSize, bY + boxSize - 8)
      ctx.stroke()

      // Tag HUD label next to box
      ctx.fillStyle = themeColor
      ctx.font = 'bold 9px "Share Tech Mono", monospace'
      ctx.fillText(`THERM_ANOM: ${props.node?.aiCamera.confidence}%`, bX + boxSize + 4, bY + 8)
    })
  }

  // Camera screen diagnostics glitches
  glitchTimer--
  if (glitchTimer <= 0) {
    isGlitching = Math.random() > 0.85
    glitchTimer = Math.random() * 40 + 15
  }

  if (isGlitching || (props.node?.sensorsHealth.camera === 'ERR')) {
    // Add digital distortion horizontal bars
    const glitchLines = isGlitching ? 3 : 8
    for (let g = 0; g < glitchLines; g++) {
      const gY = Math.random() * height
      const gH = Math.random() * 12 + 2
      const gW = Math.random() * width * 0.4 + 10
      const gX = Math.random() * (width - gW)

      ctx.fillStyle = props.node?.sensorsHealth.camera === 'ERR' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.15)'
      ctx.fillRect(gX, gY, gW, gH)
    }
  }

  // Draw Camera HUD crosshair in the center
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)'
  ctx.lineWidth = 1
  // Horizontal center hash
  ctx.beginPath()
  ctx.moveTo(width / 2 - 25, height / 2)
  ctx.lineTo(width / 2 - 6, height / 2)
  ctx.moveTo(width / 2 + 6, height / 2)
  ctx.lineTo(width / 2 + 25, height / 2)
  // Vertical center hash
  ctx.moveTo(width / 2, height / 2 - 25)
  ctx.lineTo(width / 2, height / 2 - 6)
  ctx.moveTo(width / 2, height / 2 + 6)
  ctx.lineTo(width / 2, height / 2 + 25)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(width / 2, height / 2, 4, 0, Math.PI * 2)
  ctx.stroke()

  // Draw Diagnostic HUD Overlays
  ctx.fillStyle = '#06b6d4'
  ctx.font = '9px "Share Tech Mono", monospace'
  
  // Upper Left Telemetry
  ctx.textAlign = 'left'
  ctx.fillText(`CAM_SYS: ACTIVE // LIVE_SAT`, 15, 22)
  ctx.fillText(`RESOL: FLIR 640x480 IR`, 15, 34)
  ctx.fillText(`NODE_LAT: ${props.node?.lat.toFixed(4)}`, 15, 46)
  ctx.fillText(`NODE_LNG: ${props.node?.lng.toFixed(4)}`, 15, 58)

  // Upper Right Telemetry
  ctx.textAlign = 'right'
  ctx.fillText(`IA_ENGINE: FIRETAME v2.5`, width - 15, 22)
  ctx.fillText(`SAT_LINK: 98.4% [STABLE]`, width - 15, 34)
  ctx.fillText(`FPS: 30.0 Hz`, width - 15, 46)

  // Bottom Center IA Analysis panel
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
  ctx.strokeStyle = themeColor
  ctx.lineWidth = 1
  const hudW = Math.min(width - 30, 240)
  const hudX = (width - hudW) / 2
  ctx.fillRect(hudX, height - 38, hudW, 26)
  ctx.strokeRect(hudX, height - 38, hudW, 26)

  // Draw AI text inside panel
  ctx.fillStyle = themeColor
  ctx.font = 'bold 9.5px "Share Tech Mono", monospace'
  ctx.textAlign = 'center'
  
  let labelText = `IA: PENDIENTE - ANÁLISIS PASIVO`
  if (status === 'yellow') labelText = `🔍 IA: ESCANEANDO DESVIACIÓN (CONF: ${props.node?.aiCamera.confidence}%)`
  if (status === 'orange') labelText = `⚠️ IA: EVALUANDO FOCO CÁLIDO (CONF: ${props.node?.aiCamera.confidence}%)`
  if (status === 'red') labelText = `🚨 ALERTA: FUEGO FORESTAL CONFIRMADO (${props.node?.aiCamera.confidence}%)`
  if (props.node?.falsePositiveActive) labelText = `ℹ️ FILTRO IA: HUMO AGRÍCOLA (CONF: ${props.node?.aiCamera.confidence}%)`
  
  ctx.fillText(labelText, width / 2, height - 22)
}

onMounted(() => {
  startRendering()
})

onUnmounted(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
})

watch(() => props.node?.id, () => {
  // Reset noise landscapes when changing nodes
  sweepY = 0
})
</script>

<template>
  <div class="relative w-full h-full min-h-[220px] rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950 scanlines-overlay">
    <!-- Procedural Drawing Canvas -->
    <canvas ref="canvasRef" class="w-full h-full block cursor-crosshair"></canvas>

    <!-- Glowing Alert Banner Overlay -->
    <div 
      v-if="props.node && props.node.riskStatus === 'red'" 
      class="absolute top-2 left-1/2 -translate-x-1/2 px-4 py-1 rounded bg-red-600/90 text-white font-mono font-extrabold text-[10px] uppercase tracking-widest border border-red-500 shadow-glow-red animate-pulse z-10 flex items-center space-x-1.5"
    >
      <AlertOctagon class="w-4.5 h-4.5 text-white" />
      <span>TRANSMISIÓN DE EMERGENCIA</span>
    </div>
  </div>
</template>

<style scoped>
/* Scanlines overlays applied in tailwind custom classes */
</style>
