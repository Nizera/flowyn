'use client'

import { useRef, useEffect } from 'react'

interface KpiSparklineProps {
  data: number[]
  color: string
  isPositive?: boolean
}

export function KpiSparkline({ data, color, isPositive }: KpiSparklineProps) {
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
      const w = canvas.clientWidth || 200
      const h = canvas.clientHeight || 40
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

    // Parse hex color to rgb
    function hexToRgb(hex: string): { r: number; g: number; b: number } {
      const h = hex.replace('#', '')
      return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16),
      }
    }

    const rgb = hexToRgb(color)
    const goUp = isPositive !== false

    function getPoints(): number[] {
      if (!data || data.length === 0) {
        const pts: number[] = []
        for (let i = 0; i < 30; i++) {
          const t = i / 29
          const base = goUp
            ? 0.75 - t * 0.5 + Math.sin(t * Math.PI * 3) * 0.04
            : 0.25 + t * 0.5 + Math.sin(t * Math.PI * 3) * 0.04
          pts.push(base)
        }
        return pts
      }

      const max = Math.max(...data, 1)
      const min = Math.min(...data, 0)
      const range = max - min || 1

      return data.map((v, i) => {
        const norm = (v - min) / range
        const t = i / (data.length - 1 || 1)
        // Blend data with directional slope
        const slope = goUp ? 0.75 - t * 0.5 : 0.25 + t * 0.5
        return slope * 0.5 + (goUp ? 1 - norm : norm) * 0.5
      })
    }

    const points = getPoints()

    function draw() {
      if (!ctx || !canvas) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      const pad = 4
      const drawW = width - pad * 2
      const drawH = height - 4
      const segW = drawW / (points.length - 1)

      // Main line
      ctx.beginPath()
      for (let i = 0; i < points.length; i++) {
        const x = pad + i * segW
        const y = 2 + points[i] * drawH + Math.sin(time * 0.0015 + i * 0.3) * 1

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          const prevX = pad + (i - 1) * segW
          const prevY = 2 + points[i - 1] * drawH + Math.sin(time * 0.0015 + (i - 1) * 0.3) * 1
          const cpx = (prevX + x) / 2
          ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y)
        }
      }

      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()

      // Fill area
      const lastX = pad + (points.length - 1) * segW
      ctx.lineTo(lastX, drawH + 4)
      ctx.lineTo(pad, drawH + 4)
      ctx.closePath()

      const fillGrad = ctx.createLinearGradient(0, 0, 0, height)
      fillGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`)
      fillGrad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`)
      ctx.fillStyle = fillGrad
      ctx.fill()

      // End dot
      const endY = 2 + points[points.length - 1] * drawH + Math.sin(time * 0.0015 + (points.length - 1) * 0.3) * 1
      const pulseR = 2.5 + Math.sin(time * 0.005) * 1

      ctx.beginPath()
      ctx.arc(lastX, endY, pulseR, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`
      ctx.fill()

      ctx.beginPath()
      ctx.arc(lastX, endY, 1.8, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`
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
  }, [data, color, isPositive])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-10 pointer-events-none"
      style={{ display: 'block' }}
    />
  )
}
