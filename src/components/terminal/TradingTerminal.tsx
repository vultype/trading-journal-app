'use client'

/*
 * TERMINAL XAUUSD — 100% data real (tanpa simulasi)
 * - Harga & chart XAU/USD M5/M15/H1 + pivot harian: Twelve Data
 * - BTC/USD: Twelve Data
 * - Makro (Indeks Dolar, US10Y, Real Yield, CPI, Core CPI, Core PCE, Fed Funds): FRED
 * - Sentimen berita: Google News RSS → Claude AI (tombol Analisa AI)
 * Panel yang belum ada sumber real (VIX, indeks saham, retail/COT, kalender) DIHAPUS.
 * Semua skor turunan (signal meter, bias, momentum, pivot, volatilitas) dihitung dari data real.
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Activity, Gauge as GaugeIcon, Newspaper, Layers,
  Radio, ArrowLeft, Clock, Wifi, WifiOff, Landmark,
  Circle, Sparkles, Target, Waves, Crosshair, Compass, BarChart3,
  Loader2, RefreshCw,
} from 'lucide-react'

type TF = 'M5' | 'M15' | 'H1'
const TFS: TF[] = ['M5', 'M15', 'H1']

type Candle = { o: number; h: number; l: number; c: number; t: number; v: number }
type Bias = { label: 'LONG' | 'SHORT' | 'NETRAL'; score: number }
type TFData = { candles: Candle[]; ema9: number[]; ema21: number[]; vwapArr: number[]; rsi: number; atr: number; vwap: number; bias: Bias }
type Pivots = { P: number; R1: number; R2: number; S1: number; S2: number }
type MacroPoint = { key: string; value: number; prior: number; date: string }

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))

// ─────────────────────────── indikator ───────────────────────────
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

// ─────────────────────────── live hooks ───────────────────────────
function useClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  return now
}

type LiveXau = { price: number; changePct: number; dayHigh: number; dayLow: number; tf: Record<TF, TFData> }
function useLiveXauFeed() {
  const [data, setData] = useState<LiveXau | null>(null)
  const [status, setStatus] = useState<'loading' | 'live' | 'error'>('loading')
  const candlesRef = useRef<Partial<Record<TF, Candle[]>>>({})

  useEffect(() => {
    let stopped = false
    async function pollQuote() {
      try {
        const res = await fetch('/api/terminal/quote'); const j = await res.json()
        if (j.error) throw new Error(j.error)
        if (stopped) return
        setData(prev => prev ? { ...prev, price: j.price, changePct: j.changePct, dayHigh: Math.max(j.dayHigh, j.price), dayLow: Math.min(j.dayLow, j.price) } : prev)
        setStatus('live')
      } catch { if (!stopped) setStatus(candlesRef.current.M5 ? 'live' : 'error') }
    }
    async function pollCandles(tf: TF) {
      try {
        const res = await fetch(`/api/terminal/candles?tf=${tf}`); const arr = await res.json()
        if (stopped || !Array.isArray(arr) || !arr.length) return
        candlesRef.current[tf] = arr.map((c: { o: number; h: number; l: number; c: number; t: number }) => ({ ...c, v: 1 }))
        const { M5, M15, H1 } = candlesRef.current
        if (M5 && M15 && H1) {
          const last = M5[M5.length - 1]
          setData(prev => ({
            price: prev?.price ?? last.c, changePct: prev?.changePct ?? 0,
            dayHigh: prev?.dayHigh ?? last.c, dayLow: prev?.dayLow ?? last.c,
            tf: { M5: computeTF(M5), M15: computeTF(M15), H1: computeTF(H1) },
          }))
          setStatus('live')
        }
      } catch { /* pertahankan candle lama */ }
    }
    // Ambil hanya timeframe yang belum ada — biar tidak boros kredit saat retry.
    const fetchMissing = () => { for (const tf of TFS) if (!candlesRef.current[tf]) pollCandles(tf) }
    const complete = () => TFS.every(tf => candlesRef.current[tf])
    const hidden = () => typeof document !== 'undefined' && document.hidden
    pollCandles('M5'); pollCandles('M15'); pollCandles('H1'); pollQuote()
    const qId = setInterval(() => { if (!hidden()) pollQuote() }, 20_000)
    // Loop awal: terus coba timeframe yg gagal (rate-limit) sampai lengkap — tetap jalan walau hidden agar tab background akhirnya termuat; no-op setelah lengkap
    const ensureId = setInterval(() => { if (!complete()) fetchMissing() }, 15_000)
    // Refresh berkala semua candle tiap 3 menit (hanya kalau sudah lengkap & tab terlihat)
    const cId = setInterval(() => { if (complete() && !hidden()) { pollCandles('M5'); pollCandles('M15'); pollCandles('H1') } }, 180_000)
    const onVis = () => { if (!hidden()) pollQuote() }
    document.addEventListener('visibilitychange', onVis)
    return () => { stopped = true; clearInterval(qId); clearInterval(ensureId); clearInterval(cId); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  return { data, status }
}

function useCrossAsset() {
  const [btc, setBtc] = useState<{ price: number; changePct: number } | null>(null)
  useEffect(() => {
    let stopped = false
    const poll = async () => {
      try { const res = await fetch('/api/terminal/crossasset'); const j = await res.json(); if (!stopped && j['BTC/USD']) setBtc(j['BTC/USD']) } catch { /* keep */ }
    }
    poll()
    const id = setInterval(() => { if (typeof document === 'undefined' || !document.hidden) poll() }, 180_000)
    return () => { stopped = true; clearInterval(id) }
  }, [])
  return { btc }
}

function useMacro() {
  const [map, setMap] = useState<Record<string, MacroPoint> | null>(null)
  useEffect(() => {
    let stopped = false
    const poll = async () => {
      try {
        const res = await fetch('/api/terminal/macro'); const arr = await res.json()
        if (stopped || !Array.isArray(arr)) return
        const m: Record<string, MacroPoint> = {}
        for (const p of arr as MacroPoint[]) m[p.key] = p
        setMap(m)
      } catch { /* keep */ }
    }
    poll(); const id = setInterval(poll, 3600_000) // makro harian → 1 jam cukup
    return () => { stopped = true; clearInterval(id) }
  }, [])
  return map
}

function usePivots() {
  const [pivots, setPivots] = useState<Pivots | null>(null)
  useEffect(() => {
    let stopped = false
    const poll = async () => {
      try { const res = await fetch('/api/terminal/pivots'); const j = await res.json(); if (!stopped && j.P) setPivots(j) } catch { /* keep */ }
    }
    poll(); const id = setInterval(poll, 3600_000)
    return () => { stopped = true; clearInterval(id) }
  }, [])
  return pivots
}

type NewsAI = { verdict: 'Bullish' | 'Bearish' | 'Netral'; score: number; narrative: string; drivers: string[]; headlines: { text: string; source: string; sentiment: 'bull' | 'bear' | 'neutral' }[]; fetchedAt: string }
function useNewsAI() {
  const [data, setData] = useState<NewsAI | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const analyze = async () => {
    setLoading(true); setError(null)
    try { const res = await fetch('/api/terminal/news-ai'); const j = await res.json(); if (j.error) throw new Error(j.error); setData(j) }
    catch (e) { setError(e instanceof Error ? e.message : 'gagal menganalisa') } finally { setLoading(false) }
  }
  return { data, loading, error, analyze }
}

// ─────────────────────────── scoring ───────────────────────────
function scores(tf: Record<TF, TFData>, macro: Record<string, MacroPoint> | null, newsScore: number | null, btcChg: number | null) {
  const tech = clamp((tf.M5.bias.score + tf.M15.bias.score + tf.H1.bias.score) / 9, -1, 1) * 100
  const dir = (k: string) => { const p = macro?.[k]; return p ? Math.sign(p.value - p.prior) : 0 }
  const macroScore = clamp(-(dir('dollar') * 0.4 + dir('us10y') * 0.35 + dir('realyield') * 0.25), -1, 1) * 100
  const btcN = btcChg != null ? clamp(btcChg / 3, -1, 1) : 0
  const senti = newsScore != null ? clamp(newsScore / 100 * 0.75 + btcN * 0.25, -1, 1) * 100 : clamp(btcN * 0.5, -1, 1) * 100
  const overall = macroScore * 0.3 + tech * 0.45 + senti * 0.25
  const label: 'LONG' | 'SHORT' | 'NETRAL' = overall > 20 ? 'LONG' : overall < -20 ? 'SHORT' : 'NETRAL'
  const sgn = (x: number) => Math.sign(Math.round(x))
  const agree = new Set([sgn(macroScore), sgn(tech), sgn(senti)]).size === 1 ? 3 : (sgn(macroScore) === sgn(tech) || sgn(tech) === sgn(senti) || sgn(macroScore) === sgn(senti)) ? 2 : 1
  const mag = (Math.abs(macroScore) + Math.abs(tech) + Math.abs(senti)) / 3
  const confidence = Math.round(clamp((agree / 3) * 0.6 + (mag / 100) * 0.4, 0, 1) * 100)
  return { macro: macroScore, tech, senti, overall, label, confidence }
}
function confluence(tf: Record<TF, TFData>) {
  const labels = TFS.map(t => tf[t].bias.label)
  const longs = labels.filter(l => l === 'LONG').length, shorts = labels.filter(l => l === 'SHORT').length
  let label: 'LONG' | 'SHORT' | 'NETRAL' = 'NETRAL', strength: 'campur' | 'sedang' | 'kuat' = 'campur'
  if (longs === 3) { label = 'LONG'; strength = 'kuat' } else if (shorts === 3) { label = 'SHORT'; strength = 'kuat' }
  else if (longs === 2 && shorts === 0) { label = 'LONG'; strength = 'sedang' } else if (shorts === 2 && longs === 0) { label = 'SHORT'; strength = 'sedang' }
  return { label, strength, longs, shorts }
}

// ─────────────────────────── helpers UI ───────────────────────────
const f2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const biasColor = (l: string) => l === 'LONG' ? 'text-emerald-400' : l === 'SHORT' ? 'text-red-400' : 'text-white/60'
const biasBg = (l: string) => l === 'LONG' ? 'bg-emerald-500/15 text-emerald-400' : l === 'SHORT' ? 'bg-red-500/15 text-red-400' : 'bg-white/10 text-white/60'

function Panel({ title, icon: Icon, right, children, className = '' }: { title: string; icon: React.ElementType; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.06] bg-[#0b100e] p-3.5 flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40"><Icon size={12} /> {title}</span>
        {right}
      </div>
      {children}
    </div>
  )
}
function Spark({ data, color = '#34d399' }: { data: number[]; color?: string }) {
  if (data.length < 2) return <div className="h-6" />
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / range) * 30}`).join(' ')
  return <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-6"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg>
}

function meterZone(score: number) {
  if (score <= -60) return { name: 'Strong Sell', color: '#ef4444', idx: 0 }
  if (score < -20) return { name: 'Sell', color: '#f87171', idx: 1 }
  if (score < 20) return { name: 'Neutral', color: '#9ca3af', idx: 2 }
  if (score < 60) return { name: 'Buy', color: '#34d399', idx: 3 }
  return { name: 'Strong Buy', color: '#10b981', idx: 4 }
}
function Gauge({ score }: { score: number }) {
  const cx = 120, cy = 118, r = 84
  const polar = (rr: number, deg: number) => { const a = deg * Math.PI / 180; return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)] as const }
  const seg = (a0: number, a1: number) => { let pts = ''; for (let i = 0; i <= 16; i++) { const a = a0 + (a1 - a0) * i / 16; const [x, y] = polar(r, a); pts += `${x.toFixed(1)},${y.toFixed(1)} ` } return pts.trim() }
  const zones = [{ a0: 180, a1: 146, color: '#ef4444' }, { a0: 144, a1: 110, color: '#f87171' }, { a0: 108, a1: 72, color: '#9ca3af' }, { a0: 70, a1: 36, color: '#34d399' }, { a0: 34, a1: 0, color: '#10b981' }]
  const active = meterZone(score).idx
  const frac = (clamp(score, -100, 100) + 100) / 200
  const [nx, ny] = polar(r - 10, 180 - frac * 180)
  const col = score > 20 ? '#34d399' : score < -20 ? '#f87171' : '#fbbf24'
  const labels = [{ t: 'Strong sell', x: 6, y: 114, anc: 'start', idx: 0 }, { t: 'Sell', x: 44, y: 42, anc: 'middle', idx: 1 }, { t: 'Neutral', x: 120, y: 20, anc: 'middle', idx: 2 }, { t: 'Buy', x: 196, y: 42, anc: 'middle', idx: 3 }, { t: 'Strong buy', x: 234, y: 114, anc: 'end', idx: 4 }]
  return (
    <svg viewBox="0 0 240 130" className="w-full">
      {zones.map((z, i) => <polyline key={i} points={seg(z.a0, z.a1)} fill="none" stroke={z.color} strokeWidth={i === active ? 7 : 5} strokeLinecap="round" opacity={i === active ? 1 : 0.2} />)}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={4.5} fill="#fff" />
      {labels.map(l => <text key={l.t} x={l.x} y={l.y} textAnchor={l.anc as 'start' | 'middle' | 'end'} fontSize="8.5" fontWeight={l.idx === active ? 700 : 500} fill={l.idx === active ? zones[l.idx].color : 'rgba(255,255,255,0.32)'}>{l.t}</text>)}
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
function CandleChart({ d, price, up }: { d: TFData; price: number; up: boolean }) {
  const W = 900, H = 220, padR = 52, padB = 6, padT = 8
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

// Kartu makro/lintas-aset dari data real
type CardMeta = { name: string; sub: string; dec: number; unit?: string; prefix?: string; corr: number; src: string }
function DataCard({ meta, value, prior, changePct, spark }: { meta: CardMeta; value: number | null; prior?: number | null; changePct?: number | null; spark?: number[] }) {
  if (value == null) return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5 flex flex-col justify-center items-center min-h-[76px]"><Loader2 size={14} className="animate-spin text-white/30" /><span className="text-[9px] text-white/30 mt-1">{meta.name}</span></div>
  )
  const chg = changePct != null ? changePct : (prior != null && prior !== 0 ? ((value - prior) / prior) * 100 : 0)
  const impact = Math.sign(chg) * meta.corr
  const imp = impact > 0.02 ? { t: 'Bullish', c: 'text-emerald-400 bg-emerald-500/10' } : impact < -0.02 ? { t: 'Bearish', c: 'text-red-400 bg-red-500/10' } : { t: 'Netral', c: 'text-white/50 bg-white/5' }
  const up = chg >= 0
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
      <div className="flex items-center justify-between gap-1"><span className="text-xs font-bold text-white/85 flex items-center gap-1">{meta.name}<span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title={`Live · ${meta.src}`} /></span><span className={`text-[8px] font-bold uppercase rounded px-1 py-0.5 shrink-0 ${imp.c}`}>{imp.t}</span></div>
      <div className="text-[9px] text-white/35 mb-1">{meta.sub}</div>
      <div className="flex items-end justify-between">
        <span className="text-sm font-black tabular-nums">{meta.prefix ?? ''}{value.toLocaleString('en-US', { minimumFractionDigits: meta.dec, maximumFractionDigits: meta.dec })}{meta.unit ?? ''}</span>
        <span className={`text-[10px] font-bold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>{up ? '+' : ''}{chg.toFixed(2)}%</span>
      </div>
      {spark ? <Spark data={spark} color={up ? '#34d399' : '#f87171'} /> : <p className="text-[8px] text-white/25 mt-1">{prior != null ? `sebelumnya ${meta.prefix ?? ''}${prior.toFixed(meta.dec)}${meta.unit ?? ''}` : ''}</p>}
    </div>
  )
}

const CROSS_META: Record<string, CardMeta> = {
  dollar: { name: 'Indeks Dolar', sub: 'Broad USD Index · FRED', dec: 2, corr: -1, src: 'FRED' },
  us10y: { name: 'US10Y', sub: 'Yield Treasury 10 Thn · FRED', dec: 2, unit: '%', corr: -1, src: 'FRED' },
  btc: { name: 'Bitcoin', sub: 'Kripto (debasement) · TD', dec: 0, prefix: '$', corr: 0.4, src: 'Twelve Data' },
}
const MACRO_META: { key: string; meta: CardMeta }[] = [
  { key: 'cpi', meta: { name: 'CPI (YoY)', sub: 'Inflasi headline AS · FRED', dec: 1, unit: '%', corr: -1, src: 'FRED' } },
  { key: 'corecpi', meta: { name: 'Core CPI (YoY)', sub: 'Inflasi inti (ex food/energy)', dec: 1, unit: '%', corr: -1, src: 'FRED' } },
  { key: 'corepce', meta: { name: 'Core PCE (YoY)', sub: 'Gauge favorit The Fed', dec: 1, unit: '%', corr: -1, src: 'FRED' } },
  { key: 'fedfunds', meta: { name: 'Fed Funds Rate', sub: 'Suku bunga acuan', dec: 2, unit: '%', corr: -1, src: 'FRED' } },
  { key: 'realyield', meta: { name: 'Real Yield 10Y', sub: 'TIPS — turun = bullish emas', dec: 2, unit: '%', corr: -1, src: 'FRED' } },
]

// ─────────────────────────── PAGE ───────────────────────────
export function TradingTerminal() {
  const now = useClock()
  const live = useLiveXauFeed()
  const cross = useCrossAsset()
  const macro = useMacro()
  const pivotsLive = usePivots()
  const news = useNewsAI()

  const clock = useMemo(() => new Date(now).toLocaleTimeString('id-ID'), [now])
  const h = new Date(now).getUTCHours()
  const session = h >= 12 && h < 16 ? 'London × New York' : h >= 7 && h < 12 ? 'London' : h >= 16 && h < 21 ? 'New York' : 'Asia'

  if (!live.data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#060a09] text-white/50 gap-3">
        {live.status === 'error' ? <WifiOff className="text-red-400" /> : <Radio className="animate-pulse text-primary" />}
        <p className="text-sm">{live.status === 'error' ? 'Data Twelve Data belum tersedia (limit 8/menit) — mencoba lagi…' : 'Menghubungkan data pasar…'}</p>
      </div>
    )
  }

  const feed = live.data
  const up = feed.changePct >= 0
  const sc = scores(feed.tf, macro, news.data?.score ?? null, cross.btc?.changePct ?? null)
  const conf = confluence(feed.tf)
  const dir = sc.label
  const atr = feed.tf.M15.atr
  const sltp = dir === 'LONG' ? { sl: feed.price - 1.5 * atr, tp1: feed.price + 1.5 * atr, tp2: feed.price + 3 * atr }
    : dir === 'SHORT' ? { sl: feed.price + 1.5 * atr, tp1: feed.price - 1.5 * atr, tp2: feed.price - 3 * atr } : null

  // volatilitas dari ATR M5 (real): ATR pendek vs baseline panjang
  const m5 = feed.tf.M5.candles
  const atrNow = atrLast(m5, 7), atrBase = atrLast(m5, Math.min(40, m5.length - 1)) || atrNow
  const volRatio = atrBase ? atrNow / atrBase : 1
  const volLabel = volRatio < 0.75 ? 'Rendah' : volRatio > 1.4 ? 'Tinggi' : 'Normal'

  let action: string
  if (sc.confidence < 40) action = 'Sinyal lemah/campur — tunggu konfirmasi arah.'
  else if (dir === 'LONG') action = 'Bias LONG — cari pullback ke VWAP/EMA21 untuk entry.'
  else if (dir === 'SHORT') action = 'Bias SHORT — cari retest ke VWAP/EMA21 untuk entry.'
  else action = 'Netral — tunggu arah dominan.'

  const pivots = pivotsLive
  const levels = pivots ? [
    { label: 'R2', v: pivots.R2, k: 'res' }, { label: 'R1', v: pivots.R1, k: 'res' },
    { label: 'Pivot', v: pivots.P, k: 'piv' }, { label: 'VWAP', v: feed.tf.M15.vwap, k: 'vwap' },
    { label: 'S1', v: pivots.S1, k: 'sup' }, { label: 'S2', v: pivots.S2, k: 'sup' },
  ].map(l => ({ ...l, dist: feed.price - l.v })).sort((a, b) => b.v - a.v) : []

  return (
    <div className="min-h-screen bg-[#060a09] text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-[#060a09]/95 backdrop-blur border-b border-white/8">
        <div className="px-4 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-white/50 hover:text-white shrink-0"><ArrowLeft size={18} /></Link>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-black tracking-tight">XAU/USD</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 ${live.status === 'live' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{live.status === 'live' ? 'Data Real · Twelve Data' : 'Menyegarkan…'}</span>
          </div>
          <div className="flex items-baseline gap-2"><span className={`text-2xl font-black tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>{f2(feed.price)}</span><span className={`text-xs font-bold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>{up ? '+' : ''}{feed.changePct.toFixed(2)}%</span></div>
          <div className="hidden md:flex items-center gap-4 text-[11px] text-white/50 tabular-nums">
            <span>H <b className="text-emerald-400/80">{f2(feed.dayHigh)}</b></span><span>L <b className="text-red-400/80">{f2(feed.dayLow)}</b></span>
            <span>ATR M15 <b className="text-white/80">${feed.tf.M15.atr.toFixed(2)}</b></span>
          </div>
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <span className="hidden lg:flex items-center gap-1.5 text-[11px] text-white/50"><Circle size={7} className="fill-primary text-primary" /> {session}</span>
            <span className={`flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 ${volLabel === 'Rendah' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
              <Circle size={8} className={`${volLabel === 'Rendah' ? 'fill-amber-400 text-amber-400' : 'fill-emerald-400 text-emerald-400'}`} /> Volatilitas {volLabel}
            </span>
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-white/40"><Clock size={11} /> {clock}</span>
            <span className={`flex items-center gap-1 text-[10px] ${live.status === 'live' ? 'text-emerald-400' : 'text-amber-400'}`}>{live.status === 'live' ? <Wifi size={12} /> : <RefreshCw size={11} className="animate-spin" />} live</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 p-2.5">
        {/* ── Row 1: Signal Meter · Bias & Confidence · News AI ── */}
        <Panel title="Signal Meter · XAU/USD" icon={Compass} className="lg:col-span-4">
          <p className="text-[10px] text-white/35 -mt-1.5 mb-1">Rangkuman makro · teknikal · sentimen (semua real)</p>
          <div className="flex flex-col items-center">
            <div className="w-[210px] max-w-full"><Gauge score={sc.overall} /></div>
            <p className="text-lg font-black -mt-2 leading-none" style={{ color: meterZone(sc.overall).color }}>{meterZone(sc.overall).name}</p>
            <p className="text-[10px] text-white/35 mt-1 tabular-nums">Skor {sc.overall > 0 ? '+' : ''}{Math.round(sc.overall)} · Confidence {sc.confidence}%</p>
          </div>
          {sltp ? (
            <div className="grid grid-cols-3 gap-1.5 mt-2.5 text-center">
              <div className="rounded-xl bg-red-500/8 py-1.5"><p className="text-[9px] uppercase tracking-wider text-white/35">SL</p><p className="text-[11px] font-bold text-red-400 tabular-nums">{f2(sltp.sl)}</p></div>
              <div className="rounded-xl bg-emerald-500/8 py-1.5"><p className="text-[9px] uppercase tracking-wider text-white/35">TP1</p><p className="text-[11px] font-bold text-emerald-400 tabular-nums">{f2(sltp.tp1)}</p></div>
              <div className="rounded-xl bg-emerald-500/8 py-1.5"><p className="text-[9px] uppercase tracking-wider text-white/35">TP2</p><p className="text-[11px] font-bold text-emerald-400 tabular-nums">{f2(sltp.tp2)}</p></div>
            </div>
          ) : <p className="text-[10px] text-white/35 text-center mt-2">Bias netral — belum ada saran arah.</p>}
        </Panel>

        <Panel title="Bias & Confidence" icon={GaugeIcon} className="lg:col-span-4"
          right={<span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${biasBg(sc.label)}`}>{sc.label}</span>}>
          <div className="flex items-center gap-3 mb-2.5">
            <div className="relative w-14 h-14 shrink-0">
              <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" /><circle cx="18" cy="18" r="15" fill="none" stroke={sc.confidence > 66 ? '#34d399' : sc.confidence > 40 ? '#fbbf24' : '#f87171'} strokeWidth="3.5" strokeDasharray={`${sc.confidence / 100 * 94} 94`} strokeLinecap="round" /></svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-black tabular-nums">{sc.confidence}%</span>
            </div>
            <div className="flex-1 space-y-2">
              <PillarBar label="Makro (FRED)" score={sc.macro} />
              <PillarBar label="Teknikal" score={sc.tech} />
              <PillarBar label="Sentimen" score={sc.senti} />
            </div>
          </div>
          <div className="flex items-start gap-1.5 pt-2 border-t border-white/5"><Target size={13} className="text-primary mt-0.5 shrink-0" /><p className="text-[11px] text-white/85 font-medium leading-snug">{action}</p></div>
          {!news.data && <p className="text-[9px] text-white/25 mt-1.5">Pilar sentimen menguat setelah klik "Analisa AI" pada panel berita.</p>}
        </Panel>

        <Panel title="Sentimen Berita · Analisa AI" icon={Newspaper} className="lg:col-span-4"
          right={news.data
            ? <button onClick={news.analyze} disabled={news.loading} className="flex items-center gap-1 text-[9px] text-white/40 hover:text-white/70 disabled:opacity-40"><RefreshCw size={10} className={news.loading ? 'animate-spin' : ''} /> Perbarui</button>
            : <span className="text-[9px] text-white/30">on-demand</span>}>
          {!news.data && !news.loading && !news.error && (
            <div className="flex flex-col items-center justify-center flex-1 py-4 text-center gap-2">
              <p className="text-[11px] text-white/45 leading-snug max-w-[85%]">Analisa sentimen headline emas/dolar/Fed dari berita real, diolah Claude AI.</p>
              <button onClick={news.analyze} className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg px-3.5 py-2 hover:opacity-90 transition-opacity"><Sparkles size={13} /> Analisa AI</button>
            </div>
          )}
          {news.loading && (<div className="flex flex-col items-center justify-center flex-1 py-6 gap-2 text-white/50"><Loader2 size={20} className="animate-spin text-primary" /><p className="text-[10px]">Membaca berita & menganalisa…</p></div>)}
          {news.error && !news.loading && (<div className="flex flex-col items-center justify-center flex-1 py-4 gap-2 text-center"><p className="text-[10px] text-red-400">Gagal: {news.error}</p><button onClick={news.analyze} className="text-[10px] font-semibold text-primary hover:underline">Coba lagi</button></div>)}
          {news.data && !news.loading && (() => {
            const nd = news.data; const pct = Math.round((nd.score + 100) / 2)
            const vc = nd.verdict === 'Bullish' ? 'text-emerald-400' : nd.verdict === 'Bearish' ? 'text-red-400' : 'text-white/60'
            return (
              <div className="flex flex-col gap-2 overflow-hidden">
                <div className="flex items-center justify-between"><span className={`text-sm font-black ${vc}`}>{nd.verdict}</span><span className="text-[10px] text-white/40 tabular-nums">skor {nd.score > 0 ? '+' : ''}{nd.score}</span></div>
                <div className="h-1.5 rounded-full overflow-hidden bg-red-500/25"><div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} /></div>
                <p className="text-[10px] text-white/70 leading-snug">{nd.narrative}</p>
                {nd.drivers.length > 0 && <div className="flex flex-wrap gap-1">{nd.drivers.map((d, i) => <span key={i} className="text-[9px] bg-white/5 text-white/55 rounded px-1.5 py-0.5">{d}</span>)}</div>}
                <div className="space-y-1 pt-1 border-t border-white/5 overflow-hidden">
                  {nd.headlines.slice(0, 4).map((hl, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-[8px] font-bold uppercase rounded px-1 py-0.5 mt-0.5 shrink-0 bg-white/8 text-white/50">{hl.source.slice(0, 10)}</span>
                      <p className="text-[10px] text-white/60 leading-snug flex-1">{hl.text}</p>
                      <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${hl.sentiment === 'bull' ? 'bg-emerald-400' : hl.sentiment === 'bear' ? 'bg-red-400' : 'bg-white/30'}`} />
                    </div>
                  ))}
                </div>
                <p className="text-[8px] text-white/25 text-right">Sumber: Google News · diolah Claude AI</p>
              </div>
            )
          })()}
        </Panel>

        {/* ── Row 2: 3 chart grid ── */}
        {TFS.map(tf => {
          const d = feed.tf[tf]
          return (
            <Panel key={tf} title={`XAU/USD · ${tf}`} icon={Activity} className="lg:col-span-4 h-[250px]"
              right={<div className="flex items-center gap-2"><span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${biasBg(d.bias.label)}`}>{d.bias.label}</span><span className="text-[9px] text-white/40">RSI {d.rsi.toFixed(0)}</span></div>}>
              <div className="flex-1 min-h-0"><CandleChart d={d} price={feed.price} up={up} /></div>
            </Panel>
          )
        })}

        {/* ── Row 3: Konfluensi MTF · Cross-asset ── */}
        <Panel title="Konfluensi Multi-Timeframe" icon={Crosshair} className="lg:col-span-4"
          right={<span className={`text-[10px] font-bold ${biasColor(conf.label)}`}>{conf.label === 'NETRAL' ? 'CAMPUR' : conf.label} · {conf.strength}</span>}>
          <div className="space-y-2">
            {TFS.map(x => {
              const b = feed.tf[x].bias
              return (
                <div key={x} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold w-8 text-white/60">{x}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden"><div className={`h-full ${b.label === 'LONG' ? 'bg-emerald-400' : b.label === 'SHORT' ? 'bg-red-400' : 'bg-white/25'}`} style={{ width: `${33 + Math.abs(b.score) * 22}%` }} /></div>
                  <span className={`text-[10px] font-bold w-14 text-right ${biasColor(b.label)}`}>{b.label}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[9px] text-white/30 mt-2 pt-2 border-t border-white/5">Entry paling aman searah TF besar (H1).</p>
        </Panel>

        <Panel title="Lintas-Aset (korelasi ke emas)" icon={BarChart3} className="lg:col-span-8" right={<span className="text-[9px] text-white/30">semua data real</span>}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <DataCard meta={CROSS_META.dollar} value={macro?.dollar?.value ?? null} prior={macro?.dollar?.prior} />
            <DataCard meta={CROSS_META.us10y} value={macro?.us10y?.value ?? null} prior={macro?.us10y?.prior} />
            <DataCard meta={CROSS_META.btc} value={cross.btc?.price ?? null} changePct={cross.btc?.changePct} />
          </div>
        </Panel>

        {/* ── Row 4: Inflasi & Kebijakan (FRED) ── */}
        <Panel title="Inflasi & Kebijakan The Fed" icon={Landmark} className="lg:col-span-12"
          right={<span className="text-[9px] text-white/30">FRED · rilis bulanan/harian · konteks kebijakan</span>}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {MACRO_META.map(({ key, meta }) => <DataCard key={key} meta={meta} value={macro?.[key]?.value ?? null} prior={macro?.[key]?.prior} />)}
          </div>
        </Panel>

        {/* ── Row 5: Pivot & Volatilitas ── */}
        <Panel title="Pivot & Level Kunci" icon={Layers} className="lg:col-span-6" right={<span className="text-[9px] text-white/30">pivot harian real (TD)</span>}>
          {levels.length ? (
            <div className="space-y-1">
              {levels.map(l => (
                <div key={l.label} className="flex items-center justify-between text-[11px]">
                  <span className={`font-semibold w-12 ${l.k === 'res' ? 'text-red-400/80' : l.k === 'sup' ? 'text-emerald-400/80' : l.k === 'vwap' ? 'text-amber-400/80' : 'text-white/70'}`}>{l.label}</span>
                  <span className="tabular-nums text-white/80 flex-1 text-center">{f2(l.v)}</span>
                  <span className={`tabular-nums text-[10px] w-16 text-right ${Math.abs(l.dist) < 1.5 ? 'text-amber-400 font-bold' : 'text-white/35'}`}>{l.dist >= 0 ? '+' : ''}{l.dist.toFixed(1)}</span>
                </div>
              ))}
            </div>
          ) : <div className="flex items-center justify-center py-6 text-white/30 text-[11px] gap-2"><Loader2 size={14} className="animate-spin" /> memuat pivot…</div>}
          <p className="text-[9px] text-white/30 mt-2 pt-2 border-t border-white/5">Pivot dari OHLC kemarin. Angka kanan = jarak harga ke level.</p>
        </Panel>

        <Panel title="Momentum & Volatilitas" icon={Waves} className="lg:col-span-6">
          <div className="grid grid-cols-3 gap-2 mb-2.5 text-center">
            <div className="rounded-lg bg-white/[0.03] py-2"><p className="text-[9px] uppercase tracking-wider text-white/35">Bias M5</p><p className={`text-sm font-black ${biasColor(feed.tf.M5.bias.label)}`}>{feed.tf.M5.bias.label}</p></div>
            <div className="rounded-lg bg-white/[0.03] py-2"><p className="text-[9px] uppercase tracking-wider text-white/35">RSI M5</p><p className={`text-sm font-bold tabular-nums ${feed.tf.M5.rsi > 70 ? 'text-red-400' : feed.tf.M5.rsi < 30 ? 'text-emerald-400' : 'text-white/80'}`}>{feed.tf.M5.rsi.toFixed(0)}</p></div>
            <div className="rounded-lg bg-white/[0.03] py-2"><p className="text-[9px] uppercase tracking-wider text-white/35">Volatilitas</p><p className={`text-sm font-black ${volLabel === 'Tinggi' ? 'text-amber-400' : volLabel === 'Rendah' ? 'text-white/50' : 'text-emerald-400'}`}>{volLabel}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div className="flex justify-between"><span className="text-white/50">Sesi aktif</span><span className="text-white/80 font-semibold">{session}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Range hari ini</span><span className="tabular-nums text-white/80">${(feed.dayHigh - feed.dayLow).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-white/50">ATR M5</span><span className="tabular-nums text-white/80">${feed.tf.M5.atr.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-white/50">vs VWAP M15</span><span className={`tabular-nums font-bold ${feed.price > feed.tf.M15.vwap ? 'text-emerald-400' : 'text-red-400'}`}>{feed.price > feed.tf.M15.vwap ? '+' : ''}{(feed.price - feed.tf.M15.vwap).toFixed(1)}</span></div>
          </div>
        </Panel>
      </div>

      <p className="text-center text-[10px] text-white/25 pb-6">Terminal XAUUSD · 100% data real — Twelve Data (harga/chart/pivot/BTC) + FRED (makro) + Claude AI (sentimen berita). Harga free tier update ~20 dtk, makro rilis harian/bulanan.</p>
    </div>
  )
}
