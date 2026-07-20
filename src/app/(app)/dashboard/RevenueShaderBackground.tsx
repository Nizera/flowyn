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
      maxLife: number
      life: number
      color: string
      opacity: number

      constructor(x: number, y: number) {
        this.x = x
        this.y = y
        // Drifts upwards and outwards slightly
        this.vx = (Math.random() * 0.8 - 0.4)
        this.vy = -(Math.random() * 0.6 + 0.3) // slowly float up (antigravity)
        this.size = Math.random() * 2.5 + 1
        this.maxLife = Math.random() * 80 + 40
        this.life = this.maxLife
        this.opacity = Math.random() * 0.7 + 0.3

        const colors = [
          'rgba(249, 115, 22, ',  // orange-500
          'rgba(245, 158, 11, ',  // amber-500
          'rgba(251, 146, 60, ',  // orange-400
        ]
        this.color = colors[Math.floor(Math.random() * colors.length)]
      }

      update() {
        this.x += this.vx
        this.y += this.vy
        this.life--
        
        // Horizontal drift swing
        this.vx += (Math.random() * 0.1 - 0.05)
      }

      draw(c: CanvasRenderingContext2D) {
        const ratio = this.life / this.maxLife
        const currentOpacity = this.opacity * ratio
        const currentSize = this.size * (0.3 + 0.7 * ratio)

        c.beginPath()
        c.arc(this.x, this.y, currentSize, 0, Math.PI * 2)
        c.fillStyle = `${this.color}${currentOpacity})`
        
        // Add soft glow
        c.shadowColor = 'rgba(249, 115, 22, 0.5)'
        c.shadowBlur = 5
        c.fill()
        c.shadowBlur = 0
      }
    }

    let particles: Particle[] = []
    let mouseX: number | null = null
    let mouseY: number | null = null
    let isHovering = false

    function onMouseMove(event: MouseEvent) {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      // Verify bounds
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        mouseX = x
        mouseY = y
        isHovering = true

        // Spawn a cluster of particles at the cursor
        if (Math.random() < 0.4) {
          particles.push(new Particle(mouseX, mouseY))
        }
        if (Math.random() < 0.2) {
          particles.push(new Particle(mouseX + (Math.random() * 10 - 5), mouseY + (Math.random() * 10 - 5)))
        }
      } else {
        isHovering = false
        mouseX = null
        mouseY = null
      }
    }

    function onMouseEnter() {
      isHovering = true
    }

    function onMouseLeave() {
      isHovering = false
      mouseX = null
      mouseY = null
    }

    // Attach to the parent container if possible to capture mouse early
    const parent = canvas.parentElement
    if (parent) {
      parent.addEventListener('mousemove', onMouseMove)
      parent.addEventListener('mouseenter', onMouseEnter)
      parent.addEventListener('mouseleave', onMouseLeave)
    } else {
      window.addEventListener('mousemove', onMouseMove)
    }

    let waveAngle = 0
    let raf = 0

    function animate() {
      if (!ctx || !canvas) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      // 1. Draw flowing fluid wave at the very bottom edge (lowered even more)
      waveAngle += 0.006
      ctx.beginPath()

      // Wave 1 (Subtle, sit lower)
      ctx.moveTo(0, height)
      for (let x = 0; x <= width; x += 15) {
        const y = height - 12 + Math.sin(x * 0.005 + waveAngle) * 4 + Math.cos(x * 0.01 - waveAngle) * 2
        ctx.lineTo(x, y)
      }
      ctx.lineTo(width, height)
      ctx.closePath()
      const grad1 = ctx.createLinearGradient(0, height - 15, width, height)
      grad1.addColorStop(0, 'rgba(249, 115, 22, 0.05)') 
      grad1.addColorStop(1, 'rgba(245, 158, 11, 0.02)')
      ctx.fillStyle = grad1
      ctx.fill()

      // Wave 2 (Lower layer)
      ctx.beginPath()
      ctx.moveTo(0, height)
      for (let x = 0; x <= width; x += 15) {
        const y = height - 10 + Math.sin(x * 0.007 - waveAngle * 1.1) * 3 + Math.cos(x * 0.003 + waveAngle) * 2
        ctx.lineTo(x, y)
      }
      ctx.lineTo(width, height)
      ctx.closePath()
      const grad2 = ctx.createLinearGradient(0, height - 12, width, height)
      grad2.addColorStop(0, 'rgba(245, 158, 11, 0.03)')
      grad2.addColorStop(1, 'rgba(249, 115, 22, 0.04)')
      ctx.fillStyle = grad2
      ctx.fill()

      // 2. Update and draw particles
      particles = particles.filter(p => p.life > 0)
      for (const p of particles) {
        p.update()
        p.draw(ctx)
      }

      // 3. Subtle ambient hover glow behind the particles
      if (isHovering && mouseX !== null && mouseY !== null) {
        ctx.beginPath()
        const radial = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 80)
        radial.addColorStop(0, 'rgba(249, 115, 22, 0.04)')
        radial.addColorStop(1, 'rgba(249, 115, 22, 0)')
        ctx.fillStyle = radial
        ctx.arc(mouseX, mouseY, 80, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      if (parent) {
        parent.removeEventListener('mousemove', onMouseMove)
        parent.removeEventListener('mouseenter', onMouseEnter)
        parent.removeEventListener('mouseleave', onMouseLeave)
      } else {
        window.removeEventListener('mousemove', onMouseMove)
      }
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
