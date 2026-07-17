'use client'

// Komponen "Makro Mendalam" yang dirender DI DALAM terminal (tab Makro & sub-tab
// Lintas Aset / Inflasi / Institusi). Chart komparasi ternormalisasi (fokus XAU)
// + kartu indikator + section COT. Data dari endpoint yang sudah ada.
import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { DetailLineChart, DetailMultiLineChart, Row, Stat, fmtDate, fmtDateShort, type ChartPoint } from './DetailChart'
import { Loader2, ExternalLink, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'

type MacroPoint = { value: number; prior: number }
export type MacroMap = Record<string, MacroPoint & { key?: string; date?: string; history?: number[] }> | null
export type CrossData = { btc: Q; spy: Q; qqq: Q; vixy: Q; uup: Q; xag: Q } | null
type Q = { price: number; changePct: number } | null
type CotGroup = { long: number; short: number; net: number; deltaNet: number }
type HistPoint = { date: string; value: number }
export type CotData = { date: string; funds: CotGroup; commercials: CotGroup; retail: CotGroup; fundsHistoryFull: HistPoint[]; commercialsHistoryFull: HistPoint[]; retailHistoryFull: HistPoint[] } | null
type Series = { date: string; value: number }[]

const kfmt = (n: number) => (n >= 0 ? '+' : '') + (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toFixed(0))

async function fetchHistory(type: 'fred' | 'mkt', id: string, limit = 120): Promise<Series> {
  const url = type === 'fred' ? `/api/terminal/macro-history?key=${id}&limit=${limit}` : `/api/terminal/candles?tf=D1&symbol=${encodeURIComponent(id)}`
  const d = await fetch(url).then(r => r.json()).catch(() => null)
  if (!Array.isArray(d)) return []
  return type === 'fred'
    ? (d as HistPoint[]).map(p => ({ date: p.date, value: p.value }))
    : (d as { t: number; c: number }[]).map(c => ({ date: new Date(c.t).toISOString().slice(0, 10), value: c.c }))
}

// align ke tanggal-union + rebase ke % change
function alignNormalize(named: { name: string; color: string; main?: boolean; raw: Series }[], windowDays = 90) {
  const maps = named.map(s => new Map(s.raw.map(p => [p.date, p.value])))
  const allDates = Array.from(new Set(named.flatMap(s => s.raw.map(p => p.date)))).sort()
  const dates = allDates.slice(-windowDays)
  if (!dates.length) return { dates: [] as string[], series: [] as { name: string; color: string; main?: boolean; values: (number | null)[] }[] }
  const series = named.map((s, i) => {
    let last: number | null = null
    for (const p of s.raw) { if (p.date <= dates[0]) last = p.value; else break }
    const filled = dates.map(d => { if (maps[i].has(d)) last = maps[i].get(d)!; return last })
    const base = filled.find(v => v != null) ?? null
    const values = filled.map(v => (v == null || base == null || base === 0) ? null : ((v - base) / Math.abs(base)) * 100)
    return { name: s.name, color: s.color, main: s.main, values }
  })
  return { dates, series }
}

// ── Chart komparasi interaktif (filter + fokus XAU) ──
function ComparisonSVG({ dates, series, visible, height = 340 }: {
  dates: string[]; series: { name: string; color: string; main?: boolean; values: (number | null)[] }[]; visible: Record<string, boolean>; height?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(720)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const m = () => setW(el.clientWidth || 720); m()
    const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect()
  }, [])
  const shown = series.filter(s => visible[s.name])
  const padL = 50, padR = 16, padT = 14, padB = 24
  const cw = Math.max(1, w - padL - padR), ch = Math.max(1, height - padT - padB)
  const n = dates.length
  const onMove = useCallback((clientX: number) => {
    const el = wrapRef.current; if (!el || n < 2) return
    const r = el.getBoundingClientRect()
    setHover(Math.round(Math.min(1, Math.max(0, (clientX - r.left - padL) / cw)) * (n - 1)))
  }, [cw, n])
  if (n < 2 || !shown.length) return <div style={{ height }} className="flex items-center justify-center text-white/30 text-sm">{n < 2 ? 'Memuat data…' : 'Pilih minimal satu data'}</div>
  const allVals = shown.flatMap(s => s.values.filter((v): v is number => v != null))
  const min = Math.min(...allVals, 0), max = Math.max(...allVals, 0), range = max - min || 1
  const x = (i: number) => padL + (i / (n - 1)) * cw
  const y = (v: number) => padT + ch - ((v - min) / range) * ch
  const grid = [max, (max + min) / 2, min]
  const hx = hover != null ? x(hover) : 0
  const tipLeft = hover != null ? Math.min(Math.max(hx, 92), w - 92) : 0
  return (
    <div ref={wrapRef} className="relative select-none"
      onMouseMove={e => onMove(e.clientX)} onMouseLeave={() => setHover(null)}
      onTouchStart={e => onMove(e.touches[0].clientX)} onTouchMove={e => onMove(e.touches[0].clientX)}>
      <svg width={w} height={height} className="block">
        {grid.map((gv, i) => (
          <g key={i}><line x1={padL} y1={y(gv)} x2={padL + cw} y2={y(gv)} stroke="rgba(255,255,255,0.06)" /><text x={padL - 8} y={y(gv) + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">{gv >= 0 ? '+' : ''}{gv.toFixed(1)}%</text></g>
        ))}
        <line x1={padL} y1={y(0)} x2={padL + cw} y2={y(0)} stroke="rgba(255,255,255,0.14)" strokeDasharray="2 3" />
        {[...shown].sort((a, b) => (a.main ? 1 : 0) - (b.main ? 1 : 0)).map(s => {
          const pts = s.values.map((v, i) => v == null ? null : `${x(i)},${y(v)}`).filter(Boolean).join(' ')
          return <polyline key={s.name} points={pts} fill="none" stroke={s.color} strokeWidth={s.main ? 2.75 : 1.4} opacity={s.main ? 1 : 0.85} strokeLinejoin="round" strokeLinecap="round" />
        })}
        {[0, Math.floor((n - 1) / 2), n - 1].map(i => (
          <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="10" fill="rgba(255,255,255,0.35)">{fmtDateShort(dates[i])}</text>
        ))}
        {hover != null && <line x1={hx} y1={padT} x2={hx} y2={padT + ch} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />}
        {hover != null && shown.map(s => s.values[hover] == null ? null : <circle key={s.name} cx={hx} cy={y(s.values[hover]!)} r={s.main ? 4 : 3} fill={s.color} stroke="#0b100e" strokeWidth="2" />)}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute -top-1 rounded-lg border border-white/15 bg-[#0e1513] px-2.5 py-2 shadow-xl -translate-x-1/2 space-y-0.5 z-10" style={{ left: tipLeft }}>
          <p className="text-[9px] text-white/45 whitespace-nowrap mb-0.5">{fmtDate(dates[hover])}</p>
          {[...shown].sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0)).map(s => (
            <p key={s.name} className="text-[11px] font-bold tabular-nums flex items-center gap-1.5 whitespace-nowrap" style={{ color: s.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />{s.name}: {s.values[hover] != null ? `${s.values[hover]! >= 0 ? '+' : ''}${s.values[hover]!.toFixed(2)}%` : '—'}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export type CompDef = { name: string; color: string; main?: boolean; default?: boolean } & ({ type: 'fred' | 'mkt'; id: string } | { raw: Series })

// Wrapper: fetch semua series (yg type), normalisasi, render chart + chip filter.
export function MacroComparisonChart({ title, note, defs, height = 340 }: { title: string; note?: string; defs: CompDef[]; height?: number }) {
  const [comp, setComp] = useState<ReturnType<typeof alignNormalize> | null>(null)
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const depKey = defs.map(d => d.name + ('id' in d ? d.id : ('raw' in d ? String(d.raw.length) : ''))).join('|')

  useEffect(() => {
    let stop = false
    ;(async () => {
      const raws = await Promise.all(defs.map(d => 'raw' in d ? Promise.resolve(d.raw) : fetchHistory(d.type, d.id, 120)))
      if (stop) return
      const named = defs.map((d, i) => ({ name: d.name, color: d.color, main: d.main, raw: raws[i] }))
      setComp(alignNormalize(named, 90))
      setVisible(Object.fromEntries(defs.map(d => [d.name, d.main || !!d.default])))
    })()
    return () => { stop = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey])

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <p className="text-sm font-bold flex items-center gap-2">{title} <span className="text-[9px] font-semibold text-white/30 normal-case">% perubahan · 90 hari · fokus XAU/USD</span></p>
        {note && <p className="text-[10px] text-white/40 mt-0.5">{note}</p>}
      </div>
      <div className="p-3">
        {comp ? <ComparisonSVG dates={comp.dates} series={comp.series} visible={visible} height={height} /> : <div style={{ height }} className="flex items-center justify-center"><Loader2 size={22} className="animate-spin text-white/30" /></div>}
      </div>
      {comp && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-4">
          {comp.series.map(s => {
            const on = visible[s.name]
            return (
              <button key={s.name} onClick={() => setVisible(v => ({ ...v, [s.name]: !v[s.name] }))}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${on ? 'border-white/20 bg-white/[0.06] text-white' : 'border-white/[0.08] text-white/35 hover:text-white/60'} ${s.main ? 'ring-1 ring-amber-400/40' : ''}`}>
                <span className="w-2 h-2 rounded-full" style={{ background: on ? s.color : 'rgba(255,255,255,0.2)' }} />{s.name}{s.main && ' ★'}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Kartu indikator kecil (mini chart + nilai + link detail) ──
function IndicatorCard({ label, type, id, current, href, color = '#60a5fa' }: { label: string; type: 'fred' | 'mkt'; id: string; current: string; href: string; color?: string }) {
  const [hist, setHist] = useState<Series | null>(null)
  useEffect(() => { let stop = false; fetchHistory(type, id, 90).then(s => { if (!stop) setHist(s) }); return () => { stop = true } }, [type, id])
  const data: ChartPoint[] | null = hist ? hist.map(p => ({ label: fmtDateShort(p.date), value: p.value })) : null
  return (
    <Link href={href} className="group rounded-2xl border border-white/[0.07] bg-[#0b100e] p-4 hover:border-primary/25 transition-colors block">
      <div className="flex items-center justify-between mb-1"><p className="text-[12px] font-bold text-white/80">{label}</p><ExternalLink size={12} className="text-white/25 group-hover:text-primary transition-colors" /></div>
      <p className="text-lg font-black tabular-nums mb-1">{current}</p>
      {data ? <DetailLineChart data={data} height={90} /> : <div className="h-[90px] flex items-center justify-center"><Loader2 size={14} className="animate-spin text-white/25" /></div>}
    </Link>
  )
}

// ── util: fetch banyak history sekali dgn CONCURRENCY terbatas (cegah rate-limit
// Twelve Data yg bikin sebagian chart kosong) + dedupe (1 simbol = 1 request) ──
async function fetchMany(defs: { key: string; type: 'fred' | 'mkt'; id: string }[], concurrency = 3): Promise<Record<string, Series>> {
  const out: Record<string, Series> = {}
  const queue = [...defs]
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (;;) {
      const d = queue.shift(); if (!d) break
      out[d.key] = await fetchHistory(d.type, d.id, 120)
    }
  }))
  return out
}

// Bacaan interpretasi tiap aset ke EMAS (tone + kalimat singkat).
type Reading = { tone: 'bull' | 'bear' | 'neutral'; label: string; note: string }
function ReadingBadge({ r }: { r: Reading }) {
  const c = r.tone === 'bull' ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25' : r.tone === 'bear' ? 'bg-red-500/12 text-red-400 border-red-500/25' : 'bg-white/[0.05] text-white/55 border-white/10'
  const Ic = r.tone === 'bull' ? TrendingUp : r.tone === 'bear' ? TrendingDown : Minus
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${c}`}><Ic size={10} /> {r.label}</span>
}

const upDown = (chg: number, upBear = true): Reading['tone'] => Math.abs(chg) < 0.02 ? 'neutral' : (chg > 0) === upBear ? 'bear' : 'bull'

// ── Kartu aset UTAMA (featured): chart besar + bacaan + narasi (variasi layout) ──
function FeaturedAsset({ label, sub, current, chg, data, color, href, reading, body }: {
  label: string; sub: string; current: string; chg?: string; data: Series | undefined; color: string; href: string; reading: Reading; body: string
}) {
  const cd: ChartPoint[] | null = data && data.length ? data.map(p => ({ label: fmtDateShort(p.date), value: p.value })) : null
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0b100e] overflow-hidden grid md:grid-cols-2">
      <div className="p-5 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-1"><p className="text-[13px] font-black">{label}</p><ReadingBadge r={reading} /></div>
        <p className="text-[10px] text-white/40 mb-3">{sub}</p>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-black tabular-nums">{current}</span>
          {chg && <span className="text-xs font-bold tabular-nums text-white/50">{chg}</span>}
        </div>
        <p className="text-[12px] text-white/60 leading-relaxed flex-1">{body}</p>
        <p className="text-[11px] font-semibold mt-3" style={{ color: reading.tone === 'bull' ? '#34d399' : reading.tone === 'bear' ? '#f87171' : 'rgba(255,255,255,0.6)' }}>→ {reading.note}</p>
        <Link href={href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline mt-3">Detail & tren panjang <ArrowRight size={12} /></Link>
      </div>
      <div className="relative p-3 border-t md:border-t-0 md:border-l border-white/[0.06] flex items-center" style={{ background: `linear-gradient(180deg, ${color}0a, transparent)` }}>
        {cd ? <div className="w-full"><DetailLineChart data={cd} height={190} /></div> : <div className="w-full h-[190px] flex items-center justify-center text-[11px] text-white/25">Memuat chart…</div>}
      </div>
    </div>
  )
}

// ── Kartu aset RINGKAS: chart kecil + bacaan (variasi) ──
function MiniAsset({ label, current, data, href, reading }: { label: string; current: string; data: Series | undefined; href: string; reading: Reading }) {
  const cd: ChartPoint[] | null = data && data.length ? data.map(p => ({ label: fmtDateShort(p.date), value: p.value })) : null
  return (
    <Link href={href} className="group rounded-2xl border border-white/[0.07] bg-[#0b100e] p-4 hover:border-primary/25 transition-colors block">
      <div className="flex items-center justify-between mb-1"><p className="text-[12px] font-bold text-white/80">{label}</p><ExternalLink size={12} className="text-white/25 group-hover:text-primary transition-colors" /></div>
      <div className="flex items-center justify-between gap-2 mb-2"><span className="text-lg font-black tabular-nums">{current}</span><ReadingBadge r={reading} /></div>
      {cd ? <DetailLineChart data={cd} height={80} /> : <div className="h-[80px] flex items-center justify-center text-[10px] text-white/25">Memuat…</div>}
      <p className="text-[10px] text-white/40 leading-snug mt-2">{reading.note}</p>
    </Link>
  )
}

function GroupHead({ emoji, title, intro }: { emoji: string; title: string; intro: string }) {
  return (
    <div className="pt-1">
      <h3 className="text-base font-black flex items-center gap-2"><span className="text-lg">{emoji}</span> {title}</h3>
      <p className="text-[12px] text-white/55 leading-relaxed mt-1.5 max-w-3xl">{intro}</p>
    </div>
  )
}

// ── Section: Lintas Aset (gaya artikel/editorial) ──
export function LintasAsetSection({ macro, cross }: { macro: MacroMap; cross: CrossData }) {
  const [h, setH] = useState<Record<string, Series> | null>(null)
  useEffect(() => {
    let stop = false
    fetchMany([
      { key: 'xau', type: 'mkt', id: 'XAU/USD' }, { key: 'dollar', type: 'fred', id: 'dollar' },
      { key: 'us10y', type: 'fred', id: 'us10y' }, { key: 'us02y', type: 'fred', id: 'us02y' }, { key: 'realyield', type: 'fred', id: 'realyield' },
      { key: 'vix', type: 'mkt', id: 'VIXY' }, { key: 'spy', type: 'mkt', id: 'SPY' }, { key: 'qqq', type: 'mkt', id: 'QQQ' },
      { key: 'btc', type: 'mkt', id: 'BTC/USD' }, { key: 'xag', type: 'mkt', id: 'XAG/USD' },
    ], 3).then(r => { if (!stop) setH(r) })
    return () => { stop = true }
  }, [])

  const pct = (q: Q) => q ? `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%` : ''
  const num = (q: Q, dec = 2) => q ? q.price.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—'
  const fdir = (k: string): number => { const p = macro?.[k]; return p ? p.value - p.prior : 0 }

  // Bacaan per aset
  const rDollar: Reading = { tone: upDown(fdir('dollar')), label: fdir('dollar') > 0 ? 'Tekan emas' : 'Dukung emas', note: fdir('dollar') > 0 ? 'Dolar menguat dari rilis lalu — biasanya menekan harga emas.' : 'Dolar melemah — angin positif buat emas.' }
  const r10: Reading = { tone: upDown(fdir('us10y')), label: fdir('us10y') > 0 ? 'Tekan emas' : 'Dukung emas', note: fdir('us10y') > 0 ? 'Yield naik → biaya peluang emas naik.' : 'Yield turun → emas lebih menarik.' }
  const r2: Reading = { tone: upDown(fdir('us02y')), label: fdir('us02y') > 0 ? 'Hawkish' : 'Dovish', note: fdir('us02y') > 0 ? 'Yield 2Y naik → pasar hawkish, sedikit menekan emas.' : 'Yield 2Y turun → ekspektasi pangkas bunga.' }
  const rReal: Reading = { tone: upDown(fdir('realyield')), label: fdir('realyield') > 0 ? 'Tekan emas' : 'Dukung emas', note: 'Korelasi paling kuat ke emas — real yield turun = paling bullish.' }
  const rVix: Reading = { tone: cross?.vixy ? (cross.vixy.changePct > 0.5 ? 'bull' : cross.vixy.changePct < -0.5 ? 'bear' : 'neutral') : 'neutral', label: cross?.vixy && cross.vixy.changePct > 0.5 ? 'Dukung emas' : 'Netral', note: 'VIX naik = pasar takut (risk-off) → dana lari ke aset aman seperti emas.' }
  const rSpy: Reading = { tone: cross?.spy ? (cross.spy.changePct < -0.3 ? 'bull' : cross.spy.changePct > 0.3 ? 'bear' : 'neutral') : 'neutral', label: cross?.spy && cross.spy.changePct < -0.3 ? 'Risk-off' : cross?.spy && cross.spy.changePct > 0.3 ? 'Risk-on' : 'Netral', note: 'Saham anjlok (risk-off) sering angkat emas; reli saham = selera risiko tinggi.' }
  const rQqq: Reading = { tone: cross?.qqq ? (cross.qqq.changePct < -0.3 ? 'bull' : cross.qqq.changePct > 0.3 ? 'bear' : 'neutral') : 'neutral', label: cross?.qqq && cross.qqq.changePct < -0.3 ? 'Risk-off' : cross?.qqq && cross.qqq.changePct > 0.3 ? 'Risk-on' : 'Netral', note: 'Teknologi sensitif ke suku bunga — sinyal dini pergeseran risiko.' }
  const rBtc: Reading = { tone: 'neutral', label: 'Sentimen risiko', note: 'Korelasi ke emas tidak konsisten — lebih sebagai barometer selera risiko 24/7.' }
  const rXag: Reading = { tone: cross?.xag ? (cross.xag.changePct >= 0 ? 'bull' : 'bear') : 'neutral', label: 'Searah emas', note: 'Perak biasanya bergerak searah emas, tapi lebih volatil ("emas dengan leverage").' }

  return (
    <div className="space-y-6">
      {/* Intro artikel */}
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5">Lintas Aset · Analisa Korelasi</p>
        <h2 className="text-xl font-black tracking-tight">Emas Tidak Bergerak Sendirian</h2>
        <p className="text-[13px] text-white/60 leading-relaxed mt-2 max-w-3xl">Harga XAU/USD adalah cerminan dari tarik-menarik antar aset besar dunia — dolar, suku bunga, saham, hingga kripto. Halaman ini membaca <b className="text-white/85">apa yang sedang dilakukan aset-aset itu</b> dan menerjemahkannya menjadi bacaan sederhana: <span className="text-emerald-400 font-semibold">dukung emas</span> atau <span className="text-red-400 font-semibold">tekan emas</span>. Chart di bawah menyamakan semua ke % perubahan agar bisa dibandingkan langsung.</p>
      </div>

      {/* Chart komparasi (interaktif) — pakai data yg sudah di-fetch (tanpa fetch ganda) */}
      {h ? (
        <MacroComparisonChart title="Perbandingan Lintas Aset" note="XAU/USD (garis utama) vs dolar, VIX, saham & Bitcoin — cari mana yang searah/berlawanan dengan emas."
          defs={[
            { name: 'XAU/USD', color: '#fbbf24', main: true, raw: h.xau ?? [] },
            { name: 'DXY', color: '#60a5fa', default: true, raw: h.dollar ?? [] },
            { name: 'VIX', color: '#a78bfa', raw: h.vix ?? [] },
            { name: 'S&P 500', color: '#22d3ee', default: true, raw: h.spy ?? [] },
            { name: 'Bitcoin', color: '#fb923c', raw: h.btc ?? [] },
            { name: 'Silver', color: '#e2e8f0', raw: h.xag ?? [] },
          ]} />
      ) : <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] h-[360px] flex items-center justify-center"><Loader2 size={22} className="animate-spin text-white/30" /></div>}

      {/* Grup 1: Dolar & Suku Bunga */}
      <GroupHead emoji="💵" title="Dolar & Suku Bunga AS" intro="Ini 'lawan utama' emas. Emas dihargakan dalam dolar dan tidak memberi bunga — jadi saat dolar & yield naik, emas kehilangan daya tarik relatif. Real yield (yield dikurangi inflasi) adalah penggerak paling konsisten." />
      <FeaturedAsset label="Indeks Dolar (DXY)" sub="Broad USD Index · Federal Reserve" current={macro?.dollar ? macro.dollar.value.toFixed(2) : '—'} chg={macro?.dollar ? `dari ${macro.dollar.prior.toFixed(2)}` : ''} data={h?.dollar} color="#60a5fa" href="/terminal/data/macro/dollar" reading={rDollar}
        body="Dolar adalah cerminan kekuatan ekonomi & kebijakan Fed. Ketika investor global memburu aset AS (yield tinggi, ekonomi kuat), dolar menguat dan emas — yang dihargakan dalam dolar — jadi relatif lebih mahal bagi pemegang mata uang lain, sehingga permintaan cenderung turun." />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniAsset label="Yield 10Y" current={macro?.us10y ? `${macro.us10y.value}%` : '—'} data={h?.us10y} href="/terminal/data/macro/us10y" reading={r10} />
        <MiniAsset label="Yield 2Y" current={macro?.us02y ? `${macro.us02y.value}%` : '—'} data={h?.us02y} href="/terminal/data/macro/us02y" reading={r2} />
        <MiniAsset label="Real Yield 10Y" current={macro?.realyield ? `${macro.realyield.value}%` : '—'} data={h?.realyield} href="/terminal/data/macro/realyield" reading={rReal} />
      </div>

      {/* Grup 2: Selera Risiko */}
      <GroupHead emoji="😨" title="Selera Risiko Pasar" intro="Emas adalah 'aset aman'. Saat pasar panik (risk-off) — saham anjlok, VIX melonjak — dana sering mengalir ke emas. Sebaliknya, saat pasar berani (risk-on), uang lebih memilih aset berisiko." />
      <FeaturedAsset label="VIX — Indeks Ketakutan" sub="Proxy VIXY · volatilitas S&P 500" current={cross?.vixy ? cross.vixy.price.toFixed(2) : '—'} chg={pct(cross?.vixy ?? null)} data={h?.vix} color="#a78bfa" href="/terminal/data/market/vix" reading={rVix}
        body="VIX mengukur ekspektasi gejolak pasar saham 30 hari ke depan. Lonjakan tajam biasanya menandai kepanikan (krisis, kejutan geopolitik) — dan di momen itulah emas paling sering diburu sebagai pelabuhan aman. VIX yang rendah & tenang menandakan pasar percaya diri, kurang menguntungkan emas." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MiniAsset label="S&P 500" current={num(cross?.spy ?? null)} data={h?.spy} href="/terminal/data/market/spx" reading={rSpy} />
        <MiniAsset label="Nasdaq 100" current={num(cross?.qqq ?? null)} data={h?.qqq} href="/terminal/data/market/ndx" reading={rQqq} />
      </div>

      {/* Grup 3: Aset Alternatif */}
      <GroupHead emoji="🪙" title="Aset Alternatif" intro="Bitcoin & perak sering dibandingkan dengan emas. Perak bergerak searah (logam mulia), sementara Bitcoin lebih sebagai barometer selera risiko modern — korelasinya ke emas naik-turun." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MiniAsset label="Bitcoin (BTC/USD)" current={cross?.btc ? Math.round(cross.btc.price).toLocaleString('en-US') : '—'} data={h?.btc} href="/terminal/data/market/btc" reading={rBtc} />
        <MiniAsset label="Perak (XAG/USD)" current={num(cross?.xag ?? null, 3)} data={h?.xag} href="/terminal/data/market/xag" reading={rXag} />
      </div>

      <p className="text-[11px] text-white/30 leading-relaxed pt-2 border-t border-white/[0.06]">Bacaan di atas dihitung otomatis dari data terbaru (arah rilis / perubahan harga) & kaidah korelasi umum ke emas — bersifat konteks, bukan sinyal entry. Data: Federal Reserve (FRED) & Twelve Data.</p>
    </div>
  )
}

// ── Section: Inflasi & Kebijakan Fed ──
export function InflasiSection({ macro }: { macro: MacroMap }) {
  return (
    <div className="space-y-4">
      <MacroComparisonChart title="Inflasi, Suku Bunga & Emas" note="XAU/USD vs inflasi (CPI/PCE), Fed Funds & Yield — pendorong terbesar emas jangka menengah."
        defs={[
          { name: 'XAU/USD', color: '#fbbf24', main: true, type: 'mkt', id: 'XAU/USD' },
          { name: 'CPI', color: '#f87171', default: true, type: 'fred', id: 'cpi' },
          { name: 'Core PCE', color: '#fb923c', type: 'fred', id: 'corepce' },
          { name: 'Fed Funds', color: '#60a5fa', default: true, type: 'fred', id: 'fedfunds' },
          { name: 'Yield 10Y', color: '#f472b6', type: 'fred', id: 'us10y' },
        ]} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <IndicatorCard label="CPI (Headline)" type="fred" id="cpi" current={macro?.cpi ? `${macro.cpi.value}%` : '—'} href="/terminal/data/macro/cpi" color="#f87171" />
        <IndicatorCard label="Core CPI" type="fred" id="corecpi" current={macro?.corecpi ? `${macro.corecpi.value}%` : '—'} href="/terminal/data/macro/corecpi" color="#f87171" />
        <IndicatorCard label="Core PCE (favorit Fed)" type="fred" id="corepce" current={macro?.corepce ? `${macro.corepce.value}%` : '—'} href="/terminal/data/macro/corepce" color="#fb923c" />
        <IndicatorCard label="Ekspektasi Inflasi (breakeven)" type="fred" id="breakeven" current={macro?.breakeven ? `${macro.breakeven.value}%` : '—'} href="/terminal/data/macro/breakeven" color="#fbbf24" />
        <IndicatorCard label="Fed Funds Rate" type="fred" id="fedfunds" current={macro?.fedfunds ? `${macro.fedfunds.value}%` : '—'} href="/terminal/data/macro/fedfunds" color="#60a5fa" />
        <IndicatorCard label="Pengangguran" type="fred" id="unrate" current={macro?.unrate ? `${macro.unrate.value}%` : '—'} href="/terminal/data/macro/unrate" color="#34d399" />
        <IndicatorCard label="NFP (Payrolls)" type="fred" id="nfp" current={macro?.nfp ? `${macro.nfp.value >= 0 ? '+' : ''}${macro.nfp.value}K` : '—'} href="/terminal/data/macro/nfp" color="#34d399" />
        <IndicatorCard label="Pertumbuhan Upah" type="fred" id="wagegrowth" current={macro?.wagegrowth ? `${macro.wagegrowth.value}%` : '—'} href="/terminal/data/macro/wagegrowth" color="#a78bfa" />
      </div>
    </div>
  )
}

// ── Section: Institusi vs Retail (COT) ──
export function CotSection({ cot }: { cot: CotData }) {
  if (!cot) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-white/30" /></div>
  return (
    <div className="space-y-4">
      {/* Komparasi: harga XAU vs posisi net institusi/retail (ternormalisasi) */}
      <MacroComparisonChart title="Harga Emas vs Posisi COT" note="XAU/USD vs posisi net Funds/Retail — apakah institusi memimpin atau mengikuti harga?"
        defs={[
          { name: 'XAU/USD', color: '#fbbf24', main: true, type: 'mkt', id: 'XAU/USD' },
          { name: 'Funds (Institusi)', color: '#34d399', default: true, raw: cot.fundsHistoryFull },
          { name: 'Retail', color: '#a78bfa', default: true, raw: cot.retailHistoryFull },
        ]} />
      {/* Chart absolut 3-jalur */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-wrap gap-2">
          <p className="text-sm font-bold flex items-center gap-2">Posisi Net (kontrak) — 1 Tahun <span className="text-[9px] font-semibold text-white/30 normal-case">CFTC · mingguan</span></p>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Funds</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-400" />Commercials</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400" />Retail</span>
          </div>
        </div>
        <div className="p-3">
          <DetailMultiLineChart height={320} series={[
            { name: 'Funds (Institusi)', color: '#34d399', data: cot.fundsHistoryFull.map(d => ({ label: fmtDateShort(d.date), value: d.value } as ChartPoint)) },
            { name: 'Commercials', color: '#60a5fa', data: cot.commercialsHistoryFull.map(d => ({ label: fmtDateShort(d.date), value: d.value } as ChartPoint)) },
            { name: 'Retail', color: '#a78bfa', data: cot.retailHistoryFull.map(d => ({ label: fmtDateShort(d.date), value: d.value } as ChartPoint)) },
          ]} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="Funds (Institusi)" value={kfmt(cot.funds.net)} tone={cot.funds.net >= 0 ? 'up' : 'down'} sub={`Δ${kfmt(cot.funds.deltaNet)}/mgg · smart money`} />
        <Stat label="Commercials (Hedger)" value={kfmt(cot.commercials.net)} tone={cot.commercials.net >= 0 ? 'up' : 'down'} sub={`Δ${kfmt(cot.commercials.deltaNet)}/mgg`} />
        <Stat label="Retail" value={kfmt(cot.retail.net)} tone="neutral" sub={`Δ${kfmt(cot.retail.deltaNet)}/mgg · kontrarian`} />
      </div>
      {cot.funds.net * cot.retail.net < 0 && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 p-4">
          <span className="text-amber-400 text-sm mt-0.5">⚠</span>
          <p className="text-[12px] text-amber-200/90 leading-relaxed">Institusi & Retail sedang <b>berlawanan arah</b> — historisnya condong mengikuti arah institusi (smart money).</p>
        </div>
      )}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">Rincian Posisi (kontrak) · rilis {fmtDate(cot.date)}</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          <Row l="Funds — Long" v={cot.funds.long.toLocaleString('id-ID')} />
          <Row l="Funds — Short" v={cot.funds.short.toLocaleString('id-ID')} />
          <Row l="Commercials — Long" v={cot.commercials.long.toLocaleString('id-ID')} />
          <Row l="Commercials — Short" v={cot.commercials.short.toLocaleString('id-ID')} />
          <Row l="Retail — Long" v={cot.retail.long.toLocaleString('id-ID')} />
          <Row l="Retail — Short" v={cot.retail.short.toLocaleString('id-ID')} />
        </div>
      </div>
    </div>
  )
}
