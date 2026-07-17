'use client'

// Komponen "Makro Mendalam" yang dirender DI DALAM terminal (tab Makro & sub-tab
// Lintas Aset / Inflasi / Institusi). Chart komparasi ternormalisasi (fokus XAU)
// + kartu indikator + section COT. Data dari endpoint yang sudah ada.
import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { DetailLineChart, DetailMultiLineChart, DetailBarChart, CompareBars, LongShortSplit, Stat, fmtDate, fmtDateShort, type ChartPoint } from './DetailChart'
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

      {/* Pergerakan hari ini (bar chart — konteks perubahan diskret, bukan tren) */}
      {cross && (
        <InsightCard title="Pergerakan Hari Ini (% perubahan)">
          <DetailBarChart height={170} fmt={v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
            data={[
              { label: 'S&P 500', value: cross.spy?.changePct ?? 0 },
              { label: 'Nasdaq', value: cross.qqq?.changePct ?? 0 },
              { label: 'Bitcoin', value: cross.btc?.changePct ?? 0 },
              { label: 'VIX', value: cross.vixy?.changePct ?? 0 },
              { label: 'Silver', value: cross.xag?.changePct ?? 0 },
              { label: 'Dolar', value: cross.uup?.changePct ?? 0 },
            ]} />
          <p className="text-[11px] text-white/45 leading-relaxed mt-2">Hijau = naik hari ini, merah = turun. Saham & Bitcoin hijau serentak = selera risiko tinggi (kurang bersahabat buat emas); VIX & dolar hijau = mode defensif.</p>
        </InsightCard>
      )}

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

// ── Kartu featured generik (chart bebas: line/bar/dll) ──
function FeatureCard({ label, sub, current, chg, reading, body, href, chart, color = '#60a5fa' }: {
  label: string; sub: string; current: string; chg?: string; reading: Reading; body: string; href: string; chart: React.ReactNode; color?: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0b100e] overflow-hidden grid md:grid-cols-2">
      <div className="p-5 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-1"><p className="text-[13px] font-black">{label}</p><ReadingBadge r={reading} /></div>
        <p className="text-[10px] text-white/40 mb-3">{sub}</p>
        <div className="flex items-baseline gap-2 mb-3"><span className="text-2xl font-black tabular-nums">{current}</span>{chg && <span className="text-xs font-bold tabular-nums text-white/50">{chg}</span>}</div>
        <p className="text-[12px] text-white/60 leading-relaxed flex-1">{body}</p>
        <p className="text-[11px] font-semibold mt-3" style={{ color: reading.tone === 'bull' ? '#34d399' : reading.tone === 'bear' ? '#f87171' : 'rgba(255,255,255,0.6)' }}>→ {reading.note}</p>
        <Link href={href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline mt-3">Detail & tren panjang <ArrowRight size={12} /></Link>
      </div>
      <div className="relative p-3 border-t md:border-t-0 md:border-l border-white/[0.06] flex items-center" style={{ background: `linear-gradient(180deg, ${color}0a, transparent)` }}>{chart}</div>
    </div>
  )
}
function InsightCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] p-5"><p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">{title}</p>{children}</div>
}
const lineNode = (s: Series | undefined, h = 190) => s && s.length ? <div className="w-full"><DetailLineChart data={s.map(p => ({ label: fmtDateShort(p.date), value: p.value }))} height={h} /></div> : <div className="w-full flex items-center justify-center text-[11px] text-white/25" style={{ height: h }}>Memuat chart…</div>

// ── Section: Inflasi & Kebijakan Fed (artikel + chart beragam) ──
export function InflasiSection({ macro }: { macro: MacroMap }) {
  const [h, setH] = useState<Record<string, Series> | null>(null)
  useEffect(() => {
    let stop = false
    fetchMany([
      { key: 'xau', type: 'mkt', id: 'XAU/USD' }, { key: 'cpi', type: 'fred', id: 'cpi' }, { key: 'corecpi', type: 'fred', id: 'corecpi' },
      { key: 'corepce', type: 'fred', id: 'corepce' }, { key: 'breakeven', type: 'fred', id: 'breakeven' }, { key: 'fedfunds', type: 'fred', id: 'fedfunds' },
      { key: 'unrate', type: 'fred', id: 'unrate' }, { key: 'nfp', type: 'fred', id: 'nfp' }, { key: 'wage', type: 'fred', id: 'wagegrowth' }, { key: 'us10y', type: 'fred', id: 'us10y' },
    ], 3).then(r => { if (!stop) setH(r) })
    return () => { stop = true }
  }, [])
  const fdir = (k: string) => { const p = macro?.[k]; return p ? p.value - p.prior : 0 }
  const rCpi: Reading = { tone: fdir('cpi') <= 0 ? 'bull' : 'bear', label: fdir('cpi') <= 0 ? 'Dukung emas' : 'Tekan emas', note: fdir('cpi') <= 0 ? 'Inflasi mereda → peluang Fed pangkas bunga → bullish emas.' : 'Inflasi masih panas → Fed tahan bunga tinggi → tekan emas.' }
  const rNfp: Reading = { tone: macro?.nfp ? (macro.nfp.value < macro.nfp.prior ? 'bull' : 'bear') : 'neutral', label: macro?.nfp && macro.nfp.value < macro.nfp.prior ? 'Melambat (dovish)' : 'Kuat (hawkish)', note: 'Lapangan kerja melemah = sinyal dovish = bullish emas; kuat = hawkish = tekan emas.' }
  const rFed: Reading = { tone: fdir('fedfunds') < 0 ? 'bull' : fdir('fedfunds') > 0 ? 'bear' : 'neutral', label: fdir('fedfunds') < 0 ? 'Memangkas (bullish)' : fdir('fedfunds') > 0 ? 'Menaikkan' : 'Ditahan', note: 'Ekspektasi pemangkasan bunga = bullish emas; higher-for-longer = bearish.' }
  const gaugeItems = macro ? [
    macro.cpi && { label: 'CPI (Headline)', value: macro.cpi.value, color: '#f87171' },
    macro.corecpi && { label: 'Core CPI', value: macro.corecpi.value, color: '#fb7185' },
    macro.corepce && { label: 'Core PCE (favorit Fed)', value: macro.corepce.value, color: '#fb923c' },
    macro.breakeven && { label: 'Ekspektasi Inflasi 10Y', value: macro.breakeven.value, color: '#fbbf24' },
  ].filter(Boolean) as { label: string; value: number; color: string }[] : []

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5">Inflasi & Kebijakan Fed · Laporan</p>
        <h2 className="text-xl font-black tracking-tight">Kompas Suku Bunga Emas</h2>
        <p className="text-[13px] text-white/60 leading-relaxed mt-2 max-w-3xl">Emas paling terpengaruh oleh satu hal jangka menengah: <b className="text-white/85">ke mana arah suku bunga The Fed</b>. Dan itu ditentukan oleh dua data — <b>inflasi</b> (apakah cukup rendah untuk memangkas bunga?) dan <b>ketenagakerjaan</b> (apakah ekonomi cukup lemah?). Inflasi mereda + pasar kerja melemah = ruang pemangkasan bunga = <span className="text-emerald-400 font-semibold">bullish emas</span>.</p>
      </div>

      {h ? (
        <MacroComparisonChart title="Inflasi, Suku Bunga & Emas" note="XAU/USD (garis utama) vs CPI, Core PCE, Fed Funds & Yield — disamakan ke % perubahan."
          defs={[
            { name: 'XAU/USD', color: '#fbbf24', main: true, raw: h.xau ?? [] },
            { name: 'CPI', color: '#f87171', default: true, raw: h.cpi ?? [] },
            { name: 'Core PCE', color: '#fb923c', raw: h.corepce ?? [] },
            { name: 'Fed Funds', color: '#60a5fa', default: true, raw: h.fedfunds ?? [] },
            { name: 'Yield 10Y', color: '#f472b6', raw: h.us10y ?? [] },
          ]} />
      ) : <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] h-[360px] flex items-center justify-center"><Loader2 size={22} className="animate-spin text-white/30" /></div>}

      {/* Grup 1: Inflasi */}
      <GroupHead emoji="🔥" title="Seberapa Panas Inflasi?" intro="Target The Fed adalah 2% (Core PCE). Selama inflasi di atas itu, Fed enggan memangkas bunga — kurang bersahabat buat emas. Makin mendekati/di bawah 2%, makin terbuka jalan pemangkasan." />
      <FeatureCard label="CPI — Inflasi Headline (YoY)" sub="Consumer Price Index · FRED" current={macro?.cpi ? `${macro.cpi.value}%` : '—'} chg={macro?.cpi ? `dari ${macro.cpi.prior}%` : ''} color="#f87171" href="/terminal/data/macro/cpi" reading={rCpi} chart={lineNode(h?.cpi)}
        body="CPI adalah ukuran inflasi paling banyak diliput. Angkanya sering menggerakkan pasar saat rilis, meski The Fed sebenarnya lebih memantau Core PCE. Tren yang menurun konsisten adalah kabar baik buat emas karena membuka ruang pemangkasan bunga." />
      {gaugeItems.length > 0 && (
        <InsightCard title="Bandingkan Ukuran Inflasi vs Target Fed 2%">
          <CompareBars items={gaugeItems} refValue={2} refLabel="Target The Fed" suffix="%" />
          <p className="text-[11px] text-white/45 leading-relaxed mt-3">Core PCE (garis oranye) adalah acuan RESMI Fed — bukan CPI. Selama masih jauh di atas 2%, sikap Fed cenderung hawkish (menekan emas).</p>
        </InsightCard>
      )}

      {/* Grup 2: Ketenagakerjaan */}
      <GroupHead emoji="👷" title="Pasar Tenaga Kerja" intro="Mandat ganda Fed: stabilitas harga + lapangan kerja. Pasar kerja yang melemah memberi Fed alasan untuk melonggarkan kebijakan (dovish) — bullish buat emas." />
      <FeatureCard label="NFP — Perubahan Lapangan Kerja Bulanan" sub="Nonfarm Payrolls · ribu pekerja/bulan" current={macro?.nfp ? `${macro.nfp.value >= 0 ? '+' : ''}${macro.nfp.value}K` : '—'} color="#34d399" href="/terminal/data/macro/nfp" reading={rNfp}
        chart={h?.nfp?.length ? <div className="w-full"><DetailBarChart data={h.nfp.map(p => ({ label: fmtDateShort(p.date), value: p.value }))} height={190} fmt={v => `${v >= 0 ? '+' : ''}${Math.round(v)}K`} /></div> : <div className="w-full h-[190px] flex items-center justify-center text-[11px] text-white/25">Memuat chart…</div>}
        body="Perubahan jumlah pekerjaan tiap bulan — salah satu rilis paling menggerakkan pasar. Batang di atas nol = ekonomi menambah pekerjaan (kuat/hawkish), makin tinggi makin menekan emas. Batang mengecil/negatif = melambat (dovish) = mendukung emas." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MiniAsset label="Tingkat Pengangguran" current={macro?.unrate ? `${macro.unrate.value}%` : '—'} data={h?.unrate} href="/terminal/data/macro/unrate" reading={{ tone: fdir('unrate') > 0 ? 'bull' : 'bear', label: fdir('unrate') > 0 ? 'Dovish' : 'Hawkish', note: 'Pengangguran naik = ekonomi melambat = ruang pangkas bunga = bullish emas.' }} />
        <MiniAsset label="Pertumbuhan Upah (YoY)" current={macro?.wagegrowth ? `${macro.wagegrowth.value}%` : '—'} data={h?.wage} href="/terminal/data/macro/wagegrowth" reading={{ tone: fdir('wagegrowth') <= 0 ? 'bull' : 'bear', label: fdir('wagegrowth') <= 0 ? 'Mereda' : 'Tekanan inflasi', note: 'Upah naik cepat = tekanan inflasi bertahan lama = hawkish = tekan emas.' }} />
      </div>

      {/* Grup 3: Kebijakan Fed */}
      <GroupHead emoji="🏛️" title="Arah Kebijakan Fed" intro="Muara dari semua data di atas: suku bunga acuan. Ekspektasi pemangkasan adalah pendorong bullish emas paling kuat." />
      <FeatureCard label="Fed Funds Rate" sub="Suku bunga acuan · Federal Reserve" current={macro?.fedfunds ? `${macro.fedfunds.value}%` : '—'} chg={macro?.fedfunds ? `dari ${macro.fedfunds.prior}%` : ''} color="#60a5fa" href="/terminal/data/macro/fedfunds" reading={rFed} chart={lineNode(h?.fedfunds)}
        body="Suku bunga acuan yang menjadi dasar hampir semua biaya pinjaman di ekonomi AS. Emas tidak memberi bunga, jadi saat suku bunga tinggi, memegang emas 'mahal' secara biaya peluang. Ekspektasi pasar terhadap ARAH bunga ke depan lebih penting dari angka saat ini." />

      <p className="text-[11px] text-white/30 leading-relaxed pt-2 border-t border-white/[0.06]">Bacaan dihitung otomatis dari arah rilis terbaru & kaidah umum — konteks, bukan sinyal entry. Data: Federal Reserve (FRED).</p>
    </div>
  )
}

// ── Section: Institusi vs Retail (COT) — artikel + chart beragam ──
export function CotSection({ cot }: { cot: CotData }) {
  if (!cot) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-white/30" /></div>
  const conflict = cot.funds.net * cot.retail.net < 0
  return (
    <div className="space-y-6">
      {/* Intro artikel */}
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5">Commitment of Traders · Laporan Posisi</p>
        <h2 className="text-xl font-black tracking-tight">Di Mana Uang Besar Bertaruh?</h2>
        <p className="text-[13px] text-white/60 leading-relaxed mt-2 max-w-3xl">Tiap Jumat, CFTC merilis posisi semua trader di futures emas COMEX. Ini "kartu terbuka" pasar: <b className="text-emerald-400">Funds</b> (hedge fund/spekulan besar, smart money), <b className="text-sky-400">Commercials</b> (produsen & bank), dan <b className="text-violet-400">Retail</b> (trader kecil, sering kontrarian di titik ekstrem). Membandingkan posisi mereka membantu menilai apakah tren didukung uang besar — atau justru rentan berbalik.</p>
      </div>

      {/* Komparasi harga vs posisi (line) */}
      <MacroComparisonChart title="Harga Emas vs Posisi COT" note="XAU/USD (garis utama) vs posisi net Funds/Retail — apakah institusi memimpin atau mengikuti harga?"
        defs={[
          { name: 'XAU/USD', color: '#fbbf24', main: true, type: 'mkt', id: 'XAU/USD' },
          { name: 'Funds (Institusi)', color: '#34d399', default: true, raw: cot.fundsHistoryFull },
          { name: 'Retail', color: '#a78bfa', default: true, raw: cot.retailHistoryFull },
        ]} />

      {/* Long vs Short (split bar) — konteks bar, bukan line */}
      <GroupHead emoji="⚖️" title="Long vs Short — Siapa Bertaruh ke Mana" intro="Tiap kelompok punya posisi beli (long) & jual (short). Selisihnya = posisi net. Funds yang sangat net-long menandakan smart money bullish; Retail yang ekstrem sering jadi sinyal kontrarian." />
      <InsightCard title={`Komposisi Posisi · rilis ${fmtDate(cot.date)}`}>
        <LongShortSplit fmt={kfmt} rows={[
          { label: 'Funds (Institusi)', long: cot.funds.long, short: cot.funds.short },
          { label: 'Commercials (Hedger)', long: cot.commercials.long, short: cot.commercials.short },
          { label: 'Retail', long: cot.retail.long, short: cot.retail.short },
        ]} />
      </InsightCard>
      {conflict && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 p-4">
          <span className="text-amber-400 text-sm mt-0.5">⚠</span>
          <p className="text-[12px] text-amber-200/90 leading-relaxed">Institusi & Retail sedang <b>berlawanan arah</b> — institusi {cot.funds.net >= 0 ? 'net long' : 'net short'}, retail {cot.retail.net >= 0 ? 'net long' : 'net short'}. Historisnya condong mengikuti arah institusi (smart money).</p>
        </div>
      )}

      {/* Tren posisi net 1 tahun (multi-line) */}
      <GroupHead emoji="📈" title="Tren Posisi Net — 1 Tahun" intro="Bukan cuma posisi saat ini, tapi ARAH-nya. Funds yang terus menambah long = keyakinan bullish menguat. Perhatikan juga saat Funds & Commercials bergerak berlawanan — titik ekstrem sering jadi sinyal balik arah." />
      <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-wrap gap-2">
          <p className="text-sm font-bold flex items-center gap-2">Posisi Net (kontrak) <span className="text-[9px] font-semibold text-white/30 normal-case">CFTC · mingguan · 1 tahun</span></p>
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

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-[12px] font-black mb-2">📌 Cara Membacanya</p>
        <ul className="text-[12px] text-white/60 leading-relaxed space-y-1.5 list-disc list-inside">
          <li><b className="text-emerald-400">Funds</b> = trend-follower profesional. Net-long meningkat = keyakinan bullish; ekstrem tinggi bisa berarti "sudah terlalu ramai".</li>
          <li><b className="text-sky-400">Commercials</b> = hedger, sering di sisi berlawanan Funds. Ekstrem posisi mereka kadang jadi sinyal kontrarian kuat.</li>
          <li><b className="text-violet-400">Retail</b> = sering salah di titik ekstrem. Berlawanan dengan Funds → condong ikuti Funds.</li>
          <li>Data mingguan (rilis Jumat, lagging) — konteks strategis, <b>bukan sinyal entry harian</b>.</li>
        </ul>
      </div>
    </div>
  )
}
