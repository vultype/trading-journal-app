'use client'

/*
 * TERMINAL XAUUSD — Fase 1 (UI + feed SIMULASI)
 * Semua angka di sini di-generate secara lokal (random walk), BUKAN data pasar asli.
 * Fase 2: ganti `useSimFeed()` dengan stream tick asli dari worker OANDA (WebSocket).
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Activity, TrendingUp, TrendingDown, Gauge, CalendarClock, Newspaper, Layers,
  Radio, AlertTriangle, ArrowLeft, Clock, Wifi, Users, Building2, DollarSign,
  Circle, Minus,
} from 'lucide-react'

// ─────────────────────────── konstanta simulasi ───────────────────────────
const BASE_PRICE = 2685.4
const TICK_MS = 800
const CANDLE_MS = 5000
const MAX_CANDLES = 56

type Candle = { o: number; h: number; l: number; c: number; t: number; v: number }
type Feed = {
  price: number; bid: number; ask: number; spread: number
  dayHigh: number; dayLow: number; changePct: number; up: boolean
  candles: Candle[]; ema9: number[]; ema21: number[]; vwapArr: number[]
  rsi: number; atr: number; vwap: number
  bias: { label: 'LONG' | 'SHORT' | 'NETRAL'; score: number }
  dxy: number; dxyHist: number[]; dxyDown: boolean
  retailLong: number
  contrarian: { label: 'LONG' | 'SHORT' | 'NETRAL'; strength: 'lemah' | 'sedang' | 'kuat' }
  tradeable: { ok: boolean; reason: string }
  session: string
  now: number
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
    const d = vals[i] - vals[i - 1]
    if (d >= 0) gain += d; else loss -= d
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

// ─────────────────────────── engine simulasi ───────────────────────────
function useSimFeed(): { feed: Feed | null; eventAtRef: React.MutableRefObject<number> } {
  const [feed, setFeed] = useState<Feed | null>(null)
  const st = useRef<{ price: number; candles: Candle[]; dayHigh: number; dayLow: number; open: number; drift: number; dxy: number; dxyHist: number[]; retail: number; spread: number; lastCandle: number } | null>(null)
  const eventAtRef = useRef<number>(Date.now() + (8 + Math.random() * 22) * 60_000)

  useEffect(() => {
    // seed histori
    const now = Date.now()
    const candles: Candle[] = []
    let p = BASE_PRICE - MAX_CANDLES * 0.15
    for (let i = 0; i < MAX_CANDLES; i++) {
      const o = p
      const c = o + (Math.random() - 0.46) * 3.2
      const h = Math.max(o, c) + Math.random() * 1.6
      const l = Math.min(o, c) - Math.random() * 1.6
      candles.push({ o, h, l, c, t: now - (MAX_CANDLES - i) * CANDLE_MS, v: 120 + Math.random() * 380 })
      p = c
    }
    st.current = {
      price: p, candles, dayHigh: p + 6.2, dayLow: p - 9.4, open: BASE_PRICE - 4, drift: 0.04,
      dxy: 103.8, dxyHist: Array.from({ length: 40 }, (_, i) => 103.8 + Math.sin(i / 5) * 0.3), retail: 62,
      spread: 0.18, lastCandle: now,
    }

    const id = setInterval(() => {
      const s = st.current!
      const t = Date.now()
      // ubah drift perlahan (tren mikro)
      if (Math.random() < 0.06) s.drift = (Math.random() - 0.5) * 0.16
      const noise = (Math.random() - 0.5) * 1.4
      const delta = s.drift + noise
      s.price = Math.max(1, s.price + delta)
      s.dayHigh = Math.max(s.dayHigh, s.price)
      s.dayLow = Math.min(s.dayLow, s.price)

      // spread: sesekali melebar
      s.spread += (0.18 - s.spread) * 0.2 + (Math.random() < 0.05 ? Math.random() * 0.7 : 0)
      s.spread = Math.max(0.1, Math.min(1.4, s.spread))

      // dxy bergerak kebalikan gold
      s.dxy = Math.max(90, s.dxy - delta * 0.012 + (Math.random() - 0.5) * 0.02)
      s.dxyHist = [...s.dxyHist.slice(-39), s.dxy]

      // retail drift (cenderung melawan tren → sering salah)
      s.retail += -Math.sign(delta) * Math.random() * 0.8 + (Math.random() - 0.5) * 0.5
      s.retail = Math.max(20, Math.min(88, s.retail))

      // update candle berjalan / buat baru
      const last = s.candles[s.candles.length - 1]
      if (t - s.lastCandle >= CANDLE_MS) {
        s.candles = [...s.candles.slice(-(MAX_CANDLES - 1)), { o: s.price, h: s.price, l: s.price, c: s.price, t, v: 120 + Math.random() * 380 }]
        s.lastCandle = t
      } else {
        last.c = s.price; last.h = Math.max(last.h, s.price); last.l = Math.min(last.l, s.price); last.v += 8
      }

      // indikator
      const closes = s.candles.map(c => c.c)
      const ema9 = emaArr(closes, 9)
      const ema21 = emaArr(closes, 21)
      const rsi = rsiLast(closes)
      const atr = atrLast(s.candles)
      // vwap kumulatif
      const vwapArr: number[] = []
      let pv = 0, vv = 0
      s.candles.forEach(c => { const tp = (c.h + c.l + c.c) / 3; pv += tp * c.v; vv += c.v; vwapArr.push(pv / vv) })
      const vwap = vwapArr[vwapArr.length - 1]

      // bias momentum
      let score = 0
      if (ema9[ema9.length - 1] > ema21[ema21.length - 1]) score += 1; else score -= 1
      if (s.price > vwap) score += 1; else score -= 1
      if (rsi > 55) score += 1; else if (rsi < 45) score -= 1
      const bias = score >= 2 ? { label: 'LONG' as const, score } : score <= -2 ? { label: 'SHORT' as const, score } : { label: 'NETRAL' as const, score }

      // kontrarian retail
      const cLabel = s.retail > 62 ? 'SHORT' as const : s.retail < 38 ? 'LONG' as const : 'NETRAL' as const
      const dist = Math.abs(s.retail - 50)
      const strength = dist > 25 ? 'kuat' as const : dist > 13 ? 'sedang' as const : 'lemah' as const

      // tradeability
      const msToEvent = eventAtRef.current - t
      let ok = true, reason = 'Spread & volatilitas sehat'
      if (msToEvent < 5 * 60_000 && msToEvent > -2 * 60_000) { ok = false; reason = 'News high-impact < 5 menit' }
      else if (s.spread > 0.45) { ok = false; reason = 'Spread melebar' }
      else if (atr < 0.6) { ok = false; reason = 'Volatilitas terlalu rendah' }

      // sesi (perkiraan dari UTC)
      const h = new Date(t).getUTCHours()
      const session = h >= 12 && h < 16 ? 'London × New York' : h >= 7 && h < 12 ? 'London' : h >= 16 && h < 21 ? 'New York' : 'Asia'

      const changePct = ((s.price - s.open) / s.open) * 100
      setFeed({
        price: s.price, bid: s.price - s.spread / 2, ask: s.price + s.spread / 2, spread: s.spread,
        dayHigh: s.dayHigh, dayLow: s.dayLow, changePct, up: changePct >= 0,
        candles: s.candles, ema9, ema21, vwapArr, rsi, atr, vwap, bias,
        dxy: s.dxy, dxyHist: s.dxyHist, dxyDown: s.dxyHist[s.dxyHist.length - 1] < s.dxyHist[s.dxyHist.length - 6],
        retailLong: s.retail, contrarian: { label: cLabel, strength },
        tradeable: { ok, reason }, session, now: t,
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  return { feed, eventAtRef }
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

function Spark({ data, color = '#34d399', invert = false }: { data: number[]; color?: string; invert?: boolean }) {
  if (!data.length) return null
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${invert ? ((v - min) / range) * 30 : 30 - ((v - min) / range) * 30}`).join(' ')
  return <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-8"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg>
}

// ─────────────────────────── chart candle ───────────────────────────
function CandleChart({ feed }: { feed: Feed }) {
  const W = 900, H = 360, padR = 58, padB = 6, padT = 10
  const cs = feed.candles
  const lo = Math.min(...cs.map(c => c.l), feed.vwap), hi = Math.max(...cs.map(c => c.h), feed.vwap)
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
      {/* candles */}
      {cs.map((c, i) => {
        const up = c.c >= c.o
        const col = up ? '#34d399' : '#f87171'
        const top = y(Math.max(c.o, c.c)), bot = y(Math.min(c.o, c.c))
        return (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth="1" />
            <rect x={x(i) - cw * 0.3} width={cw * 0.6} y={top} height={Math.max(1, bot - top)} fill={col} />
          </g>
        )
      })}
      {/* vwap */}
      <polyline points={line(feed.vwapArr)} fill="none" stroke="#fbbf24" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.85" />
      {/* ema */}
      <polyline points={line(feed.ema9)} fill="none" stroke="#60a5fa" strokeWidth="1.4" />
      <polyline points={line(feed.ema21)} fill="none" stroke="#c084fc" strokeWidth="1.4" />
      {/* harga sekarang */}
      <line x1="0" x2={plotW} y1={y(feed.price)} y2={y(feed.price)} stroke={feed.up ? '#34d399' : '#f87171'} strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
      <rect x={W - padR} y={y(feed.price) - 8} width={padR} height="16" fill={feed.up ? '#065f46' : '#7f1d1d'} />
      <text x={W - padR + 5} y={y(feed.price) + 3} fill="#fff" fontSize="10" fontWeight="700">{f2(feed.price)}</text>
    </svg>
  )
}

// ─────────────────────────── countdown ───────────────────────────
function useCountdown(target: number, now: number) {
  const ms = target - now
  const past = ms < 0
  const abs = Math.abs(ms)
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
  const cd = useCountdown(eventAtRef.current, feed?.now ?? Date.now())
  const clock = useMemo(() => feed ? new Date(feed.now).toLocaleTimeString('id-ID') : '', [feed])

  if (!feed) {
    return <div className="min-h-screen flex items-center justify-center bg-[#060a09] text-white/50"><Radio className="animate-pulse mr-2" /> Menghubungkan feed…</div>
  }

  const levels = [
    { label: 'Day High', v: feed.dayHigh, kind: 'res' },
    { label: 'VWAP', v: feed.vwap, kind: 'vwap' },
    { label: 'Round', v: Math.round(feed.price / 5) * 5, kind: 'round' },
    { label: 'Day Low', v: feed.dayLow, kind: 'sup' },
  ].map(l => ({ ...l, dist: feed.price - l.v }))

  return (
    <div className="min-h-screen bg-[#060a09] text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-[#060a09]/95 backdrop-blur border-b border-white/8">
        <div className="px-4 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-white/50 hover:text-white shrink-0"><ArrowLeft size={18} /></Link>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-black tracking-tight">XAU/USD</span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 rounded px-1.5 py-0.5">Data Simulasi · Fase 1</span>
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
            {/* tradeability light */}
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
        {/* Chart */}
        <Panel title="XAU/USD · 1m" icon={Activity} className="lg:col-span-8 h-[400px]"
          right={<div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-[#60a5fa]"><Minus size={12} /> EMA9</span>
            <span className="flex items-center gap-1 text-[#c084fc]"><Minus size={12} /> EMA21</span>
            <span className="flex items-center gap-1 text-[#fbbf24]"><Minus size={12} /> VWAP</span>
          </div>}>
          <div className="flex-1 min-h-0"><CandleChart feed={feed} /></div>
        </Panel>

        {/* Right rail */}
        <div className="lg:col-span-4 grid grid-rows-2 gap-2.5">
          {/* Momentum / bias */}
          <Panel title="Momentum & Bias" icon={Gauge}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] text-white/40">Bias TF rendah (EMA · VWAP · RSI)</p>
                <p className={`text-2xl font-black ${biasColor(feed.bias.label)}`}>{feed.bias.label}</p>
              </div>
              <span className={`text-3xl ${biasColor(feed.bias.label)}`}>
                {feed.bias.label === 'LONG' ? <TrendingUp size={30} /> : feed.bias.label === 'SHORT' ? <TrendingDown size={30} /> : <Minus size={30} />}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[['RSI', feed.rsi.toFixed(0), feed.rsi > 70 ? 'text-red-400' : feed.rsi < 30 ? 'text-emerald-400' : 'text-white/80'],
                ['ATR', '$' + feed.atr.toFixed(2), 'text-white/80'],
                ['vs VWAP', (feed.price > feed.vwap ? '+' : '') + f2(feed.price - feed.vwap), feed.price > feed.vwap ? 'text-emerald-400' : 'text-red-400']].map(([k, v, cls]) => (
                <div key={k} className="rounded-lg bg-white/[0.03] py-2">
                  <p className="text-[9px] uppercase tracking-wider text-white/35">{k}</p>
                  <p className={`text-sm font-bold tabular-nums ${cls}`}>{v}</p>
                </div>
              ))}
            </div>
          </Panel>

          {/* Contrarian retail */}
          <Panel title="Retail vs Smart Money · Kontrarian" icon={Users}
            right={<span className="text-[9px] text-white/30">fade retail</span>}>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-red-400 font-bold">{feed.retailLong.toFixed(0)}% Long</span>
                  <span className="text-emerald-400 font-bold">{(100 - feed.retailLong).toFixed(0)}% Short</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden bg-emerald-500/25 flex">
                  <div className="bg-red-500/70 h-full" style={{ width: `${feed.retailLong}%` }} />
                </div>
                <p className="text-[10px] text-white/45 mt-1.5">Retail ramai {feed.retailLong > 50 ? 'LONG' : 'SHORT'} → sinyal berlawanan</p>
              </div>
              <div className="text-center shrink-0">
                <p className="text-[9px] uppercase tracking-wider text-white/35">Kontrarian</p>
                <p className={`text-lg font-black leading-tight ${biasColor(feed.contrarian.label)}`}>{feed.contrarian.label}</p>
                <p className="text-[9px] text-white/40">{feed.contrarian.strength}</p>
              </div>
            </div>
          </Panel>
        </div>

        {/* Levels */}
        <Panel title="Level Kunci" icon={Layers} className="lg:col-span-3">
          <div className="space-y-1.5">
            {levels.map(l => (
              <div key={l.label} className="flex items-center justify-between text-[11px]">
                <span className={`font-semibold ${l.kind === 'res' ? 'text-red-400/80' : l.kind === 'sup' ? 'text-emerald-400/80' : l.kind === 'vwap' ? 'text-amber-400/80' : 'text-white/60'}`}>{l.label}</span>
                <span className="tabular-nums text-white/80">{f2(l.v)}</span>
                <span className={`tabular-nums text-[10px] w-14 text-right ${Math.abs(l.dist) < 1.5 ? 'text-amber-400 font-bold' : 'text-white/35'}`}>{l.dist >= 0 ? '+' : ''}{l.dist.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-white/30 mt-2 pt-2 border-t border-white/5">Angka = jarak harga ke level. Dekat level = perhatikan reaksi.</p>
        </Panel>

        {/* DXY */}
        <Panel title="Korelasi Dolar (DXY)" icon={DollarSign} className="lg:col-span-3"
          right={<span className={`text-[10px] font-bold ${feed.dxyDown ? 'text-emerald-400' : 'text-red-400'}`}>{feed.dxyDown ? '↓ bullish gold' : '↑ bearish gold'}</span>}>
          <p className="text-xl font-black tabular-nums">{feed.dxy.toFixed(3)}</p>
          <Spark data={feed.dxyHist} color={feed.dxyDown ? '#34d399' : '#f87171'} />
          <p className="text-[10px] text-white/45">{feed.dxyDown ? 'Dolar melemah → momentum emas cenderung menguat.' : 'Dolar menguat → tekanan untuk emas.'}</p>
        </Panel>

        {/* Calendar / countdown */}
        <Panel title="Kalender Ekonomi" icon={CalendarClock} className="lg:col-span-3">
          <div className={`rounded-lg p-2.5 ${cd.ms < 5 * 60000 && cd.ms > -2 * 60000 ? 'bg-red-500/15' : 'bg-white/[0.03]'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white/80">US CPI (YoY)</span>
              <span className="text-[9px] font-bold uppercase bg-red-500/20 text-red-400 rounded px-1.5 py-0.5">High</span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-white/45">dalam</span>
              <span className={`text-lg font-black tabular-nums ${cd.ms < 5 * 60000 ? 'text-red-400' : 'text-white'}`}>{cd.text}</span>
            </div>
            <div className="flex justify-between text-[9px] text-white/40 mt-1"><span>Forecast 3.1%</span><span>Prev 3.3%</span></div>
          </div>
          {cd.ms < 5 * 60000 && cd.ms > -2 * 60000 && <p className="text-[10px] text-red-300 mt-2 flex items-center gap-1"><AlertTriangle size={11} /> Hindari entry saat rilis.</p>}
        </Panel>

        {/* COT context */}
        <Panel title="COT Institusi" icon={Building2} className="lg:col-span-3"
          right={<span className="text-[9px] text-white/30">mingguan · konteks</span>}>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between"><span className="text-white/50">Managed Money</span><span className="text-emerald-400 font-bold">Net Long</span></div>
            <div className="flex justify-between"><span className="text-white/50">Δ minggu ini</span><span className="text-red-400 font-bold tabular-nums">-4.2k</span></div>
            <div className="flex justify-between"><span className="text-white/50">Commercials</span><span className="text-red-400 font-bold">Net Short</span></div>
          </div>
          <p className="text-[9px] text-amber-400/70 mt-2 pt-2 border-t border-white/5">Bias mingguan — bukan sinyal entry untuk scalping.</p>
        </Panel>

        {/* News ticker */}
        <Panel title="Berita Emas & Dolar" icon={Newspaper} className="lg:col-span-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {NEWS.map((n, i) => (
              <div key={i} className="rounded-lg bg-white/[0.03] p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 rounded px-1.5 py-0.5">{n.tag}</span>
                  <span className="text-[9px] text-white/30">{n.time} lalu</span>
                </div>
                <p className="text-[11px] text-white/70 leading-snug">{n.text}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <p className="text-center text-[10px] text-white/25 pb-6">
        Terminal XAUUSD · Fase 1 — semua angka masih SIMULASI. Fase 2 akan disambungkan ke stream tick asli OANDA.
      </p>
    </div>
  )
}
