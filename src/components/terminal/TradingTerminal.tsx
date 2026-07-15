'use client'

/*
 * TERMINAL XAUUSD — 100% data real, dashboard bertab.
 * Tab: Ringkasan · Teknikal · Makro · Sentimen · Panduan.
 * Sumber: Twelve Data (harga/candle/pivot/lintas-aset), FRED (makro), CFTC (COT), Datalitiq AI (analisa).
 * Istilah arah: Bullish (naik) / Bearish (turun).
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Activity, Gauge as GaugeIcon, Newspaper, Layers, Radio, ArrowLeft, Clock, Wifi, WifiOff,
  Landmark, Circle, Sparkles, Target, Waves, Crosshair, Compass, BarChart3, Loader2, RefreshCw,
  Info, Users, CalendarClock, Lightbulb, Brain, ExternalLink, ShieldAlert, Eye,
  LayoutDashboard, BookOpen, Maximize2, X, Flame, TrendingUp, TrendingDown, CheckCircle2, MinusCircle,
  Zap, Scale, GitBranch, Signal, ArrowUpDown, Coins, Server,
} from 'lucide-react'
import { TradingViewChart } from './TradingViewChart'
import { AiLoading } from './AiLoading'
import { TerminalAiPanel } from './TerminalAiPanel'
import { TerminalScopeAnalysis } from './TerminalScopeAnalysis'
import { TerminalNewsAnalysis } from './TerminalNewsAnalysis'
import { type Macd, type Boll, type Stoch, type Structure } from '@/lib/indicators'
import {
  TFS, clamp, atrLast, adxLabel, computeTF, riskOnScore, scores, confluence, regimeOf, usMarketOpen,
  type TF, type Dir, type Candle, type Bias, type ReversalDir, type Reversal, type TFData, type CrossQuote,
} from '@/lib/terminal-signal'

type HTF = 'H4' | 'D1'            // timeframe besar (bias harian/swing)
const HTFS: HTF[] = ['H4', 'D1']
type Pivots = { P: number; R1: number; R2: number; S1: number; S2: number }
type MacroPoint = { key: string; value: number; prior: number; date: string }
type CotGroup = { long: number; short: number; net: number; deltaNet: number }
type Cot = { date: string; funds: CotGroup; commercials: CotGroup; retail: CotGroup; fundsHistory: number[]; retailHistory: number[] }
// Indikator, regime, confidence & risk-on dari @/lib/terminal-signal (dipakai bersama cron notifikasi).

// ─────────────────────────── hooks (data real) ───────────────────────────
function useClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  return now
}
type LiveXau = { price: number; changePct: number; dayHigh: number; dayLow: number; tf: Record<TF, TFData>; htf: Partial<Record<HTF, TFData>>; lastCandleT: number }
// #2 High/Low harian & changePct diturunkan dari CANDLE sendiri (D1 berjalan + close kemarin),
// bukan field quote Twelve Data yang untuk XAU/USD sering kosong/degenerate.
function deriveDay(cRef: Partial<Record<TF | HTF, Candle[]>>, price: number): { dayHigh: number; dayLow: number; changePct: number } {
  const d1 = cRef.D1
  let dayHigh = price, dayLow = price, prevClose = 0
  if (d1 && d1.length >= 2) {
    const today = d1[d1.length - 1], prev = d1[d1.length - 2]
    dayHigh = today.h; dayLow = today.l; prevClose = prev.c
  } else if (cRef.M5 && cRef.M5.length) {
    const dayMs = 86_400_000, anchor = Math.floor(Date.now() / dayMs) * dayMs
    const today = cRef.M5.filter(c => c.t >= anchor)
    if (today.length) { dayHigh = Math.max(...today.map(c => c.h)); dayLow = Math.min(...today.map(c => c.l)) }
    prevClose = cRef.M5[0].c
  }
  dayHigh = Math.max(dayHigh, price); dayLow = Math.min(dayLow, price)
  const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
  return { dayHigh, dayLow, changePct }
}
function useLiveXauFeed() {
  const [data, setData] = useState<LiveXau | null>(null)
  const [status, setStatus] = useState<'loading' | 'live' | 'error'>('loading')
  const [quoteAt, setQuoteAt] = useState<number | null>(null)
  const [candlesAt, setCandlesAt] = useState<number | null>(null)
  const [htfAt, setHtfAt] = useState<number | null>(null)
  const candlesRef = useRef<Partial<Record<TF | HTF, Candle[]>>>({})
  useEffect(() => {
    let stopped = false
    async function pollQuote() {
      try { const j = await (await fetch('/api/terminal/quote')).json(); if (j.error) throw new Error(j.error); if (stopped) return
        setData(prev => prev ? { ...prev, price: j.price, ...deriveDay(candlesRef.current, j.price) } : prev); setStatus('live'); setQuoteAt(Date.now())
      } catch { if (!stopped) setStatus(candlesRef.current.M5 ? 'live' : 'error') }
    }
    function rebuild() {
      const c = candlesRef.current
      if (!(c.M5 && c.M15 && c.H1)) return
      const M5 = c.M5
      const htf: Partial<Record<HTF, TFData>> = {}
      for (const t of HTFS) if (c[t]) htf[t] = computeTF(c[t]!)
      setData(prev => {
        const price = prev?.price ?? M5[M5.length - 1].c
        return { price, ...deriveDay(c, price), tf: { M5: computeTF(M5), M15: computeTF(c.M15!), H1: computeTF(c.H1!) }, htf, lastCandleT: M5[M5.length - 1].t }
      })
      setStatus('live')
    }
    async function pollCandles(tf: TF | HTF) {
      try { const arr = await (await fetch(`/api/terminal/candles?tf=${tf}`)).json(); if (stopped || !Array.isArray(arr) || !arr.length) return
        candlesRef.current[tf] = arr.map((c: { o: number; h: number; l: number; c: number; t: number }) => ({ ...c, v: 1 }))
        rebuild()
        if (TFS.includes(tf as TF)) setCandlesAt(Date.now()); else setHtfAt(Date.now())
      } catch { }
    }
    const hidden = () => typeof document !== 'undefined' && document.hidden
    const missing = () => { for (const tf of [...TFS, ...HTFS]) if (!candlesRef.current[tf]) pollCandles(tf) }
    const complete = () => TFS.every(tf => candlesRef.current[tf])
    TFS.forEach(pollCandles); HTFS.forEach(pollCandles); pollQuote()
    const qId = setInterval(() => { if (!hidden()) pollQuote() }, 8_000)
    const eId = setInterval(() => { if (!complete()) missing() }, 10_000)
    const cId = setInterval(() => { if (complete() && !hidden()) TFS.forEach(pollCandles) }, 60_000)
    const hId = setInterval(() => { if (!hidden()) HTFS.forEach(pollCandles) }, 300_000)
    const onVis = () => { if (!hidden()) pollQuote() }
    document.addEventListener('visibilitychange', onVis)
    return () => { stopped = true; clearInterval(qId); clearInterval(eId); clearInterval(cId); clearInterval(hId); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  return { data, status, quoteAt, candlesAt, htfAt }
}
function useCrossAsset() {
  const [map, setMap] = useState<Record<string, CrossQuote> | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  useEffect(() => {
    let stopped = false
    const poll = async () => { try { const j = await (await fetch('/api/terminal/crossasset')).json(); if (!stopped && j['BTC/USD']) { setMap(j); setUpdatedAt(Date.now()) } } catch { } }
    poll(); const id = setInterval(() => { if (typeof document === 'undefined' || !document.hidden) poll() }, 45_000)
    return () => { stopped = true; clearInterval(id) }
  }, [])
  return { btc: map?.['BTC/USD'] ?? null, spy: map?.SPY ?? null, qqq: map?.QQQ ?? null, vixy: map?.VIXY ?? null, uup: map?.UUP ?? null, xag: map?.['XAG/USD'] ?? null, updatedAt }
}
function useMacro() {
  const [map, setMap] = useState<Record<string, MacroPoint> | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  useEffect(() => { let s = false; const poll = async () => { try { const arr = await (await fetch('/api/terminal/macro')).json(); if (s || !Array.isArray(arr)) return; const m: Record<string, MacroPoint> = {}; for (const p of arr as MacroPoint[]) m[p.key] = p; setMap(m); setUpdatedAt(Date.now()) } catch { } }; poll(); const id = setInterval(poll, 3600_000); return () => { s = true; clearInterval(id) } }, [])
  return { map, updatedAt }
}
function usePivots() {
  const [p, setP] = useState<Pivots | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  useEffect(() => { let s = false; const poll = async () => { try { const j = await (await fetch('/api/terminal/pivots')).json(); if (!s && j.P) { setP(j); setUpdatedAt(Date.now()) } } catch { } }; poll(); const id = setInterval(poll, 3600_000); return () => { s = true; clearInterval(id) } }, [])
  return { p, updatedAt }
}
function useCot() {
  const [cot, setCot] = useState<Cot | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  useEffect(() => { let s = false; const poll = async () => { try { const j = await (await fetch('/api/terminal/cot')).json(); if (!s && j.date) { setCot(j); setUpdatedAt(Date.now()) } } catch { } }; poll(); const id = setInterval(poll, 6 * 3600_000); return () => { s = true; clearInterval(id) } }, [])
  return { cot, updatedAt }
}
type AiAnalysis = {
  verdict: 'Bullish' | 'Bearish' | 'Netral'; confidence: number; keputusan: 'BELI' | 'JUAL' | 'TUNGGU'; keputusanAlasan: string; conviction: 'Tinggi' | 'Sedang' | 'Rendah'
  headline: string; executive: string; confluence: { faktor: string; arah: 'bullish' | 'bearish' | 'netral'; catatan: string }[]
  technical: string; macro: string; sentiment: string; levelKunci: { support: string; resistance: string }
  chartLevels: { entry: number | null; sl: number | null; tp: number | null; support: number | null; resistance: number | null }
  plan: { bias: string; entry: string; sl: string; tp: string; invalidation: string }
  scenarios: { kondisi: string; aksi: string }[]; risks: string[]; watch: string[]; fetchedAt: string
}
function useAiAnalysis() {
  const [data, setData] = useState<AiAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (snapshot: Record<string, unknown>, userPrompt = '') => {
    setLoading(true); setError(null)
    try { const j = await (await fetch('/api/terminal/ai-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...snapshot, userPrompt }) })).json(); if (j.error) throw new Error(j.error); setData(j) }
    catch (e) { setError(e instanceof Error ? e.message : 'gagal menganalisa') } finally { setLoading(false) }
  }
  return { data, loading, error, run }
}
type NewsItem = { text: string; source: string; time: string; link: string }
function useNews() {
  const [data, setData] = useState<NewsItem[] | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  useEffect(() => { let s = false; const poll = async () => { try { const j = await (await fetch('/api/terminal/news')).json(); if (!s && Array.isArray(j)) { setData(j); setUpdatedAt(Date.now()) } } catch { } }; poll(); const id = setInterval(poll, 600_000); return () => { s = true; clearInterval(id) } }, [])
  return { data, updatedAt }
}
type Accuracy = { total: number; correct: number; pct: number | null; window: number; ready: boolean }
function useAccuracy() {
  const [acc, setAcc] = useState<Accuracy | null>(null)
  useEffect(() => { let s = false; const poll = async () => { try { const j = await (await fetch('/api/terminal/accuracy?days=30')).json(); if (!s) setAcc(j) } catch { } }; poll(); const id = setInterval(poll, 1800_000); return () => { s = true; clearInterval(id) } }, [])
  return acc
}


// ─────────────────────────── helpers UI ───────────────────────────
const f2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const kfmt = (n: number) => (n >= 0 ? '+' : '') + (Math.abs(n) >= 1000 ? (n / 1000).toFixed(0) + 'k' : n.toFixed(0))

// Waktu relatif ("5d lalu") & countdown ("berikutnya 3d") untuk indikator freshness data.
function relTime(ts: number | null, now: number): string {
  if (!ts) return 'memuat…'
  const s = Math.floor((now - ts) / 1000)
  if (s < 2) return 'baru saja'
  if (s < 60) return `${s}d lalu`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}j lalu`
  return `${Math.floor(h / 24)}h lalu`
}
function countdownStr(ts: number | null, intervalMs: number, now: number): string {
  if (!ts) return '—'
  const remain = Math.max(0, Math.ceil((ts + intervalMs - now) / 1000))
  if (remain <= 0) return 'sebentar lagi'
  if (remain < 60) return `${remain}d`
  const m = Math.floor(remain / 60), s = remain % 60
  if (m < 60) return `${m}m ${s}d`
  const h = Math.floor(m / 60)
  return `${h}j ${m % 60}m`
}
function FreshRow({ label, ts, intervalMs, now }: { label: string; ts: number | null; intervalMs: number; now: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
      <span className="text-[10px] font-semibold text-white/70">{label}</span>
      <div className="text-right leading-tight">
        <p className="text-[9px] text-white/45">{relTime(ts, now)}</p>
        <p className="text-[9px] text-primary/70 tabular-nums">↻ {countdownStr(ts, intervalMs, now)}</p>
      </div>
    </div>
  )
}
// Status online/offline per API — dari keberhasilan & keterbaruan fetch terakhir (data real).
type ApiStat = 'online' | 'stale' | 'offline' | 'connecting'
function apiStat(ts: number | null, intervalMs: number, now: number, forced?: ApiStat): ApiStat {
  if (forced) return forced
  if (ts == null) return 'connecting'
  const age = now - ts
  if (age < intervalMs * 2.5) return 'online'
  if (age < intervalMs * 6) return 'stale'
  return 'offline'
}
const STAT_META: Record<ApiStat, { label: string; dot: string; text: string; ring: string }> = {
  online: { label: 'Online', dot: 'bg-emerald-400', text: 'text-emerald-400', ring: 'shadow-[0_0_0_3px_rgba(52,211,153,0.15)]' },
  stale: { label: 'Lambat', dot: 'bg-amber-400', text: 'text-amber-400', ring: 'shadow-[0_0_0_3px_rgba(251,191,36,0.15)]' },
  offline: { label: 'Offline', dot: 'bg-red-400', text: 'text-red-400', ring: 'shadow-[0_0_0_3px_rgba(248,113,113,0.15)]' },
  connecting: { label: 'Menghubungkan', dot: 'bg-white/40', text: 'text-white/45', ring: '' },
}
function ApiStatusRow({ label, sub, stat, ts, intervalMs, now }: { label: string; sub: string; stat: ApiStat; ts: number | null; intervalMs: number; now: number }) {
  const m = STAT_META[stat]
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <span className={`h-2 w-2 rounded-full shrink-0 ${m.dot} ${stat === 'online' ? m.ring : ''} ${stat === 'connecting' ? 'animate-pulse' : ''}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-white/85 truncate">{label}</p>
        <p className="text-[9px] text-white/40 truncate">{sub}</p>
      </div>
      <div className="text-right leading-tight shrink-0">
        <p className={`text-[10px] font-bold ${m.text}`}>{m.label}</p>
        <p className="text-[9px] text-white/35 tabular-nums">{relTime(ts, now)} · ↻{countdownStr(ts, intervalMs, now)}</p>
      </div>
    </div>
  )
}
// Level swing intraday (pivot lokal) dari candle — untuk zona S/R yang DEKAT harga (scalping).
// Swing high = high lebih tinggi dari `left` candle sebelum & `right` sesudahnya; swing low sebaliknya.
function swingLevels(candles: Candle[], left = 3, right = 3, lookback = 70): { highs: number[]; lows: number[] } {
  const c = candles.slice(-lookback)
  const highs: number[] = [], lows: number[] = []
  for (let i = left; i < c.length - right; i++) {
    let isHigh = true, isLow = true
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue
      if (c[j].h >= c[i].h) isHigh = false
      if (c[j].l <= c[i].l) isLow = false
    }
    if (isHigh) highs.push(c[i].h)
    if (isLow) lows.push(c[i].l)
  }
  return { highs, lows }
}
const dirColor = (l: string) => l === 'BULLISH' || l === 'Bullish' || l === 'bullish' ? 'text-emerald-400' : l === 'BEARISH' || l === 'Bearish' || l === 'bearish' ? 'text-red-400' : 'text-white/60'
const dirBg = (l: string) => l === 'BULLISH' || l === 'Bullish' ? 'bg-emerald-500/15 text-emerald-400' : l === 'BEARISH' || l === 'Bearish' ? 'bg-red-500/15 text-red-400' : 'bg-white/10 text-white/60'

function Panel({ title, icon: Icon, right, info, children, className = '', accent }: { title: string; icon: React.ElementType; right?: React.ReactNode; info?: string; children: React.ReactNode; className?: string; accent?: string }) {
  // accent = warna trend (opsional). Gradient dipasang sebagai BACKGROUND (di bawah konten)
  // + glow tepi atas, jadi modern/futuristik tanpa menutupi data.
  const accentStyle = accent ? {
    backgroundImage: `radial-gradient(135% 90% at 50% -25%, ${accent}22, transparent 55%), linear-gradient(to bottom, rgba(255,255,255,0.03), transparent 40%)`,
    boxShadow: `inset 0 1px 0 0 ${accent}66, inset 0 14px 40px -26px ${accent}`,
  } : { backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.03), transparent 40%)', boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06)' }
  return (
    <div style={accentStyle} className={`rounded-2xl border ${accent ? 'border-white/[0.09]' : 'border-white/[0.07]'} bg-[#0b100e] p-3.5 flex flex-col transition-colors hover:border-white/[0.13] ${className}`}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
          <Icon size={12} /> {title}
          {info && (
            <span title={info} tabIndex={0} className="group relative flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-white/60 hover:bg-primary/25 hover:text-primary focus:bg-primary/25 focus:text-primary cursor-help normal-case tracking-normal shrink-0 outline-none">
              <Info size={10} />
              <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-56 -translate-x-1/2 rounded-lg bg-black/95 border border-white/10 p-2 text-[10px] font-normal normal-case leading-snug text-white/80 opacity-0 shadow-xl transition-opacity duration-100 group-hover:opacity-100 group-focus:opacity-100">
                {info}
              </span>
            </span>
          )}
        </span>
        {right}
      </div>
      {children}
    </div>
  )
}
function meterZone(score: number) {
  if (score <= -60) return { name: 'Sangat Bearish', color: '#ef4444', idx: 0 }
  if (score < -20) return { name: 'Bearish', color: '#f87171', idx: 1 }
  if (score < 20) return { name: 'Netral', color: '#9ca3af', idx: 2 }
  if (score < 60) return { name: 'Bullish', color: '#34d399', idx: 3 }
  return { name: 'Sangat Bullish', color: '#10b981', idx: 4 }
}
function Gauge({ score }: { score: number }) {
  const cx = 120, cy = 118, r = 84
  const polar = (rr: number, deg: number) => { const a = deg * Math.PI / 180; return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)] as const }
  const seg = (a0: number, a1: number) => { let pts = ''; for (let i = 0; i <= 16; i++) { const a = a0 + (a1 - a0) * i / 16; const [x, y] = polar(r, a); pts += `${x.toFixed(1)},${y.toFixed(1)} ` } return pts.trim() }
  const zones = [{ a0: 180, a1: 146, color: '#ef4444' }, { a0: 144, a1: 110, color: '#f87171' }, { a0: 108, a1: 72, color: '#9ca3af' }, { a0: 70, a1: 36, color: '#34d399' }, { a0: 34, a1: 0, color: '#10b981' }]
  const active = meterZone(score).idx
  const frac = (clamp(score, -100, 100) + 100) / 200
  const [nx, ny] = polar(r - 10, 180 - frac * 180)
  const labels = [{ t: 'Sgt Bearish', x: 4, y: 114, anc: 'start', idx: 0 }, { t: 'Bearish', x: 44, y: 42, anc: 'middle', idx: 1 }, { t: 'Netral', x: 120, y: 20, anc: 'middle', idx: 2 }, { t: 'Bullish', x: 196, y: 42, anc: 'middle', idx: 3 }, { t: 'Sgt Bullish', x: 236, y: 114, anc: 'end', idx: 4 }]
  return (
    <svg viewBox="0 0 240 130" className="w-full">
      {zones.map((z, i) => <polyline key={i} points={seg(z.a0, z.a1)} fill="none" stroke={z.color} strokeWidth={i === active ? 7 : 5} strokeLinecap="round" opacity={i === active ? 1 : 0.2} />)}
      {/* jarum: getaran halus seperti speedometer + glow warna trend */}
      <g className="dl-gauge-needle" style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: 'view-box' }}>
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={zones[active].color} strokeWidth={5} strokeLinecap="round" opacity={0.35} />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill={zones[active].color} opacity={0.3} />
        <circle cx={cx} cy={cy} r={3.5} fill="#fff" />
      </g>
      {labels.map(l => <text key={l.t} x={l.x} y={l.y} textAnchor={l.anc as 'start' | 'middle' | 'end'} fontSize="8" fontWeight={l.idx === active ? 700 : 500} fill={l.idx === active ? zones[l.idx].color : 'rgba(255,255,255,0.32)'}>{l.t}</text>)}
      <style>{`@keyframes dlGaugeNeedle{0%,100%{transform:rotate(-0.6deg)}50%{transform:rotate(0.6deg)}} .dl-gauge-needle{animation:dlGaugeNeedle .17s ease-in-out infinite} @media (prefers-reduced-motion:reduce){.dl-gauge-needle{animation:none}}`}</style>
    </svg>
  )
}
// Speedometer Volatilitas (ATR) — 3 zona Rendah/Normal/Tinggi, jarum bergetar halus.
function VolatilityMeter({ ratio, label }: { ratio: number; label: string }) {
  const cx = 100, cy = 96, r = 78
  const polar = (rr: number, deg: number) => { const a = deg * Math.PI / 180; return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)] as const }
  const seg = (a0: number, a1: number) => { let pts = ''; for (let i = 0; i <= 14; i++) { const a = a0 + (a1 - a0) * i / 14; const [x, y] = polar(r, a); pts += `${x.toFixed(1)},${y.toFixed(1)} ` } return pts.trim() }
  const zones = [{ a0: 180, a1: 120, c: '#38bdf8', t: 'Rendah' }, { a0: 120, a1: 60, c: '#34d399', t: 'Normal' }, { a0: 60, a1: 0, c: '#fbbf24', t: 'Tinggi' }]
  // posisi jarum 0..1 dari rasio ATR (sekarang vs rata-rata); ambang volLabel: 0.75 & 1.4
  const pos = ratio < 0.75 ? clamp(ratio / 0.75, 0, 1) / 3
    : ratio <= 1.4 ? 1 / 3 + (ratio - 0.75) / (1.4 - 0.75) / 3
      : 2 / 3 + clamp((ratio - 1.4) / 1.1, 0, 1) / 3
  const ang = 180 - clamp(pos, 0, 1) * 180
  const [nx, ny] = polar(r - 12, ang)
  const active = label === 'Rendah' ? 0 : label === 'Tinggi' ? 2 : 1
  return (
    <svg viewBox="0 0 200 110" className="w-full">
      {zones.map((z, i) => <polyline key={i} points={seg(z.a0, z.a1)} fill="none" stroke={z.c} strokeWidth={i === active ? 8 : 5.5} strokeLinecap="round" opacity={i === active ? 1 : 0.22} />)}
      <g className="dl-vol-needle" style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: 'view-box' }}>
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={zones[active].c} strokeWidth={5} strokeLinecap="round" opacity={0.35} />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill={zones[active].c} opacity={0.3} />
        <circle cx={cx} cy={cy} r={3.5} fill="#fff" />
      </g>
      {zones.map(z => { const [lx, ly] = polar(r + 9, (z.a0 + z.a1) / 2); return <text key={z.t} x={lx} y={ly + 3} textAnchor="middle" fontSize="7.5" fontWeight={z.t === label ? 700 : 500} fill={z.t === label ? z.c : 'rgba(255,255,255,0.3)'}>{z.t}</text> })}
      <style>{`@keyframes dlVolNeedle{0%,100%{transform:rotate(-0.9deg)}50%{transform:rotate(0.9deg)}} .dl-vol-needle{animation:dlVolNeedle .16s ease-in-out infinite} @media (prefers-reduced-motion:reduce){.dl-vol-needle{animation:none}}`}</style>
    </svg>
  )
}
// Baris pilar yang mudah dibaca
function PillarRow({ label, score, desc }: { label: string; score: number; desc: string }) {
  const lab = score > 20 ? 'Bullish' : score < -20 ? 'Bearish' : 'Netral'
  const pct = Math.round((score + 100) / 2)
  return (
    <div>
      <div className="flex items-center justify-between mb-1"><span className="text-[11px] font-semibold text-white/75">{label}</span><span className={`text-[10px] font-bold ${dirColor(lab)}`}>{lab} · {pct}%</span></div>
      <div className="relative h-2 rounded-full bg-white/5"><div className="absolute left-1/2 top-0 h-full w-px bg-white/25" /><div className={`absolute top-0 h-full rounded-full ${score >= 0 ? 'bg-emerald-400 left-1/2' : 'bg-red-400 right-1/2'}`} style={{ width: `${Math.min(50, Math.abs(score) / 2)}%` }} /></div>
      <p className="text-[9px] text-white/35 mt-0.5">{desc}</p>
    </div>
  )
}
type CardMeta = { name: string; sub: string; dec: number; unit?: string; prefix?: string; corr: number; src: string }
function DataCard({ meta, value, prior, changePct }: { meta: CardMeta; value: number | null; prior?: number | null; changePct?: number | null }) {
  if (value == null) return <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5 flex flex-col justify-center items-center min-h-[76px]"><Loader2 size={14} className="animate-spin text-white/30" /><span className="text-[9px] text-white/30 mt-1">{meta.name}</span></div>
  const chg = changePct != null ? changePct : (prior != null && prior !== 0 ? ((value - prior) / prior) * 100 : 0)
  const impact = Math.sign(chg) * meta.corr
  const imp = impact > 0.02 ? { t: 'Bullish', c: 'text-emerald-400 bg-emerald-500/10' } : impact < -0.02 ? { t: 'Bearish', c: 'text-red-400 bg-red-500/10' } : { t: 'Netral', c: 'text-white/50 bg-white/5' }
  const up = chg >= 0
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5" title={`${meta.name}: ${meta.sub}. Tag = dampak ke emas dari arah pergerakan.`}>
      <div className="flex items-center justify-between gap-1"><span className="text-xs font-bold text-white/85 flex items-center gap-1">{meta.name}<span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /></span><span className={`text-[8px] font-bold uppercase rounded px-1 py-0.5 shrink-0 ${imp.c}`}>{imp.t}</span></div>
      <div className="text-[9px] text-white/35 mb-1">{meta.sub}</div>
      <div className="flex items-end justify-between"><span className="text-sm font-black tabular-nums">{meta.prefix ?? ''}{value.toLocaleString('en-US', { minimumFractionDigits: meta.dec, maximumFractionDigits: meta.dec })}{meta.unit ?? ''}</span><span className={`text-[10px] font-bold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>{up ? '+' : ''}{chg.toFixed(2)}%</span></div>
    </div>
  )
}
const CROSS_META: Record<string, CardMeta> = {
  dollar: { name: 'Indeks Dolar', sub: 'Broad USD · FRED', dec: 2, corr: -1, src: 'FRED' },
  us10y: { name: 'US10Y', sub: 'Yield 10 Thn · FRED', dec: 2, unit: '%', corr: -1, src: 'FRED' },
  btc: { name: 'Bitcoin', sub: 'Kripto · TD', dec: 0, prefix: '$', corr: 0.4, src: 'Twelve Data' },
  spy: { name: 'S&P 500', sub: 'Proxy SPY · TD', dec: 2, prefix: '$', corr: -0.5, src: 'Twelve Data' },
  qqq: { name: 'Nasdaq 100', sub: 'Proxy QQQ · TD', dec: 2, prefix: '$', corr: -0.5, src: 'Twelve Data' },
  vixy: { name: 'VIX (Takut)', sub: 'Proxy VIXY · TD', dec: 2, prefix: '$', corr: 1, src: 'Twelve Data' },
  uup: { name: 'Dolar (live)', sub: 'Proxy UUP · TD', dec: 2, prefix: '$', corr: -1, src: 'Twelve Data' },
}
const MACRO_META: { key: string; meta: CardMeta }[] = [
  { key: 'cpi', meta: { name: 'CPI (YoY)', sub: 'Inflasi headline · FRED', dec: 1, unit: '%', corr: -1, src: 'FRED' } },
  { key: 'corecpi', meta: { name: 'Core CPI (YoY)', sub: 'Inflasi inti', dec: 1, unit: '%', corr: -1, src: 'FRED' } },
  { key: 'corepce', meta: { name: 'Core PCE (YoY)', sub: 'Gauge favorit Fed', dec: 1, unit: '%', corr: -1, src: 'FRED' } },
  { key: 'breakeven', meta: { name: 'Ekspektasi Inflasi', sub: 'Breakeven 10Y — naik = bullish', dec: 2, unit: '%', corr: 1, src: 'FRED' } },
  { key: 'fedfunds', meta: { name: 'Fed Funds Rate', sub: 'Suku bunga acuan', dec: 2, unit: '%', corr: -1, src: 'FRED' } },
  { key: 'realyield', meta: { name: 'Real Yield 10Y', sub: 'TIPS — turun = bullish', dec: 2, unit: '%', corr: -1, src: 'FRED' } },
  { key: 'unrate', meta: { name: 'Pengangguran', sub: 'Naik = dovish (bullish)', dec: 1, unit: '%', corr: 1, src: 'FRED' } },
  { key: 'nfp', meta: { name: 'NFP (bulanan)', sub: 'Nonfarm Payrolls — lemah = bullish', dec: 0, unit: 'K', corr: 1, src: 'FRED' } },
  { key: 'wagegrowth', meta: { name: 'Pertumbuhan Upah', sub: 'Avg Hourly Earnings YoY', dec: 1, unit: '%', corr: -1, src: 'FRED' } },
]
function TVWidget({ src, config }: { src: string; config: Record<string, unknown> }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    c.innerHTML = ''
    const w = document.createElement('div'); w.className = 'tradingview-widget-container__widget'; w.style.height = '100%'; w.style.width = '100%'; c.appendChild(w)
    const s = document.createElement('script'); s.src = src; s.async = true; s.type = 'text/javascript'; s.innerHTML = JSON.stringify(config); c.appendChild(s)
    return () => { c.innerHTML = '' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])
  return <div className="tradingview-widget-container" ref={ref} style={{ height: '100%', width: '100%' }} />
}
const TV_EVENTS = { colorTheme: 'dark', isTransparent: false, locale: 'en', countryFilter: 'us', importanceFilter: '0,1', width: '100%', height: '100%' }

// Baris COT yang mudah dibaca (bar proporsi long/short)
function CotBar({ label, g, hint }: { label: string; g: CotGroup; hint: string }) {
  const total = g.long + g.short || 1
  const longPct = (g.long / total) * 100
  return (
    <div className="py-1.5" title={hint}>
      <div className="flex items-center justify-between mb-1"><span className="text-[11px] text-white/70">{label}</span><span className={`text-[10px] font-bold ${g.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{g.net >= 0 ? 'Net Long' : 'Net Short'} {kfmt(g.net)} <span className={`text-[9px] ${g.deltaNet >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>Δ{kfmt(g.deltaNet)}</span></span></div>
      <div className="h-2 rounded-full overflow-hidden bg-red-500/40 flex"><div className="bg-emerald-500/70 h-full" style={{ width: `${longPct}%` }} /></div>
      <div className="flex justify-between text-[8px] text-white/35 mt-0.5"><span>{g.long.toLocaleString()} long</span><span>{g.short.toLocaleString()} short</span></div>
    </div>
  )
}

// Chart XAU/USD via TradingView — 3 line chart clean (M5/M15/H1) berdampingan untuk komparasi.
const CHART_TFS: { label: string; value: string }[] = [
  { label: 'M5', value: '5' }, { label: 'M15', value: '15' }, { label: 'H1', value: '60' },
]
function ChartPanel({ onExpand, hasAiLevels, className = 'lg:col-span-8' }: { onExpand: () => void; hasAiLevels: boolean; className?: string }) {
  return (
    <Panel title="Chart XAU/USD · TradingView" icon={Activity} className={className} info="3 line chart XAU/USD berdampingan (M5, M15, H1) untuk komparasi antar-timeframe — lihat apakah arah tren selaras di ketiganya. Bersih, tanpa indikator."
      right={<button onClick={onExpand} className="flex items-center gap-1 text-[9px] text-white/40 hover:text-white/80"><Maximize2 size={11} /> Perbesar</button>}>
      {hasAiLevels && <p className="text-[9px] text-primary/70 mb-1.5 shrink-0">Level entry/SL/TP dari Analisa AI ada di panel "Analisa AI — Ambil Keputusan".</p>}
      <div className="grid sm:grid-cols-3 gap-2.5">
        {CHART_TFS.map(tf => (
          <div key={tf.value}>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-1.5"><Coins size={11} /> XAU/USD · {tf.label}</p>
            <TradingViewChart symbol="OANDA:XAUUSD" interval={tf.value} chartStyle="2" minimal height={300} />
          </div>
        ))}
      </div>
      <p className="text-[9px] text-white/30 mt-1.5">Line chart · tanpa indikator · TradingView (OANDA)</p>
    </Panel>
  )
}

// ─────────────────────────── helper visual baru ───────────────────────────
function Sparkline({ data, color = '#34d399', h = 26, w = 84 }: { data: number[]; color?: string; h?: number; w?: number }) {
  if (!data || data.length < 2) return <div style={{ height: h, width: w }} />
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 3) - 1.5}`).join(' ')
  const last = data[data.length - 1], first = data[0]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
      <circle cx={w} cy={h - ((last - min) / range) * (h - 3) - 1.5} r={2} fill={last >= first ? '#34d399' : '#f87171'} />
    </svg>
  )
}
// Tile insight ringkas (variatif — bukan grid kartu identik)
function StatTile({ icon: Icon, label, value, sub, tone = 'neutral', spark, sparkColor, info }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; tone?: 'bull' | 'bear' | 'warn' | 'neutral'; spark?: number[]; sparkColor?: string; info?: string }) {
  const toneC = tone === 'bull' ? 'text-emerald-400' : tone === 'bear' ? 'text-red-400' : tone === 'warn' ? 'text-amber-400' : 'text-white/85'
  const hair = tone === 'bull' ? 'from-emerald-400/60' : tone === 'bear' ? 'from-red-400/60' : tone === 'warn' ? 'from-amber-400/60' : 'from-white/15'
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#0b100e] p-2.5 flex flex-col justify-between min-h-[76px] transition-colors hover:border-white/[0.14]" style={{ backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.03), transparent 45%)' }} title={info}>
      <span className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${hair} to-transparent`} />
      <div className="flex items-center justify-between"><span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-white/35"><Icon size={10} /> {label}</span>{info && <Info size={9} className="text-white/20" />}</div>
      <div className="flex items-end justify-between gap-1 mt-1">
        <div><p className={`text-base font-black leading-none ${toneC}`}>{value}</p>{sub && <p className="text-[9px] text-white/40 mt-0.5 leading-tight">{sub}</p>}</div>
        {spark && <Sparkline data={spark} color={sparkColor ?? '#60a5fa'} />}
      </div>
    </div>
  )
}
const cellState = (s: 'bullish' | 'bearish' | 'netral') => s === 'bullish' ? 'bg-emerald-500/15 text-emerald-400' : s === 'bearish' ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.04] text-white/45'
function HeatCell({ state, text }: { state: 'bullish' | 'bearish' | 'netral'; text: string }) {
  return <div className={`rounded-md py-1 text-center text-[10px] font-bold ${cellState(state)}`}>{text}</div>
}
// meter horizontal -100..100 (dipakai untuk momentum, risk-on/off, curve)
// Meter risk-on/off yang mudah dibaca: bar terisi = proporsi ke sisi risk-off (dukung emas)
// vs risk-on (tekan emas), dengan label & % besar. riskOn: -1 (risk-off) .. +1 (risk-on).
function RiskMeter({ riskOn }: { riskOn: number }) {
  const offPct = clamp(Math.round(50 - riskOn * 50), 0, 100)  // % ke arah risk-off (bullish emas)
  const onPct = 100 - offPct
  return (
    <div>
      <div className="relative h-9 rounded-lg overflow-hidden flex bg-red-500/15 ring-1 ring-white/5">
        <div className="h-full bg-gradient-to-r from-emerald-500/70 to-emerald-400/70 flex items-center pl-2.5 transition-all" style={{ width: `${offPct}%` }}>
          {offPct >= 26 && <span className="text-xs font-black text-white leading-none">🛡️ {offPct}%</span>}
        </div>
        <div className="flex-1 flex items-center justify-end pr-2.5">
          {onPct >= 26 && <span className="text-xs font-black text-red-200 leading-none">{onPct}% 📈</span>}
        </div>
      </div>
      <div className="flex justify-between text-[9px] font-semibold mt-1.5">
        <span className="text-emerald-400">◀ RISK-OFF · emas naik</span>
        <span className="text-red-400">RISK-ON · emas turun ▶</span>
      </div>
    </div>
  )
}

// ─────────────────────────── TAB ───────────────────────────
type Tab = 'ringkasan' | 'teknikal' | 'makro' | 'sentimen' | 'berita' | 'status' | 'panduan'
const TABS: { id: Tab; label: string; icon: React.ElementType; group?: string }[] = [
  { id: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard, group: 'Analisa' },
  { id: 'teknikal', label: 'Teknikal', icon: Activity, group: 'Analisa' },
  { id: 'makro', label: 'Makro', icon: Landmark, group: 'Analisa' },
  { id: 'sentimen', label: 'Sentimen', icon: Users, group: 'Analisa' },
  { id: 'berita', label: 'Berita AI', icon: Newspaper, group: 'Analisa' },
  { id: 'status', label: 'Status Server', icon: Server, group: 'Sistem' },
  { id: 'panduan', label: 'Panduan', icon: BookOpen, group: 'Sistem' },
]

// ─────────────────────────── PAGE ───────────────────────────
export function TradingTerminal() {
  const now = useClock()
  const live = useLiveXauFeed()
  const cross = useCrossAsset()
  const { map: macro, updatedAt: macroAt } = useMacro()
  const { p: pivotsLive, updatedAt: pivotAt } = usePivots()
  const { cot, updatedAt: cotAt } = useCot()
  const ai = useAiAnalysis()
  const { data: newsItems, updatedAt: newsAt } = useNews()
  const accuracy = useAccuracy()
  const [tab, setTab] = useState<Tab>('ringkasan')
  const [chartFull, setChartFull] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')

  const clock = useMemo(() => new Date(now).toLocaleTimeString('id-ID'), [now])
  const hh = new Date(now).getUTCHours()
  const session = hh >= 12 && hh < 16 ? 'London × New York' : hh >= 7 && hh < 12 ? 'London' : hh >= 16 && hh < 21 ? 'New York' : 'Asia'

  if (!live.data) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#060a09] text-white/50 gap-3">
      {live.status === 'error' ? <WifiOff className="text-red-400" /> : <Radio className="animate-pulse text-primary" />}
      <p className="text-sm">{live.status === 'error' ? 'Data belum tersedia — mencoba lagi…' : 'Menghubungkan data pasar…'}</p>
    </div>
  )

  const feed = live.data, up = feed.changePct >= 0
  // #5 kesegaran pilar: bursa AS tutup → ekuitas beku, kecilkan bobotnya
  const usOpen = usMarketOpen(now)
  // #7 guard pasar tutup: candle M5 terbaru lebih tua dari ~15 menit = pasar tutup / data mati
  const marketStale = feed.lastCandleT ? now - feed.lastCandleT > 15 * 60_000 : false
  const staleAgeMin = feed.lastCandleT ? Math.round((now - feed.lastCandleT) / 60_000) : 0
  // #6 putus feedback loop: verdict AI TIDAK diumpankan ke skor (dulu bikin AI konfirmasi diri sendiri)
  const riskOn = riskOnScore(cross, usOpen)
  const sc = scores(feed.tf, macro, null, riskOn, cross.uup?.changePct ?? null)
  const conf = confluence(feed.tf)
  const dir = sc.label
  const m5 = feed.tf.M5.candles
  const atrNow = atrLast(m5, 7), atrBase = atrLast(m5, Math.min(40, m5.length - 1)) || atrNow
  const volRatio = atrBase ? atrNow / atrBase : 1
  const volLabel = volRatio < 0.75 ? 'Rendah' : volRatio > 1.4 ? 'Tinggi' : 'Normal'
  const adx = feed.tf.M15.adx, adxL = adxLabel(adx), trendUp = feed.tf.M15.plusDI >= feed.tf.M15.minusDI
  const confPct = Math.round((sc.overall + 100) / 2)
  const strongestPillar = Math.abs(sc.macro) >= Math.abs(sc.tech) && Math.abs(sc.macro) >= Math.abs(sc.senti) ? 'Makro' : Math.abs(sc.tech) >= Math.abs(sc.senti) ? 'Teknikal' : 'Sentimen'

  // Zona Support/Resistance untuk SCALPING — band di sekitar level pivot, hanya yang DEKAT harga.
  // Zona S/R untuk SCALPING — utamakan swing intraday M5 & M15 (paling DEKAT harga),
  // pivot harian dipakai sebagai pelengkap. Band lebarnya skala ATR (M5 utk lebih rapat).
  type ZoneSrc = 'M5' | 'M15' | 'Pivot'
  type Zone = { kind: 'res' | 'sup'; label: string; src: ZoneSrc; mid: number; low: number; high: number; dist: number; inside: boolean }
  const zoneW = clamp((feed.tf.M5.atr || 2) * 0.5, 1, 5)  // setengah lebar band (skala volatilitas M5)
  const swM5 = swingLevels(feed.tf.M5.candles), swM15 = swingLevels(feed.tf.M15.candles)
  type LvCand = { price: number; src: ZoneSrc }
  const pivRes: LvCand[] = pivotsLive ? [{ price: pivotsLive.R1, src: 'Pivot' }, { price: pivotsLive.R2, src: 'Pivot' }] : []
  const pivSup: LvCand[] = pivotsLive ? [{ price: pivotsLive.S1, src: 'Pivot' }, { price: pivotsLive.S2, src: 'Pivot' }] : []
  const resCand: LvCand[] = [...swM5.highs.map(p => ({ price: p, src: 'M5' as const })), ...swM15.highs.map(p => ({ price: p, src: 'M15' as const })), ...pivRes].filter(l => l.price > feed.price + 0.2)
  const supCand: LvCand[] = [...swM5.lows.map(p => ({ price: p, src: 'M5' as const })), ...swM15.lows.map(p => ({ price: p, src: 'M15' as const })), ...pivSup].filter(l => l.price < feed.price - 0.2)
  // gabung level yang berdekatan (dalam ~1 lebar band), ambil 3 terdekat ke harga
  const mergeNear = (cands: LvCand[], dir: 'up' | 'down') => {
    const sorted = cands.sort((a, b) => dir === 'up' ? a.price - b.price : b.price - a.price)
    const kept: LvCand[] = []
    for (const c of sorted) { if (!kept.some(k => Math.abs(k.price - c.price) < zoneW * 1.4)) kept.push(c) }
    return kept.slice(0, 3)
  }
  const mkZone = (c: LvCand, kind: 'res' | 'sup', idx: number): Zone => ({
    kind, src: c.src, mid: c.price, low: c.price - zoneW, high: c.price + zoneW, dist: c.price - feed.price,
    inside: feed.price >= c.price - zoneW && feed.price <= c.price + zoneW,
    label: (kind === 'res' ? 'Resistance' : 'Support') + (idx === 0 ? ' terdekat' : idx === 1 ? ' kedua' : ' ketiga'),
  })
  const resZones = mergeNear(resCand, 'up').map((c, i) => mkZone(c, 'res', i))
  const supZones = mergeNear(supCand, 'down').map((c, i) => mkZone(c, 'sup', i))
  const allZones = [...resZones, ...supZones]
  const nearest = allZones.length ? allZones.reduce((a, b) => Math.abs(a.dist) < Math.abs(b.dist) ? a : b) : null

  // ── insight turunan (100% real) ──
  const dayRange = feed.dayHigh - feed.dayLow
  const dayPos = dayRange > 0 ? clamp((feed.price - feed.dayLow) / dayRange, 0, 1) : 0.5
  const bbSqueeze = feed.tf.M15.boll.squeeze
  const adxTrend = feed.tf.M15.adxTrend
  const regime = regimeOf({ bbSqueeze, adx, adxTrend, trendUp })
  const avgMomentum = (feed.tf.M5.momentum + feed.tf.M15.momentum + feed.tf.H1.momentum) / 3
  const goldSilver = cross.xag && cross.xag.price > 0 ? feed.price / cross.xag.price : null
  const gsRelative = cross.xag ? feed.changePct - cross.xag.changePct : null
  const curve2s10 = macro?.us10y && macro?.us02y ? macro.us10y.value - macro.us02y.value : null

  // Kesimpulan (sintesis)
  const kLines: string[] = []
  kLines.push(`Teknikal: ${conf.bulls} bullish / ${conf.bears} bearish dari 3 TF (${conf.label === 'NETRAL' ? 'campur' : conf.label.toLowerCase()}). Tren ${adxL}${adx >= 20 ? ` & ${trendUp ? 'naik' : 'turun'}` : ''}.`)
  if (macro?.dollar && macro?.us10y) { const dUp = macro.dollar.value > macro.dollar.prior, yUp = macro.us10y.value > macro.us10y.prior; kLines.push(`Makro: dolar ${dUp ? 'menguat' : 'melemah'}, yield 10Y ${yUp ? 'naik' : 'turun'} → ${(!dUp && !yUp) ? 'mendukung emas' : (dUp && yUp) ? 'menekan emas' : 'campur'}.`) }
  if (cot) kLines.push(`COT: institusi ${cot.funds.net >= 0 ? 'net long' : 'net short'}, retail ${cot.retail.net >= 0 ? 'net long' : 'net short'}${cot.funds.net * cot.retail.net < 0 ? ' — berlawanan' : ''}.`)
  if (ai.data) kLines.push(`Analisa AI: ${ai.data.verdict} — ${ai.data.headline}`); else kLines.push('Jalankan "Analisa AI" untuk pandangan menyeluruh.')
  const kAction = sc.confidence < 40 ? 'Sinyal lemah/campur — tunggu konfirmasi arah.' : dir === 'BULLISH' ? 'Bias BULLISH. Cari pullback ke VWAP/EMA21 untuk entry beli.' : dir === 'BEARISH' ? 'Bias BEARISH. Cari retest ke VWAP/EMA21 untuk entry jual.' : 'Netral — tunggu arah dominan.'
  const kRisk = volLabel === 'Rendah' ? 'Volatilitas rendah — sinyal kurang reliabel, hindari over-trading.' : adx < 20 ? 'Tren lemah (ADX < 20) — pasar cenderung sideways, hati-hati whipsaw.' : !ai.data ? 'Jalankan Analisa AI & pantau rilis data ekonomi.' : 'Pantau rilis data ekonomi & pergerakan DXY/yield.'

  const snapshot = {
    price: +feed.price.toFixed(2), changePct: +feed.changePct.toFixed(2), session, volatility: volLabel,
    signal: { overall: Math.round(sc.overall), label: sc.label, confidence: sc.confidence, macro: Math.round(sc.macro), tech: Math.round(sc.tech), senti: Math.round(sc.senti) },
    tf: Object.fromEntries(TFS.map(t => { const d = feed.tf[t]; return [t, { bias: d.bias.label, rsi: Math.round(d.rsi), macd: d.macd.state, stoch: Math.round(d.stoch.k), struktur: d.structure.label, reversal: d.reversal.arah !== 'netral' ? `${d.reversal.arah} (${d.reversal.skor}/4 sinyal)` : null }] })),
    adx: +adx.toFixed(0), adxTrend, trendDir: trendUp ? 'naik' : 'turun', atrM15: +feed.tf.M15.atr.toFixed(2), vwapM15: +feed.tf.M15.vwap.toFixed(2),
    biasTFbesar: { H4: feed.htf.H4 ? { bias: feed.htf.H4.bias.label, rsi: Math.round(feed.htf.H4.rsi), struktur: feed.htf.H4.structure.label } : null, D1: feed.htf.D1 ? { bias: feed.htf.D1.bias.label, rsi: Math.round(feed.htf.D1.rsi), struktur: feed.htf.D1.structure.label } : null },
    regime: regime.label, momentum: Math.round(avgMomentum), bbSqueeze, riskSentiment: riskOn < -0.1 ? 'risk-off' : riskOn > 0.1 ? 'risk-on' : 'netral',
    goldSilverRatio: goldSilver ? +goldSilver.toFixed(1) : null, yieldCurve2s10: curve2s10 != null ? +curve2s10.toFixed(2) : null,
    pivots: pivotsLive ? { P: +pivotsLive.P.toFixed(2), R1: +pivotsLive.R1.toFixed(2), R2: +pivotsLive.R2.toFixed(2), S1: +pivotsLive.S1.toFixed(2), S2: +pivotsLive.S2.toFixed(2) } : null,
    macro: macro ? Object.fromEntries(Object.entries(macro).map(([k, v]) => [k, { value: v.value, prior: v.prior }])) : null,
    cot: cot ? { date: cot.date, funds: { net: cot.funds.net, deltaNet: cot.funds.deltaNet }, commercials: { net: cot.commercials.net }, retail: { net: cot.retail.net, deltaNet: cot.retail.deltaNet } } : null,
    btc: cross.btc ? { price: Math.round(cross.btc.price), changePct: +cross.btc.changePct.toFixed(2) } : null,
    riskAssets: { spy: cross.spy ? +cross.spy.changePct.toFixed(2) : null, qqq: cross.qqq ? +cross.qqq.changePct.toFixed(2) : null, vix: cross.vixy ? +cross.vixy.changePct.toFixed(2) : null, dollarRealtime: cross.uup ? +cross.uup.changePct.toFixed(2) : null },
  }

  // ── panel-panel reusable ──
  const SignalMeterPanel = (
    <Panel title="Signal Meter · XAU/USD" icon={Compass} accent={meterZone(sc.overall).color} info="Rangkuman keseluruhan dari 3 pilar (makro, teknikal, sentimen). Jarum ke kanan = bullish, ke kiri = bearish. Warna kartu ikut arah tren (hijau bullish / merah bearish).">
      <div className="flex flex-col items-center">
        <div className="w-[210px] max-w-full"><Gauge score={sc.overall} /></div>
        <p className="text-lg font-black -mt-2 leading-none" style={{ color: meterZone(sc.overall).color }}>{meterZone(sc.overall).name}</p>
        <p className="text-[10px] text-white/35 mt-1 tabular-nums">Skor {sc.overall > 0 ? '+' : ''}{Math.round(sc.overall)} · Confidence {sc.confidence}%</p>
      </div>
      <div className="mt-2.5 space-y-1.5 text-[11px]">
        <div className="flex justify-between"><span className="text-white/45">Pendorong utama</span><span className="font-semibold text-white/85">{strongestPillar}</span></div>
        <div className="flex justify-between"><span className="text-white/45">Volatilitas</span><span className={`font-semibold ${volLabel === 'Rendah' ? 'text-amber-400' : 'text-emerald-400'}`}>{volLabel}</span></div>
      </div>
    </Panel>
  )
  const BiasPanel = (
    <Panel title="Bias & Confidence" icon={GaugeIcon} info="3 pilar penilaian dalam persen (0% = sangat bearish, 100% = sangat bullish). Confidence = seberapa sepakat ketiga pilar — makin tinggi makin kuat sinyalnya." right={<span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${dirBg(sc.label)}`}>{sc.label} {confPct}%</span>}>
      <div className="flex items-center gap-3 mb-3">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" /><circle cx="18" cy="18" r="15" fill="none" stroke={sc.confidence > 66 ? '#34d399' : sc.confidence > 40 ? '#fbbf24' : '#f87171'} strokeWidth="3.5" strokeDasharray={`${sc.confidence / 100 * 94} 94`} strokeLinecap="round" /></svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-sm font-black tabular-nums leading-none">{sc.confidence}%</span><span className="text-[7px] text-white/40 uppercase">yakin</span></span>
        </div>
        <div className="flex-1">
          <p className="text-[11px] text-white/55 leading-snug">Kesepakatan sinyal: <b className={sc.confidence > 66 ? 'text-emerald-400' : sc.confidence > 40 ? 'text-amber-400' : 'text-red-400'}>{sc.confidence > 66 ? 'Kuat' : sc.confidence > 40 ? 'Sedang' : 'Lemah'}</b>. {sc.confidence > 66 ? 'Ketiga pilar cenderung sejalan.' : sc.confidence > 40 ? 'Sebagian pilar sejalan.' : 'Pilar saling bertentangan — hati-hati.'}</p>
        </div>
      </div>
      <div className="space-y-2.5">
        <PillarRow label="Makro (FRED)" score={sc.macro} desc="Dolar, yield, inflasi, kebijakan Fed" />
        <PillarRow label="Teknikal (Chart)" score={sc.tech} desc="Konfluensi M5/M15/H1 · EMA · RSI · VWAP" />
        <PillarRow label="Sentimen (Berita/Pasar)" score={sc.senti} desc="Berita AI, VIX, saham, BTC" />
      </div>
    </Panel>
  )
  const KesimpulanPanel = (
    <Panel title="Kesimpulan & Saran" icon={Lightbulb} info="Rangkuman otomatis dari seluruh data (teknikal, makro, COT, berita) → kesimpulan + saran aksi + catatan risiko.">
      <div className="flex items-center gap-2 mb-2"><span className="text-lg font-black" style={{ color: meterZone(sc.overall).color }}>{meterZone(sc.overall).name}</span><span className="text-[10px] text-white/40">Confidence {sc.confidence}%</span></div>
      <ul className="space-y-1 mb-2">{kLines.map((l, i) => <li key={i} className="text-[10px] text-white/65 leading-snug flex gap-1.5"><span className="text-primary mt-0.5">•</span>{l}</li>)}</ul>
      <div className="mt-auto space-y-1.5">
        <div className="flex items-start gap-1.5 rounded-lg bg-primary/8 p-2"><Target size={12} className="text-primary mt-0.5 shrink-0" /><p className="text-[10px] text-white/85 font-medium leading-snug">{kAction}</p></div>
        <div className="flex items-start gap-1.5"><span className="text-[9px] text-amber-400/70 mt-0.5">⚠</span><p className="text-[9px] text-white/45 leading-snug">{kRisk}</p></div>
      </div>
    </Panel>
  )
  const MtfPanel = (
    <Panel title="Konfluensi Multi-Timeframe" icon={Crosshair} info="Bias tiap timeframe (M5/M15/H1) dari EMA, VWAP, RSI. Entry paling aman searah TF besar (H1)." right={<span className={`text-[10px] font-bold ${dirColor(conf.label)}`}>{conf.label === 'NETRAL' ? 'CAMPUR' : conf.label} · {conf.strength}</span>}>
      <div className="space-y-2">{TFS.map(x => { const b = feed.tf[x].bias; return (
        <div key={x} className="flex items-center gap-2"><span className="text-[11px] font-bold w-8 text-white/60">{x}</span><div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden"><div className={`h-full ${b.label === 'BULLISH' ? 'bg-emerald-400' : b.label === 'BEARISH' ? 'bg-red-400' : 'bg-white/25'}`} style={{ width: `${33 + Math.abs(b.score) * 22}%` }} /></div><span className={`text-[10px] font-bold w-16 text-right ${dirColor(b.label)}`}>{b.label}</span></div>) })}</div>
      <p className="text-[9px] text-white/30 mt-2 pt-2 border-t border-white/5">Entry paling aman searah TF besar (H1).</p>
    </Panel>
  )
  const MomentumPanel = (
    <Panel title="Volatilitas & Momentum" icon={Waves} info="Volatilitas = seberapa besar pergerakan sekarang vs rata-rata (rasio ATR M5). Rendah = kurang reliabel/whipsaw, Tinggi = pergerakan cepat. RSI = jenuh beli (>70)/jual (<30). Jarum bergetar seperti speedometer.">
      <div className="rounded-xl bg-white/[0.03] p-2.5 mb-2.5 flex items-center gap-3">
        <div className="w-24 sm:w-28 shrink-0"><VolatilityMeter ratio={volRatio} label={volLabel} /></div>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-white/35 mb-0.5"><Flame size={10} /> Volatilitas</p>
          <p className={`text-xl font-black leading-none ${volLabel === 'Tinggi' ? 'text-amber-400' : volLabel === 'Rendah' ? 'text-sky-400' : 'text-emerald-400'}`}>{volLabel}</p>
          <p className="text-[9px] text-white/40 mt-1 tabular-nums">rasio {volRatio.toFixed(2)}× vs rata-rata</p>
          <p className="text-[9px] text-white/40 mt-0.5 tabular-nums">ATR M5 ${feed.tf.M5.atr.toFixed(2)} · M15 ${feed.tf.M15.atr.toFixed(2)}</p>
        </div>
      </div>
      <p className="text-[9px] uppercase tracking-wider text-white/35 mb-1">RSI per Timeframe</p>
      <div className="grid grid-cols-3 gap-1.5">{TFS.map(t => { const r = feed.tf[t].rsi; return (
        <div key={t} className="rounded-lg bg-white/[0.03] py-1.5 text-center"><p className="text-[8px] text-white/35">{t}</p><p className={`text-sm font-bold tabular-nums ${r > 70 ? 'text-red-400' : r < 30 ? 'text-emerald-400' : 'text-white/80'}`}>{r.toFixed(0)}</p><p className="text-[7px] text-white/30">{r > 70 ? 'jenuh beli' : r < 30 ? 'jenuh jual' : 'normal'}</p></div>) })}</div>
      <div className="flex justify-between text-[10px] mt-2 pt-2 border-t border-white/5"><span className="text-white/45" title="Rata-rata harga sejak awal sesi hari ini (anchored, bukan jendela sembarang)">Harga vs VWAP Sesi M15</span><span className={`font-bold ${feed.price > feed.tf.M15.vwap ? 'text-emerald-400' : 'text-red-400'}`}>{feed.price > feed.tf.M15.vwap ? 'di atas (+' : 'di bawah ('}{(feed.price - feed.tf.M15.vwap).toFixed(1)})</span></div>
    </Panel>
  )
  const ZonaRow = ({ z }: { z: typeof allZones[number] }) => (
    <div className={`rounded-lg border px-2.5 py-1.5 ${z.inside ? 'border-amber-500/40 bg-amber-500/10' : z.kind === 'res' ? 'border-red-500/20 bg-red-500/[0.05]' : 'border-emerald-500/20 bg-emerald-500/[0.05]'}`}>
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-1.5 text-[11px] font-bold ${z.kind === 'res' ? 'text-red-400' : 'text-emerald-400'}`}>{z.kind === 'res' ? '🔴' : '🟢'} {z.label}<span className="rounded px-1 py-0.5 text-[8px] font-bold bg-white/10 text-white/50">{z.src}</span></span>
        <span className={`text-[10px] font-bold tabular-nums ${z.inside ? 'text-amber-400' : 'text-white/40'}`}>{z.inside ? 'DI DALAM ZONA' : `${z.dist >= 0 ? '+' : ''}${z.dist.toFixed(1)} poin`}</span>
      </div>
      <p className="text-[11px] font-bold tabular-nums text-white/85 mt-0.5">{f2(z.low)} – {f2(z.high)}</p>
    </div>
  )
  const ZonaPanel = (
    <Panel title="Zona Support & Resistance (Scalping)" icon={Layers} info="Zona S/R TERDEKAT dari swing intraday M5 & M15 (paling relevan untuk scalping) + pivot harian. Tag M5/M15/Pivot menandai sumbernya. Lebar band ikut volatilitas (ATR M5). Resistance di atas (rem naik), support di bawah (rem turun). Amber = harga sedang di dalam zona.">
      {allZones.length ? (
        <div className="space-y-2">
          <div className="space-y-1.5">{resZones.slice().reverse().map((z, i) => <ZonaRow key={`r${i}`} z={z} />)}</div>
          <div className="flex items-center gap-2 py-0.5"><span className="text-[10px] font-black text-primary shrink-0">HARGA</span><div className="flex-1 h-px bg-primary/40" /><span className="text-sm font-black text-primary tabular-nums">{f2(feed.price)}</span></div>
          <div className="space-y-1.5">{supZones.map((z, i) => <ZonaRow key={`s${i}`} z={z} />)}</div>
          {nearest && <p className="text-[9px] text-white/40 mt-1 pt-2 border-t border-white/5">Zona terdekat: <b className={nearest.kind === 'res' ? 'text-red-400' : 'text-emerald-400'}>{nearest.label}</b> {nearest.inside ? '— harga sedang di dalamnya (rawan pantul/tembus).' : `${Math.abs(nearest.dist).toFixed(1)} poin ${nearest.dist >= 0 ? 'di atas' : 'di bawah'}.`} Scalping: cari pantulan di support / rejeksi di resistance.</p>}
        </div>
      ) : <div className="flex items-center justify-center py-6 text-white/30 text-[11px] gap-2"><Loader2 size={14} className="animate-spin" /> memuat zona…</div>}
    </Panel>
  )
  // Bias dari timeframe besar (H4 & Daily) — filter arah untuk scalping
  const h4b = feed.htf.H4?.bias.label, d1b = feed.htf.D1?.bias.label
  const htfVerdict = (() => {
    if (!h4b || !d1b) return null
    if (h4b === d1b && h4b !== 'NETRAL') return { label: h4b, text: `Tren besar ${h4b} (H4 & Daily searah). Utamakan entry SEARAH — jangan lawan tren besar.` }
    const big = d1b !== 'NETRAL' ? d1b : h4b
    if (big === 'NETRAL') return { label: 'NETRAL', text: 'H4 & Daily netral/ranging — tidak ada tren besar dominan, boleh main dua arah di zona.' }
    return { label: big, text: `Bias Daily ${d1b}, H4 ${h4b} — belum sepenuhnya searah. Prioritas tetap ke arah Daily (${d1b}), hati-hati saat melawan.` }
  })()
  const HtfBiasPanel = (
    <Panel title="Bias Timeframe Besar (H4 & Daily)" icon={CalendarClock} info="Arah tren dari TF besar: H4 = swing, Daily = harian. Dipakai sebagai FILTER arah — untuk scalping, utamakan entry searah tren besar, hindari melawannya.">
      <div className="space-y-2">
        {HTFS.map(t => {
          const d = feed.htf[t]
          const name = t === 'H4' ? 'H4 · swing' : 'Daily · harian'
          if (!d) return <div key={t} className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-2 text-[11px] text-white/30"><Loader2 size={12} className="animate-spin" /> {name} memuat…</div>
          const emaUp = d.ema9[d.ema9.length - 1] > d.ema21[d.ema21.length - 1]
          return (
            <div key={t} className="rounded-lg bg-white/[0.03] p-2">
              <div className="flex items-center justify-between mb-1"><span className="text-[11px] font-bold text-white/70">{name}</span><span className={`text-[10px] font-black rounded-full px-2 py-0.5 ${dirBg(d.bias.label)}`}>{d.bias.label}</span></div>
              <p className="text-[9px] text-white/45 tabular-nums">EMA {emaUp ? '▲ naik' : '▼ turun'} · RSI {d.rsi.toFixed(0)} · MACD {d.macd.state} · {d.structure.label}</p>
            </div>
          )
        })}
      </div>
      {htfVerdict && <div className="mt-2 rounded-lg bg-primary/8 p-2 flex items-start gap-1.5"><Compass size={12} className="text-primary mt-0.5 shrink-0" /><p className="text-[10px] text-white/85 leading-snug">{htfVerdict.text}</p></div>}
    </Panel>
  )
  const CrossPanel = (
    <Panel title="Lintas-Aset (korelasi ke emas)" icon={BarChart3} className="lg:col-span-12" info="Dolar & yield naik, saham risk-on kuat → emas cenderung turun. VIX naik (takut) & BTC (debasement) → cenderung bullish emas." right={<span className="text-[9px] text-white/30">FRED + Twelve Data</span>}>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <DataCard meta={CROSS_META.dollar} value={macro?.dollar?.value ?? null} prior={macro?.dollar?.prior} />
        <DataCard meta={CROSS_META.uup} value={cross.uup?.price ?? null} changePct={cross.uup?.changePct} />
        <DataCard meta={CROSS_META.us10y} value={macro?.us10y?.value ?? null} prior={macro?.us10y?.prior} />
        <DataCard meta={CROSS_META.vixy} value={cross.vixy?.price ?? null} changePct={cross.vixy?.changePct} />
        <DataCard meta={CROSS_META.spy} value={cross.spy?.price ?? null} changePct={cross.spy?.changePct} />
        <DataCard meta={CROSS_META.qqq} value={cross.qqq?.price ?? null} changePct={cross.qqq?.changePct} />
        <DataCard meta={CROSS_META.btc} value={cross.btc?.price ?? null} changePct={cross.btc?.changePct} />
      </div>
    </Panel>
  )
  const InflasiPanel = (
    <Panel title="Inflasi & Kebijakan The Fed" icon={Landmark} className="lg:col-span-12" info="Data makro FRED (rilis bulanan/harian). Inflasi turun & suku bunga turun → cenderung bullish emas." right={<span className="text-[9px] text-white/30">FRED · resmi</span>}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">{MACRO_META.map(({ key, meta }) => <DataCard key={key} meta={meta} value={macro?.[key]?.value ?? null} prior={macro?.[key]?.prior} />)}</div>
    </Panel>
  )
  const CotPanel = (
    <Panel title="COT — Retail vs Institusi" icon={Users} info="Commitment of Traders (CFTC, mingguan). Bar hijau=long, merah=short. Funds=institusi, Commercials=hedger/bank (smart money), Retail=trader kecil (sering kontrarian)." right={cot ? <span className="text-[9px] text-white/30">{cot.date}</span> : null}>
      {cot ? (
        <div className="divide-y divide-white/5">
          <CotBar label="🏛️ Funds (Institusi/spekulan besar)" g={cot.funds} hint="Non-commercial: hedge fund & spekulan besar. Trend-follower." />
          <CotBar label="🏦 Commercials (hedger/bank)" g={cot.commercials} hint="Produsen/bank. Sering benar di titik ekstrem (smart money)." />
          <CotBar label="👤 Retail (trader kecil)" g={cot.retail} hint="Non-reportable: trader ritel. Sering kontrarian saat ekstrem." />
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="rounded-lg bg-white/[0.03] p-2"><p className="text-[9px] text-white/40 mb-1">Tren net Institusi (12 mgg)</p><div className="flex items-center gap-2"><Sparkline data={cot.fundsHistory} color="#34d399" w={70} /><span className={`text-[10px] font-bold ${cot.fundsHistory[cot.fundsHistory.length - 1] >= cot.fundsHistory[0] ? 'text-emerald-400' : 'text-red-400'}`}>{cot.fundsHistory[cot.fundsHistory.length - 1] >= cot.fundsHistory[0] ? 'menambah long' : 'mengurangi'}</span></div></div>
            <div className="rounded-lg bg-white/[0.03] p-2"><p className="text-[9px] text-white/40 mb-1">Tren net Retail (12 mgg)</p><div className="flex items-center gap-2"><Sparkline data={cot.retailHistory} color="#a78bfa" w={70} /><span className={`text-[10px] font-bold ${cot.retailHistory[cot.retailHistory.length - 1] >= cot.retailHistory[0] ? 'text-emerald-400' : 'text-red-400'}`}>{cot.retailHistory[cot.retailHistory.length - 1] >= cot.retailHistory[0] ? 'menambah long' : 'mengurangi'}</span></div></div>
          </div>
          <p className="text-[9px] text-white/40 pt-2">{cot.funds.net * cot.retail.net < 0 ? 'Institusi & retail berlawanan — condong ikuti institusi.' : 'Institusi & retail searah.'} Data mingguan (lagging) — konteks, bukan sinyal entry.</p>
        </div>
      ) : <div className="flex items-center justify-center py-6 text-white/30 text-[11px] gap-2"><Loader2 size={14} className="animate-spin" /> memuat COT…</div>}
    </Panel>
  )
  const NewsPanel = (
    <Panel title="Berita Emas & Dolar" icon={Newspaper} className="h-[420px]" info="Headline terbaru emas/dolar/Fed dari Google News (klik untuk buka). Analisa sentimennya ada di panel Analisa AI.">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5">
        {!newsItems ? <div className="flex items-center justify-center py-8 text-white/30 text-[11px] gap-2"><Loader2 size={14} className="animate-spin" /> memuat berita…</div>
          : newsItems.map((n, i) => (
            <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 rounded-lg p-2 hover:bg-white/[0.03] transition-colors group">
              <span className="text-[8px] font-bold uppercase rounded px-1.5 py-0.5 mt-0.5 shrink-0 bg-white/8 text-white/50">{n.source.slice(0, 12)}</span>
              <p className="text-[11px] text-white/70 leading-snug flex-1 group-hover:text-white/90">{n.text}</p>
              <span className="text-[9px] text-white/30 shrink-0 flex items-center gap-1 mt-0.5">{n.time}<ExternalLink size={9} className="opacity-0 group-hover:opacity-60" /></span>
            </a>
          ))}
      </div>
    </Panel>
  )
  const CalendarPanel = (
    <Panel title="Kalender Ekonomi AS" icon={CalendarClock} className="h-[420px]" info="Jadwal rilis data ekonomi AS berdampak tinggi. Hindari entry menjelang rilis high-impact.">
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden"><TVWidget src="https://s3.tradingview.com/external-embedding/embed-widget-events.js" config={TV_EVENTS} /></div>
    </Panel>
  )

  // Jadwal refresh data — semua auto-refresh sendiri, ini bukti + countdown-nya
  // ── Status Server (menu terpisah) ──
  const liveForced: ApiStat | undefined = live.status === 'error' ? 'offline' : undefined
  const apiSources: { label: string; sub: string; ts: number | null; interval: number; forced?: ApiStat }[] = [
    { label: 'Harga (Quote)', sub: 'Twelve Data · tiap 8 dtk', ts: live.quoteAt, interval: 8_000, forced: liveForced },
    { label: 'Candle M5/M15/H1', sub: 'Twelve Data · tiap 60 dtk', ts: live.candlesAt, interval: 60_000, forced: liveForced },
    { label: 'Candle H4/Daily', sub: 'Twelve Data · tiap 5 mnt', ts: live.htfAt, interval: 300_000, forced: liveForced },
    { label: 'Lintas-Aset', sub: 'Twelve Data · tiap 45 dtk', ts: cross.updatedAt, interval: 45_000 },
    { label: 'Makro', sub: 'FRED · tiap 1 jam', ts: macroAt, interval: 3_600_000 },
    { label: 'Pivot Harian', sub: 'Twelve Data · tiap 1 jam', ts: pivotAt, interval: 3_600_000 },
    { label: 'COT Institusi', sub: 'CFTC Socrata · tiap 6 jam', ts: cotAt, interval: 6 * 3_600_000 },
    { label: 'Berita RSS', sub: 'Multi-sumber · tiap 10 mnt', ts: newsAt, interval: 600_000 },
  ]
  const apiStatuses = apiSources.map(s => apiStat(s.ts, s.interval, now, s.forced))
  const onlineCount = apiStatuses.filter(s => s === 'online').length
  const offlineCount = apiStatuses.filter(s => s === 'offline').length
  const overall: ApiStat = offlineCount > 0 ? 'offline' : apiStatuses.some(s => s === 'stale') ? 'stale' : apiStatuses.some(s => s === 'connecting') ? 'connecting' : 'online'
  const ServerStatusContent = (
    <>
      <Panel title="Ringkasan Server" icon={Server} className="lg:col-span-4" info="Status keseluruhan koneksi data terminal. Online = data terbaru berhasil diambil sesuai jadwal.">
        <div className="flex flex-col items-center justify-center flex-1 py-2">
          <div className="relative">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center ${STAT_META[overall].dot} ${overall === 'online' ? 'shadow-[0_0_0_6px_rgba(52,211,153,0.12)]' : ''}`}>
              <Server size={26} className="text-[#060a09]" />
            </div>
            {overall === 'online' && <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />}
          </div>
          <p className={`mt-3 text-lg font-black ${STAT_META[overall].text}`}>{overall === 'online' ? 'Semua Online' : overall === 'offline' ? 'Ada Gangguan' : overall === 'stale' ? 'Sebagian Lambat' : 'Menghubungkan'}</p>
          <p className="text-[11px] text-white/45 tabular-nums mt-0.5">{onlineCount}/{apiSources.length} API online{offlineCount > 0 ? ` · ${offlineCount} offline` : ''}</p>
        </div>
      </Panel>
      <Panel title="Cara Kerja Refresh" icon={RefreshCw} className="lg:col-span-8" info="Ringkasan mekanisme auto-refresh terminal.">
        <div className="space-y-2 text-[11px] text-white/60 leading-relaxed flex-1">
          <p>Semua data <b className="text-white/80">auto-refresh sendiri</b> di browser — tidak perlu reload halaman. Tiap jenis data punya interval berbeda: data cepat (harga 8 dtk) menyegar sering, data lambat (COT 6 jam) jarang, agar hemat kuota API.</p>
          <p className="flex items-start gap-2"><span className="text-amber-400 shrink-0">⏸</span> Refresh <b className="text-white/80">berhenti otomatis</b> saat tab browser di-background, lalu lanjut lagi begitu tab dibuka — ini normal, bukan error.</p>
          <p className="flex items-start gap-2"><span className="text-emerald-400 shrink-0">↻</span> Angka ↻ di tiap baris = hitung mundur ke refresh berikutnya. Status dihitung dari keberhasilan & keterbaruan fetch terakhir.</p>
        </div>
      </Panel>
      <Panel title="Status API Data" icon={Signal} className="lg:col-span-8" info="Status online/offline tiap sumber data real-time. Hijau = online & terbaru, kuning = data mulai basi, merah = gagal/putus.">
        <div className="grid sm:grid-cols-2 gap-2">
          {apiSources.map((s, i) => <ApiStatusRow key={s.label} label={s.label} sub={s.sub} stat={apiStatuses[i]} ts={s.ts} intervalMs={s.interval} now={now} />)}
        </div>
      </Panel>
      <Panel title="Layanan On-Demand" icon={Brain} className="lg:col-span-4" info="Layanan yang jalan saat diminta / terjadwal, bukan polling terus-menerus.">
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <span className="h-2 w-2 rounded-full bg-sky-400 shrink-0" />
            <div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-white/85">Analisa AI (Datalitiq AI)</p><p className="text-[9px] text-white/40">saat klik "Jalankan Analisa"</p></div>
            <span className="text-[10px] font-bold text-sky-400 shrink-0">On-demand</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <span className="h-2 w-2 rounded-full bg-sky-400 shrink-0" />
            <div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-white/85">Notifikasi Telegram</p><p className="text-[9px] text-white/40">Cron eksternal · tiap 5 mnt</p></div>
            <span className="text-[10px] font-bold text-sky-400 shrink-0">Terjadwal</span>
          </div>
        </div>
      </Panel>
      <Panel title="Akurasi Kesimpulan (30 hari)" icon={Target} className="lg:col-span-12" info="Kalibrasi ke depan: tiap kesimpulan yang tercatat (via cron) dievaluasi 2 jam kemudian — apakah harga bergerak sesuai arah yang disimpulkan. Butuh cron aktif + tabel terminal_predictions; angka akurat terkumpul setelah beberapa hari/minggu.">
        {accuracy?.ready && accuracy.total > 0 ? (
          <div className="flex items-center gap-5">
            <div className="text-center">
              <p className={`text-4xl font-black tabular-nums ${(accuracy.pct ?? 0) >= 60 ? 'text-emerald-400' : (accuracy.pct ?? 0) >= 45 ? 'text-amber-400' : 'text-red-400'}`}>{accuracy.pct}%</p>
              <p className="text-[10px] text-white/40 mt-0.5">arah benar</p>
            </div>
            <div className="flex-1">
              <div className="h-2.5 rounded-full bg-white/5 overflow-hidden"><div className={`h-full rounded-full ${(accuracy.pct ?? 0) >= 60 ? 'bg-emerald-400' : (accuracy.pct ?? 0) >= 45 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${accuracy.pct ?? 0}%` }} /></div>
              <p className="text-[11px] text-white/55 mt-2"><b className="text-white/85 tabular-nums">{accuracy.correct}</b> dari <b className="text-white/85 tabular-nums">{accuracy.total}</b> kesimpulan terarah benar dalam 2 jam (30 hari terakhir). Dipakai untuk menakar keandalan sinyal — makin banyak data, makin akurat angkanya.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-white/45 text-[11px] py-2"><Clock size={14} className="text-white/30" /> Mengumpulkan data kalibrasi{accuracy?.ready ? ' (belum ada kesimpulan yang dievaluasi)' : ' — aktifkan cron & tabel terminal_predictions'}. Angka akurasi muncul setelah beberapa jam berjalan.</div>
        )}
      </Panel>
    </>
  )

  // Strip insight (Ringkasan) — metrik turunan penting dalam satu pandangan
  // ── Decision Hero: jawaban satu-pandang (arah + keyakinan + kondisi + aksi) ──
  const heroClr = dir === 'BULLISH' ? '#34d399' : dir === 'BEARISH' ? '#f87171' : '#9ca3af'
  const DecisionHero = (
    <div className="lg:col-span-12 relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0b100e] p-4 sm:p-5"
      style={{ backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${heroClr}1c, transparent 50%), linear-gradient(to bottom, rgba(255,255,255,0.03), transparent 45%)`, boxShadow: `inset 0 1px 0 0 ${heroClr}55` }}>
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '26px 26px' }} />
      <div className="relative flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        <div className="flex items-center gap-4 lg:pr-6 lg:border-r lg:border-white/[0.07]">
          <div className="relative w-[74px] h-[74px] shrink-0">
            <svg viewBox="0 0 36 36" className="w-[74px] h-[74px] -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" /><circle cx="18" cy="18" r="15.5" fill="none" stroke={heroClr} strokeWidth="3" strokeDasharray={`${sc.confidence / 100 * 97.4} 97.4`} strokeLinecap="round" /></svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-lg font-black tabular-nums leading-none">{sc.confidence}%</span><span className="text-[7px] text-white/40 uppercase tracking-wider mt-0.5">yakin</span></span>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">Kesimpulan Saat Ini</p>
            <p className="text-2xl font-black leading-none" style={{ color: heroClr }}>{dir === 'BULLISH' ? 'Bias BELI' : dir === 'BEARISH' ? 'Bias JUAL' : 'TUNGGU'}</p>
            <p className="text-[10px] text-white/45 mt-1.5 tabular-nums">Skor {sc.overall > 0 ? '+' : ''}{Math.round(sc.overall)} · {meterZone(sc.overall).name}</p>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="flex items-start gap-2 text-[12px] text-white/85 font-medium leading-relaxed"><Target size={14} className="mt-0.5 shrink-0" style={{ color: heroClr }} />{kAction}</p>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <span className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold ${regime.c}`}><Signal size={9} /> {regime.label}</span>
            <span className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold ${volLabel === 'Tinggi' ? 'text-amber-400' : volLabel === 'Rendah' ? 'text-sky-400' : 'text-emerald-400'}`}><Flame size={9} /> Volatilitas {volLabel}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-white/60"><Crosshair size={9} /> {conf.bulls}B/{conf.bears}S dari 3 TF</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-white/60"><Circle size={7} className="fill-primary text-primary" /> Sesi {session}</span>
          </div>
        </div>
        <p className="hidden xl:block text-[9px] text-white/30 max-w-[130px] leading-relaxed shrink-0">Ringkasan otomatis dari teknikal, makro & sentimen. Detail di panel bawah.</p>
      </div>
    </div>
  )
  const InsightStrip = (
    <div className="lg:col-span-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      <StatTile icon={Signal} label="Regime Pasar" value={<span className={regime.c}>{regime.label}</span>} sub={regime.desc} tone="neutral" info="3 kondisi pasar. Ranging = sideways/squeeze, tanpa arah (main pantulan). Sedang Konfirmasi Arah = tren belum matang atau momentum berubah, arah belum pasti (tunggu). Trending Bullish/Bearish = ADX≥25 & menguat, arah terkonfirmasi (ikuti arah). Arah dari +DI vs -DI M15." />
      <StatTile icon={Zap} label="Momentum" value={<span className={avgMomentum > 15 ? 'text-emerald-400' : avgMomentum < -15 ? 'text-red-400' : 'text-white/70'}>{avgMomentum > 15 ? 'Bullish' : avgMomentum < -15 ? 'Bearish' : 'Netral'}</span>} sub={`skor ${avgMomentum >= 0 ? '+' : ''}${avgMomentum.toFixed(0)} · RSI/MACD/Stoch`} tone={avgMomentum > 15 ? 'bull' : avgMomentum < -15 ? 'bear' : 'neutral'} info="Gabungan RSI, MACD, Stochastic & Bollinger %B dari 3 timeframe." />
      <StatTile icon={ArrowUpDown} label="Posisi Range Hari Ini" value={`${(dayPos * 100).toFixed(0)}%`} sub={dayPos > 0.7 ? 'dekat high' : dayPos < 0.3 ? 'dekat low' : 'tengah range'} tone={dayPos > 0.7 ? 'bull' : dayPos < 0.3 ? 'bear' : 'neutral'} info={`Posisi harga di antara Low ${f2(feed.dayLow)} dan High ${f2(feed.dayHigh)} hari ini.`} />
      <StatTile icon={Scale} label="Sentimen Risiko" value={<span className={riskOn < -0.1 ? 'text-emerald-400' : riskOn > 0.1 ? 'text-red-400' : 'text-white/70'}>{riskOn < -0.1 ? 'Risk-Off' : riskOn > 0.1 ? 'Risk-On' : 'Netral'}</span>} sub={riskOn < -0.1 ? 'pasar takut → bullish emas' : riskOn > 0.1 ? 'pasar berani → tekan emas' : 'seimbang'} tone={riskOn < -0.1 ? 'bull' : riskOn > 0.1 ? 'bear' : 'neutral'} info="Dari VIX, S&P500, Nasdaq, BTC. Risk-off (takut) biasanya mengangkat emas." />
      <StatTile icon={Coins} label="Rasio Emas/Perak" value={goldSilver ? goldSilver.toFixed(1) : '—'} sub={goldSilver ? (goldSilver > 85 ? 'emas relatif mahal' : goldSilver < 70 ? 'perak memimpin' : 'normal') : 'memuat'} tone="neutral" info="XAU/XAG. >85 emas mahal relatif perak (sering risk-off); <70 perak memimpin (risk-on)." />
      <StatTile icon={GitBranch} label="Yield Curve 2s10s" value={curve2s10 != null ? `${curve2s10 >= 0 ? '+' : ''}${curve2s10.toFixed(2)}` : '—'} sub={curve2s10 != null ? (curve2s10 < 0 ? 'inversi — sinyal resesi' : 'normal') : 'memuat'} tone={curve2s10 != null && curve2s10 < 0 ? 'warn' : 'neutral'} info="Selisih yield 10Y − 2Y. Negatif (inversi) = pasar cemas resesi → mendorong ekspektasi pemangkasan Fed (bullish emas jangka menengah)." />
    </div>
  )

  // Matrix indikator multi-timeframe (heatmap)
  const cols = ['Tren', 'RSI', 'MACD', 'Stoch', 'Struktur']
  const IndicatorMatrix = (
    <Panel title="Matrix Indikator Multi-Timeframe" icon={LayoutDashboard} info="Sekilas kondisi tiap indikator di M5/M15/H1. Hijau=bullish, merah=bearish, abu=netral. Makin banyak hijau/merah sejajar = sinyal makin searah.">
      <div className="grid grid-cols-6 gap-1 text-center">
        <div />{cols.map(c => <div key={c} className="text-[9px] font-bold uppercase tracking-wider text-white/35 pb-1">{c}</div>)}
        {TFS.map(t => { const d = feed.tf[t]
          const trendS: 'bullish' | 'bearish' | 'netral' = d.ema9[d.ema9.length - 1] > d.ema21[d.ema21.length - 1] ? 'bullish' : 'bearish'
          const rsiS: 'bullish' | 'bearish' | 'netral' = d.rsi > 55 ? 'bullish' : d.rsi < 45 ? 'bearish' : 'netral'
          const stochS: 'bullish' | 'bearish' | 'netral' = d.stoch.k > 55 ? 'bullish' : d.stoch.k < 45 ? 'bearish' : 'netral'
          const strucS: 'bullish' | 'bearish' | 'netral' = d.structure.label === 'Uptrend' ? 'bullish' : d.structure.label === 'Downtrend' ? 'bearish' : 'netral'
          return (
            <div key={t} className="contents">
              <div className="text-[10px] font-bold text-white/60 flex items-center justify-center">{t}</div>
              <HeatCell state={trendS} text={trendS === 'bullish' ? 'EMA↑' : 'EMA↓'} />
              <HeatCell state={rsiS} text={d.rsi.toFixed(0)} />
              <HeatCell state={d.macd.state} text={d.macd.state === 'bullish' ? 'MACD↑' : d.macd.state === 'bearish' ? 'MACD↓' : '—'} />
              <HeatCell state={stochS} text={d.stoch.k.toFixed(0)} />
              <HeatCell state={strucS} text={d.structure.label === 'Uptrend' ? 'HH/HL' : d.structure.label === 'Downtrend' ? 'LH/LL' : 'Range'} />
            </div>
          )
        })}
      </div>
    </Panel>
  )

  // Deteksi Pembalikan Arah — gabungan cross EMA/DI/MACD/struktur per timeframe
  const ReversalPanel = (
    <Panel title="Deteksi Pembalikan Arah" icon={Waves} info="Menggabungkan 4 sinyal cross yang BARU SAJA terjadi: EMA9×EMA21, +DI×-DI, MACD histogram tembus nol, dan perubahan struktur pasar (HH/HL). Skor = berapa sinyal yang sepakat (0-4). Skor ≥2 = indikasi cukup kuat; skor 1 = masih lemah, tunggu konfirmasi.">
      <div className="space-y-2">
        {TFS.map(t => {
          const r = feed.tf[t].reversal
          const strong = r.skor >= 2
          const boxCls = r.arah === 'bullish' ? 'bg-emerald-500/10 border-emerald-500/25' : r.arah === 'bearish' ? 'bg-red-500/10 border-red-500/25' : 'bg-white/[0.03] border-white/10'
          return (
            <div key={t} className={`rounded-lg border px-2.5 py-2 ${boxCls}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-white/70">{t}</span>
                {r.arah === 'netral' ? <span className="text-[10px] text-white/35">Tidak ada sinyal reversal</span> : (
                  <span className={`flex items-center gap-1 text-[10px] font-black ${dirColor(r.arah)}`}>
                    {r.arah === 'bullish' ? '↗ Reversal Bullish' : '↘ Reversal Bearish'}
                    <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] ${strong ? 'bg-white/15' : 'bg-white/5'}`}>{r.skor}/4</span>
                  </span>
                )}
              </div>
              {r.sinyal.length > 0 && <p className="text-[9px] text-white/45 leading-snug">{r.sinyal.join(' · ')}</p>}
            </div>
          )
        })}
      </div>
      <p className="text-[9px] text-white/30 mt-2 pt-2 border-t border-white/5">Ini sinyal teknikal murni (price action), bukan jaminan — kombinasikan dengan Regime Pasar & bias timeframe besar sebelum bertindak.</p>
    </Panel>
  )

  // Osilator detail (MACD, Stochastic, Bollinger) untuk M15
  const oscTf = feed.tf.M15
  const OscillatorPanel = (
    <Panel title="Osilator & Bollinger (M15)" icon={Waves} info="MACD = momentum tren (histogram + = bullish). Stochastic = jenuh beli/jual jangka pendek. Bollinger %B = posisi harga di pita; squeeze = volatilitas menyempit, sering awal breakout.">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between rounded-lg bg-white/[0.03] p-2">
          <div><p className="text-[9px] uppercase tracking-wider text-white/35">MACD</p><p className={`text-sm font-black leading-none mt-0.5 ${dirColor(oscTf.macd.state)}`}>{oscTf.macd.state === 'bullish' ? 'Bullish' : oscTf.macd.state === 'bearish' ? 'Bearish' : 'Netral'}</p></div>
          <div className="text-right text-[9px] text-white/45 tabular-nums"><p>MACD {oscTf.macd.macd.toFixed(2)}</p><p>Signal {oscTf.macd.signal.toFixed(2)}</p><p className={oscTf.macd.hist >= 0 ? 'text-emerald-400' : 'text-red-400'}>Hist {oscTf.macd.hist >= 0 ? '+' : ''}{oscTf.macd.hist.toFixed(2)}</p></div>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-2">
          <div className="flex items-center justify-between mb-1"><span className="text-[9px] uppercase tracking-wider text-white/35">Stochastic</span><span className={`text-[10px] font-bold ${oscTf.stoch.state === 'jenuh beli' ? 'text-red-400' : oscTf.stoch.state === 'jenuh jual' ? 'text-emerald-400' : 'text-white/70'}`}>{oscTf.stoch.state}</span></div>
          <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-500/30 via-white/5 to-red-500/30"><div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white" style={{ left: `${clamp(oscTf.stoch.k, 0, 100)}%` }} /></div>
          <div className="flex justify-between text-[8px] text-white/35 mt-0.5"><span>%K {oscTf.stoch.k.toFixed(0)}</span><span>%D {oscTf.stoch.d.toFixed(0)}</span></div>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-2">
          <div className="flex items-center justify-between mb-1"><span className="text-[9px] uppercase tracking-wider text-white/35">Bollinger %B</span>{oscTf.boll.squeeze && <span className="text-[9px] font-bold text-amber-400 flex items-center gap-1"><Zap size={9} /> Squeeze</span>}</div>
          <div className="relative h-2 rounded-full bg-white/5"><div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-sky-400" style={{ left: `${clamp(oscTf.boll.pctB * 100, 0, 100)}%` }} /></div>
          <div className="flex justify-between text-[8px] text-white/35 mt-0.5"><span>lower</span><span>%B {(oscTf.boll.pctB * 100).toFixed(0)} · lebar {oscTf.boll.bandwidth.toFixed(2)}%</span><span>upper</span></div>
        </div>
      </div>
    </Panel>
  )

  const YieldCurvePanel = (
    <Panel title="Yield Curve & Suku Bunga" icon={GitBranch} info="Selisih yield 10Y−2Y. Inversi (negatif) = pasar khawatir resesi → ekspektasi Fed memangkas bunga → biasanya bullish emas jangka menengah.">
      {curve2s10 != null ? (
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div><p className="text-[9px] uppercase tracking-wider text-white/35">Spread 2s10s</p><p className={`text-2xl font-black leading-none ${curve2s10 < 0 ? 'text-amber-400' : 'text-white/85'}`}>{curve2s10 >= 0 ? '+' : ''}{curve2s10.toFixed(2)}%</p></div>
            <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 mb-1 ${curve2s10 < 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{curve2s10 < 0 ? 'Inversi' : 'Normal'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/[0.03] p-2"><p className="text-[9px] text-white/40">US 2Y</p><p className="text-sm font-bold tabular-nums">{macro?.us02y?.value.toFixed(2)}%</p></div>
            <div className="rounded-lg bg-white/[0.03] p-2"><p className="text-[9px] text-white/40">US 10Y</p><p className="text-sm font-bold tabular-nums">{macro?.us10y?.value.toFixed(2)}%</p></div>
          </div>
          <p className="text-[10px] text-white/50 leading-snug">{curve2s10 < 0 ? 'Kurva terbalik — historis mendahului resesi & siklus pemangkasan bunga, angin baik untuk emas.' : 'Kurva normal — ekonomi ekspansif, emas lebih bergantung pada arah inflasi & dolar.'}</p>
        </div>
      ) : <div className="flex items-center justify-center py-6 text-white/30 text-[11px] gap-2"><Loader2 size={14} className="animate-spin" /> memuat yield…</div>}
    </Panel>
  )

  const RiskSentimentPanel = (
    <Panel title="Sentimen Risiko Pasar" icon={Scale} info="Emas adalah aset lindung nilai. Saat pasar takut (risk-off: VIX naik, saham turun) emas cenderung naik; saat pasar berani (risk-on) emas tertekan.">
      <div className="mb-3">
        <p className={`text-lg font-black leading-none ${riskOn < -0.1 ? 'text-emerald-400' : riskOn > 0.1 ? 'text-red-400' : 'text-white/70'}`}>{riskOn < -0.1 ? 'Risk-Off' : riskOn > 0.1 ? 'Risk-On' : 'Netral'}</p>
        <p className="text-[10px] text-white/45 mt-0.5">{riskOn < -0.1 ? 'Pasar cemas → mendukung emas' : riskOn > 0.1 ? 'Pasar percaya diri → menekan emas' : 'Aliran risiko seimbang'}</p>
      </div>
      <RiskMeter riskOn={riskOn} />
      <div className="grid grid-cols-3 gap-1.5 mt-3">
        {[{ l: 'VIX', q: cross.vixy, inv: false }, { l: 'S&P', q: cross.spy, inv: true }, { l: 'BTC', q: cross.btc, inv: true }].map(x => (
          <div key={x.l} className="rounded-lg bg-white/[0.03] py-1.5 text-center"><p className="text-[8px] text-white/35">{x.l}</p><p className={`text-[11px] font-bold tabular-nums ${x.q ? (x.q.changePct >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-white/30'}`}>{x.q ? `${x.q.changePct >= 0 ? '+' : ''}${x.q.changePct.toFixed(1)}%` : '—'}</p></div>
        ))}
      </div>
    </Panel>
  )

  const GoldSilverPanel = (
    <Panel title="Rasio Emas / Perak" icon={Coins} info="XAU ÷ XAG. Rasio tinggi (>85) = emas mahal relatif perak, sering menandai fase risk-off/ketakutan. Rasio rendah (<70) = perak memimpin, biasanya risk-on/reflasi.">
      {goldSilver ? (
        <div className="space-y-2">
          <div className="flex items-end gap-2"><p className="text-2xl font-black leading-none tabular-nums">{goldSilver.toFixed(1)}</p><span className={`text-[10px] font-bold mb-1 ${goldSilver > 85 ? 'text-amber-400' : goldSilver < 70 ? 'text-sky-400' : 'text-white/50'}`}>{goldSilver > 85 ? 'emas mahal' : goldSilver < 70 ? 'perak memimpin' : 'normal'}</span></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/[0.03] p-2"><p className="text-[9px] text-white/40">Emas (XAU)</p><p className="text-sm font-bold tabular-nums">{f2(feed.price)}</p></div>
            <div className="rounded-lg bg-white/[0.03] p-2"><p className="text-[9px] text-white/40">Perak (XAG)</p><p className="text-sm font-bold tabular-nums">{cross.xag ? f2(cross.xag.price) : '—'}</p></div>
          </div>
          {gsRelative != null && <p className="text-[10px] text-white/50 leading-snug">Hari ini emas {gsRelative >= 0 ? 'outperform' : 'underperform'} perak {Math.abs(gsRelative).toFixed(2)}% — {gsRelative >= 0 ? 'aliran defensif ke emas' : 'selera risiko membaik'}.</p>}
        </div>
      ) : <div className="flex items-center justify-center py-6 text-white/30 text-[11px] gap-2"><Loader2 size={14} className="animate-spin" /> memuat perak…</div>}
    </Panel>
  )
  const AiPanel = (
    <div className="lg:col-span-12 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-[#0b100e] to-[#0b100e] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/15 ring-1 ring-primary/30"><Brain size={17} className="text-primary" /></span>
        <div><h2 className="text-sm font-black flex items-center gap-1.5">Analisa AI — Ambil Keputusan <span className="text-[8px] font-bold uppercase bg-primary/15 text-primary rounded px-1.5 py-0.5">Datalitiq AI</span></h2><p className="text-[10px] text-white/40">Semi-otomatis: gabungkan SEMUA data terminal + konteks/pertanyaan darimu → keputusan.</p></div>
      </div>
      {/* Input prompt semi-otomatis */}
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 mb-3">
        <label className="text-[10px] uppercase tracking-widest font-semibold text-white/40">Tambahkan konteks / pertanyaan (opsional)</label>
        <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={2}
          placeholder="mis. saya mau scalping sesi Asia, fokus level entry. Atau: pertimbangkan CPI malam ini yang diperkirakan turun."
          className="w-full mt-1.5 bg-transparent text-sm text-white resize-none outline-none placeholder:text-white/30" />
        <div className="flex items-center justify-between gap-2 mt-1.5 pt-2 border-t border-white/10">
          <div className="flex flex-wrap gap-1">
            {['Fokus scalping sesi Asia', 'Layak entry sekarang?', 'Pertimbangkan rilis berita hari ini', 'Cari level entry/stop/target'].map(s => (
              <button key={s} onClick={() => setAiPrompt(s)} disabled={ai.loading} className="text-[10px] rounded-full border border-white/15 px-2 py-1 text-white/50 hover:border-primary/40 hover:text-white transition-colors disabled:opacity-50">{s}</button>
            ))}
          </div>
          <button onClick={() => ai.run(snapshot, aiPrompt)} disabled={ai.loading} className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0">{ai.loading ? <><Loader2 size={14} className="animate-spin" /> Menganalisa…</> : ai.data ? <><RefreshCw size={13} /> Analisa Ulang</> : <><Sparkles size={14} /> Jalankan Analisa AI</>}</button>
        </div>
      </div>
      {!ai.data && !ai.loading && !ai.error && <div className="py-4 text-center"><p className="text-[11px] text-white/45">Klik <b className="text-primary">Jalankan Analisa AI</b> — Datalitiq AI membaca seluruh data terminal + berita terkini {aiPrompt.trim() ? '+ konteks darimu ' : ''}lalu memberi <b>keputusan (Beli/Jual/Tunggu)</b> beserta alasan, confluence, rencana, & risiko.</p></div>}
      {ai.loading && <AiLoading steps={['Membaca harga, candle & indikator…', 'Menimbang makro, COT & berita…', 'Mengecek konfluensi timeframe…', 'Menyusun keputusan & level…']} />}
      {ai.error && !ai.loading && <div className="py-6 text-center"><p className="text-[11px] text-red-400 mb-1">Gagal: {ai.error}</p><button onClick={() => ai.run(snapshot, aiPrompt)} className="text-[11px] font-semibold text-primary hover:underline">Coba lagi</button></div>}
      {ai.data && !ai.loading && (() => {
        const a = ai.data
        const decColor = a.keputusan === 'BELI' ? 'bg-emerald-500 text-black' : a.keputusan === 'JUAL' ? 'bg-red-500 text-white' : 'bg-white/15 text-white'
        return (
          <div className="space-y-3">
            {/* keputusan */}
            <div className="flex items-center gap-3 flex-wrap rounded-xl bg-black/20 p-3">
              <span className={`text-lg font-black rounded-lg px-4 py-1.5 ${decColor}`}>{a.keputusan}</span>
              <div className="flex-1 min-w-[200px]"><p className="text-sm font-bold text-white/90 leading-snug">{a.headline}</p><p className="text-[11px] text-white/55 leading-snug mt-0.5">{a.keputusanAlasan}</p></div>
              <div className="text-center shrink-0"><p className="text-[9px] uppercase tracking-wider text-white/35">Keyakinan</p><p className={`text-base font-black ${a.conviction === 'Tinggi' ? 'text-emerald-400' : a.conviction === 'Rendah' ? 'text-red-400' : 'text-amber-400'}`}>{a.conviction}</p><p className="text-[9px] text-white/40 tabular-nums">{a.confidence}%</p></div>
            </div>
            <p className="text-[11px] text-white/60 leading-snug">{a.executive}</p>
            {/* confluence checklist */}
            {a.confluence.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Peta Faktor (Confluence)</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">{a.confluence.map((c, i) => {
                  const Ic = c.arah === 'bullish' ? CheckCircle2 : c.arah === 'bearish' ? TrendingDown : MinusCircle
                  return <div key={i} className="flex items-start gap-1.5 rounded-lg bg-white/[0.03] p-2"><Ic size={13} className={`${dirColor(c.arah)} mt-0.5 shrink-0`} /><div className="min-w-0"><p className="text-[11px] font-semibold text-white/80">{c.faktor} <span className={`text-[9px] ${dirColor(c.arah)}`}>· {c.arah}</span></p><p className="text-[9px] text-white/45 leading-snug">{c.catatan}</p></div></div>
                })}</div>
              </div>
            )}
            {/* 3 seksi */}
            <div className="grid md:grid-cols-3 gap-2.5">{[{ t: 'Teknikal', ic: Activity, v: a.technical }, { t: 'Makro', ic: Landmark, v: a.macro }, { t: 'Sentimen', ic: Users, v: a.sentiment }].map(s => (
              <div key={s.t} className="rounded-xl bg-white/[0.03] border border-white/5 p-2.5"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-1"><s.ic size={11} /> {s.t}</p><p className="text-[11px] text-white/65 leading-relaxed">{s.v}</p></div>))}
            </div>
            {/* plan + level + skenario */}
            <div className="grid md:grid-cols-3 gap-2.5">
              <div className="rounded-xl bg-primary/[0.06] border border-primary/15 p-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5"><Target size={11} /> Rencana · {a.plan.bias}</p>
                <div className="space-y-1 text-[11px]"><div className="flex gap-2"><span className="text-white/40 w-14 shrink-0">Entry</span><span className="text-white/80">{a.plan.entry}</span></div><div className="flex gap-2"><span className="text-red-400/70 w-14 shrink-0">Stop</span><span className="text-white/80">{a.plan.sl}</span></div><div className="flex gap-2"><span className="text-emerald-400/70 w-14 shrink-0">Target</span><span className="text-white/80">{a.plan.tp}</span></div><div className="flex gap-2"><span className="text-amber-400/70 w-14 shrink-0">Batal jika</span><span className="text-white/70">{a.plan.invalidation}</span></div></div>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1.5"><Layers size={11} /> Level Kunci</p>
                <div className="space-y-1 text-[11px]"><div className="flex gap-2"><span className="text-red-400/70 w-20 shrink-0">Resistance</span><span className="text-white/80">{a.levelKunci.resistance}</span></div><div className="flex gap-2"><span className="text-emerald-400/70 w-20 shrink-0">Support</span><span className="text-white/80">{a.levelKunci.support}</span></div></div>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1.5"><Crosshair size={11} /> Skenario</p>
                <div className="space-y-1.5 text-[11px]">{a.scenarios.map((s, i) => <p key={i} className="text-white/65 leading-snug"><span className="text-primary font-semibold">Jika</span> {s.kondisi} → <span className="text-white/85">{s.aksi}</span></p>)}</div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-2.5">
              {a.risks.length > 0 && <div><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-400/70 mb-1"><ShieldAlert size={11} /> Risiko</p><ul className="space-y-0.5">{a.risks.map((r, i) => <li key={i} className="text-[11px] text-white/60 leading-snug flex gap-1.5"><span className="text-amber-400/70">⚠</span>{r}</li>)}</ul></div>}
              {a.watch.length > 0 && <div><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1"><Eye size={11} /> Dipantau</p><ul className="space-y-0.5">{a.watch.map((w, i) => <li key={i} className="text-[11px] text-white/60 leading-snug flex gap-1.5"><span className="text-primary">→</span>{w}</li>)}</ul></div>}
            </div>
            <p className="text-[8px] text-white/25 text-right">Diolah Datalitiq AI dari data terminal real · {new Date(a.fetchedAt).toLocaleTimeString('id-ID')}. Bukan nasihat keuangan.</p>
          </div>
        )
      })()}
    </div>
  )

  const navGroups = Array.from(new Set(TABS.map(t => t.group ?? 'Menu')))
  const activeTab = TABS.find(t => t.id === tab)
  const Flow = ({ n, label }: { n: number; label: string }) => (
    <div className="lg:col-span-12 flex items-center gap-2 pt-1">
      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-black">{n}</span>
      <span className="text-[11px] font-bold uppercase tracking-widest text-white/45">{label}</span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#060a09] text-white">
      {chartFull && (
        <div className="fixed inset-0 z-[60] bg-[#060a09] p-3 flex flex-col">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold flex items-center gap-2"><Activity size={15} className="text-primary" /> XAU/USD — {f2(feed.price)} · TradingView</span><button onClick={() => setChartFull(false)} className="flex items-center gap-1 text-xs text-white/60 hover:text-white bg-white/5 rounded-lg px-3 py-1.5"><X size={14} /> Tutup</button></div>
          <div className="flex-1 min-h-0"><TradingViewChart symbol="OANDA:XAUUSD" chartStyle="2" height="100%" /></div>
        </div>
      )}

      <div className="flex">
        {/* Sidebar (md+) */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 h-screen sticky top-0 border-r border-white/[0.06] bg-[#080d0b]">
          <div className="h-14 flex items-center gap-2 px-4 border-b border-white/[0.06] shrink-0">
            <Link href="/dashboard" className="text-white/50 hover:text-white shrink-0" title="Kembali ke dashboard"><ArrowLeft size={17} /></Link>
            <span className="font-black tracking-tight">Datalitiq</span>
            <span className="ml-auto text-[8px] font-bold uppercase tracking-wider text-primary/70">XAU</span>
          </div>
          <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
            {navGroups.map(g => (
              <div key={g}>
                <p className="px-2 mb-1.5 text-[9px] font-bold uppercase tracking-widest text-white/25">{g}</p>
                <div className="space-y-0.5">
                  {TABS.filter(t => (t.group ?? 'Menu') === g).map(t => {
                    const on = tab === t.id
                    return (
                      <button key={t.id} onClick={() => setTab(t.id)} className={`relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold transition-colors ${on ? 'text-white bg-gradient-to-r from-primary/20 to-primary/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'}`}>
                        {on && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary shadow-[0_0_8px_rgba(52,211,153,0.6)]" />}
                        <t.icon size={15} className={on ? 'text-primary' : ''} /> {t.label}
                        {t.id === 'status' && <span className={`ml-auto h-1.5 w-1.5 rounded-full ${STAT_META[overall].dot}`} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
          <button onClick={() => setTab('status')} className="m-2.5 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors shrink-0">
            <span className={`h-2 w-2 rounded-full ${STAT_META[overall].dot} ${overall === 'online' ? 'shadow-[0_0_0_3px_rgba(52,211,153,0.15)]' : ''}`} />
            <div className="min-w-0 flex-1"><p className={`text-[11px] font-bold ${STAT_META[overall].text}`}>{overall === 'online' ? 'Server Online' : overall === 'offline' ? 'Ada Gangguan' : overall === 'stale' ? 'Sebagian Lambat' : 'Menghubungkan'}</p><p className="text-[9px] text-white/35 tabular-nums">{onlineCount}/{apiSources.length} API aktif</p></div>
          </button>
        </aside>

        {/* Main column */}
        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-30 bg-[#060a09]/95 backdrop-blur border-b border-white/[0.06]">
            <div className="px-4 h-14 flex items-center gap-3 sm:gap-4">
              <Link href="/dashboard" className="md:hidden text-white/50 hover:text-white shrink-0"><ArrowLeft size={18} /></Link>
              <div className="flex items-center gap-2 shrink-0"><span className="font-black tracking-tight">XAU/USD</span><span className={`hidden sm:inline text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 ${live.status === 'live' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{live.status === 'live' ? 'Data Real' : 'Menyegarkan…'}</span></div>
              <div className="flex items-baseline gap-2"><span className={`text-2xl font-black tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>{f2(feed.price)}</span><span className={`text-xs font-bold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>{up ? '+' : ''}{feed.changePct.toFixed(2)}%</span></div>
              <div className="hidden md:flex items-center gap-4 text-[11px] text-white/50 tabular-nums"><span>H <b className="text-emerald-400/80">{f2(feed.dayHigh)}</b></span><span>L <b className="text-red-400/80">{f2(feed.dayLow)}</b></span></div>
              <div className="ml-auto flex items-center gap-3 shrink-0">
                <span className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold text-white/70">{activeTab && <activeTab.icon size={13} className="text-primary" />}{activeTab?.label}</span>
                <span className="hidden lg:flex items-center gap-1.5 text-[11px] text-white/50"><Circle size={7} className="fill-primary text-primary" /> {session}</span>
                <span className="hidden sm:flex items-center gap-1 text-[11px] text-white/40"><Clock size={11} /> {clock}</span>
                <span className={`flex items-center gap-1 text-[10px] ${live.status === 'live' ? 'text-emerald-400' : 'text-amber-400'}`}>{live.status === 'live' ? <Wifi size={12} /> : <RefreshCw size={11} className="animate-spin" />} live</span>
              </div>
            </div>
          </header>

          <main className="p-2.5 pb-20 md:pb-6">
            {marketStale && (
              <div className="mb-2.5 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5">
                <WifiOff size={16} className="text-amber-400 shrink-0" />
                <p className="text-[11px] text-amber-200/90 leading-snug"><b>Pasar kemungkinan tutup.</b> Candle terakhir {staleAgeMin >= 60 ? `${Math.floor(staleAgeMin / 60)} jam` : `${staleAgeMin} menit`} lalu — analisa di bawah dihitung dari data terakhir (biasanya penutupan Jumat), belum tentu mencerminkan kondisi saat pasar buka lagi.</p>
              </div>
            )}
            {tab === 'ringkasan' && <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
              {DecisionHero}
              {InsightStrip}
              <Flow n={1} label="Keputusan" />
              {AiPanel}
              <div className="lg:col-span-4">{SignalMeterPanel}</div>
              <div className="lg:col-span-4">{BiasPanel}</div>
              <div className="lg:col-span-4">{KesimpulanPanel}</div>
              <Flow n={2} label="Konfirmasi Teknikal" />
              <ChartPanel onExpand={() => setChartFull(true)} hasAiLevels={!!ai.data?.chartLevels} />
              <div className="lg:col-span-4 grid grid-rows-2 gap-2.5">{MtfPanel}{MomentumPanel}</div>
              <div className="lg:col-span-4">{HtfBiasPanel}</div>
              <div className="lg:col-span-4">{ZonaPanel}</div>
              <div className="lg:col-span-4">{ReversalPanel}</div>
              <Flow n={3} label="Konteks Pasar" />
              <div className="lg:col-span-6">{RiskSentimentPanel}</div>
              <div className="lg:col-span-6">{IndicatorMatrix}</div>
            </div>}

            {tab === 'teknikal' && <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
              <TerminalAiPanel scope="teknikal" title="Analisa Teknikal AI" subtitle="Datalitiq AI baca chart, indikator & struktur → arah + level entry/stop/target." snapshot={snapshot}
                suggestions={['Layak entry sekarang atau tunggu pullback?', 'Level stop & target yang logis di mana?', 'Tren M15/H1 searah tidak?']} />
              <ChartPanel onExpand={() => setChartFull(true)} hasAiLevels={!!ai.data?.chartLevels} />
              <div className="lg:col-span-4 grid grid-rows-2 gap-2.5">{MtfPanel}{SignalMeterPanel}</div>
              <div className="lg:col-span-4">{HtfBiasPanel}</div>
              <div className="lg:col-span-4">{ReversalPanel}</div>
              <div className="lg:col-span-4">{OscillatorPanel}</div>
              <div className="lg:col-span-4">{MomentumPanel}</div>
              <div className="lg:col-span-4">{ZonaPanel}</div>
              <div className="lg:col-span-12">{IndicatorMatrix}</div>
            </div>}

            {tab === 'makro' && <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
              <TerminalScopeAnalysis scope="makro" title="Analisa Makro AI" subtitle="Dampak dolar, yield, inflasi & Fed ke XAU/USD — bias % + tiap faktor." snapshot={snapshot}
                suggestions={['Bias makro emas bullish atau bearish?', 'Kurva yield 2s10s artinya apa untuk emas?', 'Inflasi terakhir dukung atau tekan emas?']} />
              {CrossPanel}
              <div className="lg:col-span-5">{YieldCurvePanel}</div>
              <div className="lg:col-span-7">{RiskSentimentPanel}</div>
              {InflasiPanel}
              <div className="lg:col-span-12">{CalendarPanel}</div>
            </div>}

            {tab === 'sentimen' && <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
              <TerminalScopeAnalysis scope="sentimen" title="Analisa Sentimen AI" subtitle="Dampak risk-on/off, COT & berita ke XAU/USD — bias % + headline mendukung/menekan." snapshot={snapshot}
                suggestions={['Sentimen sedang dukung atau tekan emas?', 'Posisi institusi vs retail bagaimana?', 'Ada tanda ekstrem/kontrarian?']} />
              <div className="lg:col-span-7">{CotPanel}</div>
              <div className="lg:col-span-5 grid grid-rows-2 gap-2.5">{RiskSentimentPanel}{GoldSilverPanel}</div>
              <div className="lg:col-span-7">{NewsPanel}</div>
              <div className="lg:col-span-5">{BiasPanel}</div>
            </div>}

            {tab === 'berita' && <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5"><TerminalNewsAnalysis snapshot={snapshot} /></div>}

            {tab === 'status' && <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">{ServerStatusContent}</div>}

            {tab === 'panduan' && <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5"><div className="lg:col-span-12"><PanduanContent /></div></div>}

            <p className="text-center text-[10px] text-white/25 pt-6">Terminal XAUUSD · 100% data real. Bukan nasihat keuangan — gunakan sebagai alat bantu analisa, keputusan tetap di tangan kamu.</p>
          </main>
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#080d0b]/95 backdrop-blur border-t border-white/[0.06] flex items-center overflow-x-auto">
        {TABS.map(t => {
          const on = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-0.5 px-3 py-2 shrink-0 ${on ? 'text-primary' : 'text-white/40'}`}>
              <t.icon size={16} />
              <span className="text-[8px] font-semibold whitespace-nowrap">{t.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ─────────────────────────── Panduan (untuk pemula) ───────────────────────────
function GuideCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0b100e] p-4">
      <h3 className="flex items-center gap-2 text-sm font-black mb-2"><Icon size={15} className="text-primary" /> {title}</h3>
      <div className="text-[12px] text-white/65 leading-relaxed space-y-1.5">{children}</div>
    </div>
  )
}
function PanduanContent() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] to-transparent p-4">
        <h2 className="text-base font-black flex items-center gap-2 mb-1"><BookOpen size={18} className="text-primary" /> Panduan Membaca Terminal (untuk Pemula)</h2>
        <p className="text-[12px] text-white/60">XAU/USD = harga emas dalam dolar AS. Emas cenderung <b className="text-emerald-400">naik (bullish)</b> saat dolar & suku bunga melemah, inflasi mereda, atau pasar takut (risk-off); dan <b className="text-red-400">turun (bearish)</b> saat sebaliknya. Terminal ini menyatukan banyak data untuk membantumu menilai arah itu.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <GuideCard title="Istilah Dasar" icon={Info}>
          <p>• <b className="text-emerald-400">Bullish</b> = perkiraan harga naik. <b className="text-red-400">Bearish</b> = perkiraan turun. <b>Netral</b> = belum jelas.</p>
          <p>• <b>Support (S)</b> = level bawah tempat harga sering memantul naik. <b>Resistance (R)</b> = level atas tempat harga sering tertahan.</p>
          <p>• <b>Timeframe</b>: M5 = 5 menit, M15 = 15 menit, H1 = 1 jam. TF besar (H1) lebih kuat pengaruhnya.</p>
        </GuideCard>
        <GuideCard title="Signal Meter & Bias/Confidence" icon={Compass}>
          <p>Jarum meter ke <b className="text-emerald-400">kanan = bullish</b>, ke <b className="text-red-400">kiri = bearish</b>. Ini rangkuman dari 3 pilar:</p>
          <p>• <b>Makro</b> (dolar/yield/inflasi/Fed), <b>Teknikal</b> (chart), <b>Sentimen</b> (berita & pasar).</p>
          <p>• <b>Confidence</b> = seberapa sepakat ketiga pilar. Makin tinggi (&gt;66%) = sinyal makin bisa dipercaya. Rendah = pilar bertentangan, hati-hati.</p>
        </GuideCard>
        <GuideCard title="Teknikal (tab Teknikal)" icon={Activity}>
          <p>• <b>Chart</b> TradingView: bisa di-zoom/drag, klik "Perbesar" untuk layar penuh.</p>
          <p>• <b>Konfluensi MTF</b>: kalau M5/M15/H1 sama-sama bullish = tren searah (lebih kuat).</p>
          <p>• <b>RSI</b>: &gt;70 jenuh beli (rawan turun), &lt;30 jenuh jual (rawan naik).</p>
          <p>• <b>ADX</b> (Kekuatan Tren): &gt;25 tren kuat (sinyal lebih valid), &lt;20 lemah/sideways (rawan tipu-tipu). <b>+DI vs -DI</b> = arah tren.</p>
          <p>• <b>ATR/Volatilitas</b>: besar pergerakan harga. Rendah = pasar sepi.</p>
        </GuideCard>
        <GuideCard title="Makro (tab Makro)" icon={Landmark}>
          <p>• <b>Indeks Dolar & US10Y (yield)</b>: naik → tekan emas; turun → dukung emas.</p>
          <p>• <b>CPI / Core PCE</b> (inflasi): turun → peluang Fed pangkas bunga → bullish emas.</p>
          <p>• <b>Fed Funds Rate</b>: suku bunga acuan. Turun = bullish emas.</p>
          <p>• <b>VIX</b> (indeks ketakutan): naik = pasar takut = emas jadi tempat aman (bullish).</p>
          <p>• <b>Kalender Ekonomi</b>: hindari buka posisi tepat sebelum rilis data high-impact (harga bisa liar).</p>
        </GuideCard>
        <GuideCard title="Sentimen & COT (tab Sentimen)" icon={Users}>
          <p>• <b>COT</b> (mingguan dari CFTC): posisi para pelaku pasar. <b className="text-emerald-400">Hijau=long</b>, <b className="text-red-400">merah=short</b>.</p>
          <p>• <b>Funds/Institusi</b> & <b>Commercials</b> = "smart money". <b>Retail</b> = trader kecil, sering salah di titik ekstrem (sinyal kontrarian).</p>
          <p>• Kalau institusi & retail berlawanan → cenderung ikuti institusi.</p>
          <p>• <b>Berita</b>: headline terbaru; analisa sentimennya ada di Analisa AI.</p>
        </GuideCard>
        <GuideCard title="Analisa AI & Cara Pakai" icon={Brain}>
          <p>Di tab <b>Ringkasan</b>, klik <b className="text-primary">Jalankan Analisa AI</b>. Datalitiq AI membaca SEMUA data + berita lalu memberi:</p>
          <p>• <b>Keputusan</b> (Beli/Jual/Tunggu) + alasan + tingkat keyakinan.</p>
          <p>• <b>Peta faktor</b> (mana yang bullish/bearish), rencana (entry/stop/target), level kunci, skenario, & risiko.</p>
          <p className="text-amber-400/80">⚠ Ini alat bantu, <b>bukan nasihat keuangan</b>. Selalu pakai stop loss & kelola risiko. Keputusan akhir tetap di tanganmu.</p>
        </GuideCard>
      </div>
      <div className="rounded-2xl border border-white/[0.06] bg-[#0b100e] p-4">
        <h3 className="flex items-center gap-2 text-sm font-black mb-2"><CheckCircle2 size={15} className="text-primary" /> Alur Baca yang Disarankan</h3>
        <ol className="text-[12px] text-white/65 leading-relaxed space-y-1 list-decimal list-inside">
          <li>Buka tab <b>Ringkasan</b> → lihat Signal Meter & Confidence (arah + seberapa yakin).</li>
          <li>Klik <b>Jalankan Analisa AI</b> untuk pandangan menyeluruh & keputusan.</li>
          <li>Cek <b>Teknikal</b> (tren/ADX kuat?) & <b>Makro</b> (dolar/yield mendukung?).</li>
          <li>Cek <b>Sentimen</b> (institusi & berita sejalan?).</li>
          <li>Kalau semua searah & confidence tinggi → sinyal lebih kuat. Selalu pasang stop loss.</li>
        </ol>
      </div>
    </div>
  )
}
