'use client'

import { useRef, useEffect } from 'react'

interface RevenueWaveBackgroundProps {
  data: Array<{ date: string; spend: number; revenue: number }>
}

export function RevenueWaveBackground({ data }: RevenueWaveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let animFrame = 0
    let time = 0

    function syncSize() {
      if (!canvas) return
      const w = canvas.clientWidth || 400
      const h = canvas.clientHeight || 48
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
        width = w
        height = h
      }
    }

    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(canvas)

    function getLinePoints(): number[] {
      if (!data || data.length === 0) {
        const pts: number[] = []
        for (let i = 0; i < 50; i++) {
          const t = i / 49
          // Upward slope with organic wobble
          pts.push(
            0.85 - t * 0.65 + Math.sin(t * Math.PI * 3) * 0.06 + Math.sin(t * Math.PI * 7) * 0.02
          )
        }
        return pts
      }

      const revenues = data.map(d => d.revenue)
      const maxRev = Math.max(...revenues, 1)
      const minRev = Math.min(...revenues, 0)
      const range = maxRev - minRev || 1

      return revenues.map((r, i) => {
        const norm = (r - minRev) / range
        // Base upward slope + data shape
        const t = i / (revenues.length - 1 || 1)
        const baseSlope = 0.85 - t * 0.65
        return baseSlope - norm * 0.15
      })
    }

    const linePoints = getLinePoints()

    function draw() {
      if (!ctx || !canvas) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      const padding = 8
      const drawW = width - padding * 2
      const drawH = height - 4
      const segmentW = drawW / (linePoints.length - 1)

      // Draw the upward-sloping line
      ctx.beginPath()

      for (let i = 0; i < linePoints.length; i++) {
        const x = padding + i * segmentW
        const baseY = 2 + linePoints[i] * drawH
        const waveY = baseY + Math.sin(time * 0.0012 + i * 0.25) * 1.5

        if (i === 0) {
          ctx.moveTo(x, waveY)
        } else {
          const prevX = padding + (i - 1) * segmentW
          const prevBaseY = 2 + linePoints[i - 1] * drawH
          const prevWaveY = prevBaseY + Math.sin(time * 0.0012 + (i - 1) * 0.25) * 1.5
          const cpx = (prevX + x) / 2
          ctx.bezierCurveTo(cpx, prevWaveY, cpx, waveY, x, waveY)
        }
      }

      const gradient = ctx.createLinearGradient(0, 0, width, 0)
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.15)')
      gradient.addColorStop(0.4, 'rgba(34, 197, 94, 0.35)')
      gradient.addColorStop(0.8, 'rgba(34, 197, 94, 0.55)')
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0.7)')

      ctx.strokeStyle = gradient
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()

      // Filled area under the line
      const lastX = padding + (linePoints.length - 1) * segmentW
      const lastBaseY = 2 + linePoints[linePoints.length - 1] * drawH
      ctx.lineTo(lastX, drawH + 4)
      ctx.lineTo(padding, drawH + 4)
      ctx.closePath()

      const fillGrad = ctx.createLinearGradient(0, 0, 0, height)
      fillGrad.addColorStop(0, 'rgba(34, 197, 94, 0.08)')
      fillGrad.addColorStop(1, 'rgba(34, 197, 94, 0)')
      ctx.fillStyle = fillGrad
      ctx.fill()

      // Pulse dot at end
      const endX = lastX
      const endY = lastBaseY + Math.sin(time * 0.0012 + (linePoints.length - 1) * 0.25) * 1.5
      const pulseR = 3.5 + Math.sin(time * 0.005) * 1.5

      ctx.beginPath()
      ctx.arc(endX, endY, pulseR, 0, Math.PI * 2)
      const glow = ctx.createRadialGradient(endX, endY, 0, endX, endY, pulseR)
      glow.addColorStop(0, 'rgba(34, 197, 94, 0.6)')
      glow.addColorStop(1, 'rgba(34, 197, 94, 0)')
      ctx.fillStyle = glow
      ctx.fill()

      ctx.beginPath()
      ctx.arc(endX, endY, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(34, 197, 94, 0.8)'
      ctx.fill()

      ctx.restore()

      time += 16
      animFrame = requestAnimationFrame(draw)
    }

    animFrame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animFrame)
      ro.disconnect()
    }
  }, [data])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-12 pointer-events-none -mx-6"
      style={{ display: 'block' }}
    />
  )
}
