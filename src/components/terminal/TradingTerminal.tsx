'use client'

/*
 * TERMINAL XAUUSD — Fase 1 (UI + feed SIMULASI)
 * Semua angka di-generate lokal (random walk), BUKAN data pasar asli.
 * Fase 2: ganti `useSimFeed()` dengan stream tick asli worker OANDA (WebSocket).
 *
 * Timeframe: M5 / M15 / H1 (tanpa M1 — terlalu noise).
 * Harga tetap tick real-time; hanya pembentukan candle yang mengikuti TF.
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Activity, TrendingUp, TrendingDown, Gauge, CalendarClock, Newspaper, Layers,
  Radio, AlertTriangle, ArrowLeft, Clock, Wifi, Users, Building2, DollarSign,
  Circle, Minus, Sparkles, Target, Waves, Crosshair,
} from 'lucide-react'

// ─────────────────────────── konstanta simulasi ───────────────────────────
const BASE_PRICE = 2685.4
const TICK_MS = 800
type TF = 'M5' | 'M15' | 'H1'
const TFS: TF[] = ['M5', 'M15', 'H1']
// interval dikompres agar demo terlihat hidup (rasio 5:15:60 dipertahankan)
const TF_MS: Record<TF, number> = { M5: 4000, M15: 12000, H1: 48000 }
const TF_N: Record<TF, number> = { M5: 60, M15: 48, H1: 40 }

type Candle = { o: number; h: number; l: number; c: number; t: number; v: number }
type Bias = { label: 'LONG' | 'SHORT' | 'NETRAL'; score: number }
type TFData = { candles: Candle[]; ema9: number[]; ema21: number[]; vwapArr: number[]; rsi: number; atr: number; vwap: number; bias: Bias }
type Pivots = { P: number; R1: number; R2: number; S1: number; S2: number }
type Feed = {
  price: number; bid: number; ask: number; spread: number
  dayHigh: number; dayLow: number; changePct: number; up: boolean
  tf: Record<TF, TFData>
  dxy: number; dxyHist: number[]; dxyDown: boolean
  retailLong: number
  contrarian: { label: 'LONG' | 'SHORT' | 'NETRAL'; strength: 'lemah' | 'sedang' | 'kuat' }
  tradeable: { ok: boolean; reason: string }
  pivots: Pivots
  vol: { label: 'Rendah' | 'Normal' | 'Tinggi'; ratio: number }
  session: string; now: number
}

// ─────────────────────────── util indikator ───────────────────────────
function emaArr(vals: number[], period: number): number[] {
  const k = 2 / (period + 1); const out: number[] = []; let prev = vals[0] ?? 0
  vals.forEach((v, i) => { prev = i ? v * k + prev * (1 - k) : v; out.push(prev) })
  return out
}
function rsiLast(vals: number[], period = 14): number {
  if (vals.length < period + 1) return 50
  let gain = 0, loss = 0
  for (let i = vals.length - period; i < vals.length; i++) {
    const d = vals[i] - vals[i - 1]; if (d >= 0) gain += d; else loss -= d
  }
  const rs = loss === 0 ? 100 : gain / loss
  return 100 - 100 / (1 + rs)
}
function atrLast(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1]
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)))
  }
  const slice = trs.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / slice.length
}
function computeTF(candles: Candle[]): TFData {
  const closes = candles.map(c => c.c)
  const ema9 = emaArr(closes, 9), ema21 = emaArr(closes, 21)
  const rsi = rsiLast(closes), atr = atrLast(candles)
  const vwapArr: number[] = []; let pv = 0, vv = 0
  candles.forEach(c => { const tp = (c.h + c.l + c.c) / 3; pv += tp * c.v; vv += c.v; vwapArr.push(pv / vv) })
  const vwap = vwapArr[vwapArr.length - 1]
  const price = closes[closes.length - 1]
  let score = 0
  if (ema9[ema9.length - 1] > ema21[ema21.length - 1]) score += 1; else score -= 1
  if (price > vwap) score += 1; else score -= 1
  if (rsi > 55) score += 1; else if (rsi < 45) score -= 1
  const bias: Bias = score >= 2 ? { label: 'LONG', score } : score <= -2 ? { label: 'SHORT', score } : { label: 'NETRAL', score }
  return { candles, ema9, ema21, vwapArr, rsi, atr, vwap, bias }
}

// ─────────────────────────── engine simulasi ───────────────────────────
function useSimFeed() {
  const [feed, setFeed] = useState<Feed | null>(null)
  const st = useRef<any>(null)
  const eventAtRef = useRef<number>(Date.now() + (8 + Math.random() * 22) * 60_000)

  useEffect(() => {
    const now = Date.now()
    const seedSeries = (n: number, body: number): Candle[] => {
      const arr: Candle[] = []; let p = BASE_PRICE - n * body * 0.12
      for (let i = 0; i < n; i++) {
        const o = p, c = o + (Math.random() - 0.46) * body
        const h = Math.max(o, c) + Math.random() * body * 0.4
        const l = Math.min(o, c) - Math.random() * body * 0.4
        arr.push({ o, h, l, c, t: now, v: 120 + Math.random() * 380 }); p = c
      }
      arr[arr.length - 1].c = BASE_PRICE
      return arr
    }
    const series: Record<TF, Candle[]> = { M5: seedSeries(TF_N.M5, 3.2), M15: seedSeries(TF_N.M15, 5.5), H1: seedSeries(TF_N.H1, 9) }
    const prevH = BASE_PRICE + 12, prevL = BASE_PRICE - 15, prevC = BASE_PRICE - 3
    const P = (prevH + prevL + prevC) / 3
    const pivots: Pivots = { P, R1: 2 * P - prevL, R2: P + (prevH - prevL), S1: 2 * P - prevH, S2: P - (prevH - prevL) }

    st.current = {
      price: BASE_PRICE, series, last: { M5: now, M15: now, H1: now },
      dayHigh: BASE_PRICE + 6.2, dayLow: BASE_PRICE - 9.4, open: BASE_PRICE - 4, drift: 0.04,
      dxy: 103.8, dxyHist: Array.from({ length: 40 }, (_, i) => 103.8 + Math.sin(i / 5) * 0.3), retail: 62,
      spread: 0.18, pivots, atrBase: 2.6,
    }

    const id = setInterval(() => {
      const s = st.current, t = Date.now()
      if (Math.random() < 0.06) s.drift = (Math.random() - 0.5) * 0.16
      const delta = s.drift + (Math.random() - 0.5) * 1.4
      s.price = Math.max(1, s.price + delta)
      s.dayHigh = Math.max(s.dayHigh, s.price); s.dayLow = Math.min(s.dayLow, s.price)
      s.spread += (0.18 - s.spread) * 0.2 + (Math.random() < 0.05 ? Math.random() * 0.7 : 0)
      s.spread = Math.max(0.1, Math.min(1.4, s.spread))
      s.dxy = Math.max(90, s.dxy - delta * 0.012 + (Math.random() - 0.5) * 0.02)
      s.dxyHist = [...s.dxyHist.slice(-39), s.dxy]
      s.retail += -Math.sign(delta) * Math.random() * 0.8 + (Math.random() - 0.5) * 0.5
      s.retail = Math.max(20, Math.min(88, s.retail))

      for (const tf of TFS) {
        const series: Candle[] = s.series[tf]
        const last = series[series.length - 1]
        if (t - s.last[tf] >= TF_MS[tf]) {
          s.series[tf] = [...series.slice(-(TF_N[tf] - 1)), { o: s.price, h: s.price, l: s.price, c: s.price, t, v: 120 + Math.random() * 380 }]
          s.last[tf] = t
        } else { last.c = s.price; last.h = Math.max(last.h, s.price); last.l = Math.min(last.l, s.price); last.v += 8 }
      }

      const tf: Record<TF, TFData> = { M5: computeTF(s.series.M5), M15: computeTF(s.series.M15), H1: computeTF(s.series.H1) }

      const cLabel = s.retail > 62 ? 'SHORT' : s.retail < 38 ? 'LONG' : 'NETRAL'
      const dist = Math.abs(s.retail - 50)
      const strength = dist > 25 ? 'kuat' : dist > 13 ? 'sedang' : 'lemah'

      const msToEvent = eventAtRef.current - t
      let ok = true, reason = 'Spread & volatilitas sehat'
      if (msToEvent < 5 * 60_000 && msToEvent > -2 * 60_000) { ok = false; reason = 'News high-impact < 5 menit' }
      else if (s.spread > 0.45) { ok = false; reason = 'Spread melebar' }
      else if (tf.M5.atr < 0.6) { ok = false; reason = 'Volatilitas terlalu rendah' }

      const ratio = tf.M5.atr / s.atrBase
      const volLabel = ratio < 0.8 ? 'Rendah' : ratio > 1.4 ? 'Tinggi' : 'Normal'

      const h = new Date(t).getUTCHours()
      const session = h >= 12 && h < 16 ? 'London × New York' : h >= 7 && h < 12 ? 'London' : h >= 16 && h < 21 ? 'New York' : 'Asia'
      const changePct = ((s.price - s.open) / s.open) * 100

      setFeed({
        price: s.price, bid: s.price - s.spread / 2, ask: s.price + s.spread / 2, spread: s.spread,
        dayHigh: s.dayHigh, dayLow: s.dayLow, changePct, up: changePct >= 0, tf,
        dxy: s.dxy, dxyHist: s.dxyHist, dxyDown: s.dxyHist[s.dxyHist.length - 1] < s.dxyHist[s.dxyHist.length - 6],
        retailLong: s.retail, contrarian: { label: cLabel, strength },
        tradeable: { ok, reason }, pivots: s.pivots, vol: { label: volLabel, ratio }, session, now: t,
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  return { feed, eventAtRef }
}

// ─────────────────────────── konfluensi + insight ───────────────────────────
function confluence(feed: Feed) {
  const labels = TFS.map(tf => feed.tf[tf].bias.label)
  const longs = labels.filter(l => l === 'LONG').length
  const shorts = labels.filter(l => l === 'SHORT').length
  let label: 'LONG' | 'SHORT' | 'NETRAL' = 'NETRAL'
  let strength: 'campur' | 'sedang' | 'kuat' = 'campur'
  if (longs === 3) { label = 'LONG'; strength = 'kuat' }
  else if (shorts === 3) { label = 'SHORT'; strength = 'kuat' }
  else if (longs === 2 && shorts === 0) { label = 'LONG'; strength = 'sedang' }
  else if (shorts === 2 && longs === 0) { label = 'SHORT'; strength = 'sedang' }
  return { label, strength, longs, shorts }
}
function buildInsight(feed: Feed, tf: TF) {
  const conf = confluence(feed)
  const above = feed.price > feed.tf[tf].vwap
  const parts: string[] = []
  parts.push(`Konfluensi TF: ${conf.longs} bullish / ${conf.shorts} bearish dari 3`)
  parts.push(above ? 'harga di atas VWAP (momentum beli)' : 'harga di bawah VWAP (momentum jual)')
  if (feed.contrarian.label !== 'NETRAL') parts.push(`retail ${feed.retailLong.toFixed(0)}% ${feed.retailLong > 50 ? 'long' : 'short'} → kontrarian ${feed.contrarian.label}`)
  parts.push(feed.dxyDown ? 'DXY melemah mendukung emas' : 'DXY menguat menekan emas')
  let action: string
  if (!feed.tradeable.ok) action = `⚠ ${feed.tradeable.reason} — tahan dulu.`
  else if (conf.label === 'LONG') action = 'Bias LONG — cari pullback ke VWAP/EMA21 untuk entry.'
  else if (conf.label === 'SHORT') action = 'Bias SHORT — cari retest ke VWAP/EMA21 untuk entry.'
  else action = 'Sinyal campur antar-TF — tunggu satu arah dominan dulu.'
  return { verdict: conf.label, strength: conf.strength, text: parts.join(' · ') + '.', action }
}

// ─────────────────────────── helpers tampilan ───────────────────────────
const f2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const biasColor = (l: string) => l === 'LONG' ? 'text-emerald-400' : l === 'SHORT' ? 'text-red-400' : 'text-white/60'
const biasBg = (l: string) => l === 'LONG' ? 'bg-emerald-500/15 text-emerald-400' : l === 'SHORT' ? 'bg-red-500/15 text-red-400' : 'bg-white/10 text-white/60'

function Panel({ title, icon: Icon, right, children, className = '' }: { title: string; icon: React.ElementType; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.02] p-3 flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40"><Icon size={12} /> {title}</span>
        {right}
      </div>
      {children}
    </div>
  )
}

function Spark({ data, color = '#34d399' }: { data: number[]; color?: string }) {
  if (!data.length) return null
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / range) * 30}`).join(' ')
  return <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-8"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg>
}

function CandleChart({ d, price, up }: { d: TFData; price: number; up: boolean }) {
  const W = 900, H = 360, padR = 58, padB = 6, padT = 10
  const cs = d.candles
  const lo = Math.min(...cs.map(c => c.l), d.vwap), hi = Math.max(...cs.map(c => c.h), d.vwap)
  const pad = (hi - lo) * 0.08 || 1
  const min = lo - pad, max = hi + pad
  const plotW = W - padR
  const y = (v: number) => padT + (max - v) / (max - min) * (H - padT - padB)
  const cw = plotW / cs.length
  const x = (i: number) => i * cw + cw / 2
  const line = (arr: number[]) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const gridVals = Array.from({ length: 5 }, (_, i) => min + (max - min) * (i / 4))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      {gridVals.map((g, i) => (
        <g key={i}>
          <line x1="0" x2={plotW} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.05)" />
          <text x={W - padR + 5} y={y(g) + 3} fill="rgba(255,255,255,0.35)" fontSize="10">{f2(g)}</text>
        </g>
      ))}
      {cs.map((c, i) => {
        const cup = c.c >= c.o, col = cup ? '#34d399' : '#f87171'
        const top = y(Math.max(c.o, c.c)), bot = y(Math.min(c.o, c.c))
        return (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth="1" />
            <rect x={x(i) - cw * 0.3} width={cw * 0.6} y={top} height={Math.max(1, bot - top)} fill={col} />
          </g>
        )
      })}
      <polyline points={line(d.vwapArr)} fill="none" stroke="#fbbf24" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.85" />
      <polyline points={line(d.ema9)} fill="none" stroke="#60a5fa" strokeWidth="1.4" />
      <polyline points={line(d.ema21)} fill="none" stroke="#c084fc" strokeWidth="1.4" />
      <line x1="0" x2={plotW} y1={y(price)} y2={y(price)} stroke={up ? '#34d399' : '#f87171'} strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
      <rect x={W - padR} y={y(price) - 8} width={padR} height="16" fill={up ? '#065f46' : '#7f1d1d'} />
      <text x={W - padR + 5} y={y(price) + 3} fill="#fff" fontSize="10" fontWeight="700">{f2(price)}</text>
    </svg>
  )
}

function useCountdown(target: number, now: number) {
  const ms = target - now, past = ms < 0, abs = Math.abs(ms)
  const m = Math.floor(abs / 60000), s = Math.floor((abs % 60000) / 1000)
  return { text: `${past ? '-' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, ms }
}

const NEWS = [
  { time: '2m', tag: 'Fed', text: 'Pejabat Fed isyaratkan suku bunga tetap ditahan hingga kuartal depan' },
  { time: '11m', tag: 'Gold', text: 'Emas bertahan di dekat level tertinggi mingguan jelang rilis data inflasi AS' },
  { time: '24m', tag: 'USD', text: 'Dolar melemah tipis, indeks DXY tertekan yield Treasury yang turun' },
  { time: '38m', tag: 'Macro', text: 'Permintaan safe-haven meningkat di tengah ketidakpastian geopolitik' },
]

// ─────────────────────────── PAGE ───────────────────────────
export function TradingTerminal() {
  const { feed, eventAtRef } = useSimFeed()
  const [tf, setTf] = useState<TF>('M5')
  const cd = useCountdown(eventAtRef.current, feed?.now ?? Date.now())
  const clock = useMemo(() => feed ? new Date(feed.now).toLocaleTimeString('id-ID') : '', [feed])

  if (!feed) {
    return <div className="min-h-screen flex items-center justify-center bg-[#060a09] text-white/50"><Radio className="animate-pulse mr-2" /> Menghubungkan feed…</div>
  }

  const d = feed.tf[tf]
  const insight = buildInsight(feed, tf)
  const conf = confluence(feed)

  // Saran SL/TP dari ATR TF terpilih, arah = konfluensi (fallback bias TF)
  const dir = conf.label !== 'NETRAL' ? conf.label : d.bias.label
  const atr = d.atr
  const sltp = dir === 'LONG'
    ? { sl: feed.price - 1.5 * atr, tp1: feed.price + 1.5 * atr, tp2: feed.price + 3 * atr }
    : dir === 'SHORT'
      ? { sl: feed.price + 1.5 * atr, tp1: feed.price - 1.5 * atr, tp2: feed.price - 3 * atr }
      : null

  const levels = [
    { label: 'R2', v: feed.pivots.R2, k: 'res' }, { label: 'R1', v: feed.pivots.R1, k: 'res' },
    { label: 'Pivot', v: feed.pivots.P, k: 'piv' }, { label: 'VWAP', v: d.vwap, k: 'vwap' },
    { label: 'S1', v: feed.pivots.S1, k: 'sup' }, { label: 'S2', v: feed.pivots.S2, k: 'sup' },
  ].map(l => ({ ...l, dist: feed.price - l.v })).sort((a, b) => b.v - a.v)

  return (
    <div className="min-h-screen bg-[#060a09] text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-[#060a09]/95 backdrop-blur border-b border-white/8">
        <div className="px-4 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-white/50 hover:text-white shrink-0"><ArrowLeft size={18} /></Link>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-black tracking-tight">XAU/USD</span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 rounded px-1.5 py-0.5">Simulasi · Fase 1</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black tabular-nums ${feed.up ? 'text-emerald-400' : 'text-red-400'}`}>{f2(feed.price)}</span>
            <span className={`text-xs font-bold tabular-nums ${feed.up ? 'text-emerald-400' : 'text-red-400'}`}>{feed.up ? '+' : ''}{feed.changePct.toFixed(2)}%</span>
          </div>
          <div className="hidden md:flex items-center gap-4 text-[11px] text-white/50 tabular-nums">
            <span>Bid <b className="text-white/80">{f2(feed.bid)}</b></span>
            <span>Ask <b className="text-white/80">{f2(feed.ask)}</b></span>
            <span>Spread <b className={feed.spread > 0.45 ? 'text-amber-400' : 'text-white/80'}>${feed.spread.toFixed(2)}</b></span>
            <span>H <b className="text-emerald-400/80">{f2(feed.dayHigh)}</b></span>
            <span>L <b className="text-red-400/80">{f2(feed.dayLow)}</b></span>
          </div>
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <span className="hidden lg:flex items-center gap-1.5 text-[11px] text-white/50"><Circle size={7} className="fill-primary text-primary" /> {feed.session}</span>
            <span className={`flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 ${feed.tradeable.ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              <Circle size={8} className={`${feed.tradeable.ok ? 'fill-emerald-400 text-emerald-400' : 'fill-red-400 text-red-400'} animate-pulse`} />
              {feed.tradeable.ok ? 'TRADEABLE' : 'HATI-HATI'}
            </span>
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-white/40"><Clock size={11} /> {clock}</span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400"><Wifi size={12} /> live</span>
          </div>
        </div>
        {!feed.tradeable.ok && (
          <div className="px-4 py-1.5 bg-red-500/10 border-t border-red-500/20 flex items-center gap-2 text-[11px] text-red-300">
            <AlertTriangle size={12} /> {feed.tradeable.reason} — pertimbangkan menunggu.
          </div>
        )}
      </header>

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 p-2.5">
        {/* Chart + TF selector */}
        <Panel title={`XAU/USD · ${tf}`} icon={Activity} className="lg:col-span-8 h-[400px]"
          right={<div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-white/5 p-0.5">
              {TFS.map(x => (
                <button key={x} onClick={() => setTf(x)} className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${tf === x ? 'bg-primary text-primary-foreground' : 'text-white/45 hover:text-white'}`}>{x}</button>
              ))}
            </div>
            <div className="hidden xl:flex items-center gap-2.5 text-[10px]">
              <span className="flex items-center gap-1 text-[#60a5fa]"><Minus size={12} /> EMA9</span>
              <span className="flex items-center gap-1 text-[#c084fc]"><Minus size={12} /> EMA21</span>
              <span className="flex items-center gap-1 text-[#fbbf24]"><Minus size={12} /> VWAP</span>
            </div>
          </div>}>
          <div className="flex-1 min-h-0"><CandleChart d={d} price={feed.price} up={feed.up} /></div>
        </Panel>

        {/* Right rail: Auto-Insight + MTF Confluence */}
        <div className="lg:col-span-4 grid grid-rows-2 gap-2.5">
          <Panel title="Auto-Insight" icon={Sparkles}
            right={<span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${biasBg(insight.verdict)}`}>{insight.verdict} · {insight.strength}</span>}>
            <p className="text-[11px] text-white/60 leading-relaxed">{insight.text}</p>
            <div className="mt-2 pt-2 border-t border-white/5 flex items-start gap-1.5">
              <Target size={13} className="text-primary mt-0.5 shrink-0" />
              <p className="text-[11px] text-white/85 font-medium leading-snug">{insight.action}</p>
            </div>
          </Panel>

          <Panel title="Konfluensi Multi-Timeframe" icon={Crosshair}
            right={<span className={`text-[10px] font-bold ${biasColor(conf.label)}`}>{conf.label === 'NETRAL' ? 'CAMPUR' : conf.label} · {conf.strength}</span>}>
            <div className="space-y-1.5">
              {TFS.map(x => {
                const b = feed.tf[x].bias
                return (
                  <div key={x} className="flex items-center gap-2">
                    <span className="text-[11px] font-bold w-8 text-white/60">{x}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full ${b.label === 'LONG' ? 'bg-emerald-400' : b.label === 'SHORT' ? 'bg-red-400' : 'bg-white/25'}`} style={{ width: `${33 + Math.abs(b.score) * 22}%` }} />
                    </div>
                    <span className={`text-[10px] font-bold w-14 text-right ${biasColor(b.label)}`}>{b.label}</span>
                  </div>
                )
              })}
            </div>
            <p className="text-[9px] text-white/30 mt-2 pt-2 border-t border-white/5">Entry paling aman searah TF besar (H1).</p>
          </Panel>
        </div>

        {/* Momentum + SL/TP */}
        <Panel title={`Momentum & Saran · ${tf}`} icon={Gauge} className="lg:col-span-3">
          <div className="flex items-center justify-between mb-2.5">
            <p className={`text-xl font-black ${biasColor(d.bias.label)}`}>{d.bias.label}</p>
            <span className={biasColor(d.bias.label)}>{d.bias.label === 'LONG' ? <TrendingUp size={22} /> : d.bias.label === 'SHORT' ? <TrendingDown size={22} /> : <Minus size={22} />}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center mb-2.5">
            {[['RSI', d.rsi.toFixed(0), d.rsi > 70 ? 'text-red-400' : d.rsi < 30 ? 'text-emerald-400' : 'text-white/80'],
              ['ATR', '$' + d.atr.toFixed(2), 'text-white/80'],
              ['VWAP', (feed.price > d.vwap ? '+' : '') + (feed.price - d.vwap).toFixed(1), feed.price > d.vwap ? 'text-emerald-400' : 'text-red-400']].map(([k, v, cls]) => (
              <div key={k} className="rounded-lg bg-white/[0.03] py-1.5"><p className="text-[9px] uppercase tracking-wider text-white/35">{k}</p><p className={`text-xs font-bold tabular-nums ${cls}`}>{v}</p></div>
            ))}
          </div>
          {sltp ? (
            <div className="space-y-1 text-[11px] pt-2 border-t border-white/5">
              <p className="text-[9px] uppercase tracking-wider text-white/35 mb-1">Saran {dir} (ATR × 1.5/3)</p>
              <div className="flex justify-between"><span className="text-red-400/80">Stop Loss</span><span className="tabular-nums">{f2(sltp.sl)}</span></div>
              <div className="flex justify-between"><span className="text-emerald-400/80">Take Profit 1</span><span className="tabular-nums">{f2(sltp.tp1)}</span></div>
              <div className="flex justify-between"><span className="text-emerald-400/80">Take Profit 2</span><span className="tabular-nums">{f2(sltp.tp2)}</span></div>
            </div>
          ) : <p className="text-[10px] text-white/35 pt-2 border-t border-white/5">Bias netral — tidak ada saran arah.</p>}
        </Panel>

        {/* Contrarian */}
        <Panel title="Retail vs Smart Money" icon={Users} className="lg:col-span-3" right={<span className="text-[9px] text-white/30">fade retail</span>}>
          <div className="flex justify-between text-[10px] mb-1"><span className="text-red-400 font-bold">{feed.retailLong.toFixed(0)}% Long</span><span className="text-emerald-400 font-bold">{(100 - feed.retailLong).toFixed(0)}% Short</span></div>
          <div className="h-2.5 rounded-full overflow-hidden bg-emerald-500/25 flex"><div className="bg-red-500/70 h-full" style={{ width: `${feed.retailLong}%` }} /></div>
          <div className="flex items-center justify-between mt-2.5">
            <p className="text-[10px] text-white/45 max-w-[55%] leading-snug">Retail ramai {feed.retailLong > 50 ? 'LONG' : 'SHORT'} → sinyal berlawanan</p>
            <div className="text-center"><p className="text-[9px] uppercase tracking-wider text-white/35">Kontrarian</p><p className={`text-base font-black leading-tight ${biasColor(feed.contrarian.label)}`}>{feed.contrarian.label}</p><p className="text-[9px] text-white/40">{feed.contrarian.strength}</p></div>
          </div>
        </Panel>

        {/* DXY */}
        <Panel title="Korelasi Dolar (DXY)" icon={DollarSign} className="lg:col-span-3"
          right={<span className={`text-[10px] font-bold ${feed.dxyDown ? 'text-emerald-400' : 'text-red-400'}`}>{feed.dxyDown ? '↓ bullish gold' : '↑ bearish gold'}</span>}>
          <p className="text-xl font-black tabular-nums">{feed.dxy.toFixed(3)}</p>
          <Spark data={feed.dxyHist} color={feed.dxyDown ? '#34d399' : '#f87171'} />
          <p className="text-[10px] text-white/45">{feed.dxyDown ? 'Dolar melemah → momentum emas cenderung menguat.' : 'Dolar menguat → tekanan untuk emas.'}</p>
        </Panel>

        {/* Volatility + Session */}
        <Panel title="Volatilitas & Sesi" icon={Waves} className="lg:col-span-3">
          <div className="flex items-center justify-between mb-2">
            <div><p className="text-[10px] text-white/40">Kondisi (ATR M5)</p><p className={`text-lg font-black ${feed.vol.label === 'Tinggi' ? 'text-amber-400' : feed.vol.label === 'Rendah' ? 'text-white/50' : 'text-emerald-400'}`}>{feed.vol.label}</p></div>
            <span className="text-xs tabular-nums text-white/50">{(feed.vol.ratio * 100).toFixed(0)}%</span>
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between"><span className="text-white/50">Sesi aktif</span><span className="text-white/80 font-semibold">{feed.session}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Range harian</span><span className="tabular-nums text-white/80">${(feed.dayHigh - feed.dayLow).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Kualitas spread</span><span className={feed.spread > 0.45 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>{feed.spread > 0.45 ? 'Lebar' : 'Sehat'}</span></div>
          </div>
        </Panel>

        {/* Pivot & Levels */}
        <Panel title="Pivot & Level Kunci" icon={Layers} className="lg:col-span-4">
          <div className="space-y-1">
            {levels.map(l => (
              <div key={l.label} className="flex items-center justify-between text-[11px]">
                <span className={`font-semibold w-12 ${l.k === 'res' ? 'text-red-400/80' : l.k === 'sup' ? 'text-emerald-400/80' : l.k === 'vwap' ? 'text-amber-400/80' : 'text-white/70'}`}>{l.label}</span>
                <span className="tabular-nums text-white/80 flex-1 text-center">{f2(l.v)}</span>
                <span className={`tabular-nums text-[10px] w-16 text-right ${Math.abs(l.dist) < 1.5 ? 'text-amber-400 font-bold' : 'text-white/35'}`}>{l.dist >= 0 ? '+' : ''}{l.dist.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-white/30 mt-2 pt-2 border-t border-white/5">Pivot harian (H/L/C kemarin). Angka kanan = jarak harga ke level.</p>
        </Panel>

        {/* Calendar */}
        <Panel title="Kalender Ekonomi" icon={CalendarClock} className="lg:col-span-4">
          <div className={`rounded-lg p-2.5 ${cd.ms < 5 * 60000 && cd.ms > -2 * 60000 ? 'bg-red-500/15' : 'bg-white/[0.03]'}`}>
            <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-white/80">US CPI (YoY)</span><span className="text-[9px] font-bold uppercase bg-red-500/20 text-red-400 rounded px-1.5 py-0.5">High</span></div>
            <div className="flex items-center justify-between mt-1.5"><span className="text-[10px] text-white/45">dalam</span><span className={`text-lg font-black tabular-nums ${cd.ms < 5 * 60000 ? 'text-red-400' : 'text-white'}`}>{cd.text}</span></div>
            <div className="flex justify-between text-[9px] text-white/40 mt-1"><span>Forecast 3.1%</span><span>Prev 3.3%</span></div>
          </div>
          {cd.ms < 5 * 60000 && cd.ms > -2 * 60000 && <p className="text-[10px] text-red-300 mt-2 flex items-center gap-1"><AlertTriangle size={11} /> Hindari entry saat rilis.</p>}
        </Panel>

        {/* COT */}
        <Panel title="COT Institusi" icon={Building2} className="lg:col-span-4" right={<span className="text-[9px] text-white/30">mingguan · konteks</span>}>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between"><span className="text-white/50">Managed Money</span><span className="text-emerald-400 font-bold">Net Long</span></div>
            <div className="flex justify-between"><span className="text-white/50">Δ minggu ini</span><span className="text-red-400 font-bold tabular-nums">-4.2k</span></div>
            <div className="flex justify-between"><span className="text-white/50">Commercials</span><span className="text-red-400 font-bold">Net Short</span></div>
          </div>
          <p className="text-[9px] text-amber-400/70 mt-2 pt-2 border-t border-white/5">Bias mingguan — bukan sinyal entry untuk scalping.</p>
        </Panel>

        {/* News */}
        <Panel title="Berita Emas & Dolar" icon={Newspaper} className="lg:col-span-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {NEWS.map((n, i) => (
              <div key={i} className="rounded-lg bg-white/[0.03] p-2.5">
                <div className="flex items-center gap-1.5 mb-1"><span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 rounded px-1.5 py-0.5">{n.tag}</span><span className="text-[9px] text-white/30">{n.time} lalu</span></div>
                <p className="text-[11px] text-white/70 leading-snug">{n.text}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <p className="text-center text-[10px] text-white/25 pb-6">Terminal XAUUSD · Fase 1 — angka masih SIMULASI. Fase 2 disambung ke stream tick asli OANDA.</p>
    </div>
  )
}
