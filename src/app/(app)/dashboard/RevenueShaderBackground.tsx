'use client'

import { useRef, useEffect } from 'react'

export function RevenueShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0

    function syncSize() {
      if (!canvas) return
      const w = canvas.clientWidth || 400
      const h = canvas.clientHeight || 200
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

    class Particle {
      x: number
      y: number
      vx: number
      vy: number
      size: number
      color: string
      alpha: number
      angle: number
      speed: number

      constructor(w: number, h: number) {
        this.x = Math.random() * w
        this.y = Math.random() * h
        this.vx = (Math.random() - 0.5) * 0.4
        this.vy = -Math.random() * 0.5 - 0.1 // Slow gentle drift upwards
        this.size = Math.random() * 1.5 + 0.8
        this.alpha = Math.random() * 0.3 + 0.15 // Subtler alpha
        this.angle = Math.random() * Math.PI * 2
        this.speed = Math.random() * 0.015 + 0.005

        const colors = [
          'rgba(249, 115, 22, ',  // orange-500
          'rgba(245, 158, 11, ',  // amber-500
        ]
        this.color = colors[Math.floor(Math.random() * colors.length)]
      }

      update(w: number, h: number, mouseX: number | null, mouseY: number | null) {
        this.angle += this.speed
        this.y += this.vy + Math.sin(this.angle) * 0.2
        this.x += this.vx + Math.cos(this.angle) * 0.2

        if (this.y < -10) {
          this.y = h + 10
          this.x = Math.random() * w
        }
        if (this.x < -10) this.x = w + 10
        if (this.x > w + 10) this.x = -10

        // Gentle mouse repulsion (Antigravity style)
        if (mouseX !== null && mouseY !== null) {
          const dx = mouseX - this.x
          const dy = mouseY - this.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const maxDist = 80

          if (dist < maxDist && dist > 0) {
            const force = (1 - dist / maxDist) * 2
            const angle = Math.atan2(dy, dx)
            this.x -= Math.cos(angle) * force
            this.y -= Math.sin(angle) * force
          }
        }
      }

      draw(c: CanvasRenderingContext2D) {
        c.beginPath()
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        c.fillStyle = `${this.color}${this.alpha})`
        c.shadowColor = 'rgba(249, 115, 22, 0.2)'
        c.shadowBlur = 3
        c.fill()
        c.shadowBlur = 0
      }
    }

    const particleCount = 25 // Fewer particles for a cleaner look
    let particles: Particle[] = []
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle(width || 400, height || 200))
    }

    let mouseX: number | null = null
    let mouseY: number | null = null

    function onMouseMove(e: MouseEvent) {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      mouseX = e.clientX - rect.left
      mouseY = e.clientY - rect.top
    }

    function onMouseLeave() {
      mouseX = null
      mouseY = null
    }

    const parent = canvas.parentElement
    if (parent) {
      parent.addEventListener('mousemove', onMouseMove)
      parent.addEventListener('mouseleave', onMouseLeave)
    }

    let raf = 0
    function animate() {
      if (!ctx || !canvas) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      // Subtle constellation lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 55) {
            const alpha = (1 - dist / 55) * 0.08 // Very subtle lines
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(249, 115, 22, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      for (const p of particles) {
        p.update(width, height, mouseX, mouseY)
        p.draw(ctx)
      }

      ctx.restore()
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      if (parent) {
        parent.removeEventListener('mousemove', onMouseMove)
        parent.removeEventListener('mouseleave', onMouseLeave)
      }
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full pointer-events-none z-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      style={{ display: 'block' }}
    />
  )
}
