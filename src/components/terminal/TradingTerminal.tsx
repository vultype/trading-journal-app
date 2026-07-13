'use client'

/*
 * TERMINAL XAUUSD — Fase 1 (UI + feed SIMULASI)
 * Semua angka di-generate lokal dengan model faktor (dollar & risk) yang membuat
 * DXY/yield/VIX/S&P/Nasdaq/BTC berkorelasi konsisten ke emas. BUKAN data pasar asli.
 * Fase 2: ganti `useSimFeed()` dengan stream tick asli worker OANDA + feed makro.
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Activity, TrendingUp, TrendingDown, Gauge as GaugeIcon, CalendarClock, Newspaper, Layers,
  Radio, AlertTriangle, ArrowLeft, Clock, Wifi, Users, Building2,
  Circle, Minus, Sparkles, Target, Waves, Crosshair, Compass, BarChart3,
} from 'lucide-react'

// ─────────────────────────── konstanta ───────────────────────────
const BASE_PRICE = 2685.4
const TICK_MS = 800
type TF = 'M5' | 'M15' | 'H1'
const TFS: TF[] = ['M5', 'M15', 'H1']
const TF_MS: Record<TF, number> = { M5: 4000, M15: 12000, H1: 48000 }
const TF_N: Record<TF, number> = { M5: 60, M15: 48, H1: 40 }

type Candle = { o: number; h: number; l: number; c: number; t: number; v: number }
type Bias = { label: 'LONG' | 'SHORT' | 'NETRAL'; score: number }
type TFData = { candles: Candle[]; ema9: number[]; ema21: number[]; vwapArr: number[]; rsi: number; atr: number; vwap: number; bias: Bias }
type Pivots = { P: number; R1: number; R2: number; S1: number; S2: number }
type Asset = { value: number; chgPct: number; hist: number[] }
type AssetKey = 'dxy' | 'us10y' | 'vix' | 'sp' | 'ndx' | 'btc'
type Feed = {
  price: number; bid: number; ask: number; spread: number
  dayHigh: number; dayLow: number; changePct: number; up: boolean
  tf: Record<TF, TFData>
  assets: Record<AssetKey, Asset>
  retailLong: number
  contrarian: { label: 'LONG' | 'SHORT' | 'NETRAL'; strength: 'lemah' | 'sedang' | 'kuat' }
  tradeable: { ok: boolean; reason: string }
  pivots: Pivots
  vol: { label: 'Rendah' | 'Normal' | 'Tinggi'; ratio: number }
  session: string; now: number
}

const ASSET_META: { key: AssetKey; name: string; sub: string; corr: number; dec: number; prefix?: string; suffix?: string }[] = [
  { key: 'dxy', name: 'DXY', sub: 'Indeks Dolar', corr: -1, dec: 2 },
  { key: 'us10y', name: 'US10Y', sub: 'Yield 10 Thn', corr: -1, dec: 2, suffix: '%' },
  { key: 'vix', name: 'VIX', sub: 'Indeks Ketakutan', corr: 1, dec: 2 },
  { key: 'sp', name: 'S&P 500', sub: 'Saham AS', corr: -0.5, dec: 0 },
  { key: 'ndx', name: 'Nasdaq', sub: 'Saham Teknologi', corr: -0.5, dec: 0 },
  { key: 'btc', name: 'Bitcoin', sub: 'Kripto', corr: 0.4, dec: 0, prefix: '$' },
]

const HEADLINES: { src: 'Reuters' | 'Bloomberg'; senti: number; text: string; time: string }[] = [
  { src: 'Reuters', senti: 1, text: 'Emas menguat, ekspektasi pemangkasan suku bunga Fed meningkat', time: '3m' },
  { src: 'Bloomberg', senti: -1, text: 'Dolar rebound usai data tenaga kerja AS kuat, tekan logam mulia', time: '12m' },
  { src: 'Reuters', senti: 1, text: 'Ketegangan geopolitik dorong permintaan safe-haven emas', time: '25m' },
  { src: 'Bloomberg', senti: 0, text: 'Investor emas berhati-hati jelang rilis inflasi AS malam ini', time: '40m' },
  { src: 'Reuters', senti: 1, text: 'Bank sentral global lanjutkan akumulasi emas kuartal ini', time: '1j' },
]
const NARRATIVE_N = HEADLINES.reduce((a, h) => a + h.senti, 0) / HEADLINES.length

// ─────────────────────────── util indikator ───────────────────────────
function emaArr(vals: number[], period: number): number[] {
  const k = 2 / (period + 1); const out: number[] = []; let prev = vals[0] ?? 0
  vals.forEach((v, i) => { prev = i ? v * k + prev * (1 - k) : v; out.push(prev) })
  return out
}
function rsiLast(vals: number[], period = 14): number {
  if (vals.length < period + 1) return 50
  let gain = 0, loss = 0
  for (let i = vals.length - period; i < vals.length; i++) { const d = vals[i] - vals[i - 1]; if (d >= 0) gain += d; else loss -= d }
  const rs = loss === 0 ? 100 : gain / loss
  return 100 - 100 / (1 + rs)
}
function atrLast(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) { const c = candles[i], p = candles[i - 1]; trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c))) }
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
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))

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
        const h = Math.max(o, c) + Math.random() * body * 0.4, l = Math.min(o, c) - Math.random() * body * 0.4
        arr.push({ o, h, l, c, t: now, v: 120 + Math.random() * 380 }); p = c
      }
      arr[arr.length - 1].c = BASE_PRICE; return arr
    }
    const series: Record<TF, Candle[]> = { M5: seedSeries(TF_N.M5, 3.2), M15: seedSeries(TF_N.M15, 5.5), H1: seedSeries(TF_N.H1, 9) }
    const prevH = BASE_PRICE + 12, prevL = BASE_PRICE - 15, prevC = BASE_PRICE - 3
    const P = (prevH + prevL + prevC) / 3
    const pivots: Pivots = { P, R1: 2 * P - prevL, R2: P + (prevH - prevL), S1: 2 * P - prevH, S2: P - (prevH - prevL) }
    const opens = { dxy: 103.8, us10y: 4.25, vix: 15.5, sp: 5420, ndx: 19100, btc: 68000 }
    const mkHist = (v: number) => Array.from({ length: 40 }, () => v)

    st.current = {
      price: BASE_PRICE, series, last: { M5: now, M15: now, H1: now },
      dayHigh: BASE_PRICE + 6.2, dayLow: BASE_PRICE - 9.4, open: BASE_PRICE - 4,
      dollarF: 0, riskF: 0, drift: 0.04, retail: 62, spread: 0.18, pivots, atrBase: 2.6, opens,
      hist: { dxy: mkHist(opens.dxy), us10y: mkHist(opens.us10y), vix: mkHist(opens.vix), sp: mkHist(opens.sp), ndx: mkHist(opens.ndx), btc: mkHist(opens.btc) },
    }

    const id = setInterval(() => {
      const s = st.current, t = Date.now()
      // model faktor: dolar & risk (mean-reverting random walk)
      const ddollar = (Math.random() - 0.5) * 0.5 - s.dollarF * 0.03
      const drisk = (Math.random() - 0.5) * 0.5 - s.riskF * 0.03
      s.dollarF += ddollar; s.riskF += drisk
      const goldDelta = -ddollar * 1.6 - drisk * 0.4 + (Math.random() - 0.5) * 0.8
      s.price = Math.max(1, s.price + goldDelta)
      s.dayHigh = Math.max(s.dayHigh, s.price); s.dayLow = Math.min(s.dayLow, s.price)
      s.spread += (0.18 - s.spread) * 0.2 + (Math.random() < 0.05 ? Math.random() * 0.7 : 0)
      s.spread = clamp(s.spread, 0.1, 1.4)
      s.retail += -Math.sign(goldDelta) * Math.random() * 0.8 + (Math.random() - 0.5) * 0.5
      s.retail = clamp(s.retail, 20, 88)

      // aset turunan dari faktor
      const av: Record<AssetKey, number> = {
        dxy: 103.8 + s.dollarF * 0.6,
        us10y: Math.max(1, 4.25 + s.dollarF * 0.06),
        vix: Math.max(9, 15.5 - s.riskF * 1.2),
        sp: 5420 + s.riskF * 22,
        ndx: 19100 + s.riskF * 95,
        btc: 68000 + s.riskF * 450 - s.dollarF * 380,
      }
      const assets = {} as Record<AssetKey, Asset>
      for (const k of Object.keys(av) as AssetKey[]) {
        s.hist[k] = [...s.hist[k].slice(-39), av[k]]
        assets[k] = { value: av[k], chgPct: ((av[k] - s.opens[k]) / s.opens[k]) * 100, hist: s.hist[k] }
      }

      for (const tf of TFS) {
        const arr: Candle[] = s.series[tf]; const last = arr[arr.length - 1]
        if (t - s.last[tf] >= TF_MS[tf]) { s.series[tf] = [...arr.slice(-(TF_N[tf] - 1)), { o: s.price, h: s.price, l: s.price, c: s.price, t, v: 120 + Math.random() * 380 }]; s.last[tf] = t }
        else { last.c = s.price; last.h = Math.max(last.h, s.price); last.l = Math.min(last.l, s.price); last.v += 8 }
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
        dayHigh: s.dayHigh, dayLow: s.dayLow, changePct, up: changePct >= 0, tf, assets,
        retailLong: s.retail, contrarian: { label: cLabel, strength },
        tradeable: { ok, reason }, pivots: s.pivots, vol: { label: volLabel, ratio }, session, now: t,
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])
  return { feed, eventAtRef }
}

// ─────────────────────────── skor 3 pilar ───────────────────────────
function scores(feed: Feed) {
  const a = feed.assets
  const dxyN = clamp(a.dxy.chgPct / 0.5, -1, 1)
  const yldN = clamp(a.us10y.chgPct / 2, -1, 1)
  const spN = clamp(a.sp.chgPct / 1, -1, 1)
  const ndxN = clamp(a.ndx.chgPct / 1.3, -1, 1)
  const vixN = clamp(a.vix.chgPct / 6, -1, 1)
  const btcN = clamp(a.btc.chgPct / 2, -1, 1)
  const contra = clamp((50 - feed.retailLong) / 25, -1, 1)
  const macro = clamp(-dxyN * 0.6 - yldN * 0.4, -1, 1) * 100
  const tech = clamp((feed.tf.M5.bias.score + feed.tf.M15.bias.score + feed.tf.H1.bias.score) / 9, -1, 1) * 100
  const senti = clamp(vixN * 0.3 + btcN * 0.15 + NARRATIVE_N * 0.3 + contra * 0.15 - spN * 0.06 - ndxN * 0.04, -1, 1) * 100
  const overall = macro * 0.35 + tech * 0.4 + senti * 0.25
  const label: 'LONG' | 'SHORT' | 'NETRAL' = overall > 20 ? 'LONG' : overall < -20 ? 'SHORT' : 'NETRAL'
  const sgn = (x: number) => Math.sign(Math.round(x))
  const agree = new Set([sgn(macro), sgn(tech), sgn(senti)]).size === 1 ? 3 : (sgn(macro) === sgn(tech) || sgn(tech) === sgn(senti) || sgn(macro) === sgn(senti)) ? 2 : 1
  const mag = (Math.abs(macro) + Math.abs(tech) + Math.abs(senti)) / 3
  const confidence = Math.round(clamp((agree / 3) * 0.6 + (mag / 100) * 0.4, 0, 1) * 100)
  return { macro, tech, senti, overall, label, confidence }
}

// ─────────────────────────── helpers UI ───────────────────────────
const f2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const biasColor = (l: string) => l === 'LONG' ? 'text-emerald-400' : l === 'SHORT' ? 'text-red-400' : 'text-white/60'
const biasBg = (l: string) => l === 'LONG' ? 'bg-emerald-500/15 text-emerald-400' : l === 'SHORT' ? 'bg-red-500/15 text-red-400' : 'bg-white/10 text-white/60'
const wib = (ts: number) => new Date(ts).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) + ' WIB'

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
  return <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-6"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg>
}

function Gauge({ score, label }: { score: number; label: string }) {
  const W = 220, H = 128, cx = 110, cy = 116, rOut = 92, rIn = 74, N = 44
  const polar = (r: number, deg: number) => { const rad = deg * Math.PI / 180; return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)] as const }
  const frac = (score + 100) / 200
  const [nx, ny] = polar(rIn - 6, 180 - frac * 180)
  const col = score > 20 ? '#34d399' : score < -20 ? '#f87171' : '#fbbf24'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {Array.from({ length: N + 1 }).map((_, k) => {
        const fr = k / N, deg = 180 - fr * 180
        const [x1, y1] = polar(rIn, deg), [x2, y2] = polar(rOut, deg)
        const c = fr < 0.38 ? '#f87171' : fr < 0.62 ? '#fbbf24' : '#34d399'
        const on = Math.abs(fr - frac) < 0.03
        return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={on ? 4 : 2.4} opacity={on ? 1 : 0.55} />
      })}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={col} strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill={col} />
      <text x={cx} y={cy - 26} textAnchor="middle" fill={col} fontSize="30" fontWeight="800">{score > 0 ? '+' : ''}{Math.round(score)}</text>
      <text x={cx} y={cy - 8} textAnchor="middle" fill={col} fontSize="12" fontWeight="700">{label}</text>
      <text x={16} y={cy + 10} fill="#f87171" fontSize="9" fontWeight="700">BEARISH</text>
      <text x={W - 16} y={cy + 10} textAnchor="end" fill="#34d399" fontSize="9" fontWeight="700">BULLISH</text>
    </svg>
  )
}

function PillarBar({ label, score }: { label: string; score: number }) {
  const pos = score >= 0, w = Math.min(50, Math.abs(score) / 2)
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1"><span className="text-white/60 font-semibold">{label}</span><span className={`font-bold tabular-nums ${pos ? 'text-emerald-400' : 'text-red-400'}`}>{score > 0 ? '+' : ''}{Math.round(score)}</span></div>
      <div className="relative h-2 rounded-full bg-white/5">
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
        <div className={`absolute top-0 h-full rounded-full ${pos ? 'bg-emerald-400 left-1/2' : 'bg-red-400 right-1/2'}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  )
}

function CandleChart({ d, price, up, compact = false }: { d: TFData; price: number; up: boolean; compact?: boolean }) {
  const W = 900, H = compact ? 220 : 360, padR = 52, padB = 6, padT = 8
  const cs = d.candles
  const lo = Math.min(...cs.map(c => c.l), d.vwap), hi = Math.max(...cs.map(c => c.h), d.vwap)
  const pad = (hi - lo) * 0.08 || 1, min = lo - pad, max = hi + pad, plotW = W - padR
  const y = (v: number) => padT + (max - v) / (max - min) * (H - padT - padB)
  const cw = plotW / cs.length, x = (i: number) => i * cw + cw / 2
  const line = (arr: number[]) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const gridVals = Array.from({ length: 4 }, (_, i) => min + (max - min) * (i / 3))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      {gridVals.map((g, i) => (<g key={i}><line x1="0" x2={plotW} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.05)" /><text x={W - padR + 4} y={y(g) + 3} fill="rgba(255,255,255,0.35)" fontSize="9">{f2(g)}</text></g>))}
      {cs.map((c, i) => { const cup = c.c >= c.o, col = cup ? '#34d399' : '#f87171'; const top = y(Math.max(c.o, c.c)), bot = y(Math.min(c.o, c.c)); return (<g key={i}><line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth="1" /><rect x={x(i) - cw * 0.3} width={cw * 0.6} y={top} height={Math.max(1, bot - top)} fill={col} /></g>) })}
      <polyline points={line(d.vwapArr)} fill="none" stroke="#fbbf24" strokeWidth="1.1" strokeDasharray="4 3" opacity="0.8" />
      <polyline points={line(d.ema9)} fill="none" stroke="#60a5fa" strokeWidth="1.3" />
      <polyline points={line(d.ema21)} fill="none" stroke="#c084fc" strokeWidth="1.3" />
      <line x1="0" x2={plotW} y1={y(price)} y2={y(price)} stroke={up ? '#34d399' : '#f87171'} strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
      <rect x={W - padR} y={y(price) - 7} width={padR} height="14" fill={up ? '#065f46' : '#7f1d1d'} />
      <text x={W - padR + 4} y={y(price) + 3} fill="#fff" fontSize="9" fontWeight="700">{f2(price)}</text>
    </svg>
  )
}

function AssetCard({ meta, a }: { meta: typeof ASSET_META[number]; a: Asset }) {
  const impact = Math.sign(a.chgPct) * meta.corr
  const imp = impact > 0.05 ? { t: 'Bullish', c: 'text-emerald-400 bg-emerald-500/10' } : impact < -0.05 ? { t: 'Bearish', c: 'text-red-400 bg-red-500/10' } : { t: 'Netral', c: 'text-white/50 bg-white/5' }
  const up = a.chgPct >= 0
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
      <div className="flex items-center justify-between gap-1"><span className="text-xs font-bold text-white/85">{meta.name}</span><span className={`text-[8px] font-bold uppercase rounded px-1 py-0.5 shrink-0 ${imp.c}`}>{imp.t}</span></div>
      <div className="text-[9px] text-white/35 mb-1">{meta.sub}</div>
      <div className="flex items-end justify-between">
        <span className="text-sm font-black tabular-nums">{meta.prefix ?? ''}{a.value.toLocaleString('en-US', { minimumFractionDigits: meta.dec, maximumFractionDigits: meta.dec })}{meta.suffix ?? ''}</span>
        <span className={`text-[10px] font-bold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>{up ? '+' : ''}{a.chgPct.toFixed(2)}%</span>
      </div>
      <Spark data={a.hist} color={up ? '#34d399' : '#f87171'} />
    </div>
  )
}

function useCountdown(target: number, now: number) {
  const ms = target - now, past = ms < 0, abs = Math.abs(ms)
  const m = Math.floor(abs / 60000), s = Math.floor((abs % 60000) / 1000)
  return { text: `${past ? '-' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, ms }
}

// ─────────────────────────── PAGE ───────────────────────────
export function TradingTerminal() {
  const { feed, eventAtRef } = useSimFeed()
  const cd = useCountdown(eventAtRef.current, feed?.now ?? Date.now())
  const clock = useMemo(() => feed ? new Date(feed.now).toLocaleTimeString('id-ID') : '', [feed])

  if (!feed) return <div className="min-h-screen flex items-center justify-center bg-[#060a09] text-white/50"><Radio className="animate-pulse mr-2" /> Menghubungkan feed…</div>

  const sc = scores(feed)
  const dir = sc.label
  const atr = feed.tf.M15.atr
  const sltp = dir === 'LONG' ? { sl: feed.price - 1.5 * atr, tp1: feed.price + 1.5 * atr, tp2: feed.price + 3 * atr }
    : dir === 'SHORT' ? { sl: feed.price + 1.5 * atr, tp1: feed.price - 1.5 * atr, tp2: feed.price - 3 * atr } : null

  let action: string
  if (!feed.tradeable.ok) action = `⚠ ${feed.tradeable.reason} — tahan dulu.`
  else if (sc.confidence < 40) action = 'Sinyal lemah/campur — tunggu konfirmasi arah.'
  else if (dir === 'LONG') action = 'Bias LONG — cari pullback ke VWAP/EMA21 untuk entry.'
  else if (dir === 'SHORT') action = 'Bias SHORT — cari retest ke VWAP/EMA21 untuk entry.'
  else action = 'Netral — tunggu arah dominan.'

  const narrativePct = Math.round((NARRATIVE_N + 1) / 2 * 100)
  const levels = [
    { label: 'R2', v: feed.pivots.R2, k: 'res' }, { label: 'R1', v: feed.pivots.R1, k: 'res' },
    { label: 'Pivot', v: feed.pivots.P, k: 'piv' }, { label: 'VWAP', v: feed.tf.M15.vwap, k: 'vwap' },
    { label: 'S1', v: feed.pivots.S1, k: 'sup' }, { label: 'S2', v: feed.pivots.S2, k: 'sup' },
  ].map(l => ({ ...l, dist: feed.price - l.v })).sort((a, b) => b.v - a.v)

  const now = feed.now
  const CAL = [
    { name: 'US CPI (YoY)', imp: 'High', fc: '3.1%', prev: '3.3%', at: eventAtRef.current },
    { name: 'US Core PCE', imp: 'High', fc: '2.6%', prev: '2.7%', at: now + 3 * 3600_000 },
    { name: 'Fed Speak — Powell', imp: 'Med', fc: '—', prev: '—', at: now + 5 * 3600_000 },
    { name: 'Initial Jobless Claims', imp: 'Med', fc: '232K', prev: '229K', at: now + 20 * 3600_000 },
    { name: 'US Retail Sales (MoM)', imp: 'High', fc: '0.3%', prev: '0.1%', at: now + 26 * 3600_000 },
  ]

  return (
    <div className="min-h-screen bg-[#060a09] text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-[#060a09]/95 backdrop-blur border-b border-white/8">
        <div className="px-4 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-white/50 hover:text-white shrink-0"><ArrowLeft size={18} /></Link>
          <div className="flex items-center gap-2 shrink-0"><span className="font-black tracking-tight">XAU/USD</span><span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 rounded px-1.5 py-0.5">Simulasi · Fase 1</span></div>
          <div className="flex items-baseline gap-2"><span className={`text-2xl font-black tabular-nums ${feed.up ? 'text-emerald-400' : 'text-red-400'}`}>{f2(feed.price)}</span><span className={`text-xs font-bold tabular-nums ${feed.up ? 'text-emerald-400' : 'text-red-400'}`}>{feed.up ? '+' : ''}{feed.changePct.toFixed(2)}%</span></div>
          <div className="hidden md:flex items-center gap-4 text-[11px] text-white/50 tabular-nums">
            <span>Bid <b className="text-white/80">{f2(feed.bid)}</b></span><span>Ask <b className="text-white/80">{f2(feed.ask)}</b></span>
            <span>Spread <b className={feed.spread > 0.45 ? 'text-amber-400' : 'text-white/80'}>${feed.spread.toFixed(2)}</b></span>
            <span>H <b className="text-emerald-400/80">{f2(feed.dayHigh)}</b></span><span>L <b className="text-red-400/80">{f2(feed.dayLow)}</b></span>
          </div>
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <span className="hidden lg:flex items-center gap-1.5 text-[11px] text-white/50"><Circle size={7} className="fill-primary text-primary" /> {feed.session}</span>
            <span className={`flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 ${feed.tradeable.ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}><Circle size={8} className={`${feed.tradeable.ok ? 'fill-emerald-400 text-emerald-400' : 'fill-red-400 text-red-400'} animate-pulse`} />{feed.tradeable.ok ? 'TRADEABLE' : 'HATI-HATI'}</span>
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-white/40"><Clock size={11} /> {clock}</span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400"><Wifi size={12} /> live</span>
          </div>
        </div>
        {!feed.tradeable.ok && <div className="px-4 py-1.5 bg-red-500/10 border-t border-red-500/20 flex items-center gap-2 text-[11px] text-red-300"><AlertTriangle size={12} /> {feed.tradeable.reason} — pertimbangkan menunggu.</div>}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 p-2.5">
        {/* ── Row 1: Signal Meter · Bias & Confidence · Narrative ── */}
        <Panel title="Signal Meter · XAU/USD" icon={Compass} className="lg:col-span-4">
          <Gauge score={sc.overall} label={sc.label} />
          {sltp ? (
            <div className="grid grid-cols-3 gap-1.5 mt-1 text-center">
              <div className="rounded-lg bg-red-500/8 py-1.5"><p className="text-[9px] uppercase tracking-wider text-white/35">SL</p><p className="text-[11px] font-bold text-red-400 tabular-nums">{f2(sltp.sl)}</p></div>
              <div className="rounded-lg bg-emerald-500/8 py-1.5"><p className="text-[9px] uppercase tracking-wider text-white/35">TP1</p><p className="text-[11px] font-bold text-emerald-400 tabular-nums">{f2(sltp.tp1)}</p></div>
              <div className="rounded-lg bg-emerald-500/8 py-1.5"><p className="text-[9px] uppercase tracking-wider text-white/35">TP2</p><p className="text-[11px] font-bold text-emerald-400 tabular-nums">{f2(sltp.tp2)}</p></div>
            </div>
          ) : <p className="text-[10px] text-white/35 text-center mt-1">Bias netral — belum ada saran arah.</p>}
        </Panel>

        <Panel title="Bias & Confidence" icon={GaugeIcon} className="lg:col-span-4"
          right={<span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${biasBg(sc.label)}`}>{sc.label}</span>}>
          <div className="flex items-center gap-3 mb-2.5">
            <div className="relative w-14 h-14 shrink-0">
              <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" /><circle cx="18" cy="18" r="15" fill="none" stroke={sc.confidence > 66 ? '#34d399' : sc.confidence > 40 ? '#fbbf24' : '#f87171'} strokeWidth="3.5" strokeDasharray={`${sc.confidence / 100 * 94} 94`} strokeLinecap="round" /></svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-black tabular-nums">{sc.confidence}%</span>
            </div>
            <div className="flex-1 space-y-2">
              <PillarBar label="Makro" score={sc.macro} />
              <PillarBar label="Teknikal" score={sc.tech} />
              <PillarBar label="Sentimen" score={sc.senti} />
            </div>
          </div>
          <div className="flex items-start gap-1.5 pt-2 border-t border-white/5"><Target size={13} className="text-primary mt-0.5 shrink-0" /><p className="text-[11px] text-white/85 font-medium leading-snug">{action}</p></div>
        </Panel>

        <Panel title="Sentimen Naratif · Bloomberg / Reuters" icon={Newspaper} className="lg:col-span-4"
          right={<span className={`text-[10px] font-bold ${NARRATIVE_N > 0 ? 'text-emerald-400' : NARRATIVE_N < 0 ? 'text-red-400' : 'text-white/60'}`}>{NARRATIVE_N > 0 ? 'Bullish' : NARRATIVE_N < 0 ? 'Bearish' : 'Netral'} {narrativePct}%</span>}>
          <div className="h-1.5 rounded-full overflow-hidden bg-red-500/25 mb-2"><div className="h-full bg-emerald-400" style={{ width: `${narrativePct}%` }} /></div>
          <div className="space-y-1.5 overflow-hidden">
            {HEADLINES.slice(0, 4).map((h, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className={`text-[8px] font-bold uppercase rounded px-1 py-0.5 mt-0.5 shrink-0 ${h.src === 'Bloomberg' ? 'bg-orange-500/15 text-orange-300' : 'bg-blue-500/15 text-blue-300'}`}>{h.src === 'Bloomberg' ? 'BBG' : 'RTRS'}</span>
                <p className="text-[10px] text-white/65 leading-snug flex-1">{h.text}</p>
                <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${h.senti > 0 ? 'bg-emerald-400' : h.senti < 0 ? 'bg-red-400' : 'bg-white/30'}`} />
              </div>
            ))}
          </div>
        </Panel>

        {/* ── Row 2: 3 chart grid ── */}
        {TFS.map(tf => {
          const d = feed.tf[tf]
          return (
            <Panel key={tf} title={`XAU/USD · ${tf}`} icon={Activity} className="lg:col-span-4 h-[250px]"
              right={<div className="flex items-center gap-2"><span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${biasBg(d.bias.label)}`}>{d.bias.label}</span><span className="text-[9px] text-white/40">RSI {d.rsi.toFixed(0)}</span></div>}>
              <div className="flex-1 min-h-0"><CandleChart d={d} price={feed.price} up={feed.up} compact /></div>
            </Panel>
          )
        })}

        {/* ── Row 3: Cross-asset · Contrarian ── */}
        <Panel title="Parameter Lintas-Aset (korelasi ke emas)" icon={BarChart3} className="lg:col-span-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ASSET_META.map(m => <AssetCard key={m.key} meta={m} a={feed.assets[m.key]} />)}
          </div>
        </Panel>

        <Panel title="Retail vs Smart Money" icon={Users} className="lg:col-span-4" right={<span className="text-[9px] text-white/30">fade retail</span>}>
          <div className="flex justify-between text-[10px] mb-1"><span className="text-red-400 font-bold">{feed.retailLong.toFixed(0)}% Long</span><span className="text-emerald-400 font-bold">{(100 - feed.retailLong).toFixed(0)}% Short</span></div>
          <div className="h-2.5 rounded-full overflow-hidden bg-emerald-500/25 flex"><div className="bg-red-500/70 h-full" style={{ width: `${feed.retailLong}%` }} /></div>
          <div className="flex items-center justify-between mt-2.5">
            <p className="text-[10px] text-white/45 max-w-[55%] leading-snug">Retail ramai {feed.retailLong > 50 ? 'LONG' : 'SHORT'} → sinyal berlawanan</p>
            <div className="text-center"><p className="text-[9px] uppercase tracking-wider text-white/35">Kontrarian</p><p className={`text-base font-black leading-tight ${biasColor(feed.contrarian.label)}`}>{feed.contrarian.label}</p><p className="text-[9px] text-white/40">{feed.contrarian.strength}</p></div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-white/5 space-y-1 text-[10px]">
            <div className="flex justify-between"><span className="text-white/50 flex items-center gap-1"><Building2 size={10} /> COT Managed Money</span><span className="text-emerald-400 font-bold">Net Long</span></div>
            <div className="flex justify-between"><span className="text-white/50">Commercials</span><span className="text-red-400 font-bold">Net Short</span></div>
          </div>
        </Panel>

        {/* ── Row 4: Pivot · Volatilitas ── */}
        <Panel title="Pivot & Level Kunci" icon={Layers} className="lg:col-span-6">
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

        <Panel title="Volatilitas & Sesi" icon={Waves} className="lg:col-span-6">
          <div className="flex items-center justify-between mb-2">
            <div><p className="text-[10px] text-white/40">Kondisi (ATR M5)</p><p className={`text-lg font-black ${feed.vol.label === 'Tinggi' ? 'text-amber-400' : feed.vol.label === 'Rendah' ? 'text-white/50' : 'text-emerald-400'}`}>{feed.vol.label}</p></div>
            <span className="text-xs tabular-nums text-white/50">{(feed.vol.ratio * 100).toFixed(0)}%</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div className="flex justify-between"><span className="text-white/50">Sesi</span><span className="text-white/80 font-semibold">{feed.session}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Range</span><span className="tabular-nums text-white/80">${(feed.dayHigh - feed.dayLow).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Spread</span><span className={feed.spread > 0.45 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>{feed.spread > 0.45 ? 'Lebar' : 'Sehat'}</span></div>
            <div className="flex justify-between"><span className="text-white/50">ATR M15</span><span className="tabular-nums text-white/80">${feed.tf.M15.atr.toFixed(2)}</span></div>
          </div>
        </Panel>

        {/* ── Row 5: Kalender WIB ── */}
        <Panel title="Kalender Ekonomi (WIB)" icon={CalendarClock} className="lg:col-span-12"
          right={<span className="text-[10px] text-white/40 flex items-center gap-1"><Crosshair size={11} /> Berikutnya: US CPI <b className={`ml-1 ${cd.ms < 5 * 60000 ? 'text-red-400' : 'text-white'}`}>{cd.text}</b></span>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[11px] border-separate border-spacing-0">
              <thead><tr className="text-white/40">
                <th className="text-left font-semibold py-1.5 px-2">Waktu (WIB)</th><th className="text-left font-semibold py-1.5 px-2">Event</th>
                <th className="text-center font-semibold py-1.5 px-2">Dampak</th><th className="text-right font-semibold py-1.5 px-2">Forecast</th>
                <th className="text-right font-semibold py-1.5 px-2">Prev</th><th className="text-right font-semibold py-1.5 px-2">Hitung Mundur</th>
              </tr></thead>
              <tbody>
                {CAL.map((e, i) => {
                  const ms = e.at - now, past = ms < 0
                  const m = Math.floor(Math.abs(ms) / 60000), hh = Math.floor(m / 60), mm = m % 60
                  const cdText = past ? 'rilis' : hh > 0 ? `${hh}j ${mm}m` : `${mm}m`
                  const soon = ms > 0 && ms < 30 * 60000
                  return (
                    <tr key={i} className={i % 2 ? 'bg-white/[0.02]' : ''}>
                      <td className="py-1.5 px-2 tabular-nums text-white/70">{wib(e.at)}</td>
                      <td className="py-1.5 px-2 text-white/85 font-medium">{e.name}</td>
                      <td className="py-1.5 px-2 text-center"><span className={`text-[9px] font-bold uppercase rounded px-1.5 py-0.5 ${e.imp === 'High' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>{e.imp}</span></td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-white/70">{e.fc}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-white/50">{e.prev}</td>
                      <td className={`py-1.5 px-2 text-right tabular-nums font-semibold ${past ? 'text-white/30' : soon ? 'text-red-400' : 'text-white/70'}`}>{cdText}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <p className="text-center text-[10px] text-white/25 pb-6">Terminal XAUUSD · Fase 1 — angka masih SIMULASI (model faktor). Fase 2 disambung ke stream tick asli OANDA + feed makro.</p>
    </div>
  )
}
