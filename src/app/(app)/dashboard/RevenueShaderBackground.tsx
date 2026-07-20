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

    // Particle class for Antigravity-like floating dust
    class Particle {
      x: number
      y: number
      baseX: number
      baseY: number
      size: number
      speedY: number
      speedX: number
      color: string
      opacity: number
      angle: number
      spin: number

      constructor() {
        this.x = Math.random() * width
        this.y = height + Math.random() * 50
        this.baseX = this.x
        this.baseY = this.y
        this.size = Math.random() * 2 + 1
        this.speedY = -(Math.random() * 0.3 + 0.1) // Float up slowly (antigravity)
        this.speedX = (Math.random() * 0.2 - 0.1)
        this.opacity = Math.random() * 0.6 + 0.2
        this.angle = Math.random() * Math.PI * 2
        this.spin = Math.random() * 0.01 - 0.005

        // Flowyn orange/amber colors
        const colors = [
          'rgba(249, 115, 22, ',  // orange-500
          'rgba(245, 158, 11, ',  // amber-500
          'rgba(253, 186, 116, ', // orange-300
        ]
        this.color = colors[Math.floor(Math.random() * colors.length)]
      }

      update(mx: number | null, my: number | null) {
        // Drift upwards
        this.y += this.speedY
        this.x += this.speedX + Math.sin(this.angle) * 0.15
        this.angle += this.spin

        // Respawn when reaching the top
        if (this.y < -10) {
          this.y = height + Math.random() * 20
          this.x = Math.random() * width
          this.opacity = Math.random() * 0.6 + 0.2
        }

        // Mouse interaction (repulsion/magnetic drift like antigravity)
        if (mx !== null && my !== null) {
          const dx = this.x - mx
          const dy = this.y - my
          const distance = Math.sqrt(dx * dx + dy * dy)
          const forceRadius = 100

          if (distance < forceRadius) {
            const force = (forceRadius - distance) / forceRadius
            const directionX = dx / distance
            const directionY = dy / distance
            // Push away gently
            this.x += directionX * force * 1.5
            this.y += directionY * force * 1.5
          }
        }
      }

      draw(c: CanvasRenderingContext2D) {
        c.beginPath()
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        c.fillStyle = `${this.color}${this.opacity})`
        // Add soft glow
        c.shadowColor = 'rgba(249, 115, 22, 0.4)'
        c.shadowBlur = 4
        c.fill()
        c.shadowBlur = 0 // reset
      }
    }

    const particles: Particle[] = []
    const particleCount = 45

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle())
    }

    let mouseX: number | null = null
    let mouseY: number | null = null

    function onMouseMove(event: MouseEvent) {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      mouseX = event.clientX - rect.left
      mouseY = event.clientY - rect.top
    }

    function onMouseLeave() {
      mouseX = null
      mouseY = null
    }

    window.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)

    let waveAngle = 0
    let raf = 0

    function animate() {
      if (!ctx || !canvas) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      // 1. Draw flowing fluid wave at the bottom edge (shifted down)
      waveAngle += 0.008
      ctx.beginPath()

      // Wave 1
      ctx.moveTo(0, height)
      for (let x = 0; x <= width; x += 10) {
        const y = height - 24 + Math.sin(x * 0.006 + waveAngle) * 8 + Math.cos(x * 0.012 - waveAngle) * 4
        ctx.lineTo(x, y)
      }
      ctx.lineTo(width, height)
      ctx.closePath()
      const grad1 = ctx.createLinearGradient(0, height - 30, width, height)
      grad1.addColorStop(0, 'rgba(249, 115, 22, 0.06)') // subtle flowyn orange
      grad1.addColorStop(1, 'rgba(245, 158, 11, 0.03)') // amber
      ctx.fillStyle = grad1
      ctx.fill()

      // Wave 2 (layered for depth)
      ctx.beginPath()
      ctx.moveTo(0, height)
      for (let x = 0; x <= width; x += 10) {
        const y = height - 20 + Math.sin(x * 0.008 - waveAngle * 1.2) * 6 + Math.cos(x * 0.004 + waveAngle) * 4
        ctx.lineTo(x, y)
      }
      ctx.lineTo(width, height)
      ctx.closePath()
      const grad2 = ctx.createLinearGradient(0, height - 25, width, height)
      grad2.addColorStop(0, 'rgba(245, 158, 11, 0.04)')
      grad2.addColorStop(1, 'rgba(249, 115, 22, 0.05)')
      ctx.fillStyle = grad2
      ctx.fill()

      // 2. Draw interactive particles
      for (const p of particles) {
        p.update(mouseX, mouseY)
        p.draw(ctx)
      }

      // 3. Subtle mouse cursor glow
      if (mouseX !== null && mouseY !== null) {
        ctx.beginPath()
        const radial = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 90)
        radial.addColorStop(0, 'rgba(249, 115, 22, 0.05)')
        radial.addColorStop(1, 'rgba(249, 115, 22, 0)')
        ctx.fillStyle = radial
        ctx.arc(mouseX, mouseY, 90, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouseMove)
      if (canvas) canvas.removeEventListener('mouseleave', onMouseLeave)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full pointer-events-none"
      style={{ display: 'block' }}
    />
  )
}
