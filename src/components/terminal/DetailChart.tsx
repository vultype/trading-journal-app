'use client'

// Komponen shared untuk halaman detail 1 indikator (/terminal/data/*).
// Chart dibangun sendiri (SVG) dari data real — bukan iframe TradingView
// (sering blank/diblokir). Dipakai oleh halaman FRED (macro) & market (Twelve Data).
import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Crown, Landmark } from 'lucide-react'

export type ChartPoint = { label: string; value: number }

// Chart garis interaktif: hover → tooltip + crosshair. Spacing antar titik SAMA RATA
// per index (bukan skala waktu asli) — sederhana & tetap terbaca untuk data harian/intraday.
export function DetailLineChart({ data, height = 340 }: { data: ChartPoint[]; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(640)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const measure = () => setW(el.clientWidth || 640)
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const padL = 46, padR = 14, padT = 14, padB = 24
  const cw = Math.max(1, w - padL - padR), ch = Math.max(1, height - padT - padB)

  const onMove = useCallback((clientX: number) => {
    const el = wrapRef.current; if (!el || data.length < 2) return
    const rect = el.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - rect.left - padL) / cw))
    setHover(Math.round(frac * (data.length - 1)))
  }, [cw, data.length])

  if (data.length < 2) return <div style={{ height }} className="flex items-center justify-center text-white/30 text-sm">Data belum cukup untuk chart</div>

  const vals = data.map(d => d.value)
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1
  const x = (i: number) => padL + (i / (data.length - 1)) * cw
  const y = (v: number) => padT + ch - ((v - min) / range) * ch
  const linePts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')
  const areaPts = `${padL},${padT + ch} ${linePts} ${padL + cw},${padT + ch}`
  const up = vals[vals.length - 1] >= vals[0]
  const color = up ? '#34d399' : '#f87171'
  const gridVals = [max, min + range * 0.5, min]
  const hd = hover != null ? data[hover] : null
  const hx = hover != null ? x(hover) : 0
  const tipLeft = Math.min(Math.max(hx, 60), w - 60)
  const gradId = `dchart-fill-${Math.round(min * 1000)}`

  return (
    <div ref={wrapRef} className="relative select-none"
      onMouseMove={e => onMove(e.clientX)} onMouseLeave={() => setHover(null)}
      onTouchStart={e => onMove(e.touches[0].clientX)} onTouchMove={e => onMove(e.touches[0].clientX)}>
      <svg width={w} height={height} className="block">
        <defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.22" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line x1={padL} y1={y(gv)} x2={padL + cw} y2={y(gv)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padL - 8} y={y(gv) + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">{gv.toFixed(2)}</text>
          </g>
        ))}
        <polygon points={areaPts} fill={`url(#${gradId})`} />
        <polyline points={linePts} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        {[0, Math.floor((data.length - 1) / 2), data.length - 1].map(i => (
          <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize="10" fill="rgba(255,255,255,0.35)">{data[i].label}</text>
        ))}
        {hd && (
          <g>
            <line x1={hx} y1={padT} x2={hx} y2={padT + ch} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hx} cy={y(hd.value)} r="4" fill={color} stroke="#0b100e" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hd && (
        <div className="pointer-events-none absolute -top-1 rounded-lg border border-white/15 bg-[#0e1513] px-2.5 py-1.5 shadow-xl -translate-x-1/2" style={{ left: tipLeft }}>
          <p className="text-[9px] text-white/45 whitespace-nowrap">{hd.label}</p>
          <p className="text-[12px] font-black tabular-nums" style={{ color }}>{hd.value.toFixed(3)}</p>
        </div>
      )}
    </div>
  )
}

// Multi-series (dipakai halaman COT: Funds/Commercials/Retail sekaligus).
export function DetailMultiLineChart({ series, height = 340 }: { series: { name: string; color: string; data: ChartPoint[] }[]; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(640)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const measure = () => setW(el.clientWidth || 640)
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const padL = 54, padR = 14, padT = 14, padB = 24
  const cw = Math.max(1, w - padL - padR), ch = Math.max(1, height - padT - padB)
  const n = series[0]?.data.length ?? 0
  const onMove = useCallback((clientX: number) => {
    const el = wrapRef.current; if (!el || n < 2) return
    const rect = el.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - rect.left - padL) / cw))
    setHover(Math.round(frac * (n - 1)))
  }, [cw, n])
  if (n < 2) return <div style={{ height }} className="flex items-center justify-center text-white/30 text-sm">Data belum cukup untuk chart</div>

  const allVals = series.flatMap(s => s.data.map(d => d.value))
  const min = Math.min(...allVals, 0), max = Math.max(...allVals, 0), range = max - min || 1
  const x = (i: number) => padL + (i / (n - 1)) * cw
  const y = (v: number) => padT + ch - ((v - min) / range) * ch
  const zeroY = y(0)
  const gridVals = [max, (max + min) / 2, min]
  const hx = hover != null ? x(hover) : 0
  const tipLeft = hover != null ? Math.min(Math.max(hx, 90), w - 90) : 0

  return (
    <div ref={wrapRef} className="relative select-none"
      onMouseMove={e => onMove(e.clientX)} onMouseLeave={() => setHover(null)}
      onTouchStart={e => onMove(e.touches[0].clientX)} onTouchMove={e => onMove(e.touches[0].clientX)}>
      <svg width={w} height={height} className="block">
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line x1={padL} y1={y(gv)} x2={padL + cw} y2={y(gv)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padL - 8} y={y(gv) + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">{Math.round(gv / 1000)}K</text>
          </g>
        ))}
        <line x1={padL} y1={zeroY} x2={padL + cw} y2={zeroY} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="2 3" />
        {series.map(s => {
          const pts = s.data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')
          return <polyline key={s.name} points={pts} fill="none" stroke={s.color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        })}
        {[0, Math.floor((n - 1) / 2), n - 1].map(i => (
          <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="10" fill="rgba(255,255,255,0.35)">{series[0].data[i]?.label}</text>
        ))}
        {hover != null && <line x1={hx} y1={padT} x2={hx} y2={padT + ch} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3 3" />}
        {hover != null && series.map(s => {
          const d = s.data[hover]; if (!d) return null
          return <circle key={s.name} cx={hx} cy={y(d.value)} r="3.5" fill={s.color} stroke="#0b100e" strokeWidth="2" />
        })}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute -top-1 rounded-lg border border-white/15 bg-[#0e1513] px-2.5 py-2 shadow-xl -translate-x-1/2 space-y-1" style={{ left: tipLeft }}>
          <p className="text-[9px] text-white/45 whitespace-nowrap">{series[0].data[hover]?.label}</p>
          {series.map(s => (
            <p key={s.name} className="text-[11px] font-bold tabular-nums flex items-center gap-1.5 whitespace-nowrap" style={{ color: s.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />{s.name}: {s.data[hover] ? (s.data[hover].value >= 0 ? '+' : '') + Math.round(s.data[hover].value / 1000) + 'K' : '—'}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export function Row({ l, v, c }: { l: string; v: React.ReactNode; c?: string }) {
  return <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2.5"><span className="text-[12px] text-white/60">{l}</span><span className={`text-[13px] font-bold tabular-nums ${c ?? 'text-white/85'}`}>{v}</span></div>
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' | 'neutral' }) {
  const c = tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-red-400' : 'text-white/85'
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0b100e] p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <p className={`text-lg font-black tabular-nums mt-1 ${c}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/35 mt-0.5">{sub}</p>}
    </div>
  )
}

export function LockedTeaser({ icon: Icon = Landmark, title, desc }: { icon?: React.ElementType; title: string; desc: string }) {
  return (
    <div className="min-h-screen bg-[#060a09] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-3xl border border-primary/20 bg-gradient-to-b from-[#0b1512] to-[#0b100e] p-8 text-center">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 ring-1 ring-primary/30 text-primary mb-5"><Icon size={26} /></span>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 rounded-full px-2.5 py-1"><Crown size={11} /> Fitur Pro</span>
        <h2 className="text-2xl font-black tracking-tight mt-4">{title}</h2>
        <p className="text-sm text-white/55 mt-2.5 leading-relaxed">{desc}</p>
        <Link href="/upgrade" className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-bold mt-7 hover:opacity-90 transition-all"><Crown size={15} /> Upgrade ke Pro</Link>
      </div>
    </div>
  )
}

export const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return d } }
export const fmtDateShort = (d: string) => { try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) } catch { return d } }
