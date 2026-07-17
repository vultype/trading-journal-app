'use client'

// Confetti burst ringan berbasis canvas — tanpa dependency eksternal.
// Render sekali saat mount; partikel jatuh + memudar lalu berhenti sendiri.
import { useEffect, useRef } from 'react'

const COLORS = ['#34d399', '#22d3ee', '#a3e635', '#fbbf24', '#f472b6', '#ffffff']

export function Confetti({ count = 160, duration = 3500 }: { count?: number; duration?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => { canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr }
    resize()
    window.addEventListener('resize', resize)

    const W = () => canvas.width, H = () => canvas.height
    type P = { x: number; y: number; vx: number; vy: number; sz: number; rot: number; vr: number; color: string; shape: number }
    const parts: P[] = Array.from({ length: count }, () => ({
      x: W() / 2 + (Math.random() - 0.5) * W() * 0.3,
      y: H() * 0.35 + (Math.random() - 0.5) * 60 * dpr,
      vx: (Math.random() - 0.5) * 14 * dpr,
      vy: (Math.random() * -9 - 4) * dpr,
      sz: (Math.random() * 6 + 4) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      shape: (Math.random() * 2) | 0,
    }))

    const gravity = 0.32 * dpr
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const elapsed = t - start
      const fade = Math.max(0, 1 - Math.max(0, elapsed - duration * 0.55) / (duration * 0.45))
      ctx.clearRect(0, 0, W(), H())
      ctx.globalAlpha = fade
      for (const p of parts) {
        p.vy += gravity; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color
        if (p.shape === 0) ctx.fillRect(-p.sz / 2, -p.sz / 2, p.sz, p.sz * 0.6)
        else { ctx.beginPath(); ctx.arc(0, 0, p.sz / 2, 0, Math.PI * 2); ctx.fill() }
        ctx.restore()
      }
      ctx.globalAlpha = 1
      if (elapsed < duration) raf = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, W(), H())
    }
    raf = requestAnimationFrame(tick)

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [count, duration])

  return <canvas ref={ref} className="fixed inset-0 z-[60] pointer-events-none" style={{ width: '100vw', height: '100vh' }} aria-hidden />
}
