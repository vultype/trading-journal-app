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

// ── Bar chart (vertikal) — cocok utk data diskret/perubahan (NFP bulanan, % move) ──
export function DetailBarChart({ data, height = 200, posColor = '#34d399', negColor = '#f87171', fmt = (v: number) => v.toFixed(2) }: { data: ChartPoint[]; height?: number; posColor?: string; negColor?: string; fmt?: (v: number) => string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => { const el = wrapRef.current; if (!el) return; const m = () => setW(el.clientWidth || 600); m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect() }, [])
  const padL = 42, padR = 10, padT = 12, padB = 22
  const cw = Math.max(1, w - padL - padR), ch = Math.max(1, height - padT - padB)
  if (data.length < 1) return <div style={{ height }} className="flex items-center justify-center text-white/30 text-sm">Data belum cukup</div>
  const vals = data.map(d => d.value)
  const min = Math.min(...vals, 0), max = Math.max(...vals, 0), range = max - min || 1
  const y = (v: number) => padT + ch - ((v - min) / range) * ch
  const zeroY = y(0)
  const bw = cw / data.length
  const onMove = (clientX: number) => { const el = wrapRef.current; if (!el) return; const r = el.getBoundingClientRect(); const i = Math.floor((clientX - r.left - padL) / bw); setHover(i >= 0 && i < data.length ? i : null) }
  const grid = min < 0 ? [max, 0, min] : [max, min + range / 2, min]
  const hd = hover != null ? data[hover] : null
  const tipLeft = hover != null ? Math.min(Math.max(padL + hover * bw + bw / 2, 55), w - 55) : 0
  return (
    <div ref={wrapRef} className="relative select-none" onMouseMove={e => onMove(e.clientX)} onMouseLeave={() => setHover(null)}
      onTouchStart={e => onMove(e.touches[0].clientX)} onTouchMove={e => onMove(e.touches[0].clientX)}>
      <svg width={w} height={height} className="block">
        {grid.map((gv, i) => (<g key={i}><line x1={padL} y1={y(gv)} x2={padL + cw} y2={y(gv)} stroke={gv === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'} strokeDasharray={gv === 0 ? '2 3' : ''} /><text x={padL - 6} y={y(gv) + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">{fmt(gv)}</text></g>))}
        {data.map((d, i) => { const x0 = padL + i * bw + bw * 0.16, bw2 = bw * 0.68, yv = y(d.value); const barY = d.value >= 0 ? yv : zeroY, barH = Math.max(1, Math.abs(zeroY - yv)); return <rect key={i} x={x0} y={barY} width={bw2} height={barH} rx={1.5} fill={d.value >= 0 ? posColor : negColor} opacity={hover == null || hover === i ? 0.9 : 0.4} /> })}
        {[0, Math.floor((data.length - 1) / 2), data.length - 1].map(i => (<text key={i} x={padL + i * bw + bw / 2} y={height - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize="10" fill="rgba(255,255,255,0.35)">{data[i].label}</text>))}
      </svg>
      {hd && (<div className="pointer-events-none absolute -top-1 rounded-lg border border-white/15 bg-[#0e1513] px-2.5 py-1.5 shadow-xl -translate-x-1/2" style={{ left: tipLeft }}><p className="text-[9px] text-white/45 whitespace-nowrap">{hd.label}</p><p className="text-[12px] font-black tabular-nums" style={{ color: hd.value >= 0 ? posColor : negColor }}>{fmt(hd.value)}</p></div>)}
    </div>
  )
}

// ── Bar horizontal komparasi level (mis. inflasi CPI/PCE + target Fed) ──
export function CompareBars({ items, refValue, refLabel, suffix = '%' }: { items: { label: string; value: number; color?: string }[]; refValue?: number; refLabel?: string; suffix?: string }) {
  const max = Math.max(...items.map(i => Math.abs(i.value)), refValue ? Math.abs(refValue) : 0) * 1.12 || 1
  return (
    <div className="space-y-2.5">
      {items.map(it => (
        <div key={it.label}>
          <div className="flex items-center justify-between text-[11px] mb-1"><span className="text-white/60">{it.label}</span><span className="font-bold tabular-nums text-white/85">{it.value}{suffix}</span></div>
          <div className="relative h-2.5 rounded-full bg-white/[0.05] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(Math.abs(it.value) / max) * 100}%`, background: it.color ?? '#60a5fa' }} />
            {refValue != null && <span className="absolute top-0 bottom-0 w-px bg-amber-400/80" style={{ left: `${(refValue / max) * 100}%` }} />}
          </div>
        </div>
      ))}
      {refValue != null && refLabel && <p className="text-[10px] text-amber-400/80 flex items-center gap-1"><span className="inline-block w-2 h-px bg-amber-400/80" /> {refLabel} ({refValue}{suffix})</p>}
    </div>
  )
}

// ── Diverging bars (nilai bertanda, dari tengah) — korelasi / performa % ──
export function DivergingBars({ items, fmt, posColor = '#34d399', negColor = '#f87171' }: { items: { label: string; value: number }[]; fmt?: (v: number) => string; posColor?: string; negColor?: string }) {
  const max = Math.max(...items.map(i => Math.abs(i.value)), 0.001)
  return (
    <div className="space-y-2">
      {items.map(it => {
        const pos = it.value >= 0
        const w = (Math.abs(it.value) / max) * 48
        return (
          <div key={it.label} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-right text-[11px] text-white/60 truncate">{it.label}</span>
            <div className="relative flex-1 h-4 rounded bg-white/[0.03]">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
              <div className="absolute top-0.5 bottom-0.5 rounded-sm transition-all" style={{ left: pos ? '50%' : `${50 - w}%`, width: `${Math.max(1, w)}%`, background: pos ? posColor : negColor, opacity: 0.85 }} />
            </div>
            <span className="w-11 shrink-0 text-[11px] font-bold tabular-nums" style={{ color: pos ? posColor : negColor }}>{fmt ? fmt(it.value) : it.value.toFixed(2)}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Meter horizontal (mis. selera risiko: risk-off ↔ risk-on) ──
export function Meter({ value, leftLabel, rightLabel, leftColor = '#34d399', rightColor = '#f87171', caption }: { value: number; leftLabel: string; rightLabel: string; leftColor?: string; rightColor?: string; caption?: string }) {
  const v = Math.min(100, Math.max(0, value))
  return (
    <div>
      <div className="relative h-3 rounded-full mb-1.5" style={{ background: `linear-gradient(90deg, ${leftColor}66, rgba(255,255,255,0.08) 50%, ${rightColor}66)` }}>
        <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white ring-2 ring-[#0b100e] shadow" style={{ left: `${v}%` }} />
      </div>
      <div className="flex justify-between text-[10px] font-semibold"><span style={{ color: leftColor }}>◀ {leftLabel}</span><span style={{ color: rightColor }}>{rightLabel} ▶</span></div>
      {caption && <p className="text-[11px] text-white/55 leading-relaxed mt-2">{caption}</p>}
    </div>
  )
}

// ── Split long vs short (COT) — bar terbagi hijau/merah ──
export function LongShortSplit({ rows, fmt }: { rows: { label: string; long: number; short: number }[]; fmt: (n: number) => string }) {
  return (
    <div className="space-y-3">
      {rows.map(r => {
        const total = r.long + r.short || 1
        const lp = (r.long / total) * 100
        const net = r.long - r.short
        return (
          <div key={r.label}>
            <div className="flex items-center justify-between text-[11px] mb-1"><span className="text-white/70 font-semibold">{r.label}</span><span className={`tabular-nums font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>net {fmt(net)}</span></div>
            <div className="flex h-5 rounded-lg overflow-hidden text-[9px] font-bold ring-1 ring-white/[0.06]">
              <div className="bg-emerald-500/70 flex items-center px-2 text-emerald-50 whitespace-nowrap overflow-hidden" style={{ width: `${lp}%` }}>{lp > 18 ? `Long ${fmt(r.long)}` : ''}</div>
              <div className="bg-red-500/70 flex items-center justify-end px-2 text-red-50 whitespace-nowrap overflow-hidden" style={{ width: `${100 - lp}%` }}>{(100 - lp) > 18 ? `Short ${fmt(r.short)}` : ''}</div>
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-3 text-[9px] text-white/40 pt-0.5"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/70" />Long</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/70" />Short</span></div>
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
