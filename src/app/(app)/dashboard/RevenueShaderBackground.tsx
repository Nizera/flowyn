'use client'

import { useRef, useEffect } from 'react'

const VERT = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

// Adapted shader: white background with subtle orange flowing energy trails
// and a mouse-following orange glow. Keeps the card light and content readable.
const FRAG = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec2 mouse = u_mouse / u_resolution;

    vec3 orange = vec3(1.0, 0.45, 0.15); // #FF7326
    vec3 amber  = vec3(1.0, 0.60, 0.25); // flow accent
    vec3 white = vec3(1.0, 0.99, 0.98);

    // Animated flowing noise
    float n = sin(uv.x * 8.0 + u_time * 0.4) * cos(uv.y * 8.0 + u_time * 0.4);
    n += sin(uv.x * 18.0 - u_time * 0.7) * 0.5;

    // Horizontal energy band centered vertically with organic motion
    float band = smoothstep(0.12, 0.0, abs(uv.y - 0.5 + n * 0.08));
    band *= smoothstep(1.0, 0.0, uv.x); // fade from left to right
    band *= 0.18; // keep subtle so white stays dominant

    // Mouse glow (in pixel/normalized coords)
    float dist = distance(uv, mouse);
    float glow = smoothstep(0.35, 0.0, dist) * 0.35;

    vec3 finalColor = mix(white, orange, band);
    finalColor = mix(finalColor, amber, glow * 0.8);

    gl_FragColor = vec4(finalColor, 1.0);
}`

export function RevenueShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const canvas: HTMLCanvasElement = canvasEl

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function syncSize() {
      if (!canvas) return
      const w = canvas.clientWidth || 400
      const h = canvas.clientHeight || 200
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
    }
    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(canvas)

    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return
    const glCtx: WebGLRenderingContext = gl

    function compile(type: number, src: string) {
      const s = glCtx.createShader(type)!
      glCtx.shaderSource(s, src)
      glCtx.compileShader(s)
      return s
    }

    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(prog, 'a_position')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uRes = gl.getUniformLocation(prog, 'u_resolution')
    const uMouse = gl.getUniformLocation(prog, 'u_mouse')

    let mouse = { x: (canvas.width || 1) / 2, y: (canvas.height || 1) / 2 }

    function onMouseMove(event: MouseEvent) {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const nx = (event.clientX - rect.left) / rect.width
      const ny = 1.0 - (event.clientY - rect.top) / rect.height
      mouse.x = nx * canvas.width
      mouse.y = ny * canvas.height
    }
    window.addEventListener('mousemove', onMouseMove)

    let raf = 0
    function render(t: number) {
      syncSize()
      glCtx.viewport(0, 0, canvas.width, canvas.height)
      if (uTime) glCtx.uniform1f(uTime, t * 0.001)
      if (uRes) glCtx.uniform2f(uRes, canvas.width, canvas.height)
      if (uMouse) glCtx.uniform2f(uMouse, mouse.x, mouse.y)
      glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4)
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouseMove)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ display: 'block', pointerEvents: 'none' }}
    />
  )
}
