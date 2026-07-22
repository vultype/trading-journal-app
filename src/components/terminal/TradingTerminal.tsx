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
  Landmark, Circle, Sparkles, Target, Waves, Crosshair, Compass, BarChart3, Loader2, RefreshCw, Route,
  Info, Users, CalendarClock, Lightbulb, Brain, ExternalLink, ShieldAlert, Eye,
  LayoutDashboard, BookOpen, Maximize2, X, Flame, TrendingUp, TrendingDown, CheckCircle2, MinusCircle, LineChart,
  Zap, Scale, GitBranch, Signal, ArrowUpDown, Coins, Server, MessageSquarePlus, ChevronUp, ChevronDown, ChevronRight,
  Lock, Crown, Check, Volume2, VolumeX,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { playChime, type ChimeDir } from '@/lib/chime'
import { detectTrendPhase, type PhaseState } from '@/lib/trend-phase'
import { buildProjection, type ProjLevel } from '@/lib/projection'
import { buildDollarIndex, ageMinutes, FX_PAIRS, STALE_MIN, type FxPair } from '@/lib/dollar-fx'
import { TradingViewChart } from './TradingViewChart'
import { aiFetch } from '@/lib/ai-fetch'
import { useCredits } from '@/hooks/useCredits'
import { createClient } from '@/lib/supabase'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { AiLoading } from './AiLoading'
import { TerminalAiPanel } from './TerminalAiPanel'
import { TerminalScopeAnalysis } from './TerminalScopeAnalysis'
import { MacroComparisonChart, LintasAsetSection, InflasiSection, CotSection } from './MacroDeepDive'
import { TerminalNewsAnalysis } from './TerminalNewsAnalysis'
import { type Macd, type Boll, type Stoch, type Structure } from '@/lib/indicators'
import {
  TFS, clamp, atrLast, adxLabel, computeTF, riskOnScore, scores, confluence, regimeOf, efficiencyRatio, usMarketOpen,
  macroCandleImpact, macroCandleBlend,
  type TF, type Dir, type Candle, type Bias, type ReversalDir, type Reversal, type TFData, type CrossQuote, type RegimePhase,
} from '@/lib/terminal-signal'

type HTF = 'H4' | 'D1'            // timeframe besar (bias harian/swing)
const HTFS: HTF[] = ['H4', 'D1']

type Pivots = { P: number; R1: number; R2: number; S1: number; S2: number }
type MacroPoint = { key: string; value: number; prior: number; date: string; history: number[] }
type CotGroup = { long: number; short: number; net: number; deltaNet: number }
type CotHistPoint = { date: string; value: number }
type Cot = { date: string; funds: CotGroup; commercials: CotGroup; retail: CotGroup; fundsHistory: number[]; retailHistory: number[]; fundsHistoryFull: CotHistPoint[]; commercialsHistoryFull: CotHistPoint[]; retailHistoryFull: CotHistPoint[] }
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
// Candle per-timeframe untuk proxy makro — UUP (dolar) & IEF (yield 10Y, harga
// berbanding terbalik dgn yield). Dipakai supaya pilar Makro bisa dihitung per
// M5/M15/H1 seperti Teknikal (bukan cuma arah harian FRED), dan untuk deteksi
// "DXY vs Yield bertentangan → berpotensi ranging".
// dollar = indeks sintetis dari forex (LIVE 24 jam, menggantikan UUP saat tersedia).
// ief tetap ETF — tidak ada proxy yield 24 jam, jadi kesegarannya dilaporkan
// lewat `yieldStaleMin` agar tidak dipakai seolah-olah masih hidup.
type MacroTechFeed = {
  uup: Record<TF, TFData> | null
  ief: Record<TF, TFData> | null
  dollarLive: boolean          // true = dolar dari forex 24 jam
  yieldStaleMin: number | null // umur candle yield (menit)
}
function useMacroCandleFeed(): MacroTechFeed {
  const [uup, setUup] = useState<Record<TF, TFData> | null>(null)
  const [ief, setIef] = useState<Record<TF, TFData> | null>(null)
  const [dollarLive, setDollarLive] = useState(false)
  const [yieldStaleMin, setYieldStaleMin] = useState<number | null>(null)
  useEffect(() => {
    let stopped = false
    const iefRef: Partial<Record<TF, Candle[]>> = {}
    const fxRef: Record<TF, Partial<Record<FxPair, Candle[]>>> = { M5: {}, M15: {}, H1: {} }
    const uupRef: Partial<Record<TF, Candle[]>> = {}
    const norm = (arr: unknown[]) => (arr as { o: number; h: number; l: number; c: number; t: number }[]).map(c => ({ ...c, v: 1 }))

    async function pollIef(tf: TF) {
      try {
        const arr = await (await fetch(`/api/terminal/candles?tf=${tf}&symbol=IEF`)).json()
        if (stopped || !Array.isArray(arr) || !arr.length) return
        iefRef[tf] = norm(arr)
        if (iefRef.M5 && iefRef.M15 && iefRef.H1) {
          setIef({ M5: computeTF(iefRef.M5), M15: computeTF(iefRef.M15), H1: computeTF(iefRef.H1) })
          setYieldStaleMin(ageMinutes(iefRef.M5))
        }
      } catch { }
    }
    // Cadangan: UUP dipakai hanya bila indeks forex gagal tersusun.
    async function pollUup(tf: TF) {
      try {
        const arr = await (await fetch(`/api/terminal/candles?tf=${tf}&symbol=UUP`)).json()
        if (stopped || !Array.isArray(arr) || !arr.length) return
        uupRef[tf] = norm(arr)
      } catch { }
    }
    async function pollFx(tf: TF, pair: FxPair) {
      try {
        const arr = await (await fetch(`/api/terminal/candles?tf=${tf}&symbol=${encodeURIComponent(pair)}`)).json()
        if (stopped || !Array.isArray(arr) || !arr.length) return
        fxRef[tf][pair] = norm(arr)
      } catch { }
    }
    function rebuildDollar() {
      const built: Partial<Record<TF, TFData>> = {}
      let live = true
      for (const tf of TFS) {
        const idx = buildDollarIndex(fxRef[tf])
        if (idx.length >= 30) built[tf] = computeTF(idx)
        else if (uupRef[tf]) { built[tf] = computeTF(uupRef[tf]!); live = false }
      }
      if (built.M5 && built.M15 && built.H1) {
        setUup({ M5: built.M5, M15: built.M15, H1: built.H1 })
        setDollarLive(live)
      }
    }
    const pollAll = async () => {
      await Promise.all([
        ...TFS.map(tf => pollIef(tf)),
        ...TFS.map(tf => pollUup(tf)),
        ...TFS.flatMap(tf => FX_PAIRS.map(p => pollFx(tf, p))),
      ])
      if (!stopped) rebuildDollar()
    }
    pollAll()
    const id = setInterval(() => { if (typeof document === 'undefined' || !document.hidden) pollAll() }, 60_000)
    return () => { stopped = true; clearInterval(id) }
  }, [])
  return { uup, ief, dollarLive, yieldStaleMin }
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
  const [insufficient, setInsufficient] = useState(false)
  const run = async (snapshot: Record<string, unknown>, userPrompt = '') => {
    setLoading(true); setError(null); setInsufficient(false)
    try {
      const { data: j, insufficient: low } = await aiFetch<{ error?: string } & AiAnalysis>('/api/terminal/ai-analysis', { ...snapshot, userPrompt })
      if (low) { setInsufficient(true); setError(j.error || 'Kredit AI tidak cukup. Silakan top up.'); return }
      if (j.error) throw new Error(j.error)
      setData(j)
    }
    catch (e) { setError(e instanceof Error ? e.message : 'gagal menganalisa') } finally { setLoading(false) }
  }
  return { data, loading, error, insufficient, run }
}
// Logo branding (upload admin) untuk navbar terminal — sama seperti Hub.
function useAppConfigLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  useEffect(() => {
    let s = false
    createClient().from('app_config').select('logo_url').eq('id', 1).maybeSingle()
      .then(({ data }) => { if (!s) setLogoUrl((data?.logo_url as string | null) ?? null) })
    return () => { s = true }
  }, [])
  return logoUrl
}
type NewsItem = { text: string; source: string; time: string; link: string }
function useNews() {
  const [data, setData] = useState<NewsItem[] | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  useEffect(() => { let s = false; const poll = async () => { try { const j = await (await fetch('/api/terminal/news')).json(); if (!s && Array.isArray(j)) { setData(j); setUpdatedAt(Date.now()) } } catch { } }; poll(); const id = setInterval(poll, 600_000); return () => { s = true; clearInterval(id) } }, [])
  return { data, updatedAt }
}
type RegimeAcc = { regime: string; total: number; correct: number; pct: number }
type Accuracy = { total: number; correct: number; pct: number | null; window: number; ready: boolean; byRegime?: RegimeAcc[] }
function useAccuracy() {
  const [acc, setAcc] = useState<Accuracy | null>(null)
  useEffect(() => { let s = false; const poll = async () => { try { const j = await (await fetch('/api/terminal/accuracy?days=30')).json(); if (!s) setAcc(j) } catch { } }; poll(); const id = setInterval(poll, 1800_000); return () => { s = true; clearInterval(id) } }, [])
  return acc
}
// Kalender ekonomi USD (High/Medium) — untuk News Guard & panel kalender. Poll 15 menit.
type CalEvent = { title: string; time: number; impact: 'High' | 'Medium'; forecast: string; previous: string }
function useCalendar() {
  const [events, setEvents] = useState<CalEvent[]>([])
  useEffect(() => { let s = false; const poll = async () => { try { const j = await (await fetch('/api/terminal/calendar')).json(); if (!s && Array.isArray(j)) setEvents(j) } catch { } }; poll(); const id = setInterval(poll, 900_000); return () => { s = true; clearInterval(id) } }, [])
  return events
}
// Riwayat 10 kesimpulan terakhir + hasil evaluasi (kalibrasi). Poll 5 menit.
type PredRow = { created_at: string; dir: string; confidence: number | null; price: number; regime: string | null; evaluated: boolean; correct: boolean | null; price_after: number | null }
function usePredictions() {
  const [rows, setRows] = useState<PredRow[] | null>(null)
  useEffect(() => { let s = false; const poll = async () => { try { const j = await (await fetch('/api/terminal/predictions')).json(); if (!s && Array.isArray(j)) setRows(j) } catch { } }; poll(); const id = setInterval(poll, 300_000); return () => { s = true; clearInterval(id) } }, [])
  return rows
}
// Arah & ringkasan per sesi HARI INI (Asia/London/NY, WIB) — reset otomatis tiap hari.
// Dihitung dari candle M15 (tertutup) yang jatuh di jendela sesi hari berjalan.
const WIB_OFFSET_MS = 7 * 3_600_000
// Jendela WIB kontigu (tanpa jam kosong), tetap dalam 1 hari agar reset harian sederhana.
const SESSIONS = [
  { name: 'Asia', s: 6, e: 14 },
  { name: 'London', s: 14, e: 19 },
  { name: 'New York', s: 19, e: 23 },
] as const
type SessionRow = { name: string; status: 'belum' | 'berlangsung' | 'selesai'; arah: 'Bullish' | 'Bearish' | 'Flat' | null; open: number; close: number; low: number; high: number; rangePips: number }
function sessionSummary(candles: Candle[], now: number): SessionRow[] {
  // Batas hari & jam sesi dihitung dalam WIB (bukan UTC) — geser +7 jam, bulatkan ke hari, geser balik.
  const dayStart = Math.floor((now + WIB_OFFSET_MS) / 86_400_000) * 86_400_000 - WIB_OFFSET_MS
  return SESSIONS.map(x => {
    const from = dayStart + x.s * 3_600_000, to = dayStart + x.e * 3_600_000
    const status: SessionRow['status'] = now < from ? 'belum' : now >= to ? 'selesai' : 'berlangsung'
    const cs = candles.filter(c => c.t >= from && c.t < to)
    if (!cs.length) return { name: x.name, status, arah: null, open: 0, close: 0, low: 0, high: 0, rangePips: 0 }
    const open = cs[0].o, close = cs[cs.length - 1].c
    const hi = Math.max(...cs.map(c => c.h)), lo = Math.min(...cs.map(c => c.l))
    const chg = close - open
    const arah: SessionRow['arah'] = chg > 1.5 ? 'Bullish' : chg < -1.5 ? 'Bearish' : 'Flat'
    // Konvensi XAU/USD: 1 pip = $0.10
    return { name: x.name, status, arah, open, close, low: lo, high: hi, rangePips: Math.round((hi - lo) * 10) }
  })
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
    <div style={accentStyle} className={`rounded-2xl border ${accent ? 'border-white/[0.09]' : 'border-white/[0.07]'} bg-[#0b100e] p-4 flex flex-col transition-colors hover:border-white/[0.13] ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-white/85">
          <Icon size={14} className="text-primary/80" /> {title}
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

// ── Panel makro gaya "Gaya ke Emas": tiap faktor jadi bar diverging (dampak KE EMAS) ──
// impact = arah pergerakan × korelasi ke emas. + = dukung emas (hijau/kanan), − = tekan (merah/kiri).
type GoldForce = { name: string; sub: string; valueStr: string; chg: number; impact: number }
function buildForce(m: CardMeta, value: number | null | undefined, prior?: number | null, changePct?: number | null): GoldForce | null {
  if (value == null) return null
  const chg = changePct != null ? changePct : (prior != null && prior !== 0 ? ((value - prior) / prior) * 100 : 0)
  const valueStr = `${m.prefix ?? ''}${value.toLocaleString('en-US', { minimumFractionDigits: m.dec, maximumFractionDigits: m.dec })}${m.unit ?? ''}`
  return { name: m.name, sub: m.sub, valueStr, chg, impact: Math.sign(chg) * m.corr }
}
// Satu kolom (Mendukung / Menekan) — daftar bersih, diurut dari dampak terkuat.
function ForceColumn({ tone, forces }: { tone: 'bull' | 'bear'; forces: GoldForce[] }) {
  const bull = tone === 'bull'
  const head = bull ? 'text-emerald-400' : 'text-red-400'
  const zone = bull ? 'bg-emerald-500/[0.05]' : 'bg-red-500/[0.05]'
  const rows = [...forces].sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg))
  return (
    <div className={`rounded-xl ${zone} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[12px] font-black flex items-center gap-1.5 ${head}`}><span className={`w-2 h-2 rounded-full ${bull ? 'bg-emerald-400' : 'bg-red-400'}`} />{bull ? 'Mendukung Emas' : 'Menekan Emas'}</span>
        <span className={`text-[13px] font-black tabular-nums ${head}`}>{rows.length}</span>
      </div>
      {rows.length ? (
        <div className="divide-y divide-white/[0.06]">
          {rows.map(f => (
            <div key={f.name} className="flex items-center justify-between gap-3 py-2" title={f.sub}>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-white/90 truncate leading-tight">{f.name}</p>
                <p className="text-[10px] text-white/40 truncate leading-tight">{f.sub}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-black tabular-nums leading-tight text-white/90">{f.valueStr}</p>
                <p className={`text-[10px] font-bold tabular-nums leading-tight ${head}`}>{f.chg >= 0 ? '+' : ''}{f.chg.toFixed(2)}%</p>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="text-[11px] text-white/30 py-2">— tidak ada saat ini</p>}
    </div>
  )
}
function ForceColumns({ forces }: { forces: GoldForce[] }) {
  const bull = forces.filter(f => f.impact > 0.02)
  const bear = forces.filter(f => f.impact < -0.02)
  const neutral = forces.filter(f => Math.abs(f.impact) <= 0.02)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      <ForceColumn tone="bull" forces={bull} />
      <ForceColumn tone="bear" forces={bear} />
      {neutral.length > 0 && <p className="sm:col-span-2 text-[10px] text-white/35 leading-snug">Belum bergerak berarti: {neutral.map(f => f.name).join(', ')}.</p>}
    </div>
  )
}
function GoldForceSummary({ forces }: { forces: GoldForce[] }) {
  const bull = forces.filter(f => f.impact > 0.02).length
  const bear = forces.filter(f => f.impact < -0.02).length
  const total = bull + bear || 1
  const lean = bull > bear ? { t: 'Condong Dukung Emas', c: 'text-emerald-400' } : bear > bull ? { t: 'Condong Tekan Emas', c: 'text-red-400' } : { t: 'Gaya Seimbang', c: 'text-white/60' }
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[11px] font-black ${lean.c}`}>{lean.t}</span>
        <span className="text-[10px] text-white/45 tabular-nums"><span className="text-emerald-400 font-bold">{bull} dukung</span> · <span className="text-red-400 font-bold">{bear} tekan</span></span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-red-500/30 flex">
        <div className="h-full bg-emerald-500/70 transition-all" style={{ width: `${(bull / total) * 100}%` }} />
      </div>
    </div>
  )
}

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

// Chart XAU/USD via TradingView — SATU line chart bersih, timeframe bisa diganti.
const CHART_TFS: { label: string; value: string }[] = [
  { label: 'M5', value: '5' }, { label: 'M15', value: '15' }, { label: 'H1', value: '60' }, { label: 'H4', value: '240' }, { label: 'D1', value: 'D' },
]
function ChartPanel({ onExpand, hasAiLevels, className = '' }: { onExpand: () => void; hasAiLevels: boolean; className?: string }) {
  const [tf, setTf] = useState('15')
  return (
    <Panel title="Chart XAU/USD" icon={Activity} className={className} info="Line chart XAU/USD (TradingView, OANDA) — bersih & fokus arah harga. Ganti timeframe lewat tombol M5–D1."
      right={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {CHART_TFS.map(x => (
              <button key={x.value} onClick={() => setTf(x.value)} className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${tf === x.value ? 'bg-primary/20 text-primary' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}>{x.label}</button>
            ))}
          </div>
          <button onClick={onExpand} className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/80"><Maximize2 size={12} /> Perbesar</button>
        </div>
      }>
      {hasAiLevels && <p className="text-[10px] text-primary/70 mb-2 shrink-0">Level entry/SL/TP dari Analisa AI ada di panel "Analisa AI — Ambil Keputusan".</p>}
      <TradingViewChart symbol="OANDA:XAUUSD" interval={tf} chartStyle="2" minimal height={380} />
      <p className="text-[10px] text-white/30 mt-2">Line chart · fokus arah harga · TradingView (OANDA)</p>
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
// StatTile: kartu ringkas. Kalau `detail` diisi, kartu bisa DIKLIK untuk expand
// info lebih dalam inline (accordion di dalam kartu itu sendiri) — tanpa modal,
// tanpa mengganggu layout grid kartu di sekitarnya.
function StatTile({ icon: Icon, label, value, sub, tone = 'neutral', spark, sparkColor, info, detail, moreHref, moreLabel = 'Detail lengkap' }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; tone?: 'bull' | 'bear' | 'warn' | 'neutral'; spark?: number[]; sparkColor?: string; info?: string; detail?: React.ReactNode; moreHref?: string; moreLabel?: string }) {
  const [open, setOpen] = useState(false)
  const toneC = tone === 'bull' ? 'text-emerald-400' : tone === 'bear' ? 'text-red-400' : tone === 'warn' ? 'text-amber-400' : 'text-white/85'
  const hair = tone === 'bull' ? 'from-emerald-400/60' : tone === 'bear' ? 'from-red-400/60' : tone === 'warn' ? 'from-amber-400/60' : 'from-white/15'
  const clickable = !!detail
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-[#0b100e] p-4 flex flex-col justify-between min-h-[92px] transition-colors ${open ? 'border-primary/30' : 'border-white/[0.07] hover:border-white/[0.14]'} ${clickable ? 'cursor-pointer' : ''}`}
      style={{ backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.03), transparent 45%)' }}
      title={clickable ? undefined : info}
      onClick={clickable ? () => setOpen(v => !v) : undefined}
      role={clickable ? 'button' : undefined}>
      <span className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${hair} to-transparent`} />
      <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/40"><Icon size={12} /> {label}</span>{clickable ? <ChevronDown size={12} className={`text-white/25 transition-transform ${open ? 'rotate-180 text-primary' : ''}`} /> : info && <Info size={11} className="text-white/20" />}</div>
      <div className="flex items-end justify-between gap-1 mt-2">
        <div><p className={`text-xl font-black leading-none ${toneC}`}>{value}</p>{sub && <p className="text-[11px] text-white/45 mt-1 leading-tight">{sub}</p>}</div>
        {spark && <Sparkline data={spark} color={sparkColor ?? '#60a5fa'} />}
      </div>
      {/* Link ke halaman detail — SELALU tampil (tak perlu expand dulu) */}
      {moreHref && (
        <Link href={moreHref} onClick={e => e.stopPropagation()} className="relative z-10 flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline mt-2.5 pt-2.5 border-t border-white/[0.06]">
          {moreLabel} <ChevronRight size={12} />
        </Link>
      )}
      {open && detail && (
        <div className="mt-3 pt-3 border-t border-white/[0.07] cursor-default" onClick={e => e.stopPropagation()}>
          {detail}
        </div>
      )}
    </div>
  )
}
// Baris kecil dipakai di dalam StatTile detail (label kiri, nilai kanan).
function DetailRow({ l, v, c }: { l: string; v: React.ReactNode; c?: string }) {
  return <div className="flex items-center justify-between text-[11px] py-0.5"><span className="text-white/45">{l}</span><span className={`font-bold tabular-nums ${c ?? 'text-white/80'}`}>{v}</span></div>
}
const cellState = (s: 'bullish' | 'bearish' | 'netral') => s === 'bullish' ? 'bg-emerald-500/15 text-emerald-400' : s === 'bearish' ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.04] text-white/45'
function HeatCell({ state, text }: { state: 'bullish' | 'bearish' | 'netral'; text: string }) {
  return <div className={`rounded-md py-1 text-center text-[10px] font-bold ${cellState(state)}`}>{text}</div>
}
// meter horizontal -100..100 (dipakai untuk momentum, risk-on/off, curve)
// Meter risk-on/off yang mudah dibaca: bar terisi = proporsi ke sisi risk-off (dukung emas)
// vs risk-on (tekan emas), dengan label & % besar. riskOn: -1 (risk-off) .. +1 (risk-on).
function RiskMeter({ riskOn }: { riskOn: number }) {
  // Gauge modern: track gradient risk-off (kiri, hijau/bullish emas) → risk-on (kanan, merah),
  // marker menunjukkan posisi sekarang. pos 0..100 (0 = ekstrem risk-off).
  const pos = clamp(Math.round(50 + riskOn * 50), 2, 98)
  const zona = riskOn < -0.35 ? 'Risk-Off Kuat' : riskOn < -0.1 ? 'Risk-Off' : riskOn > 0.35 ? 'Risk-On Kuat' : riskOn > 0.1 ? 'Risk-On' : 'Seimbang'
  const zc = riskOn < -0.1 ? 'text-emerald-400' : riskOn > 0.1 ? 'text-red-400' : 'text-white/70'
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-white/45">Posisi sentimen sekarang</span>
        <span className={`text-sm font-black ${zc}`}>{zona}</span>
      </div>
      <div className="relative h-3 rounded-full ring-1 ring-white/10" style={{ background: 'linear-gradient(90deg, #10b981 0%, #34d399 30%, #6b7280 50%, #f87171 70%, #ef4444 100%)' }}>
        <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700" style={{ left: `${pos}%` }}>
          <span className="block w-5 h-5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] ring-4 ring-black/50" />
        </span>
      </div>
      <div className="flex justify-between text-[10px] font-semibold mt-2">
        <span className="text-emerald-400">🛡️ Risk-Off · emas naik</span>
        <span className="text-white/30">netral</span>
        <span className="text-red-400">Risk-On · emas turun 📈</span>
      </div>
    </div>
  )
}

// ─────────────────────────── TAB ───────────────────────────
type Tab = 'ringkasan' | 'teknikal' | 'makro' | 'makro-lintas' | 'makro-inflasi' | 'makro-cot' | 'sentimen' | 'berita' | 'rnd' | 'status' | 'panduan'
const TABS: { id: Tab; label: string; icon: React.ElementType; group?: string; pro?: boolean }[] = [
  { id: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard, group: 'Analisa' },
  { id: 'teknikal', label: 'Teknikal', icon: Activity, group: 'Analisa', pro: true },
  { id: 'makro', label: 'Makro', icon: Landmark, group: 'Analisa', pro: true },
  { id: 'sentimen', label: 'Sentimen', icon: Users, group: 'Analisa', pro: true },
  { id: 'berita', label: 'Analisa News', icon: Newspaper, group: 'Analisa', pro: true },
  { id: 'rnd', label: 'R&D Sniper', icon: Crosshair, group: 'Sistem' },
  { id: 'status', label: 'Status Server', icon: Server, group: 'Sistem' },
  { id: 'panduan', label: 'Panduan', icon: BookOpen, group: 'Sistem' },
]
// Sub-menu (dropdown) di bawah item "Makro" — halaman makro mendalam.
const MACRO_SUBTABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'makro', label: 'Ringkasan Makro', icon: Landmark },
  { id: 'makro-lintas', label: 'Lintas Aset', icon: LineChart },
  { id: 'makro-inflasi', label: 'Inflasi & Fed', icon: Flame },
  { id: 'makro-cot', label: 'Institusi vs Retail', icon: Users },
]
const MACRO_TAB_IDS = MACRO_SUBTABS.map(s => s.id)
// Pill bar sub-menu makro — tampil di atas konten tiap sub-tab (nav utama di mobile).
function MacroSubNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {MACRO_SUBTABS.map(s => {
        const on = tab === s.id
        return (
          <button key={s.id} onClick={() => setTab(s.id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors shrink-0 ${on ? 'bg-primary/15 text-primary ring-1 ring-primary/25' : 'text-white/45 hover:text-white/80 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
            <s.icon size={13} /> {s.label}
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────── GATE PRO/FREE ───────────────────────────
// Konten DUMMY (angka/meter palsu) untuk latar panel terkunci — data ASLI tak
// pernah dirender ke DOM untuk user Free, jadi tak ada info yang bocor lewat blur.
function LockedDummy() {
  const bars: [string, string, string][] = [['w-[72%]', 'bg-emerald-400/40', 'w-10'], ['w-[54%]', 'bg-emerald-400/35', 'w-8'], ['w-[38%]', 'bg-red-400/40', 'w-9']]
  return (
    <div className="p-4">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="#34d399" strokeWidth="3.5" strokeDasharray="66 94" strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-emerald-400">72</span>
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-3 w-28 rounded bg-white/15" />
          <div className="h-2.5 w-40 rounded bg-white/[0.08]" />
          <div className="h-2.5 w-24 rounded bg-white/[0.08]" />
        </div>
      </div>
      <div className="space-y-2 mb-4">
        {bars.map(([w, c], i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2.5 w-14 rounded bg-white/10 shrink-0" />
            <div className="flex-1 h-2.5 rounded-full bg-white/[0.06] overflow-hidden"><div className={`h-full rounded-full ${c} ${w}`} /></div>
            <div className={`h-2.5 ${bars[i][2]} rounded bg-white/10`} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2 space-y-1.5">
            <div className="h-2 w-10 rounded bg-white/8" />
            <div className={`h-3 w-12 rounded ${i % 3 === 2 ? 'bg-red-400/30' : 'bg-emerald-400/30'}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
// Bungkus panel bernilai: latar = konten DUMMY di-blur kuat & tak bisa diklik,
// di atasnya overlay nama kategori + CTA upgrade. Klik → /upgrade.
// children SENGAJA diabaikan (data asli tak dirender untuk Free).
function LockedWrap({ title }: { title: string; children?: React.ReactNode; blur?: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0b100e] min-h-[190px]">
      <div className="pointer-events-none select-none" style={{ filter: 'blur(11px)' }} aria-hidden><LockedDummy /></div>
      <Link href="/upgrade" className="group absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#060a09]/70 to-[#060a09]/85 hover:from-[#060a09]/60 hover:to-[#060a09]/80 transition-colors">
        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 ring-1 ring-primary/30 text-primary"><Lock size={17} /></span>
        <p className="text-[13px] font-bold text-white/90 text-center px-4">{title}</p>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-[11px] font-bold group-hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"><Crown size={12} /> Buka dengan Pro</span>
      </Link>
    </div>
  )
}
// Teaser satu halaman penuh untuk tab yang khusus Pro (Teknikal/Makro/Sentimen/News).
function LockedTab({ icon: Icon, title, tagline, benefits }: { icon: React.ElementType; title: string; tagline: string; benefits: string[] }) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="relative rounded-3xl border border-primary/20 bg-gradient-to-b from-[#0b1512] to-[#0b100e] overflow-hidden p-8 md:p-12 text-center">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-primary/12 blur-[110px] rounded-full pointer-events-none" />
        <div className="relative">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 ring-1 ring-primary/30 text-primary mb-5"><Icon size={26} /></span>
          <span className="ml-2 inline-flex items-center gap-1 align-middle text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 rounded-full px-2.5 py-1"><Crown size={11} /> Fitur Pro</span>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-4">{title}</h2>
          <p className="text-sm text-white/55 mt-2.5 max-w-md mx-auto leading-relaxed">{tagline}</p>
          <ul className="mt-6 space-y-2.5 text-left max-w-sm mx-auto">
            {benefits.map(b => <li key={b} className="flex items-start gap-2.5 text-sm text-white/75"><span className="shrink-0 mt-0.5 rounded-full bg-primary/15 p-0.5"><Check size={12} className="text-primary" /></span>{b}</li>)}
          </ul>
          <Link href="/upgrade" className="group inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-bold mt-8 hover:opacity-90 transition-all shadow-lg shadow-primary/25"><Crown size={15} /> Upgrade ke Pro</Link>
          <p className="text-[11px] text-white/35 mt-3">Mulai Rp179.000/bln · buka semua analisa AI</p>
        </div>
      </div>
    </div>
  )
}
const LOCKED_TAB_META: Record<string, { title: string; tagline: string; benefits: string[] }> = {
  teknikal: { title: 'Analisa Teknikal AI', tagline: 'Datalitiq AI membaca chart & struktur multi-timeframe jadi arah + level entry/stop/target.', benefits: ['Konfluensi M5/M15/H1 + bias H4/Daily', 'Level entry, stop & target berupa angka', 'Sinyal reversal & zona penting otomatis'] },
  makro: { title: 'Analisa Makro AI', tagline: 'Dampak dolar, yield, inflasi, Fed & posisi institusi (COT) ke XAU/USD — jadi bias yang jelas.', benefits: ['12+ data ekonomi resmi (FRED)', 'Posisi COT institusi vs retail (smart money)', 'Kurva yield & real yield dijelaskan'] },
  sentimen: { title: 'Analisa Sentimen AI', tagline: 'Risk-on/off (VIX, saham, BTC) & berita terkini ditimbang jadi peta sentimen ke emas.', benefits: ['Risk-on/off dari VIX, S&P500, Nasdaq & BTC', 'Peta sentimen → dukung/tekan emas', 'Analisa dampak berita terkini'] },
  berita: { title: 'Analisa News AI', tagline: 'Prediksi arah emas sebelum rilis berita besar — skenario reaksi + level kunci, tanpa larangan.', benefits: ['Prediksi dampak CPI/NFP/FOMC ke emas', 'Skenario reaksi + probabilitas', 'Rekomendasi arah pre-news + peringatan'] },
}

// ─────────────────────────── PAGE ───────────────────────────
export function TradingTerminal({ plan = 'pro', isAdmin = false }: { plan?: 'free' | 'pro'; isAdmin?: boolean }) {
  const isPro = plan === 'pro'
  const now = useClock()
  const live = useLiveXauFeed()
  const cross = useCrossAsset()
  const { map: macro, updatedAt: macroAt } = useMacro()
  const macroTech = useMacroCandleFeed()
  const { p: pivotsLive, updatedAt: pivotAt } = usePivots()
  const { cot, updatedAt: cotAt } = useCot()
  const ai = useAiAnalysis()
  const credits = useCredits()
  const logoUrl = useAppConfigLogo()
  const { data: newsItems, updatedAt: newsAt } = useNews()
  const accuracy = useAccuracy()
  const calEvents = useCalendar()
  const predictions = usePredictions()
  // Spread broker (poin $) — disimpan lokal, untuk cek kelayakan biaya scalping
  const [spread, setSpread] = useState<number>(() => { if (typeof window === 'undefined') return 0; const v = parseFloat(localStorage.getItem('dtq_spread') || '0'); return Number.isFinite(v) && v >= 0 ? v : 0 })
  const saveSpread = (v: number) => { setSpread(v); try { localStorage.setItem('dtq_spread', String(v)) } catch { } }
  const [tab, setTab] = useState<Tab>('ringkasan')
  const [macroOpen, setMacroOpen] = useState(false)
  const [chartFull, setChartFull] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [showPrompt, setShowPrompt] = useState(false)  // form konteks AI tersembunyi secara default
  const [aiFull, setAiFull] = useState(true)           // toggle output AI: Lengkap vs Ringkas
  const [soundOn, setSoundOn] = useState<boolean>(() => { if (typeof window === 'undefined') return true; return localStorage.getItem('dtq_regime_sound') !== 'off' })
  // Nyalakan → putar preview chime (langsung terdengar, sekaligus "membuka" izin audio browser
  // di titik ini — bukan menunggu regime berubah, yang mungkin tak terjadi selama Anda tes).
  const toggleSound = () => setSoundOn(v => { const n = !v; try { localStorage.setItem('dtq_regime_sound', n ? 'on' : 'off') } catch { } ; if (n) playChime('regime', 'up'); return n })
  const regimePhaseRef = useRef<RegimePhase | undefined>(undefined)  // histeresis regime (fase sebelumnya)
  const notifiedRegime = useRef<{ phase: RegimePhase; label: string } | null>(null)  // deteksi perubahan regime utk notif
  // Momentum & Signal Meter memakai ambang keras (±15 dan ±20), jadi nilai yang
  // bergoyang di sekitar ambang bisa memicu notifikasi berkali-kali. Label baru
  // harus BERTAHAN selama CONFIRM_MS sebelum dibunyikan — display tetap berubah
  // seketika, hanya notifikasinya yang menunggu konfirmasi.
  const CONFIRM_MS = 45_000
  const notifiedMom = useRef<string | null>(null)
  const pendingMom = useRef<{ label: string; since: number } | null>(null)
  const notifiedSig = useRef<string | null>(null)
  const pendingSig = useRef<{ label: string; since: number } | null>(null)
  // R&D Sniper (khusus admin): state fase sebelumnya + kunci notifikasi terakhir
  const phasePrevRef = useRef<PhaseState | null>(null)
  const notifiedPhase = useRef<string | null>(null)
  const notifiedEntry = useRef<string | null>(null)   // satu alert per kunjungan zona entry

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
  // News Guard: rilis USD High-impact ±30 menit dari sekarang → tahan entry
  const highEvents = calEvents.filter(e => e.impact === 'High')
  const guardEvent = highEvents.find(e => Math.abs(now - e.time) <= 30 * 60_000) ?? null
  const nextEvent = highEvents.find(e => e.time > now) ?? null
  const evCountdown = (t: number) => { const m = Math.round((t - now) / 60_000); return m <= 0 ? `${-m} mnt lalu` : m < 90 ? `${m} mnt lagi` : `${Math.floor(m / 60)}j ${m % 60}m lagi` }
  // Arah & ringkasan per sesi hari ini (Asia/London/NY, reset harian)
  const sesi = sessionSummary(feed.tf.M15.candles, now)
  // Kelayakan biaya: target scalp tipikal (ATR M15) minimal 3× spread
  const costOk = spread > 0 ? feed.tf.M15.atr >= 3 * spread : null
  // #6 putus feedback loop: verdict AI TIDAK diumpankan ke skor (dulu bikin AI konfirmasi diri sendiri)
  const riskOn = riskOnScore(cross, usOpen)
  // Makro per-candle (UUP=dolar, IEF=yield 10Y terbalik) — M5/M15/H1, sebanding dgn Teknikal.
  const macroTechReady = macroTech.uup && macroTech.ief
  // Yield BELUM BUKA = bursa AS tutup (IEF adalah ETF, hanya trading 09:30-16:00 ET).
  // Di sesi Asia/Eropa datanya berjam-jam lalu. Memakainya seolah-olah hidup
  // membuat terminal menampilkan dampak -100 penuh keyakinan dari data basi,
  // padahal emas sedang bergerak live. Karena itu kontribusinya DINOLKAN, bukan
  // sekadar diberi label — skor yang salah lebih berbahaya daripada skor kosong.
  const yieldStale = macroTech.yieldStaleMin != null && macroTech.yieldStaleMin > STALE_MIN
  const fastMacroRaw = macroTechReady ? macroCandleBlend(macroTech.uup!, macroTech.ief!) : null
  const fastMacro = fastMacroRaw ? { ...fastMacroRaw, yieldImpact: yieldStale ? 0 : fastMacroRaw.yieldImpact } : null
  const macroM15Raw = macroTechReady ? macroCandleImpact(macroTech.uup!.M15, macroTech.ief!.M15) : null
  const macroM15 = macroM15Raw ? { ...macroM15Raw, yieldImpact: yieldStale ? 0 : macroM15Raw.yieldImpact } : null
  // Ringkasan makro per-candle (M5/M15/H1) — dipakai panel Makro MTF sekaligus
  // diumpankan ke Analisa AI. yieldImpact dinolkan saat pasarnya belum buka, konsisten dengan
  // perlakuan di skor: jangan sampai AI & panel melihat angka yang berbeda.
  const macroCandleSnap = macroTechReady ? (() => {
    const z = (m: { dollarImpact: number; yieldImpact: number }) => ({ ...m, yieldImpact: yieldStale ? 0 : m.yieldImpact })
    return {
      M5: z(macroCandleImpact(macroTech.uup!.M5, macroTech.ief!.M5)),
      M15: z(macroCandleImpact(macroTech.uup!.M15, macroTech.ief!.M15)),
      H1: z(macroCandleImpact(macroTech.uup!.H1, macroTech.ief!.H1)),
      blend: fastMacro,
    }
  })() : null
  const sc = scores(feed.tf, macro, null, riskOn, cross.uup?.changePct ?? null, fastMacro)
  const conf = confluence(feed.tf)
  const dir = sc.label
  const m5 = feed.tf.M5.candles
  const atrNow = atrLast(m5, 7), atrBase = atrLast(m5, Math.min(40, m5.length - 1)) || atrNow
  const volRatio = atrBase ? atrNow / atrBase : 1
  const volLabel = volRatio < 0.75 ? 'Rendah' : volRatio > 1.4 ? 'Tinggi' : 'Normal'
  const adx = feed.tf.M15.adx, adxL = adxLabel(adx), trendUp = feed.tf.M15.plusDI >= feed.tf.M15.minusDI
  const confPct = Math.round((sc.overall + 100) / 2)
  const strongestPillar = Math.abs(sc.macro) >= Math.abs(sc.tech) && Math.abs(sc.macro) >= Math.abs(sc.senti) ? 'Makro' : Math.abs(sc.tech) >= Math.abs(sc.senti) ? 'Teknikal' : 'Sentimen'
  // Konflik pilar: 2 pilar TERKUAT (bukan sekadar sama tanda) berlawanan arah & sama-sama
  // bukan netral (>20). Confidence bisa tetap tinggi murni karena magnitude besar, meski
  // pilar-pilarnya sebetulnya saling melawan — jangan sampai teks bilang "sejalan" saat ini.
  const pillarsRanked = [{ n: 'Makro', s: sc.macro }, { n: 'Teknikal', s: sc.tech }, { n: 'Sentimen', s: sc.senti }].sort((a, b) => Math.abs(b.s) - Math.abs(a.s))
  const [pTop, pSecond] = pillarsRanked
  const pillarConflict = Math.abs(pTop.s) > 20 && Math.abs(pSecond.s) > 20 && Math.sign(pTop.s) !== Math.sign(pSecond.s)
  const agreementText = pillarConflict
    ? { label: 'Kuat (tarik-menarik)', desc: `${pTop.n} & ${pSecond.n} berlawanan ekstrem — tunggu konfirmasi.`, cls: 'text-amber-400' }
    : sc.confidence > 66 ? { label: 'Kuat', desc: 'Ketiga pilar cenderung sejalan.', cls: 'text-emerald-400' }
    : sc.confidence > 40 ? { label: 'Sedang', desc: 'Sebagian pilar sejalan.', cls: 'text-amber-400' }
    : { label: 'Lemah', desc: 'Pilar saling bertentangan — hati-hati.', cls: 'text-red-400' }

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
  const regime = regimeOf({
    bbSqueeze, adx, adxTrend, trendUp,
    er: efficiencyRatio(feed.tf.M15.candles.map(c => c.c), 14),
    diSpread: Math.abs(feed.tf.M15.plusDI - feed.tf.M15.minusDI),
    m5: { adx: feed.tf.M5.adx, trendUp: feed.tf.M5.plusDI >= feed.tf.M5.minusDI },
    h1: { adx: feed.tf.H1.adx, trendUp: feed.tf.H1.plusDI >= feed.tf.H1.minusDI },
    prevPhase: regimePhaseRef.current,
  })
  regimePhaseRef.current = regime.phase
  // Notifikasi saat REGIME berubah (Ranging ⇄ Trending). Side-effect ditunda via setTimeout
  // agar tak setState saat render; ref di-update sinkron supaya hanya sekali per perubahan.
  {
    const prev = notifiedRegime.current
    if (prev === null) notifiedRegime.current = { phase: regime.phase, label: regime.label }
    else if (prev.phase !== regime.phase) {
      notifiedRegime.current = { phase: regime.phase, label: regime.label }
      const label = regime.label, toTrending = regime.phase === 'trending', beep = soundOn
      setTimeout(() => {
        toast[toTrending ? 'success' : 'info'](`Regime berubah → ${label}${toTrending ? ' · tren mulai jalan' : ' · pasar menyamping'}`)
        if (beep) playChime('regime', toTrending ? 'up' : 'flat')
      }, 0)
    }
  }
  const avgMomentum = (feed.tf.M5.momentum + feed.tf.M15.momentum + feed.tf.H1.momentum) / 3

  // ── Notifikasi MOMENTUM & SIGNAL METER ──
  // Ambang di sini harus sama persis dengan yang dipakai untuk menampilkan label,
  // supaya bunyi tidak pernah bertentangan dengan yang terbaca di layar.
  {
    const notifyStable = (
      cur: string,
      notified: React.RefObject<string | null>,
      pending: React.RefObject<{ label: string; since: number } | null>,
      fire: (label: string) => void,
    ) => {
      if (notified.current === null) { notified.current = cur; pending.current = null; return }  // render pertama: rekam saja
      if (cur === notified.current) { pending.current = null; return }
      const t = Date.now()
      if (pending.current?.label !== cur) { pending.current = { label: cur, since: t }; return }
      if (t - pending.current.since < CONFIRM_MS) return   // belum cukup bertahan
      notified.current = cur; pending.current = null
      setTimeout(() => fire(cur), 0)
    }
    const dirOf = (l: string): ChimeDir => l === 'Bullish' || l === 'BULLISH' ? 'up' : l === 'Bearish' || l === 'BEARISH' ? 'down' : 'flat'
    const beep = soundOn

    const momLabel = avgMomentum > 15 ? 'Bullish' : avgMomentum < -15 ? 'Bearish' : 'Netral'
    notifyStable(momLabel, notifiedMom, pendingMom, l => {
      toast[l === 'Netral' ? 'info' : l === 'Bullish' ? 'success' : 'error'](`Momentum → ${l} · skor ${avgMomentum >= 0 ? '+' : ''}${avgMomentum.toFixed(0)}`)
      if (beep) playChime('momentum', dirOf(l))
    })

    notifyStable(sc.label, notifiedSig, pendingSig, l => {
      toast[l === 'NETRAL' ? 'info' : l === 'BULLISH' ? 'success' : 'error'](`Signal Meter → ${l} · skor ${sc.overall >= 0 ? '+' : ''}${sc.overall.toFixed(0)}`)
      if (beep) playChime('signal', dirOf(l))
    })
  }

  // ── R&D SNIPER (khusus admin): deteksi fase Coiling → Ignition → Confirmed ──
  // Mesin murni di lib/trend-phase.ts; di sini hanya jalankan + notifikasi transisi.
  const phase = isAdmin ? detectTrendPhase({ m5: feed.tf.M5, m15: feed.tf.M15, price: feed.price, utcHour: hh, prev: phasePrevRef.current }) : null
  if (phase) {
    phasePrevRef.current = phase
    const key = `${phase.phase}:${phase.dir ?? '-'}`
    if (notifiedPhase.current === null) notifiedPhase.current = key   // render pertama: rekam saja
    else if (notifiedPhase.current !== key) {
      notifiedPhase.current = key
      if (phase.phase !== 'idle') {
        const p = phase, beep = soundOn, priceNow = feed.price
        setTimeout(() => {
          toast[p.phase === 'ignition' ? 'success' : 'info'](`🎯 R&D: ${p.label}${p.dir ? ` (${p.dir === 'bull' ? 'Bullish' : 'Bearish'})` : ''} · skor ${p.score}`)
          if (beep) playChime(p.phase === 'coiling' ? 'coiling' : p.phase === 'ignition' ? 'ignition' : 'regime', p.dir === 'bear' ? 'down' : p.dir === 'bull' ? 'up' : 'flat')
          // Email admin — token diambil dari sesi; route memverifikasi admin + rate-limit
          createClient().auth.getSession().then(({ data: { session } }) => {
            if (!session) return
            fetch('/api/admin/phase-alert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ phase: p.phase, dir: p.dir, label: p.label, score: p.score, price: priceNow, reasons: p.reasons, zoneNote: p.zone?.note ?? '' }),
            }).catch(() => {})
          })
        }, 0)
      }
    }

    // Notifikasi SETUP ENTRY (konfluensi zona + Fib). Terpisah dari notif fase:
    // ini yang benar-benar "boleh dieksekusi", jadi dibedakan bunyinya.
    // Kunci = sisi + zona dibulatkan → satu alert per kunjungan zona, bukan tiap tick.
    const eKey = phase.entry ? `${phase.entry.side}:${Math.round(phase.entry.zoneLo)}` : null
    if (notifiedEntry.current !== eKey) {
      notifiedEntry.current = eKey
      if (phase.entry) {
        const en = phase.entry, beep = soundOn, priceNow = feed.price
        setTimeout(() => {
          toast.success(`🎯 SETUP ${en.side} · skor ${en.score} · zona $${en.zoneLo.toFixed(1)}–$${en.zoneHi.toFixed(1)} · R:R 1:${en.rr.toFixed(1)}`)
          if (beep) playChime('ignition', en.side === 'BUY' ? 'up' : 'down')
          createClient().auth.getSession().then(({ data: { session } }) => {
            if (!session) return
            fetch('/api/admin/phase-alert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({
                phase: 'ignition', dir: en.side === 'BUY' ? 'bull' : 'bear',
                label: `SETUP ${en.side}`, score: en.score, price: priceNow,
                reasons: en.factors,
                zoneNote: `Entry $${en.zoneLo.toFixed(1)}–$${en.zoneHi.toFixed(1)} · SL $${en.sl.toFixed(1)} · TP1 $${en.tp1.toFixed(1)} · R:R 1:${en.rr.toFixed(1)}`,
              }),
            }).catch(() => {})
          })
        }, 0)
      }
    }
  }
  const goldSilver = cross.xag && cross.xag.price > 0 ? feed.price / cross.xag.price : null
  const gsRelative = cross.xag ? feed.changePct - cross.xag.changePct : null
  const curve2s10 = macro?.us10y && macro?.us02y ? macro.us10y.value - macro.us02y.value : null

  // Kesimpulan (sintesis)
  const kLines: string[] = []
  kLines.push(`Teknikal: ${conf.bulls} bullish / ${conf.bears} bearish dari 3 TF (${conf.label === 'NETRAL' ? 'campur' : conf.label.toLowerCase()}). Tren ${adxL}${adx >= 20 ? ` & ${trendUp ? 'naik' : 'turun'}` : ''}.`)
  if (macro?.dollar && macro?.us10y) { const dUp = macro.dollar.value > macro.dollar.prior, yUp = macro.us10y.value > macro.us10y.prior; kLines.push(`Makro: dolar ${dUp ? 'menguat' : 'melemah'}, yield 10Y ${yUp ? 'naik' : 'turun'} → ${(!dUp && !yUp) ? 'mendukung emas' : (dUp && yUp) ? 'menekan emas' : 'campur'}.`) }
  if (cot) kLines.push(`COT: institusi ${cot.funds.net >= 0 ? 'net long' : 'net short'}, retail ${cot.retail.net >= 0 ? 'net long' : 'net short'}${cot.funds.net * cot.retail.net < 0 ? ' — berlawanan' : ''}.`)
  if (ai.data) kLines.push(`Analisa AI: ${ai.data.verdict} — ${ai.data.headline}`); else kLines.push('Jalankan "Analisa AI" untuk pandangan menyeluruh.')
  // Zona entry = HARGA konkret (rata-rata sesi & EMA21 M15), bukan nama indikator.
  const e21M15 = feed.tf.M15.ema21[feed.tf.M15.ema21.length - 1]
  const pbLo = Math.min(e21M15, feed.tf.M15.vwap), pbHi = Math.max(e21M15, feed.tf.M15.vwap)
  const pbZone = pbHi - pbLo < 1 ? `$${f2((pbLo + pbHi) / 2)}` : `$${f2(pbLo)}–$${f2(pbHi)}`
  const kAction = sc.confidence < 40 ? 'Sinyal lemah/campur — tunggu konfirmasi arah.' : dir === 'BULLISH' ? `Bias BULLISH. Tunggu pullback ke area ${pbZone}, konfirmasi, baru entry beli.` : dir === 'BEARISH' ? `Bias BEARISH. Tunggu retest ke area ${pbZone}, konfirmasi, baru entry jual.` : 'Netral — tunggu arah dominan.'
  const kRisk = volLabel === 'Rendah' ? 'Volatilitas rendah — sinyal kurang reliabel, hindari over-trading.' : adx < 20 ? 'Tren lemah (ADX < 20) — pasar cenderung sideways, hati-hati whipsaw.' : !ai.data ? 'Jalankan Analisa AI & pantau rilis data ekonomi.' : 'Pantau rilis data ekonomi & pergerakan DXY/yield.'

  const snapshot = {
    price: +feed.price.toFixed(2), changePct: +feed.changePct.toFixed(2), session, volatility: volLabel,
    signal: { overall: Math.round(sc.overall), label: sc.label, confidence: sc.confidence, macro: Math.round(sc.macro), tech: Math.round(sc.tech), senti: Math.round(sc.senti) },
    tf: Object.fromEntries(TFS.map(t => { const d = feed.tf[t]; return [t, { bias: d.bias.label, rsi: Math.round(d.rsi), macd: d.macd.state, stoch: Math.round(d.stoch.k), struktur: d.structure.label, reversal: d.reversal.arah !== 'netral' ? `${d.reversal.arah} (${d.reversal.skor}/4 sinyal)` : null }] })),
    adx: +adx.toFixed(0), adxTrend, trendDir: trendUp ? 'naik' : 'turun', atrM15: +feed.tf.M15.atr.toFixed(2), vwapM15: +feed.tf.M15.vwap.toFixed(2),
    biasTFbesar: { H4: feed.htf.H4 ? { bias: feed.htf.H4.bias.label, rsi: Math.round(feed.htf.H4.rsi), struktur: feed.htf.H4.structure.label } : null, D1: feed.htf.D1 ? { bias: feed.htf.D1.bias.label, rsi: Math.round(feed.htf.D1.rsi), struktur: feed.htf.D1.structure.label } : null },
    regime: regime.label, momentum: Math.round(avgMomentum), bbSqueeze, riskSentiment: riskOn < -0.1 ? 'risk-off' : riskOn > 0.1 ? 'risk-on' : 'netral',
    goldSilverRatio: goldSilver ? +goldSilver.toFixed(1) : null, yieldCurve2s10: curve2s10 != null ? +curve2s10.toFixed(2) : null,
    // Candle mentah (bar TERTUTUP) untuk price action AI — O/H/L/C ringkas
    candlesM5: feed.tf.M5.candles.slice(-30).map(c => `${c.o.toFixed(1)}/${c.h.toFixed(1)}/${c.l.toFixed(1)}/${c.c.toFixed(1)}`),
    candlesM15: feed.tf.M15.candles.slice(-20).map(c => `${c.o.toFixed(1)}/${c.h.toFixed(1)}/${c.l.toFixed(1)}/${c.c.toFixed(1)}`),
    pivots: pivotsLive ? { P: +pivotsLive.P.toFixed(2), R1: +pivotsLive.R1.toFixed(2), R2: +pivotsLive.R2.toFixed(2), S1: +pivotsLive.S1.toFixed(2), S2: +pivotsLive.S2.toFixed(2) } : null,
    macro: macro ? Object.fromEntries(Object.entries(macro).map(([k, v]) => [k, { value: v.value, prior: v.prior }])) : null,
    // Makro PER-CANDLE (proxy UUP=dolar, IEF=yield 10Y terbalik): dampak-ke-emas -100..100 per TF.
    // Sebanding horizon waktunya dgn teknikal M5/M15/H1.
    macroCandle: macroCandleSnap ? {
      M5: { dolar: Math.round(macroCandleSnap.M5.dollarImpact), yield: Math.round(macroCandleSnap.M5.yieldImpact) },
      M15: { dolar: Math.round(macroCandleSnap.M15.dollarImpact), yield: Math.round(macroCandleSnap.M15.yieldImpact) },
      H1: { dolar: Math.round(macroCandleSnap.H1.dollarImpact), yield: Math.round(macroCandleSnap.H1.yieldImpact) },
      blend: macroCandleSnap.blend ? { dolar: Math.round(macroCandleSnap.blend.dollarImpact), yield: Math.round(macroCandleSnap.blend.yieldImpact) } : null,
    } : null,
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
          <p className="text-[11px] text-white/55 leading-snug">Kesepakatan sinyal: <b className={agreementText.cls}>{agreementText.label}</b>. {agreementText.desc}</p>
        </div>
      </div>
      <div className="space-y-2.5">
        <PillarRow label="Makro (FRED)" score={sc.macro} desc="Dolar, yield, inflasi, kebijakan Fed" />
        <PillarRow label="Teknikal (Chart)" score={sc.tech} desc="Konfluensi M5/M15/H1 · EMA · RSI · VWAP" />
        <PillarRow label="Sentimen (Berita/Pasar)" score={sc.senti} desc="Berita AI, VIX, saham, BTC" />
      </div>
    </Panel>
  )
  // Panel gabungan "Detail 3 Pilar & Alasan" — merger Signal Meter + Bias & Confidence +
  // Kesimpulan & Saran (Ringkasan). Decision Hero sudah pegang verdict/confidence/aksi.
  const PilarPanel = (
    <Panel title="Detail 3 Pilar & Alasan" icon={GaugeIcon} accent={meterZone(sc.overall).color} info="Rincian di balik kesimpulan: skor tiap pilar (makro/teknikal/sentimen), kesepakatan antar-pilar, dan alasan + risikonya." right={<span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${dirBg(sc.label)}`}>{sc.label} {confPct}%</span>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="space-y-2.5">
            <PillarRow label="Makro (FRED + Dolar live)" score={sc.macro} desc="Dolar, yield, inflasi, kebijakan Fed" />
            <PillarRow label="Teknikal (Chart)" score={sc.tech} desc="Konfluensi M5/M15/H1 · tren · momentum" />
            <PillarRow label="Sentimen (Berita/Pasar)" score={sc.senti} desc="VIX, saham, BTC · risk-on/off" />
          </div>
          <p className="text-[10px] text-white/50 leading-snug mt-3 pt-2 border-t border-white/5">Kesepakatan sinyal: <b className={agreementText.cls}>{agreementText.label}</b> · {agreementText.desc}</p>
        </div>
        <div className="flex flex-col">
          <ul className="space-y-1 mb-2">{kLines.map((l, i) => <li key={i} className="text-[10px] text-white/65 leading-snug flex gap-1.5"><span className="text-primary mt-0.5">•</span>{l}</li>)}</ul>
          <div className="mt-auto flex items-start gap-1.5"><span className="text-[9px] text-amber-400/70 mt-0.5">⚠</span><p className="text-[9px] text-white/45 leading-snug">{kRisk}</p></div>
        </div>
      </div>
    </Panel>
  )
  // Riwayat 10 kesimpulan terakhir + hasil evaluasi 2 jam (dari kalibrasi cron)
  const RiwayatPanel = (
    <Panel title="Riwayat Kesimpulan" icon={CheckCircle2} info="10 kesimpulan terakhir yang tercatat (via cron tiap 5 menit, dirangkum) + hasil evaluasinya 2 jam kemudian: ✓ arah benar, ✗ meleset, ○ netral/belum dievaluasi. Untuk menakar keandalan sinyal secara nyata.">
      {predictions && predictions.length > 0 ? (
        <div className="space-y-1">
          {predictions.map((p, i) => {
            const t = new Date(p.created_at)
            const res = !p.evaluated ? { icon: '○', c: 'text-white/35', txt: 'menunggu' } : p.correct === true ? { icon: '✓', c: 'text-emerald-400', txt: `${p.price_after != null ? (p.price_after - p.price >= 0 ? '+' : '') + (p.price_after - p.price).toFixed(1) : ''}` } : p.correct === false ? { icon: '✗', c: 'text-red-400', txt: `${p.price_after != null ? (p.price_after - p.price >= 0 ? '+' : '') + (p.price_after - p.price).toFixed(1) : ''}` } : { icon: '—', c: 'text-white/35', txt: 'netral' }
            return (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2 py-1.5 text-[10px]">
                <span className="text-white/35 tabular-nums w-14 shrink-0">{t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} {t.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })}</span>
                <span className={`font-bold w-16 ${dirColor(p.dir)}`}>{p.dir === 'BULLISH' ? 'Bullish' : p.dir === 'BEARISH' ? 'Bearish' : 'Netral'}</span>
                <span className="text-white/40 tabular-nums">{p.confidence ?? '—'}%</span>
                <span className="text-white/40 tabular-nums hidden sm:inline">@{p.price.toFixed(1)}</span>
                <span className={`ml-auto font-black ${res.c}`}>{res.icon} <span className="font-semibold tabular-nums">{res.txt}</span></span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2.5 text-white/40 text-[11px] py-4"><Clock size={14} className="text-white/25" /> Belum ada riwayat — aktifkan cron + tabel terminal_predictions, riwayat terisi otomatis.</div>
      )}
    </Panel>
  )
  const MtfPanel = (
    <Panel title="Konfluensi Multi-Timeframe" icon={Crosshair} info="Bias tiap timeframe (M5/M15/H1) dari EMA, VWAP, RSI. Entry paling aman searah TF besar (H1)." right={<span className={`text-[10px] font-bold ${dirColor(conf.label)}`}>{conf.label === 'NETRAL' ? 'CAMPUR' : conf.label} · {conf.strength}</span>}>
      <div className="space-y-2">{TFS.map(x => { const b = feed.tf[x].bias; return (
        <div key={x} className="flex items-center gap-2"><span className="text-[11px] font-bold w-8 text-white/60">{x}</span><div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden"><div className={`h-full ${b.label === 'BULLISH' ? 'bg-emerald-400' : b.label === 'BEARISH' ? 'bg-red-400' : 'bg-white/25'}`} style={{ width: `${33 + Math.abs(b.score) * 22}%` }} /></div><span className={`text-[10px] font-bold w-16 text-right ${dirColor(b.label)}`}>{b.label}</span></div>) })}</div>
      <p className="text-[9px] text-white/30 mt-2 pt-2 border-t border-white/5">Entry paling aman searah TF besar (H1).</p>
    </Panel>
  )
  // ── Makro per-timeframe, disandingkan dengan bias Teknikal ──
  // Tujuannya menjawab "apakah makro dan teknikal searah di TF yang sama?".
  // Sebelumnya data M5/M15/H1 ini sudah dihitung tapi hanya dikirim ke AI —
  // tidak pernah terlihat user, padahal justru di sinilah korelasi/divergensi
  // makro vs teknikal paling jelas terbaca.
  const MacroMtfPanel = macroCandleSnap ? (() => {
    const rows = TFS.map(tf => {
      const m = macroCandleSnap[tf]
      const tech = feed.tf[tf].bias
      // Dampak makro ke EMAS: positif = mendukung emas, negatif = menekan.
      const macroDir = m.dollarImpact + (yieldStale ? 0 : m.yieldImpact) > 20 ? 'BULLISH'
        : m.dollarImpact + (yieldStale ? 0 : m.yieldImpact) < -20 ? 'BEARISH' : 'NETRAL'
      const sejalan = macroDir !== 'NETRAL' && tech.label !== 'NETRAL' && macroDir === tech.label
      const lawan = macroDir !== 'NETRAL' && tech.label !== 'NETRAL' && macroDir !== tech.label
      return { tf, m, tech, macroDir, sejalan, lawan }
    })
    const nLawan = rows.filter(r => r.lawan).length
    const nSejalan = rows.filter(r => r.sejalan).length
    // Bar dua arah dari titik tengah: kanan = mendukung emas, kiri = menekan.
    // Dibuat tebal (h-2.5) agar terbaca sekilas tanpa memicingkan mata.
    const bar = (v: number) => {
      const c = v > 20 ? '#10b981' : v < -20 ? '#ef4444' : 'rgba(255,255,255,.3)'
      return (
        <div className="flex-1 h-2.5 rounded-full bg-white/[0.06] overflow-hidden relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
          <div className="absolute top-0 bottom-0 rounded-full transition-all" style={{ background: c, left: v >= 0 ? '50%' : `${50 + v / 2}%`, width: `${Math.max(1.5, Math.abs(v) / 2)}%` }} />
        </div>
      )
    }
    const verdictC = nLawan >= 2 ? '#ef4444' : nSejalan >= 2 ? '#10b981' : 'rgba(255,255,255,.5)'
    const verdictT = nLawan >= 2 ? 'BERTENTANGAN' : nSejalan >= 2 ? 'SEJALAN' : 'CAMPUR'
    return (
      <Panel title="Makro per-Timeframe vs Teknikal" icon={Scale} accent={verdictC}
        info="Dampak makro ke EMAS dihitung pada struktur candle M5/M15/H1 — sama seperti pilar Teknikal — supaya bisa dibandingkan langsung. Bar ke kanan = mendukung emas, ke kiri = menekan. Kolom Teknikal adalah bias di TF yang sama; kalau berlawanan, sinyal sedang bertentangan dan risiko whipsaw naik."
        right={<span className="text-[11px] font-black px-2.5 py-1 rounded-lg" style={{ background: `${verdictC}22`, color: verdictC }}>{verdictT}</span>}>
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.tf} className="rounded-xl border p-3.5"
              style={{ borderColor: r.lawan ? '#ef444440' : r.sejalan ? '#10b98140' : 'rgba(255,255,255,.08)', background: r.lawan ? '#ef44440a' : r.sejalan ? '#10b9810a' : 'rgba(255,255,255,.02)' }}>
              {/* Baris judul TF + verdict */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-base font-black text-white/85">{r.tf}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                  style={{ background: r.lawan ? '#ef444422' : r.sejalan ? '#10b98122' : 'rgba(255,255,255,.06)', color: r.lawan ? '#f87171' : r.sejalan ? '#34d399' : 'rgba(255,255,255,.45)' }}>
                  {r.lawan ? 'Berlawanan' : r.sejalan ? 'Searah' : 'Netral'}
                </span>
              </div>

              {/* Dolar */}
              <div className="flex items-center gap-3 mb-2.5">
                <span className="text-[12px] font-semibold text-white/50 w-16 shrink-0">Dolar</span>
                {bar(r.m.dollarImpact)}
                <span className="text-[13px] font-black tabular-nums w-12 text-right"
                  style={{ color: r.m.dollarImpact > 20 ? '#34d399' : r.m.dollarImpact < -20 ? '#f87171' : 'rgba(255,255,255,.5)' }}>
                  {r.m.dollarImpact >= 0 ? '+' : ''}{Math.round(r.m.dollarImpact)}
                </span>
              </div>

              {/* Yield */}
              <div className="flex items-center gap-3 mb-2.5">
                <span className="text-[12px] font-semibold text-white/50 w-16 shrink-0">Yield</span>
                {yieldStale ? (
                  <span className="flex-1 flex items-center gap-1.5 text-[12px] text-amber-400/80">
                    <Clock size={13} /> Pasar yield belum buka
                  </span>
                ) : (
                  <>
                    {bar(r.m.yieldImpact)}
                    <span className="text-[13px] font-black tabular-nums w-12 text-right"
                      style={{ color: r.m.yieldImpact > 20 ? '#34d399' : r.m.yieldImpact < -20 ? '#f87171' : 'rgba(255,255,255,.5)' }}>
                      {r.m.yieldImpact >= 0 ? '+' : ''}{Math.round(r.m.yieldImpact)}
                    </span>
                  </>
                )}
              </div>

              {/* Teknikal — pembanding */}
              <div className="flex items-center gap-3 pt-2.5 border-t border-white/[0.06]">
                <span className="text-[12px] font-semibold text-white/50 w-16 shrink-0">Teknikal</span>
                <span className={`text-[13px] font-black ${dirColor(r.tech.label)}`}>{r.tech.label}</span>
              </div>
            </div>
          ))}

          <div className="rounded-xl p-3.5" style={{ background: `${verdictC}12`, border: `1px solid ${verdictC}33` }}>
            <p className="text-[13px] leading-relaxed" style={{ color: nLawan >= 2 ? '#fca5a5' : nSejalan >= 2 ? '#6ee7b7' : 'rgba(255,255,255,.7)' }}>
              {nLawan >= 2
                ? 'Makro dan Teknikal berlawanan di mayoritas timeframe — kondisi rawan whipsaw. Kurangi ukuran posisi atau tunggu keduanya searah.'
                : nSejalan >= 2
                  ? 'Makro dan Teknikal searah di mayoritas timeframe — konfluensi terkuat untuk entry.'
                  : 'Sinyal campur antar timeframe — belum ada dorongan dominan.'}
            </p>
          </div>

          <p className="text-[11px] text-white/35 leading-relaxed">
            Dolar: {macroTech.dollarLive ? 'forex 24 jam (live)' : 'proxy ETF UUP'} · Yield: {yieldStale
              ? `pasar yield belum buka — data terakhir ${Math.round(macroTech.yieldStaleMin!)} menit lalu, kontribusinya tidak dihitung`
              : 'live'}
          </p>
        </div>
      </Panel>
    )
  })() : null

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
  // ── Proyeksi: arah leg, target, kedalaman koreksi, sisa ruang harian ──
  // Sengaja dibingkai "level proyeksi", BUKAN prediksi: yang dihitung adalah
  // tempat harga cenderung bereaksi (Fib extension/retracement dari leg nyata),
  // bukan klaim ke mana harga pasti pergi.
  const proj = buildProjection({
    m15: feed.tf.M15.candles, d1: feed.htf.D1?.candles ?? [], price: feed.price,
    ema21: feed.tf.M15.ema21[feed.tf.M15.ema21.length - 1] ?? feed.price,
    atr: feed.tf.M15.atr, dayHigh: feed.dayHigh, dayLow: feed.dayLow,
  })
  const projC = proj.dir === 'naik' ? '#10b981' : proj.dir === 'turun' ? '#ef4444' : '#64748b'
  const ProjLevelRow = ({ l, tone }: { l: ProjLevel; tone: string }) => (
    <div className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${l.reached ? 'bg-white/[0.06]' : 'bg-white/[0.02]'}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-bold shrink-0 w-14" style={{ color: l.reached ? 'rgba(255,255,255,.45)' : tone }}>{l.label}</span>
        <span className="text-[10px] text-white/35 truncate">{l.basis}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[12px] font-black tabular-nums">${l.price.toFixed(1)}</span>
        <span className="text-[10px] tabular-nums w-12 text-right" style={{ color: l.distPct >= 0 ? '#34d399' : '#f87171' }}>
          {l.distPct >= 0 ? '+' : ''}{l.distPct.toFixed(2)}%
        </span>
        {l.reached && <span className="text-[9px] text-white/35">✓</span>}
      </div>
    </div>
  )
  const ProjeksiPanel = (
    <Panel title="Proyeksi Harga · Target & Koreksi" icon={Route} accent={projC}
      info="Level terukur dari leg impuls M15 terakhir: target = Fibonacci extension + swing sebelumnya; koreksi = retracement 38.2/50/61.8/78.6%. Tanda ✓ = sudah tersentuh. INI BUKAN PREDIKSI — hanya area di mana harga secara historis cenderung bereaksi."
      right={<span className="text-[10px] font-bold" style={{ color: projC }}>{proj.dir === 'naik' ? '▲ LEG NAIK' : proj.dir === 'turun' ? '▼ LEG TURUN' : '↔ CAMPUR'}</span>}>
      {proj.targets.length === 0 ? (
        <p className="text-[12px] text-white/45 py-3">{proj.note}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] text-white/55 leading-relaxed">{proj.dirNote}</p>

          {/* POSISI HARGA SEKARANG — skala visual dari dasar ke puncak leg */}
          {proj.legPos && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Posisi Harga Sekarang</span>
                <span className="text-[11px] font-black" style={{ color: proj.legPos.retracePct >= 50 && proj.legPos.retracePct < 61.8 ? '#fbbf24' : projC }}>
                  koreksi {Math.round(proj.legPos.retracePct)}%
                </span>
              </div>
              {/* Rel skala: dasar leg (kiri) → puncak leg (kanan), penanda harga saat ini */}
              <div className="relative h-8">
                <div className="absolute inset-x-0 top-3 h-1.5 rounded-full bg-white/10" />
                {/* pita golden zone 50–61.8% */}
                {(() => {
                  const lo = proj.legLo, hi = proj.legHi, w = hi - lo
                  if (w <= 0) return null
                  const g1 = proj.retracements.find(r => r.label === '50%')?.price
                  const g2 = proj.retracements.find(r => r.label === '61.8%')?.price
                  if (g1 == null || g2 == null) return null
                  const a = Math.max(0, Math.min(100, ((Math.min(g1, g2) - lo) / w) * 100))
                  const b = Math.max(0, Math.min(100, ((Math.max(g1, g2) - lo) / w) * 100))
                  return <div className="absolute top-3 h-1.5 rounded-full" style={{ left: `${a}%`, width: `${Math.max(1, b - a)}%`, background: '#f59e0b55' }} />
                })()}
                <div className="absolute top-1.5 w-0.5 h-4 rounded-full" style={{ left: `${proj.legPos.posPct}%`, background: projC, boxShadow: `0 0 6px ${projC}` }} />
                <span className="absolute top-0 text-[9px] tabular-nums text-white/70 -translate-x-1/2" style={{ left: `${proj.legPos.posPct}%` }}>●</span>
                <span className="absolute bottom-0 left-0 text-[9px] text-white/30 tabular-nums">${proj.legLo.toFixed(1)}</span>
                <span className="absolute bottom-0 right-0 text-[9px] text-white/30 tabular-nums">${proj.legHi.toFixed(1)}</span>
              </div>
              <p className="text-[11px] font-semibold mt-1" style={{ color: proj.legPos.retracePct >= 50 && proj.legPos.retracePct < 61.8 ? '#fbbf24' : 'rgba(255,255,255,.75)' }}>{proj.legPos.zone}</p>
              <p className="text-[10px] text-white/45 leading-relaxed mt-0.5">{proj.legPos.note}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Target — bila lanjut</p>
            <div className="space-y-1">{proj.targets.map((l, i) => <ProjLevelRow key={i} l={l} tone={projC} />)}</div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Koreksi — sampai mana masih wajar</p>
            <div className="space-y-1">{proj.retracements.map((l, i) => <ProjLevelRow key={i} l={l} tone="#fbbf24" />)}</div>
          </div>

          {proj.invalidation && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/[0.07] border border-red-500/25 p-2.5">
              <ShieldAlert size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-200/85 leading-relaxed">{proj.invalidation.note}</p>
            </div>
          )}

          {proj.room && (() => {
            const r = proj.room
            const rc = r.level === 'ekstrem' ? '#ef4444' : r.level === 'ramai' ? '#f59e0b' : r.level === 'sepi' ? '#3b82f6' : '#10b981'
            return (
              <div className="rounded-xl border p-3" style={{ borderColor: `${rc}44`, background: `${rc}0d` }}>
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Ruang Gerak Hari Ini</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase" style={{ background: `${rc}26`, color: rc }}>{r.level}</span>
                </div>

                {/* Angka utama: berapa kali lipat dari hari normal */}
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-2xl font-black tabular-nums" style={{ color: rc }}>{(r.usedPct / 100).toFixed(2)}×</span>
                  <span className="text-[11px] text-white/45 mb-1">hari normal ({Math.round(r.usedPct)}%)</span>
                </div>

                {/* Rel range hari ini + posisi harga — menunjukkan ARAH kelelahan */}
                <div className="relative h-7 mb-1">
                  <div className="absolute inset-x-0 top-3 h-1.5 rounded-full bg-white/10" />
                  <div className="absolute top-3 h-1.5 rounded-full" style={{ left: 0, width: `${Math.min(100, r.posInDay)}%`, background: `${rc}66` }} />
                  <div className="absolute top-1.5 w-0.5 h-4 rounded-full" style={{ left: `${r.posInDay}%`, background: rc, boxShadow: `0 0 6px ${rc}` }} />
                  <span className="absolute bottom-0 left-0 text-[9px] text-white/30 tabular-nums">L ${feed.dayLow.toFixed(1)}</span>
                  <span className="absolute bottom-0 right-0 text-[9px] text-white/30 tabular-nums">H ${feed.dayHigh.toFixed(1)}</span>
                </div>
                <p className="text-[11px] font-semibold" style={{ color: rc }}>Harga {r.posLabel} ({Math.round(r.posInDay)}%)</p>

                <div className="grid grid-cols-2 gap-2 mt-2 mb-2">
                  <div className="rounded-lg bg-white/[0.03] p-2">
                    <p className="text-[9px] text-white/35 uppercase tracking-wider">Range hari ini</p>
                    <p className="text-[13px] font-black tabular-nums">${r.todayRange.toFixed(1)}</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-2">
                    <p className="text-[9px] text-white/35 uppercase tracking-wider">Median {r.sample} hari</p>
                    <p className="text-[13px] font-black tabular-nums text-white/70">${r.typical.toFixed(1)}</p>
                  </div>
                </div>

                <p className="text-[11px] text-white/60 leading-relaxed">{r.note}</p>
              </div>
            )
          })()}

          <p className="text-[10px] text-white/25 leading-relaxed">{proj.note}</p>
        </div>
      )}
    </Panel>
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
  const crossForces = [
    buildForce(CROSS_META.dollar, macro?.dollar?.value, macro?.dollar?.prior),
    buildForce(CROSS_META.uup, cross.uup?.price, null, cross.uup?.changePct),
    buildForce(CROSS_META.us10y, macro?.us10y?.value, macro?.us10y?.prior),
    buildForce(CROSS_META.vixy, cross.vixy?.price, null, cross.vixy?.changePct),
    buildForce(CROSS_META.spy, cross.spy?.price, null, cross.spy?.changePct),
    buildForce(CROSS_META.qqq, cross.qqq?.price, null, cross.qqq?.changePct),
    buildForce(CROSS_META.btc, cross.btc?.price, null, cross.btc?.changePct),
  ].filter(Boolean) as GoldForce[]
  const CrossPanel = (
    <Panel title="Lintas-Aset — Dampak ke Emas" icon={BarChart3} className="lg:col-span-12" info="Tiap aset dipisah menurut dampaknya ke emas: kolom hijau mendukung emas, kolom merah menekan. Dolar & yield naik, saham risk-on kuat → menekan; VIX naik (takut) & BTC → mendukung. Diurut dari penggerak terbesar." right={<span className="text-[9px] text-white/30">FRED + Twelve Data</span>}>
      {crossForces.length ? (
        <>
          <GoldForceSummary forces={crossForces} />
          <ForceColumns forces={crossForces} />
        </>
      ) : <div className="flex items-center justify-center py-8 text-white/30 text-[11px] gap-2"><Loader2 size={14} className="animate-spin" /> memuat data lintas-aset…</div>}
    </Panel>
  )
  const metaOf = (k: string) => MACRO_META.find(x => x.key === k)?.meta
  const infForce = (k: string) => { const m = metaOf(k); return m ? buildForce(m, macro?.[k]?.value, macro?.[k]?.prior) : null }
  const infAll = MACRO_META.map(x => infForce(x.key)).filter(Boolean) as GoldForce[]
  // ── GVZ: volatilitas emas (CBOE Gold ETF VIX) ──
  // Ini indikator VOLATILITAS, bukan arah. Naiknya GVZ tidak berarti emas naik —
  // hanya ayunannya melebar. Karena itu dipisah dari panel gaya makro (yang
  // menghitung dorongan bullish/bearish) dan diberi bahasa aksi sendiri:
  // kalibrasi jarak SL dan ekspektasi range harian.
  const gvz = macro?.gvz ?? null
  const gvzInfo = (() => {
    if (!gvz) return null
    const hist = gvz.history ?? []
    // Persentil terhadap riwayat ~180 hari — berbasis data, bukan ambang hafalan
    // yang bisa usang saat rezim volatilitas bergeser.
    const pct = hist.length >= 30
      ? Math.round((hist.filter(v => v < gvz.value).length / hist.length) * 100)
      : null
    const chg = gvz.value - gvz.prior
    const level = pct == null ? 'normal' : pct >= 80 ? 'tinggi' : pct >= 55 ? 'agak tinggi' : pct >= 25 ? 'normal' : 'rendah'
    const color = level === 'tinggi' ? '#ef4444' : level === 'agak tinggi' ? '#f59e0b' : level === 'rendah' ? '#3b82f6' : '#10b981'
    const action = level === 'tinggi'
      ? 'Ayunan lebar. Lebarkan SL (ATR sudah otomatis menyesuaikan), kecilkan lot agar risiko rupiah tetap sama. Target jauh jadi lebih realistis, tapi whipsaw juga lebih sering.'
      : level === 'agak tinggi'
        ? 'Volatilitas di atas rata-rata. Jangan pakai SL sempit gaya pasar tenang — mudah kena sapu sebelum arah benar.'
        : level === 'rendah'
          ? 'Pasar tenang. Range harian cenderung sempit — target besar sulit tercapai. Justru kondisi bagus untuk menunggu setup breakout dari kompresi.'
          : 'Volatilitas wajar. Ukuran SL & target normal sesuai ATR.'
    return { pct, chg, level, color, action }
  })()
  const GvzPanel = gvzInfo && gvz ? (
    <Panel title="Volatilitas Emas (GVZ)" icon={Waves} accent={gvzInfo.color}
      info="CBOE Gold ETF Volatility Index — 'VIX-nya emas'. Mengukur ekspektasi ayunan harga emas 30 hari ke depan. INI BUKAN INDIKATOR ARAH: GVZ naik hanya berarti gerakan melebar, tidak memberi tahu naik atau turun. Dipakai untuk mengkalibrasi jarak SL dan seberapa realistis target."
      right={<span className="text-[9px] text-white/30">FRED · harian</span>}>
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-3xl font-black tabular-nums" style={{ color: gvzInfo.color }}>{gvz.value.toFixed(1)}</p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {gvzInfo.chg >= 0 ? '▲' : '▼'} {Math.abs(gvzInfo.chg).toFixed(2)} vs sebelumnya · {gvz.date}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-black px-2.5 py-1 rounded-lg uppercase" style={{ background: `${gvzInfo.color}22`, color: gvzInfo.color }}>
              {gvzInfo.level}
            </span>
            {gvzInfo.pct != null && <p className="text-[10px] text-white/35 mt-1">persentil {gvzInfo.pct} · 180 hari</p>}
          </div>
        </div>
        {gvzInfo.pct != null && (
          <div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${gvzInfo.pct}%`, background: gvzInfo.color }} />
            </div>
            <div className="flex justify-between text-[9px] text-white/25 mt-1"><span>tenang</span><span>bergejolak</span></div>
          </div>
        )}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Artinya untuk Entry</p>
          <p className="text-[12px] text-white/70 leading-relaxed">{gvzInfo.action}</p>
        </div>
        <p className="text-[10px] text-white/25 leading-relaxed">Bukan sinyal arah — hanya lebar ayunan. Untuk arah, lihat Signal Meter &amp; struktur.</p>
      </div>
    </Panel>
  ) : null

  const InflasiPanel = (
    <Panel title="Inflasi & Kebijakan The Fed — Dampak ke Emas" icon={Landmark} className="lg:col-span-12" info="Data makro resmi FRED dipisah menurut dampaknya ke emas: inflasi & suku bunga turun → mendukung; data tenaga kerja lemah → dovish (mendukung). Kolom hijau mendukung, merah menekan." right={<span className="text-[9px] text-white/30">FRED · resmi</span>}>
      {infAll.length ? (
        <>
          <GoldForceSummary forces={infAll} />
          <ForceColumns forces={infAll} />
        </>
      ) : <div className="flex items-center justify-center py-8 text-white/30 text-[11px] gap-2"><Loader2 size={14} className="animate-spin" /> memuat data makro…</div>}
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
  const upcomingCal = calEvents.filter(e => e.time > now - 3600_000).slice(0, 12)
  const CalendarPanel = (
    <Panel title="Kalender Ekonomi AS (minggu ini)" icon={CalendarClock} info="Jadwal rilis data ekonomi USD berdampak tinggi/menengah (sumber publik, refresh 30 mnt). Merah = High impact — News Guard otomatis menahan sinyal ±30 menit di sekitarnya. Hindari entry menjelang rilis besar.">
      {upcomingCal.length ? (
        <div className="grid sm:grid-cols-2 gap-1.5">
          {upcomingCal.map((e, i) => {
            const past = e.time < now
            const soon = !past && e.time - now < 3600_000
            return (
              <div key={i} className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 ${soon && e.impact === 'High' ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/[0.06] bg-white/[0.02]'} ${past ? 'opacity-45' : ''}`}>
                <span className={`h-2 w-2 rounded-full shrink-0 ${e.impact === 'High' ? 'bg-red-400' : 'bg-amber-400'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-white/85 truncate">{e.title}</p>
                  <p className="text-[9px] text-white/40">{new Date(e.time).toLocaleString('id-ID', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} WIB{e.forecast ? ` · perkiraan ${e.forecast}` : ''}{e.previous ? ` · sebelumnya ${e.previous}` : ''}</p>
                </div>
                <span className={`text-[9px] font-bold tabular-nums shrink-0 ${soon && e.impact === 'High' ? 'text-amber-300' : 'text-white/40'}`}>{past ? 'lewat' : evCountdown(e.time)}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2.5 text-white/40 text-[11px] py-4"><Loader2 size={13} className="animate-spin text-white/25" /> Memuat kalender…</div>
      )}
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
              {accuracy.byRegime && accuracy.byRegime.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {accuracy.byRegime.map(r => (
                    <span key={r.regime} className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold ${r.pct >= 60 ? 'text-emerald-400' : r.pct >= 45 ? 'text-amber-400' : 'text-red-400'}`} title={`${r.correct}/${r.total} benar saat kondisi ${r.regime}`}>{r.regime} {r.pct}% <span className="text-white/35 font-semibold">({r.total}x)</span></span>
                  ))}
                </div>
              )}
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
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0b100e] p-4 sm:p-5"
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
            <p className="text-2xl font-black leading-none" style={{ color: heroClr }}>{dir === 'BULLISH' ? 'Bias Bullish' : dir === 'BEARISH' ? 'Bias Bearish' : 'Netral — Tunggu'}</p>
            <p className="text-[10px] text-white/45 mt-1.5 tabular-nums">Skor {sc.overall > 0 ? '+' : ''}{Math.round(sc.overall)} · {meterZone(sc.overall).name}</p>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {guardEvent ? (
            <p className="flex items-start gap-2 text-[12px] font-semibold leading-relaxed text-amber-300"><ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber-400" />NEWS GUARD — rilis <b>&ldquo;{guardEvent.title}&rdquo;</b> {evCountdown(guardEvent.time)}. Tahan entry: spike berita mengalahkan sinyal teknikal. Tunggu pasar mencerna dulu.</p>
          ) : (
            <p className="flex items-start gap-2 text-[12px] text-white/85 font-medium leading-relaxed"><Target size={14} className="mt-0.5 shrink-0" style={{ color: heroClr }} />{kAction}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <span className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold ${regime.c}`}><Signal size={9} /> {regime.label}</span>
            <span className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold ${volLabel === 'Tinggi' ? 'text-amber-400' : volLabel === 'Rendah' ? 'text-sky-400' : 'text-emerald-400'}`}><Flame size={9} /> Volatilitas {volLabel}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-white/60"><Crosshair size={9} /> {conf.bulls}B/{conf.bears}S dari 3 TF</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-white/60"><Circle size={7} className="fill-primary text-primary" /> Sesi {session}</span>
            {!guardEvent && nextEvent && nextEvent.time - now < 3 * 3600_000 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-300"><CalendarClock size={9} /> {nextEvent.title} · {evCountdown(nextEvent.time)}</span>
            )}
            {costOk != null && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${costOk ? 'border-white/10 bg-white/[0.04] text-emerald-400' : 'border-amber-500/25 bg-amber-500/10 text-amber-300'}`} title={`Target scalp tipikal (ATR M15 $${feed.tf.M15.atr.toFixed(2)}) ${costOk ? '≥' : '<'} 3× spread ($${(3 * spread).toFixed(2)})`}>
                <Scale size={9} /> Biaya {costOk ? 'layak' : 'tinggi'}
              </span>
            )}
            <label className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] text-white/45">
              Spread $
              <input type="number" step="0.05" min="0" value={spread || ''} placeholder="0.30" onChange={e => saveSpread(parseFloat(e.target.value) || 0)}
                className="w-11 bg-transparent text-[9px] font-bold text-white/80 outline-none placeholder:text-white/25" />
            </label>
          </div>
        </div>
        <p className="hidden xl:block text-[9px] text-white/30 max-w-[130px] leading-relaxed shrink-0">Ringkasan otomatis dari teknikal, makro & sentimen. Detail di panel bawah.</p>
      </div>
    </div>
  )
  const InsightStrip = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatTile icon={Signal} label="Regime Pasar" value={<span className={regime.c}>{regime.label}</span>} sub={regime.desc} tone="neutral" info="2 kondisi (Ranging · Trending) dari skor kekuatan tren M15 (Efficiency Ratio + ADX + spread DI), dengan histeresis anti-flip. Notifikasi + bunyi otomatis saat regime berubah." />
      <StatTile icon={Zap} label="Momentum" value={<span className={avgMomentum > 15 ? 'text-emerald-400' : avgMomentum < -15 ? 'text-red-400' : 'text-white/70'}>{avgMomentum > 15 ? 'Bullish' : avgMomentum < -15 ? 'Bearish' : 'Netral'}</span>} sub={`skor ${avgMomentum >= 0 ? '+' : ''}${avgMomentum.toFixed(0)} · RSI/MACD/Stoch`} tone={avgMomentum > 15 ? 'bull' : avgMomentum < -15 ? 'bear' : 'neutral'} info="Gabungan RSI, MACD, Stochastic & Bollinger %B dari 3 timeframe." />
      <StatTile icon={ArrowUpDown} label="Posisi Range Hari Ini" value={`${(dayPos * 100).toFixed(0)}%`} sub={dayPos > 0.7 ? 'dekat high' : dayPos < 0.3 ? 'dekat low' : 'tengah range'} tone={dayPos > 0.7 ? 'bull' : dayPos < 0.3 ? 'bear' : 'neutral'} info={`Posisi harga di antara Low ${f2(feed.dayLow)} dan High ${f2(feed.dayHigh)} hari ini.`} />
      <StatTile icon={Scale} label="Sentimen Risiko" value={<span className={riskOn < -0.1 ? 'text-emerald-400' : riskOn > 0.1 ? 'text-red-400' : 'text-white/70'}>{riskOn < -0.1 ? 'Risk-Off' : riskOn > 0.1 ? 'Risk-On' : 'Netral'}</span>} sub={riskOn < -0.1 ? 'pasar takut → bullish emas' : riskOn > 0.1 ? 'pasar berani → tekan emas' : 'seimbang'} tone={riskOn < -0.1 ? 'bull' : riskOn > 0.1 ? 'bear' : 'neutral'} info="Dari VIX, S&P500, Nasdaq, BTC. Risk-off (takut) biasanya mengangkat emas." />
    </div>
  )
  // Arah & ringkasan per sesi (Asia/London/NY) — reset otomatis tiap hari
  const SesiPanel = (
    <Panel title="Arah & Ringkasan per Sesi" icon={Clock} info="Ringkasan pergerakan XAU/USD per sesi HARI INI (jam WIB: Asia 06-14, London 14-19, New York 19-23). Arah (bullish/bearish) hanya muncul setelah sesi SELESAI — sesi yang masih berjalan ditandai 'masih berjalan' agar tidak menyesatkan. Reset otomatis setiap pergantian hari." right={<span className="text-[10px] text-white/35">reset harian · WIB</span>}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {sesi.map(s => {
          const live = s.status === 'berlangsung'
          // Verdict arah HANYA untuk sesi yang sudah selesai — sesi berjalan dibiarkan netral
          // supaya pembacaan tidak bingung (arah belum final).
          const verdict = live ? null : s.arah
          const clr = verdict === 'Bullish' ? 'text-emerald-400' : verdict === 'Bearish' ? 'text-red-400' : 'text-white/60'
          const dot = verdict === 'Bullish' ? 'bg-emerald-400' : verdict === 'Bearish' ? 'bg-red-400' : 'bg-white/40'
          const box = verdict === 'Bullish' ? 'border-emerald-500/25 bg-emerald-500/[0.06]' : verdict === 'Bearish' ? 'border-red-500/25 bg-red-500/[0.06]' : live ? 'border-primary/20 bg-primary/[0.04]' : 'border-white/10 bg-white/[0.02]'
          const span = s.high - s.low
          const openPct = span > 0 ? ((s.open - s.low) / span) * 100 : 50
          const closePct = span > 0 ? ((s.close - s.low) / span) * 100 : 50
          return (
            <div key={s.name} className={`rounded-xl border p-3.5 ${s.status === 'belum' ? 'border-white/[0.07] bg-white/[0.015] opacity-60' : box}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-white/85">{s.name}</p>
                <span className={`text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${live ? 'bg-primary/15 text-primary' : s.status === 'selesai' ? 'bg-white/10 text-white/50' : 'bg-white/5 text-white/35'}`}>{live ? '● Berlangsung' : s.status === 'selesai' ? 'Selesai' : 'Belum mulai'}</span>
              </div>
              {s.arah ? (
                <>
                  {verdict ? (
                    <p className={`text-lg font-black leading-none ${clr}`}>{verdict === 'Bullish' ? '↗ Bullish' : verdict === 'Bearish' ? '↘ Bearish' : '→ Flat'}</p>
                  ) : (
                    <p className="text-sm font-bold text-primary flex items-center gap-1.5 leading-none py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" /> Sesi masih berjalan</p>
                  )}

                  {/* Open vs Sekarang — kartu berdampingan */}
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <div className="flex-1 rounded-lg bg-white/[0.03] border border-white/[0.06] px-2 py-1.5 min-w-0">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-white/35">Open</p>
                      <p className="text-[11px] font-bold text-white/70 tabular-nums truncate">{f2(s.open)}</p>
                    </div>
                    <span className="text-white/25 text-xs shrink-0">→</span>
                    <div className={`flex-1 rounded-lg border px-2 py-1.5 min-w-0 ${live ? 'bg-primary/10 border-primary/25' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                      <p className={`text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 ${live ? 'text-primary' : 'text-white/35'}`}>
                        {live && <span className="w-1 h-1 rounded-full bg-primary animate-pulse shrink-0" />}{live ? 'Sekarang' : 'Close'}
                      </p>
                      <p className={`text-[11px] font-bold tabular-nums truncate ${clr}`}>{f2(s.close)}</p>
                    </div>
                  </div>

                  {/* Range visual (low → high) dengan penanda posisi Open & Sekarang, dalam pips */}
                  <div className="mt-2.5">
                    <div className="relative h-1.5 rounded-full bg-white/[0.06]">
                      <div className={`absolute inset-y-0 rounded-full opacity-60 ${dot}`} style={{ left: `${Math.min(openPct, closePct)}%`, width: `${Math.max(2, Math.abs(closePct - openPct))}%` }} />
                      <span className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/60 ring-2 ring-[#0b0f0e]" style={{ left: `calc(${openPct}% - 3px)` }} title={`Open ${f2(s.open)}`} />
                      <span className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ring-2 ring-[#0b0f0e] ${dot} ${live ? 'animate-pulse' : ''}`} style={{ left: `calc(${closePct}% - 3px)` }} title={`${live ? 'Sekarang' : 'Close'} ${f2(s.close)}`} />
                    </div>
                    <p className="text-[10px] text-white/35 mt-1.5 tabular-nums">Range {s.rangePips} pips</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-white/30 py-2">{s.status === 'belum' ? 'Menunggu sesi dimulai…' : 'Data belum tersedia'}</p>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )

  // Kondisi teknikal multi-timeframe (heatmap)
  const cols = ['Tren', 'RSI', 'MACD', 'Stoch', 'Struktur']
  const IndicatorMatrix = (
    <Panel title="Teknikal per Timeframe" icon={LayoutDashboard} info="Sekilas kondisi teknikal di M5/M15/H1. Hijau=bullish, merah=bearish, abu=netral. Makin banyak hijau/merah sejajar = sinyal makin searah.">
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
  // ── Kesimpulan MAKRO → XAU/USD: verdict + pendorong utama, dihitung dari data FRED + dolar live ──
  const makroDrivers = (() => {
    const out: { l: string; arah: 'bullish' | 'bearish' | 'netral'; d: string }[] = []
    // Per-candle (M15, proxy UUP/IEF) — sebanding horizon waktunya dengan pilar Teknikal.
    if (macroM15) {
      // Sumber dolar disebut apa adanya: forex 24 jam vs ETF. Yield diberi
      // penanda umur bila datanya beku (bursa AS tutup) — menampilkan dampak
      // -100 dari data 6 jam lalu tanpa keterangan itu menyesatkan.
      out.push({ l: `Dolar (M15, ${macroTech.dollarLive ? 'forex 24 jam' : 'proxy UUP'})`, arah: macroM15.dollarImpact > 20 ? 'bullish' : macroM15.dollarImpact < -20 ? 'bearish' : 'netral', d: `dampak ${macroM15.dollarImpact >= 0 ? '+' : ''}${Math.round(macroM15.dollarImpact)}` })
      out.push({ l: `Yield (M15, proxy IEF)${yieldStale ? ' — belum buka' : ''}`, arah: yieldStale ? 'netral' : macroM15.yieldImpact > 20 ? 'bullish' : macroM15.yieldImpact < -20 ? 'bearish' : 'netral', d: yieldStale ? `pasar yield belum buka · data ${Math.round(macroTech.yieldStaleMin!)} mnt lalu` : `dampak ${macroM15.yieldImpact >= 0 ? '+' : ''}${Math.round(macroM15.yieldImpact)}` })
    }
    const dLive = cross.uup?.changePct
    if (dLive != null) out.push({ l: 'Dolar (live, harian)', arah: dLive > 0.05 ? 'bearish' : dLive < -0.05 ? 'bullish' : 'netral', d: `UUP ${dLive >= 0 ? '+' : ''}${dLive.toFixed(2)}% hari ini` })
    const dirOf = (k: string, invert = true) => { const p = macro?.[k]; if (!p) return null; const up = p.value > p.prior; return { up, arah: (invert ? (up ? 'bearish' : 'bullish') : (up ? 'bullish' : 'bearish')) as 'bullish' | 'bearish' } }
    const y = dirOf('us10y'); if (y && macro?.us10y) out.push({ l: 'Yield 10Y (FRED, harian)', arah: y.arah, d: `${macro.us10y.value}% (${y.up ? 'naik' : 'turun'})` })
    const r = dirOf('realyield'); if (r && macro?.realyield) out.push({ l: 'Real Yield', arah: r.arah, d: `${macro.realyield.value}% (${r.up ? 'naik' : 'turun'})` })
    const c = dirOf('cpi', false); if (c && macro?.cpi) out.push({ l: 'Inflasi CPI', arah: c.up ? 'bullish' : 'bearish', d: `${macro.cpi.value}% YoY (${c.up ? 'naik' : 'mereda'})` })
    if (macro?.fedfunds) out.push({ l: 'Fed Funds', arah: 'netral', d: `${macro.fedfunds.value}% — arah kebijakan jadi kunci` })
    return out
  })()
  const makroVerdict = sc.macro > 15 ? { t: 'Bullish untuk Emas', c: '#34d399' } : sc.macro < -15 ? { t: 'Bearish untuk Emas', c: '#f87171' } : { t: 'Netral untuk Emas', c: '#9ca3af' }
  const MakroKesimpulanPanel = (
    <Panel title="Kesimpulan Makro → XAU/USD" icon={Lightbulb} accent={makroVerdict.c} info="Sintesis otomatis seluruh data makro (dolar & yield per-candle M5/M15/H1, inflasi, Fed) menjadi satu kesimpulan dampak ke emas. Skor dari pilar Makro di Signal Meter.">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" /><circle cx="18" cy="18" r="15" fill="none" stroke={makroVerdict.c} strokeWidth="3.5" strokeDasharray={`${Math.abs(sc.macro) / 100 * 94} 94`} strokeLinecap="round" /></svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-black tabular-nums" style={{ color: makroVerdict.c }}>{Math.round(Math.abs(sc.macro))}</span>
        </div>
        <div>
          <p className="text-xl font-black leading-none" style={{ color: makroVerdict.c }}>{makroVerdict.t}</p>
          <p className="text-[11px] text-white/45 mt-1.5">Skor pilar makro {sc.macro >= 0 ? '+' : ''}{Math.round(sc.macro)} dari −100…+100</p>
        </div>
      </div>
      {/* Transparansi kesegaran data — user berhak tahu skor ini dihitung dari
          data hidup atau pasarnya belum buka, terutama saat trading di sesi Asia. */}
      {yieldStale && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/[0.09] border border-amber-500/30 p-3 mb-3">
          <Clock size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-100/85 leading-relaxed">
            <b>Pasar yield belum buka.</b> Data yield (ETF IEF) terakhir {Math.round(macroTech.yieldStaleMin!)} menit lalu, jadi kontribusinya belum dihitung agar tidak memberi sinyal palsu.
            {macroTech.dollarLive
              ? ' Dolar tetap live dari forex 24 jam.'
              : ' Dolar juga memakai proxy ETF — kehati-hatian ekstra.'}
            {' '}Untuk sesi Asia, andalkan Teknikal &amp; struktur harga.
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        {makroDrivers.map(d => (
          <div key={d.l} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
            <span className="text-[11px] text-white/70">{d.l}</span>
            <span className="flex items-center gap-2"><span className="text-[10px] text-white/40 tabular-nums">{d.d}</span><span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${d.arah === 'bullish' ? 'bg-emerald-500/15 text-emerald-400' : d.arah === 'bearish' ? 'bg-red-500/15 text-red-400' : 'bg-white/10 text-white/50'}`}>{d.arah}</span></span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-white/40 leading-snug mt-3 pt-3 border-t border-white/5">{sc.macro > 15 ? 'Kondisi makro condong menopang emas — dolar/yield melunak. Sinyal beli teknikal dapat angin dari makro.' : sc.macro < -15 ? 'Kondisi makro menekan emas — dolar/yield menguat. Hati-hati sinyal beli yang melawan arus makro.' : 'Makro belum memihak — biarkan teknikal & sesi yang menentukan, ukuran posisi konservatif.'}</p>
    </Panel>
  )
  // ── Kesimpulan SENTIMEN → XAU/USD: risk-on/off + posisi COT ──
  const sentiVerdict = sc.senti > 15 ? { t: 'Bullish untuk Emas', c: '#34d399' } : sc.senti < -15 ? { t: 'Bearish untuk Emas', c: '#f87171' } : { t: 'Netral untuk Emas', c: '#9ca3af' }
  const SentimenKesimpulanPanel = (
    <Panel title="Kesimpulan Sentimen → XAU/USD" icon={Lightbulb} accent={sentiVerdict.c} info="Sintesis otomatis sentimen pasar (risk-on/off dari VIX/saham/BTC + posisi institusi COT) menjadi satu kesimpulan dampak ke emas.">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" /><circle cx="18" cy="18" r="15" fill="none" stroke={sentiVerdict.c} strokeWidth="3.5" strokeDasharray={`${Math.abs(sc.senti) / 100 * 94} 94`} strokeLinecap="round" /></svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-black tabular-nums" style={{ color: sentiVerdict.c }}>{Math.round(Math.abs(sc.senti))}</span>
        </div>
        <div>
          <p className="text-xl font-black leading-none" style={{ color: sentiVerdict.c }}>{sentiVerdict.t}</p>
          <p className="text-[11px] text-white/45 mt-1.5">Skor pilar sentimen {sc.senti >= 0 ? '+' : ''}{Math.round(sc.senti)} dari −100…+100</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"><span className="text-[11px] text-white/70">Mood pasar</span><span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${riskOn < -0.1 ? 'bg-emerald-500/15 text-emerald-400' : riskOn > 0.1 ? 'bg-red-500/15 text-red-400' : 'bg-white/10 text-white/50'}`}>{riskOn < -0.1 ? 'Risk-Off → dukung emas' : riskOn > 0.1 ? 'Risk-On → tekan emas' : 'Seimbang'}</span></div>
        {cot && <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"><span className="text-[11px] text-white/70">Institusi (COT)</span><span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${cot.funds.net >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>net {cot.funds.net >= 0 ? 'LONG' : 'SHORT'} {kfmt(cot.funds.net)} ({cot.funds.deltaNet >= 0 ? '+' : ''}{kfmt(cot.funds.deltaNet)} minggu ini)</span></div>}
        {cot && <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"><span className="text-[11px] text-white/70">Retail (kontrarian)</span><span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-white/10 text-white/50">net {cot.retail.net >= 0 ? 'long' : 'short'} {kfmt(cot.retail.net)}</span></div>}
        {cross.vixy && <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"><span className="text-[11px] text-white/70">VIX (rasa takut)</span><span className={`text-[10px] font-bold tabular-nums ${cross.vixy.changePct > 0 ? 'text-emerald-400' : 'text-white/50'}`}>{cross.vixy.changePct >= 0 ? '+' : ''}{cross.vixy.changePct.toFixed(2)}% {cross.vixy.changePct > 2 ? '— ketakutan naik, dukung emas' : ''}</span></div>}
      </div>
      <p className="text-[10px] text-white/40 leading-snug mt-3 pt-3 border-t border-white/5">{sc.senti > 15 ? 'Sentimen mendukung emas — pasar defensif / institusi menambah long. Searah dengan sinyal beli.' : sc.senti < -15 ? 'Sentimen menekan emas — selera risiko tinggi. Sinyal beli butuh konfirmasi ekstra.' : 'Sentimen netral — bukan pendorong utama hari ini.'}</p>
    </Panel>
  )
  // ── Chart Sentimen (baru): diverging bar — tiap faktor mendorong emas ke bullish/bearish ──
  const sentiFactors: { l: string; push: number; note: string }[] = (() => {
    const cl = (n: number) => Math.max(-100, Math.min(100, n))
    const out: { l: string; push: number; note: string }[] = []
    out.push({ l: 'Mood Pasar', push: cl(-riskOn * 55), note: riskOn < -0.1 ? 'risk-off' : riskOn > 0.1 ? 'risk-on' : 'seimbang' })
    if (cross.vixy) out.push({ l: 'VIX (takut)', push: cl(cross.vixy.changePct * 14), note: `${cross.vixy.changePct >= 0 ? '+' : ''}${cross.vixy.changePct.toFixed(1)}%` })
    if (cot) out.push({ l: 'Institusi (COT)', push: cl(cot.funds.net >= 0 ? 45 + Math.sign(cot.funds.deltaNet) * 15 : -45 + Math.sign(cot.funds.deltaNet) * 15), note: `net ${cot.funds.net >= 0 ? 'long' : 'short'}` })
    if (cross.spy) out.push({ l: 'Saham (S&P)', push: cl(-cross.spy.changePct * 18), note: `${cross.spy.changePct >= 0 ? '+' : ''}${cross.spy.changePct.toFixed(1)}%` })
    if (goldSilver != null) out.push({ l: 'Emas/Perak', push: cl((goldSilver - 80) * 3), note: goldSilver.toFixed(1) })
    return out
  })()
  const SentimenChartPanel = (
    <Panel title="Peta Sentimen → Emas" icon={BarChart3} info="Tiap faktor sentimen didorong ke kanan (mendukung emas / bullish) atau ke kiri (menekan emas / bearish). Panjang bar = kekuatan dorongan. Garis tengah = netral.">
      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider mb-2"><span className="text-red-400/70">← Tekan emas</span><span className="text-white/30">netral</span><span className="text-emerald-400/70">Dukung emas →</span></div>
      <div className="space-y-2">
        {sentiFactors.map(f => {
          const bull = f.push >= 0, w = Math.min(50, Math.abs(f.push) / 2)
          return (
            <div key={f.l} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[10px] text-white/60 truncate">{f.l}</span>
              <div className="relative flex-1 h-4 rounded bg-white/[0.03]">
                <span className="absolute top-0 bottom-0 left-1/2 w-px bg-white/15" />
                <span className={`absolute top-0.5 bottom-0.5 rounded ${bull ? 'bg-emerald-400/70' : 'bg-red-400/70'}`} style={{ left: bull ? '50%' : `${50 - w}%`, width: `${w}%` }} />
              </div>
              <span className="w-14 shrink-0 text-right text-[9px] text-white/40 tabular-nums">{f.note}</span>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-white/40 leading-snug mt-3 pt-3 border-t border-white/5">Skor sentimen komposit <span className="font-bold" style={{ color: sentiVerdict.c }}>{sc.senti >= 0 ? '+' : ''}{Math.round(sc.senti)}</span> → {sentiVerdict.t.toLowerCase()}.</p>
    </Panel>
  )
  const AiPanel = (
    <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-[#0b100e] to-[#0b100e] p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/15 ring-1 ring-primary/30"><Brain size={17} className="text-primary" /></span>
        <div className="flex-1 min-w-[220px]"><h2 className="text-sm font-black flex items-center gap-1.5">Analisa AI — Ambil Keputusan <span className="text-[8px] font-bold uppercase bg-primary/15 text-primary rounded px-1.5 py-0.5">Datalitiq AI</span></h2><p className="text-[10px] text-white/40">Gabungkan SEMUA data terminal + berita terkini → keputusan Beli/Jual/Tunggu.</p></div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowPrompt(v => !v)} disabled={ai.loading} className={`flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-3 py-2 border transition-colors disabled:opacity-50 ${showPrompt ? 'border-primary/40 text-primary bg-primary/10' : 'border-white/15 text-white/55 hover:text-white hover:border-white/30'}`}>
            <MessageSquarePlus size={13} /> {showPrompt ? 'Tutup konteks' : 'Tambah konteks'}{aiPrompt.trim() && !showPrompt ? ' •' : ''}
          </button>
          <button onClick={async () => { await ai.run(snapshot, aiPrompt); credits.refresh() }} disabled={ai.loading} className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity">{ai.loading ? <><Loader2 size={14} className="animate-spin" /> Menganalisa…</> : ai.data ? <><RefreshCw size={13} /> Analisa Ulang</> : <><Sparkles size={14} /> Jalankan Analisa AI</>}</button>
        </div>
      </div>
      {/* Saldo kredit AI — sembunyikan untuk admin/unlimited */}
      {credits.configured && !credits.unlimited && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-black/20 border border-white/[0.06] px-3 py-2 mb-3 text-[10px]">
          <span className="flex items-center gap-1.5 text-white/55"><Coins size={12} className="text-primary" /> Biaya analisa ini: <b className="text-white/80">{credits.cost.analysis} kredit</b></span>
          <span className="flex items-center gap-2">
            <span className="text-white/45">Saldo: <b className={`tabular-nums ${credits.total < credits.cost.analysis ? 'text-amber-400' : 'text-white/80'}`}>{credits.loading ? '…' : credits.total}</b> kredit</span>
            <Link href="/account#token" className="font-semibold text-primary hover:underline">Top Up</Link>
          </span>
        </div>
      )}
      {/* Form konteks — tersembunyi secara default */}
      {showPrompt && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 mb-3">
          <label className="text-[10px] uppercase tracking-widest font-semibold text-white/40">Tambahkan konteks / pertanyaan (opsional)</label>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={2} autoFocus
            placeholder="mis. saya mau scalping sesi Asia, fokus level entry. Atau: pertimbangkan CPI malam ini yang diperkirakan turun."
            className="w-full mt-1.5 bg-transparent text-sm text-white resize-none outline-none placeholder:text-white/30" />
          <div className="flex flex-wrap gap-1 mt-1.5 pt-2 border-t border-white/10">
            {['Fokus scalping sesi Asia', 'Layak entry sekarang?', 'Pertimbangkan rilis berita hari ini', 'Cari level entry/stop/target'].map(s => (
              <button key={s} onClick={() => setAiPrompt(s)} disabled={ai.loading} className="text-[10px] rounded-full border border-white/15 px-2 py-1 text-white/50 hover:border-primary/40 hover:text-white transition-colors disabled:opacity-50">{s}</button>
            ))}
          </div>
        </div>
      )}
      {!ai.data && !ai.loading && !ai.error && <div className="py-4 text-center"><p className="text-[11px] text-white/45">Klik <b className="text-primary">Jalankan Analisa AI</b> — Datalitiq AI membaca seluruh data terminal + berita terkini {aiPrompt.trim() ? '+ konteks darimu ' : ''}lalu memberi <b>keputusan (Beli/Jual/Tunggu)</b> beserta alasan, confluence, rencana, & risiko.</p></div>}
      {ai.loading && <AiLoading steps={['Membaca harga, candle & teknikal…', 'Menimbang makro, COT & berita…', 'Mengecek konfluensi timeframe…', 'Menyusun keputusan & level…']} />}
      {ai.error && !ai.loading && ai.insufficient && (
        <div className="py-6 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-amber-400 mb-2"><Coins size={13} /> Kredit AI tidak cukup untuk analisa ini ({credits.cost.analysis} kredit). Saldo: {credits.total}.</p>
          <Link href="/account#token" className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"><Sparkles size={12} /> Top Up Kredit</Link>
        </div>
      )}
      {ai.error && !ai.loading && !ai.insufficient && <div className="py-6 text-center"><p className="text-[11px] text-red-400 mb-1">Gagal: {ai.error}</p><button onClick={() => ai.run(snapshot, aiPrompt)} className="text-[11px] font-semibold text-primary hover:underline">Coba lagi</button></div>}
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
            {/* Fokus scalping: alignment M5 · M15 · H1 (dari data live terminal) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Timeframe Scalping</p>
                <button onClick={() => setAiFull(v => !v)} className="flex items-center gap-1 text-[10px] font-semibold text-white/45 hover:text-white transition-colors">{aiFull ? <>Ringkas <ChevronUp size={12} /></> : <>Lengkap <ChevronDown size={12} /></>}</button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['M5', 'M15', 'H1'] as const).map(tfk => {
                  const b = feed.tf[tfk].bias.label
                  const tone = /bull/i.test(b) ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/[0.07]' : /bear/i.test(b) ? 'text-red-400 border-red-500/25 bg-red-500/[0.07]' : 'text-white/55 border-white/10 bg-white/[0.03]'
                  return (
                    <div key={tfk} className={`rounded-lg border px-2.5 py-2 ${tone}`}>
                      <p className="text-[9px] uppercase tracking-wider text-white/40 leading-none">{tfk}</p>
                      <p className="text-[12px] font-black mt-1 leading-none">{b}</p>
                      <p className="text-[8px] text-white/35 mt-1 tabular-nums">RSI {Math.round(feed.tf[tfk].rsi)} · {feed.tf[tfk].macd.state}</p>
                    </div>
                  )
                })}
              </div>
            </div>
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
            {aiFull && <>
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
            </>}
            <p className="text-[8px] text-white/25 text-right">Diolah Datalitiq AI dari data terminal real · {new Date(a.fetchedAt).toLocaleTimeString('id-ID')}. Bukan nasihat keuangan.</p>
          </div>
        )
      })()}
    </div>
  )

  // Status Server hanya untuk admin — sembunyikan tab-nya dari user biasa.
  const visibleTabs = isAdmin ? TABS : TABS.filter(t => t.id !== 'status' && t.id !== 'rnd')
  const navGroups = Array.from(new Set(visibleTabs.map(t => t.group ?? 'Menu')))
  const activeTab = TABS.find(t => t.id === tab)

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
            <Link href="/hub" className="text-white/50 hover:text-white shrink-0" title="Ganti tools"><ArrowLeft size={17} /></Link>
            <BrandLogo url={logoUrl} />
            <span className="ml-auto text-[8px] font-bold uppercase tracking-wider text-primary/70">XAU</span>
          </div>
          <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
            {navGroups.map(g => (
              <div key={g}>
                <p className="px-2 mb-1.5 text-[9px] font-bold uppercase tracking-widest text-white/25">{g}</p>
                <div className="space-y-0.5">
                  {visibleTabs.filter(t => (t.group ?? 'Menu') === g).map(t => {
                    // Item "Makro" = dropdown dengan sub-menu (makro mendalam)
                    if (t.id === 'makro') {
                      const activeInMacro = (MACRO_TAB_IDS as Tab[]).includes(tab)
                      const expanded = macroOpen || activeInMacro
                      return (
                        <div key="makro-group">
                          <button onClick={() => { setMacroOpen(o => !o); if (!activeInMacro) setTab('makro') }}
                            className={`relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold transition-colors ${activeInMacro ? 'text-white bg-gradient-to-r from-primary/20 to-primary/5' : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'}`}>
                            {activeInMacro && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary shadow-[0_0_8px_rgba(52,211,153,0.6)]" />}
                            <t.icon size={15} className={activeInMacro ? 'text-primary' : ''} /> {t.label}
                            {!isPro ? <Lock size={11} className="ml-auto text-primary/60" /> : <ChevronDown size={13} className={`ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />}
                          </button>
                          {expanded && isPro && (
                            <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-white/[0.08] pl-2">
                              {MACRO_SUBTABS.map(s => {
                                const son = tab === s.id
                                return (
                                  <button key={s.id} onClick={() => setTab(s.id)} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${son ? 'bg-primary/10 text-primary' : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'}`}>
                                    <s.icon size={13} /> {s.label}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    }
                    const on = tab === t.id
                    return (
                      <button key={t.id} onClick={() => setTab(t.id)} className={`relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold transition-colors ${on ? 'text-white bg-gradient-to-r from-primary/20 to-primary/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'}`}>
                        {on && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary shadow-[0_0_8px_rgba(52,211,153,0.6)]" />}
                        <t.icon size={15} className={on ? 'text-primary' : ''} /> {t.label}
                        {!isPro && t.pro && <Lock size={11} className="ml-auto text-primary/60" />}
                        {t.id === 'status' && <span className={`ml-auto h-1.5 w-1.5 rounded-full ${STAT_META[overall].dot}`} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
          {isAdmin && (
            <button onClick={() => setTab('status')} className="m-2.5 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors shrink-0">
              <span className={`h-2 w-2 rounded-full ${STAT_META[overall].dot} ${overall === 'online' ? 'shadow-[0_0_0_3px_rgba(52,211,153,0.15)]' : ''}`} />
              <div className="min-w-0 flex-1"><p className={`text-[11px] font-bold ${STAT_META[overall].text}`}>{overall === 'online' ? 'Server Online' : overall === 'offline' ? 'Ada Gangguan' : overall === 'stale' ? 'Sebagian Lambat' : 'Menghubungkan'}</p><p className="text-[9px] text-white/35 tabular-nums">{onlineCount}/{apiSources.length} API aktif</p></div>
            </button>
          )}
        </aside>

        {/* Main column */}
        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-30 bg-[#060a09]/95 backdrop-blur border-b border-white/[0.06]">
            <div className="px-4 h-14 flex items-center gap-3 sm:gap-4">
              <Link href="/hub" className="md:hidden text-white/50 hover:text-white shrink-0"><ArrowLeft size={18} /></Link>
              <div className="flex items-center gap-2 shrink-0"><span className="font-black tracking-tight">XAU/USD</span><span className={`hidden sm:inline text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 ${live.status === 'live' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{live.status === 'live' ? 'Data Real' : 'Menyegarkan…'}</span></div>
              <div className="flex items-baseline gap-2"><span className={`text-2xl font-black tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>{f2(feed.price)}</span><span className={`text-xs font-bold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>{up ? '+' : ''}{feed.changePct.toFixed(2)}%</span></div>
              <div className="hidden md:flex items-center gap-4 text-[11px] text-white/50 tabular-nums"><span>H <b className="text-emerald-400/80">{f2(feed.dayHigh)}</b></span><span>L <b className="text-red-400/80">{f2(feed.dayLow)}</b></span></div>
              <div className="ml-auto flex items-center gap-3 shrink-0">
                <span className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold text-white/70">{activeTab && <activeTab.icon size={13} className="text-primary" />}{activeTab?.label}</span>
                <span className="hidden lg:flex items-center gap-1.5 text-[11px] text-white/50"><Circle size={7} className="fill-primary text-primary" /> {session}</span>
                <span className="hidden sm:flex items-center gap-1 text-[11px] text-white/40"><Clock size={11} /> {clock}</span>
                <span className={`flex items-center gap-1 text-[10px] ${live.status === 'live' ? 'text-emerald-400' : 'text-amber-400'}`}>{live.status === 'live' ? <Wifi size={12} /> : <RefreshCw size={11} className="animate-spin" />} live</span>
                <button onClick={toggleSound} title={soundOn ? 'Bunyi notifikasi (regime · momentum · signal meter): AKTIF' : 'Bunyi notifikasi (regime · momentum · signal meter): MATI'} className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${soundOn ? 'text-primary hover:bg-primary/10' : 'text-white/35 hover:bg-white/5'}`}>{soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
              </div>
            </div>
          </header>

          <main className="p-4 md:p-6 pb-20 md:pb-8">
            {marketStale && (
              <div className="max-w-6xl mx-auto mb-4 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5">
                <WifiOff size={16} className="text-amber-400 shrink-0" />
                <p className="text-[11px] text-amber-200/90 leading-snug"><b>Pasar kemungkinan tutup.</b> Candle terakhir {staleAgeMin >= 60 ? `${Math.floor(staleAgeMin / 60)} jam` : `${staleAgeMin} menit`} lalu — analisa di bawah dihitung dari data terakhir (biasanya penutupan Jumat), belum tentu mencerminkan kondisi saat pasar buka lagi.</p>
              </div>
            )}
            {/* Layout gaya jurnal: kolom terbatas, irama vertikal seragam, baris = 1 pertanyaan */}
            {tab === 'ringkasan' && (isPro ? <div className="max-w-6xl mx-auto space-y-4 lg:space-y-5">
              {AiPanel}
              {DecisionHero}
              {InsightStrip}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{SignalMeterPanel}{PilarPanel}</div>
              <ChartPanel onExpand={() => setChartFull(true)} hasAiLevels={!!ai.data?.chartLevels} />
              {SesiPanel}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{MtfPanel}{HtfBiasPanel}</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{ZonaPanel}{ReversalPanel}</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{MomentumPanel}{IndicatorMatrix}</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{RiwayatPanel}{RiskSentimentPanel}</div>
            </div> : <div className="max-w-6xl mx-auto space-y-4 lg:space-y-5">
              {/* FREE: harga live + info sesi tampil penuh; keputusan/sinyal di-blur */}
              <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] to-transparent px-4 py-3">
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/15 ring-1 ring-primary/30 text-primary shrink-0"><Crown size={17} /></span>
                <div className="flex-1 min-w-0"><p className="text-[13px] font-bold">Kamu di mode Gratis</p><p className="text-[11px] text-white/50 leading-snug">Harga & sesi live terbuka. Keputusan AI, Signal Meter & analisa lengkap khusus Pro.</p></div>
                <Link href="/upgrade" className="shrink-0 inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3.5 py-2 text-[11px] font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"><Crown size={12} /> Upgrade</Link>
              </div>
              <ChartPanel onExpand={() => setChartFull(true)} hasAiLevels={false} />
              {SesiPanel}
              <LockedWrap title="Analisa AI — Keputusan Beli/Jual/Tunggu" blur={6}>{AiPanel}</LockedWrap>
              <LockedWrap title="Keputusan Akhir & Tingkat Keyakinan">{DecisionHero}</LockedWrap>
              <LockedWrap title="Ringkasan Sinyal Pasar">{InsightStrip}</LockedWrap>
              <LockedWrap title="Signal Meter & Detail 3 Pilar"><div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{SignalMeterPanel}{PilarPanel}</div></LockedWrap>
              <LockedWrap title="Konfluensi Timeframe & Bias Besar"><div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{MtfPanel}{HtfBiasPanel}</div></LockedWrap>
              <LockedWrap title="Zona Kunci & Sinyal Reversal"><div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{ZonaPanel}{ReversalPanel}</div></LockedWrap>
              <LockedWrap title="Momentum & Teknikal per Timeframe"><div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{MomentumPanel}{IndicatorMatrix}</div></LockedWrap>
              <LockedWrap title="Riwayat Sinyal & Sentimen Risiko"><div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{RiwayatPanel}{RiskSentimentPanel}</div></LockedWrap>
            </div>)}

            {tab === 'teknikal' && (!isPro ? <LockedTab icon={Activity} {...LOCKED_TAB_META.teknikal} /> : <div className="max-w-6xl mx-auto space-y-4 lg:space-y-5">
              <TerminalAiPanel scope="teknikal" title="Analisa Teknikal AI" subtitle="Datalitiq AI baca chart & struktur multi-timeframe → arah + level entry/stop/target." snapshot={snapshot}
                suggestions={['Layak entry sekarang atau tunggu pullback?', 'Level stop & target yang logis di mana?', 'Tren M15/H1 searah tidak?']} />
              <ChartPanel onExpand={() => setChartFull(true)} hasAiLevels={!!ai.data?.chartLevels} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{MtfPanel}{SignalMeterPanel}</div>
              {MacroMtfPanel && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{MacroMtfPanel}</div>}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{HtfBiasPanel}{ReversalPanel}</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{OscillatorPanel}{MomentumPanel}</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{ProjeksiPanel}{ZonaPanel}</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{IndicatorMatrix}</div>
            </div>)}

            {tab === 'makro' && (!isPro ? <LockedTab icon={Landmark} {...LOCKED_TAB_META.makro} /> : <div className="max-w-6xl mx-auto space-y-4 lg:space-y-5">
              <MacroSubNav tab={tab} setTab={setTab} />
              {/* Chart komparasi: XAU/USD vs makro utama (ternormalisasi, fokus XAU) */}
              <MacroComparisonChart title="Perbandingan Makro vs Emas" note="Semua data disamakan ke % perubahan agar bisa dibandingkan. Klik chip untuk tampil/sembunyikan."
                defs={[
                  { name: 'XAU/USD', color: '#fbbf24', main: true, type: 'mkt', id: 'XAU/USD' },
                  { name: 'DXY', color: '#60a5fa', default: true, type: 'fred', id: 'dollar' },
                  { name: 'Yield 10Y', color: '#f472b6', default: true, type: 'fred', id: 'us10y' },
                  { name: 'Real Yield', color: '#34d399', type: 'fred', id: 'realyield' },
                  { name: 'CPI', color: '#f87171', type: 'fred', id: 'cpi' },
                ]} />
              <TerminalScopeAnalysis scope="makro" hidePrompt title="Analisa Makro AI" subtitle="Dampak dolar, yield, inflasi & Fed ke XAU/USD — bias % + tiap faktor." snapshot={snapshot}
                suggestions={[]} />
              {/* Statistik makro kunci (termasuk COT — posisi institusi/retail juga bagian makro) */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatTile icon={Landmark} label="Dolar (Live)" value={cross.uup ? <span className={cross.uup.changePct > 0.05 ? 'text-red-400' : cross.uup.changePct < -0.05 ? 'text-emerald-400' : 'text-white/70'}>{cross.uup.changePct >= 0 ? '+' : ''}{cross.uup.changePct.toFixed(2)}%</span> : '—'} sub={cross.uup ? (cross.uup.changePct > 0.05 ? 'menguat → tekan emas' : cross.uup.changePct < -0.05 ? 'melemah → dukung emas' : 'datar') : 'memuat'} tone={cross.uup ? (cross.uup.changePct > 0.05 ? 'bear' : cross.uup.changePct < -0.05 ? 'bull' : 'neutral') : 'neutral'} info="Proxy UUP real-time. Dolar & emas biasanya berlawanan arah."
                  spark={macro?.dollar?.history} sparkColor="#60a5fa"
                  moreHref="/terminal/data/macro/dollar" moreLabel="Lihat chart & detail DXY"
                  detail={<>
                    <DetailRow l="UUP (proxy live)" v={cross.uup ? `${cross.uup.changePct >= 0 ? '+' : ''}${cross.uup.changePct.toFixed(2)}%` : '—'} c={cross.uup && cross.uup.changePct > 0.05 ? 'text-red-400' : cross.uup && cross.uup.changePct < -0.05 ? 'text-emerald-400' : undefined} />
                    <DetailRow l="Indeks Dolar (DXY, FRED harian)" v={macro?.dollar ? macro.dollar.value.toFixed(2) : '—'} />
                    <DetailRow l="Prior" v={macro?.dollar ? macro.dollar.prior.toFixed(2) : '—'} />
                    {macro?.dollar?.history && macro.dollar.history.length >= 2 && (
                      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-white/[0.05]"><span className="text-[10px] text-white/35">Tren beberapa rilis terakhir</span><Sparkline data={macro.dollar.history} color="#60a5fa" w={70} h={20} /></div>
                    )}
                    <p className="text-[10px] text-white/40 leading-snug mt-2">Emas dihargakan dalam dolar — dolar menguat = emas relatif lebih mahal buat pemegang mata uang lain, biasanya menekan harga.</p>
                  </>} />
                <StatTile icon={GitBranch} label="Yield 10Y" value={macro?.us10y ? `${macro.us10y.value}%` : '—'} sub={macro?.us10y ? (macro.us10y.value > macro.us10y.prior ? 'naik → tekan emas' : 'turun → dukung emas') : 'memuat'} tone={macro?.us10y ? (macro.us10y.value > macro.us10y.prior ? 'bear' : 'bull') : 'neutral'} info="Yield Treasury 10 tahun. Naik = biaya peluang memegang emas naik."
                  spark={macro?.us10y?.history} sparkColor="#60a5fa"
                  moreHref="/terminal/data/macro/us10y" moreLabel="Lihat chart & detail Yield 10Y"
                  detail={<>
                    <DetailRow l="US10Y" v={macro?.us10y ? `${macro.us10y.value}%` : '—'} />
                    <DetailRow l="Prior" v={macro?.us10y ? `${macro.us10y.prior}%` : '—'} />
                    <DetailRow l="US02Y" v={macro?.us02y ? `${macro.us02y.value}%` : '—'} />
                    <DetailRow l="Kurva 2s10s" v={curve2s10 != null ? `${curve2s10 >= 0 ? '+' : ''}${curve2s10.toFixed(2)}%` : '—'} c={curve2s10 != null ? (curve2s10 < 0 ? 'text-amber-400' : undefined) : undefined} />
                    {macro?.us10y?.history && macro.us10y.history.length >= 2 && (
                      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-white/[0.05]"><span className="text-[10px] text-white/35">Tren beberapa rilis terakhir</span><Sparkline data={macro.us10y.history} color="#60a5fa" w={70} h={20} /></div>
                    )}
                    <p className="text-[10px] text-white/40 leading-snug mt-2">Yield naik = investor dapat imbal hasil lebih tinggi dari obligasi "bebas risiko" → emas (tanpa imbal hasil) jadi kurang menarik. Kurva 2s10s negatif = pasar obligasi memperkirakan resesi/pangkas bunga.</p>
                  </>} />
                <StatTile icon={Flame} label="Inflasi CPI" value={macro?.cpi ? `${macro.cpi.value}%` : '—'} sub={macro?.cpi ? `YoY · prior ${macro.cpi.prior}%` : 'memuat'} tone={macro?.cpi ? (macro.cpi.value > macro.cpi.prior ? 'bull' : 'neutral') : 'neutral'} info="Inflasi tinggi = emas sebagai lindung nilai makin menarik (jangka menengah)."
                  spark={macro?.cpi?.history} sparkColor="#60a5fa"
                  moreHref="/terminal/data/macro/cpi" moreLabel="Lihat chart & detail CPI"
                  detail={<>
                    <DetailRow l="CPI (headline, YoY)" v={macro?.cpi ? `${macro.cpi.value}%` : '—'} />
                    <DetailRow l="Core CPI (ex food & energy)" v={macro?.corecpi ? `${macro.corecpi.value}%` : '—'} />
                    <DetailRow l="Core PCE (gauge favorit Fed)" v={macro?.corepce ? `${macro.corepce.value}%` : '—'} />
                    <DetailRow l="Ekspektasi Inflasi 10Y (breakeven)" v={macro?.breakeven ? `${macro.breakeven.value}%` : '—'} />
                    {macro?.cpi?.history && macro.cpi.history.length >= 2 && (
                      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-white/[0.05]"><span className="text-[10px] text-white/35">Tren beberapa rilis terakhir</span><Sparkline data={macro.cpi.history} color="#60a5fa" w={70} h={20} /></div>
                    )}
                    <p className="text-[10px] text-white/40 leading-snug mt-2">Core PCE paling dipantau The Fed untuk keputusan suku bunga. Inflasi mereda → peluang pangkas bunga naik → bullish emas.</p>
                  </>} />
                <StatTile icon={Scale} label="Fed Funds" value={macro?.fedfunds ? `${macro.fedfunds.value}%` : '—'} sub="suku bunga acuan" tone="neutral" info="Ekspektasi pemangkasan = bullish emas; ditahan tinggi = bearish."
                  spark={macro?.fedfunds?.history} sparkColor="#60a5fa"
                  moreHref="/terminal/data/macro/fedfunds" moreLabel="Lihat chart & detail Fed Funds"
                  detail={<>
                    <DetailRow l="Fed Funds Rate" v={macro?.fedfunds ? `${macro.fedfunds.value}%` : '—'} />
                    <DetailRow l="Pengangguran" v={macro?.unrate ? `${macro.unrate.value}%` : '—'} />
                    <DetailRow l="NFP (perubahan bulanan)" v={macro?.nfp ? `${macro.nfp.value >= 0 ? '+' : ''}${macro.nfp.value}K` : '—'} />
                    <DetailRow l="Pertumbuhan Upah (YoY)" v={macro?.wagegrowth ? `${macro.wagegrowth.value}%` : '—'} />
                    {macro?.fedfunds?.history && macro.fedfunds.history.length >= 2 && (
                      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-white/[0.05]"><span className="text-[10px] text-white/35">Tren beberapa rilis terakhir</span><Sparkline data={macro.fedfunds.history} color="#60a5fa" w={70} h={20} /></div>
                    )}
                    <p className="text-[10px] text-white/40 leading-snug mt-2">Suku bunga acuan Fed. Pasar tenaga kerja melemah + upah mereda = ruang lebih besar buat Fed memangkas bunga → bullish emas.</p>
                  </>} />
                <StatTile icon={Users} label="Institusi (COT)" value={cot ? <span className={cot.funds.net >= 0 ? 'text-emerald-400' : 'text-red-400'}>{cot.funds.net >= 0 ? 'Net Long' : 'Net Short'}</span> : '—'} sub={cot ? `${kfmt(cot.funds.net)} · Δ ${kfmt(cot.funds.deltaNet)}/mgg` : 'memuat'} tone={cot ? (cot.funds.net >= 0 ? 'bull' : 'bear') : 'neutral'} info="Posisi bersih dana besar di futures emas (CFTC, mingguan)."
                  spark={cot?.fundsHistory} sparkColor="#34d399"
                  moreHref="/terminal/data/cot" moreLabel="Lihat chart & detail COT"
                  detail={cot ? <>
                    <DetailRow l="Funds (institusi/spekulan)" v={`${kfmt(cot.funds.net)}`} c={cot.funds.net >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                    <DetailRow l="Δ minggu ini" v={`${cot.funds.deltaNet >= 0 ? '+' : ''}${kfmt(cot.funds.deltaNet)}`} />
                    <DetailRow l="Commercials (hedger/bank)" v={`${kfmt(cot.commercials.net)}`} c={cot.commercials.net >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                    <DetailRow l="Tanggal data (CFTC)" v={cot.date} />
                    {cot.fundsHistory.length >= 2 && (
                      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-white/[0.05]"><span className="text-[10px] text-white/35">Tren net 12 minggu</span><Sparkline data={cot.fundsHistory} color="#60a5fa" w={70} h={20} /></div>
                    )}
                    <p className="text-[10px] text-white/40 leading-snug mt-2">Funds = hedge fund & spekulan besar, trend-follower. Commercials = produsen/bank, sering benar di titik ekstrem (smart money kontrarian). Data mingguan (lagging) — konteks, bukan sinyal entry.</p>
                  </> : undefined} />
                <StatTile icon={Users} label="Retail" value={cot ? <span className="text-white/75">{cot.retail.net >= 0 ? 'Net Long' : 'Net Short'}</span> : '—'} sub={cot ? `${kfmt(cot.retail.net)} — sering kontrarian` : 'memuat'} tone="neutral" info="Trader kecil sering berada di sisi yang salah pada titik ekstrem."
                  spark={cot?.retailHistory} sparkColor="#a78bfa"
                  moreHref="/terminal/data/cot" moreLabel="Lihat chart & detail COT"
                  detail={cot ? <>
                    <DetailRow l="Retail net" v={`${kfmt(cot.retail.net)}`} c={cot.retail.net >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                    <DetailRow l="Δ minggu ini" v={`${cot.retail.deltaNet >= 0 ? '+' : ''}${kfmt(cot.retail.deltaNet)}`} />
                    <DetailRow l="vs Institusi (Funds)" v={cot.funds.net * cot.retail.net < 0 ? 'Berlawanan' : 'Searah'} c={cot.funds.net * cot.retail.net < 0 ? 'text-amber-400' : undefined} />
                    {cot.retailHistory.length >= 2 && (
                      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-white/[0.05]"><span className="text-[10px] text-white/35">Tren net 12 minggu</span><Sparkline data={cot.retailHistory} color="#a78bfa" w={70} h={20} /></div>
                    )}
                    <p className="text-[10px] text-white/40 leading-snug mt-2">Trader ritel (non-reportable) cenderung salah arah di titik ekstrem — kalau posisinya berlawanan sama institusi, condong ikuti institusi.</p>
                  </> : undefined} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{MakroKesimpulanPanel}{RiskSentimentPanel}</div>
              {MacroMtfPanel && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{MacroMtfPanel}</div>}
              {CrossPanel}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{YieldCurvePanel}{GoldSilverPanel}</div>
              {GvzPanel && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{GvzPanel}</div>}
              {InflasiPanel}
              {CotPanel}
              {CalendarPanel}
            </div>)}

            {/* Sub-tab makro mendalam */}
            {tab === 'makro-lintas' && (!isPro ? <LockedTab icon={Landmark} {...LOCKED_TAB_META.makro} /> : <div className="max-w-6xl mx-auto space-y-4 lg:space-y-5">
              <MacroSubNav tab={tab} setTab={setTab} />
              <LintasAsetSection macro={macro} cross={cross} />
            </div>)}
            {tab === 'makro-inflasi' && (!isPro ? <LockedTab icon={Landmark} {...LOCKED_TAB_META.makro} /> : <div className="max-w-6xl mx-auto space-y-4 lg:space-y-5">
              <MacroSubNav tab={tab} setTab={setTab} />
              <InflasiSection macro={macro} />
            </div>)}
            {tab === 'makro-cot' && (!isPro ? <LockedTab icon={Users} {...LOCKED_TAB_META.sentimen} /> : <div className="max-w-6xl mx-auto space-y-4 lg:space-y-5">
              <MacroSubNav tab={tab} setTab={setTab} />
              <CotSection cot={cot} />
            </div>)}

            {tab === 'sentimen' && (!isPro ? <LockedTab icon={Users} {...LOCKED_TAB_META.sentimen} /> : <div className="max-w-6xl mx-auto space-y-4 lg:space-y-5">
              <TerminalScopeAnalysis scope="sentimen" hidePrompt title="Analisa Sentimen AI" subtitle="Dampak risk-on/off & berita ke XAU/USD — bias % + headline mendukung/menekan." snapshot={snapshot}
                suggestions={[]} />
              {/* Statistik sentimen kunci (COT dipindah ke tab Makro) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatTile icon={Scale} label="Mood Pasar" value={<span className={riskOn < -0.1 ? 'text-emerald-400' : riskOn > 0.1 ? 'text-red-400' : 'text-white/70'}>{riskOn < -0.1 ? 'Risk-Off' : riskOn > 0.1 ? 'Risk-On' : 'Seimbang'}</span>} sub={riskOn < -0.1 ? 'defensif → dukung emas' : riskOn > 0.1 ? 'agresif → tekan emas' : 'tanpa arah'} tone={riskOn < -0.1 ? 'bull' : riskOn > 0.1 ? 'bear' : 'neutral'} info="Dari VIX, S&P500, Nasdaq & BTC real-time."
                  detail={<>
                    <DetailRow l="S&P 500" v={cross.spy ? `${cross.spy.changePct >= 0 ? '+' : ''}${cross.spy.changePct.toFixed(2)}%` : '—'} c={cross.spy && cross.spy.changePct < 0 ? 'text-emerald-400' : cross.spy && cross.spy.changePct > 0 ? 'text-red-400' : undefined} />
                    <DetailRow l="Nasdaq (QQQ)" v={cross.qqq ? `${cross.qqq.changePct >= 0 ? '+' : ''}${cross.qqq.changePct.toFixed(2)}%` : '—'} c={cross.qqq && cross.qqq.changePct < 0 ? 'text-emerald-400' : cross.qqq && cross.qqq.changePct > 0 ? 'text-red-400' : undefined} />
                    <DetailRow l="VIX (proxy)" v={cross.vixy ? `${cross.vixy.changePct >= 0 ? '+' : ''}${cross.vixy.changePct.toFixed(2)}%` : '—'} c={cross.vixy && cross.vixy.changePct > 0 ? 'text-emerald-400' : undefined} />
                    <DetailRow l="Bitcoin" v={cross.btc ? `${cross.btc.changePct >= 0 ? '+' : ''}${cross.btc.changePct.toFixed(2)}%` : '—'} c={cross.btc && cross.btc.changePct < 0 ? 'text-emerald-400' : cross.btc && cross.btc.changePct > 0 ? 'text-red-400' : undefined} />
                    <p className="text-[10px] text-white/40 leading-snug mt-2">Saham/BTC turun & VIX naik bersamaan = pasar sedang defensif (risk-off) → uang biasanya lari ke aset aman seperti emas.</p>
                  </>} />
                <StatTile icon={Activity} label="VIX (Takut)" value={cross.vixy ? `${cross.vixy.changePct >= 0 ? '+' : ''}${cross.vixy.changePct.toFixed(1)}%` : '—'} sub={cross.vixy ? (cross.vixy.changePct > 2 ? 'ketakutan melonjak' : cross.vixy.changePct > 0 ? 'was-was' : 'tenang') : 'memuat'} tone={cross.vixy ? (cross.vixy.changePct > 2 ? 'bull' : 'neutral') : 'neutral'} info="VIX naik = pasar takut → aliran ke aset aman (emas)."
                  moreHref="/terminal/data/market/vix" moreLabel="Lihat chart & detail VIX"
                  detail={<>
                    <DetailRow l="Perubahan (proxy VIXY)" v={cross.vixy ? `${cross.vixy.changePct >= 0 ? '+' : ''}${cross.vixy.changePct.toFixed(2)}%` : '—'} c={cross.vixy && cross.vixy.changePct > 0 ? 'text-emerald-400' : undefined} />
                    <DetailRow l="Harga proxy" v={cross.vixy ? cross.vixy.price.toFixed(2) : '—'} />
                    <DetailRow l="Kondisi" v={cross.vixy ? (cross.vixy.changePct > 2 ? 'Ketakutan melonjak' : cross.vixy.changePct > 0 ? 'Was-was' : 'Tenang') : '—'} />
                    <p className="text-[10px] text-white/40 leading-snug mt-2">VIX = "index ketakutan" pasar saham. Naik tajam biasanya bersamaan risk-off — investor mencari aset aman termasuk emas.</p>
                  </>} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{SentimenKesimpulanPanel}{SentimenChartPanel}</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">{RiskSentimentPanel}{GoldSilverPanel}</div>
              {BiasPanel}
              {NewsPanel}
            </div>)}

            {tab === 'berita' && (!isPro ? <LockedTab icon={Newspaper} {...LOCKED_TAB_META.berita} /> : <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4"><TerminalNewsAnalysis snapshot={snapshot} /></div>)}

            {tab === 'rnd' && isAdmin && phase && (() => {
              const pc = phase.phase === 'ignition' ? '#22c55e' : phase.phase === 'confirmed' ? (phase.dir === 'bull' ? '#10b981' : '#ef4444') : phase.phase === 'coiling' ? '#f59e0b' : '#64748b'
              // Tahap 1 punya dua wajah: kompresi tanpa arah (Coiling) vs kompresi
              // searah tren (Koreksi). Label ikut menyesuaikan supaya tidak menyesatkan.
              const isKoreksi = phase.phase === 'coiling' && phase.dir !== null
              const STEPS = [
                isKoreksi
                  ? { id: 'coiling', t: 'Koreksi', d: 'Tunggu zona lanjutan' }
                  : { id: 'coiling', t: 'Coiling', d: 'Energi terkumpul' },
                { id: 'ignition', t: 'Cari Zona Open Posisi', d: 'Trigger sniper' },
                { id: 'confirmed', t: 'Trending', d: 'Kelola posisi' },
              ] as const
              const activeIdx = STEPS.findIndex(st => st.id === phase.phase)
              const durMin = Math.max(0, Math.round((Date.now() - phase.sinceTs) / 60_000))
              return (
                <div className="max-w-6xl mx-auto space-y-4">
                  <Panel title="R&D Sniper — Fase Tren M5" icon={Crosshair} accent={pc}
                    info="Tool riset (khusus admin). Coiling = siaga; Ignition = momen cari entry; Trending = kelola posisi, bukan entry. Skor = keyakinan — catat semua sinyal ke Jurnal Backtest sebelum dipercaya untuk uang sungguhan."
                    right={<span className="text-[10px] font-bold" style={{ color: pc }}>skor {phase.score}/100</span>}>
                    <div className="space-y-4">
                      {/* ARAH SEKARANG — pertanyaan pertama trader: BUY atau SELL? */}
                      {(() => {
                        const b = phase.bias
                        const bc = b === 'bullish' ? '#10b981' : b === 'bearish' ? '#ef4444' : '#64748b'
                        return (
                          <div className="rounded-2xl border p-4" style={{ background: `${bc}14`, borderColor: `${bc}55` }}>
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Arah Sekarang</p>
                                <p className="text-2xl font-black tracking-tight" style={{ color: bc }}>
                                  {b === 'bullish' ? '▲ BULLISH' : b === 'bearish' ? '▼ BEARISH' : '↔ NETRAL'}
                                </p>
                              </div>
                              <div className="px-4 py-2 rounded-xl font-black text-sm" style={{ background: b === 'netral' ? '#64748b22' : `${bc}26`, color: bc }}>
                                {b === 'bullish' ? 'CARI BUY' : b === 'bearish' ? 'CARI SELL' : 'TUNGGU'}
                              </div>
                            </div>
                            <p className="text-[12px] text-white/60 mt-2">{phase.biasNote}</p>
                            {phase.srNote && <p className="text-[11px] text-white/45 mt-1">{phase.srNote}</p>}
                          </div>
                        )
                      })()}

                      {/* SETUP SIAP EKSEKUSI — muncul hanya saat konfluensi cukup */}
                      {phase.entry && (() => {
                        const en = phase.entry
                        const ec = en.side === 'BUY' ? '#10b981' : '#ef4444'
                        return (
                          <div className="rounded-2xl border-2 p-4" style={{ borderColor: ec, background: `${ec}12` }}>
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                              <span className="text-lg font-black" style={{ color: ec }}>🎯 SETUP {en.side} — skor {en.score}/100</span>
                              <span className="text-[12px] font-bold px-2.5 py-1 rounded-lg" style={{ background: `${ec}22`, color: ec }}>R:R 1:{en.rr.toFixed(1)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              <div className="rounded-lg bg-white/[0.04] p-2.5">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Zona Entry</p>
                                <p className="text-sm font-black tabular-nums">${en.zoneLo.toFixed(1)}–${en.zoneHi.toFixed(1)}</p>
                              </div>
                              <div className="rounded-lg bg-red-500/10 p-2.5">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-red-300/60">Stop Loss</p>
                                <p className="text-sm font-black tabular-nums text-red-300">${en.sl.toFixed(1)}</p>
                              </div>
                              <div className="rounded-lg bg-emerald-500/10 p-2.5">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300/60">Target 1</p>
                                <p className="text-sm font-black tabular-nums text-emerald-300">${en.tp1.toFixed(1)}</p>
                              </div>
                            </div>
                            <ul className="space-y-1">
                              {en.factors.map((f, i) => (
                                <li key={i} className="flex items-start gap-2 text-[12px] text-white/75 leading-relaxed">
                                  <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full" style={{ background: ec }} />{f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })()}

                      {/* Fibonacci golden zone */}
                      {phase.fib && (() => {
                        const fb = phase.fib
                        return (
                          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Fibonacci · leg {fb.up ? 'naik' : 'turun'} ${fb.legLo.toFixed(1)}–${fb.legHi.toFixed(1)}</p>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: fb.inGolden ? '#f59e0b26' : '#ffffff0d', color: fb.inGolden ? '#fbbf24' : 'rgba(255,255,255,.45)' }}>
                                {fb.inGolden ? 'DI GOLDEN ZONE' : `retrace ${Math.round(fb.pct * 100)}%`}
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center">
                              {([['38.2%', fb.f382, false], ['50%', fb.f500, true], ['61.8%', fb.f618, true], ['78.6%', fb.f786, false]] as const).map(([l, v, gold]) => (
                                <div key={l} className="rounded-lg p-2" style={{ background: gold ? '#f59e0b14' : '#ffffff08', border: gold ? '1px solid #f59e0b33' : '1px solid transparent' }}>
                                  <p className="text-[9px] font-bold" style={{ color: gold ? '#fbbf24' : 'rgba(255,255,255,.4)' }}>{l}</p>
                                  <p className="text-[12px] font-black tabular-nums text-white/80">${v.toFixed(1)}</p>
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-white/30 mt-2">Golden zone 50–61.8% = area pullback klasik untuk entry sniper searah tren.</p>
                          </div>
                        )
                      })()}

                      {/* Timeline fase */}
                      <div className="grid grid-cols-3 gap-2">
                        {STEPS.map((st, i) => {
                          const on = i === activeIdx
                          const passed = activeIdx > i
                          return (
                            <div key={st.id} className={`rounded-xl border p-3 text-center transition-colors ${on ? 'border-transparent' : 'border-white/10'}`}
                              style={on ? { background: `${pc}1a`, boxShadow: `inset 0 0 0 1px ${pc}66` } : undefined}>
                              <p className={`text-[11px] font-black ${on ? '' : passed ? 'text-white/60' : 'text-white/30'}`} style={on ? { color: pc } : undefined}>{st.t}</p>
                              <p className="text-[10px] text-white/35 mt-0.5">{st.d}</p>
                            </div>
                          )
                        })}
                      </div>

                      {/* Status utama */}
                      <div className="rounded-2xl border border-white/10 p-5 text-center" style={{ background: `${pc}0d` }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">{phase.phase === 'idle' ? 'Status' : `Fase aktif · ${durMin}m`}</p>
                        <p className="text-2xl font-black tracking-tight" style={{ color: pc }}>
                          {phase.label}{phase.dir ? <span className="ml-2">{phase.dir === 'bull' ? '▲' : '▼'}</span> : null}
                        </p>
                        <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden max-w-sm mx-auto">
                          <div className="h-full rounded-full transition-all" style={{ width: `${phase.score}%`, background: pc }} />
                        </div>
                        <p className="text-[10px] text-white/35 mt-1.5">keyakinan {phase.score}/100 — ignition sengaja tak pernah 100: dini = tidak pasti</p>
                      </div>

                      {/* Readout live — SELALU tampil (bukti tool hidup & menghitung tiap tick) */}
                      {(() => {
                        const m = phase.metrics
                        const cell = (label: string, val: string, hint: string, good: boolean | null) => (
                          <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{label}</p>
                            <p className={`text-sm font-black tabular-nums ${good === true ? 'text-emerald-400' : good === false ? 'text-white/50' : 'text-white/80'}`}>{val}</p>
                            <p className="text-[9px] text-white/30 leading-tight mt-0.5">{hint}</p>
                          </div>
                        )
                        return (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 flex items-center gap-1.5"><Radio size={10} className="text-emerald-400 animate-pulse" /> Metrik Live · M5 (update tiap tick)</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {cell('Efficiency', m.er.toFixed(2), m.er >= 0.4 ? 'terarah' : m.er < 0.25 ? 'acak/coiling' : 'campur', m.er >= 0.4 ? true : m.er < 0.25 ? false : null)}
                              {cell('ADX', Math.round(m.adx).toString(), m.adx >= 23 ? 'tren kuat' : m.adx < 20 ? 'lemah/diam' : 'menanjak', m.adx >= 23 ? true : m.adx < 20 ? false : null)}
                              {cell('Kontraksi ATR', m.atrContraction.toFixed(2), m.atrContraction < 0.8 ? 'menyempit' : 'normal', m.atrContraction < 0.8 ? true : null)}
                              {cell('BB Squeeze', `p${Math.round(m.bwPctile * 100)}`, m.bwPctile <= 0.25 ? 'squeeze!' : 'longgar', m.bwPctile <= 0.25 ? true : false)}
                              {cell('Jarak EMA21', `${m.distEmaAtr.toFixed(1)}×ATR`, m.distEmaAtr > 2.2 ? 'ekstrem' : 'wajar', m.distEmaAtr > 2.2 ? false : null)}
                              {cell('Candle', `${m.rangeAtr.toFixed(1)}×ATR`, m.rangeAtr >= 1.2 ? 'ekspansi' : 'kecil', m.rangeAtr >= 1.2 ? true : null)}
                              {cell('RSI', Math.round(m.rsi).toString(), m.rsi >= 72 ? 'jenuh beli' : m.rsi <= 28 ? 'jenuh jual' : m.rsi >= 52 ? 'bias naik' : m.rsi <= 48 ? 'bias turun' : 'netral', null)}
                              {cell('M15 Filter', m.m15Up ? '▲ Bull' : '▼ Bear', 'arah TF besar', null)}
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {cell('Level Breakout ↑', `$${m.dchHi.toFixed(1)}`, 'close M5 di atas = ignition bull', null)}
                              {cell('Level Breakout ↓', `$${m.dchLo.toFixed(1)}`, 'close M5 di bawah = ignition bear', null)}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Struktur pasar (price action HH/HL) + event BOS/ChoCh */}
                      {(() => {
                        const m = phase.metrics
                        const sc = m.structLabel === 'Uptrend' ? '#10b981' : m.structLabel === 'Downtrend' ? '#ef4444' : '#64748b'
                        const isChoch = m.structEvent === 'ChoCh_up' || m.structEvent === 'ChoCh_down'
                        return (
                          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Struktur Pasar (Price Action)</p>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-lg font-black" style={{ color: sc }}>
                                {m.structLabel === 'Uptrend' ? '▲ Uptrend' : m.structLabel === 'Downtrend' ? '▼ Downtrend' : '↔ Sideways'}
                              </span>
                              <span className="text-[12px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${sc}1a`, color: sc }}>{m.structSeq}</span>
                              <span className="text-[11px] text-white/45 tabular-nums">Swing H <b className="text-white/70">${m.structHigh.toFixed(1)}</b> · L <b className="text-white/70">${m.structLow.toFixed(1)}</b></span>
                            </div>
                            {m.structEvent && (
                              <div className="flex items-start gap-2 mt-3 rounded-lg p-2.5" style={{ background: isChoch ? '#a855f71a' : `${sc}14`, border: `1px solid ${isChoch ? '#a855f755' : sc + '44'}` }}>
                                <span className="text-[11px] font-black shrink-0 mt-0.5" style={{ color: isChoch ? '#c084fc' : sc }}>{isChoch ? 'ChoCh' : 'BOS'}</span>
                                <span className="text-[12px] text-white/75 leading-relaxed">{m.structEventNote}</span>
                              </div>
                            )}
                            <p className="text-[10px] text-white/30 mt-2 leading-relaxed">HH·HL = higher high &amp; higher low (uptrend sehat). BOS = tren lanjut. <b style={{ color: '#c084fc' }}>ChoCh</b> = pembalikan dini — sinyal paling awal.</p>
                          </div>
                        )
                      })()}

                      {/* Peringatan kematangan — obat FOMO */}
                      {phase.mature && phase.matureNote && (
                        <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/30 p-4">
                          <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
                          <p className="text-[12px] text-red-200/90 leading-relaxed"><b>Tren sudah matang.</b> {phase.matureNote}</p>
                        </div>
                      )}

                      {/* Zona aksi */}
                      {phase.zone && (
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Zona Aksi</p>
                          <p className="text-lg font-black tabular-nums">${phase.zone.lo.toFixed(1)} — ${phase.zone.hi.toFixed(1)}</p>
                          <p className="text-[11px] text-white/55 mt-1 leading-relaxed">{phase.zone.note}</p>
                        </div>
                      )}

                      {/* Bukti price action — bahan jurnal backtest */}
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Bukti Price Action</p>
                        <ul className="space-y-1.5">
                          {phase.reasons.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-[12px] text-white/70 leading-relaxed">
                              <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full" style={{ background: pc }} />{r}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <p className="text-[10px] text-white/30 leading-relaxed">
                        🔔 Notifikasi transisi fase aktif: toast + bunyi (coiling = 2 nada rendah, ignition = 4 nada cepat, trending = chime regime) + email ke admin.
                        ⚠️ Tool R&D — deteksi dini pasti punya false signal. Catat tiap sinyal di Jurnal Backtest (fase, skor, hasil) sebelum dipakai untuk uang sungguhan.
                      </p>
                    </div>
                  </Panel>
                </div>
              )
            })()}
            {tab === 'status' && isAdmin && <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">{ServerStatusContent}</div>}

            {tab === 'panduan' && <div className="max-w-6xl mx-auto"><PanduanContent /></div>}

            <p className="text-center text-[10px] text-white/25 pt-6">Terminal XAUUSD · 100% data real. Bukan nasihat keuangan — gunakan sebagai alat bantu analisa, keputusan tetap di tangan kamu.</p>
          </main>
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#080d0b]/95 backdrop-blur border-t border-white/[0.06] flex items-center overflow-x-auto">
        {visibleTabs.map(t => {
          const on = tab === t.id || (t.id === 'makro' && (MACRO_TAB_IDS as Tab[]).includes(tab))
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex flex-col items-center gap-0.5 px-3 py-2 shrink-0 ${on ? 'text-primary' : 'text-white/40'}`}>
              {!isPro && t.pro && <Lock size={9} className="absolute top-1 right-1.5 text-primary/60" />}
              <t.icon size={16} />
              <span className="text-[8px] font-semibold whitespace-nowrap">{t.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ─────────────────────────── Panduan (interaktif, untuk pemula) ───────────────────────────
// Kartu accordion: klik judul untuk buka/tutup. Satu terbuka default.
function GuideAccordion({ title, icon: Icon, open, onToggle, children }: { title: string; icon: React.ElementType; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border transition-colors ${open ? 'border-primary/25 bg-primary/[0.04]' : 'border-white/[0.06] bg-[#0b100e] hover:border-white/15'}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-2.5 p-4 text-left">
        <span className={`flex items-center justify-center w-8 h-8 rounded-xl shrink-0 ${open ? 'bg-primary/15 ring-1 ring-primary/30 text-primary' : 'bg-white/5 text-white/50'}`}><Icon size={15} /></span>
        <h3 className="flex-1 text-sm font-black">{title}</h3>
        <ChevronDown size={16} className={`text-white/40 transition-transform ${open ? 'rotate-180 text-primary' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 -mt-1 text-[12px] text-white/65 leading-relaxed space-y-1.5">{children}</div>}
    </div>
  )
}

function PanduanContent() {
  const [open, setOpen] = useState<string>('istilah')
  const toggle = (id: string) => setOpen(o => o === id ? '' : id)

  // Langkah cara membaca terminal (stepper visual)
  const STEPS = [
    { icon: Compass, t: 'Lihat Signal Meter', d: 'Di tab Ringkasan: jarum ke kanan = bullish, ke kiri = bearish. Cek juga Confidence.' },
    { icon: Brain, t: 'Jalankan Analisa AI', d: 'Dapat 1 keputusan tegas (Beli/Jual/Tunggu) + alasan + strip M5/M15/H1.' },
    { icon: Activity, t: 'Konfirmasi Teknikal', d: 'Cek M5/M15/H1 searah? lalu lihat kartu Kesimpulan Makro & Sentimen.' },
    { icon: Target, t: 'Eksekusi + SL', d: 'Pakai level entry/stop/target dari AI. SL selalu terpasang, jarak sesuai volatilitas.' },
  ]
  // Tiga pilar sinyal (legenda)
  const PILLARS = [
    { icon: Landmark, t: 'Makro', d: 'Dolar, yield, inflasi & Fed', c: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
    { icon: Activity, t: 'Teknikal', d: 'Chart & struktur multi-timeframe', c: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { icon: Users, t: 'Sentimen', d: 'Berita, COT & mood pasar', c: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  ]

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] to-transparent p-5">
        <h2 className="text-base font-black flex items-center gap-2 mb-1.5"><BookOpen size={18} className="text-primary" /> Cara Baca Terminal Scalping XAU/USD</h2>
        <p className="text-[12px] text-white/60 leading-relaxed">Terminal ini menyatukan semua data jadi <b className="text-white/85">satu arah bias yang jelas</b> untuk <b className="text-primary">scalping emas</b> (fokus M5, M15, H1). XAU/USD = harga emas dalam dolar. Emas cenderung <b className="text-emerald-400">naik</b> saat dolar & suku bunga melemah / pasar takut, dan <b className="text-red-400">turun</b> saat sebaliknya.</p>
      </div>

      {/* Stepper: cara baca dalam 4 langkah */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2.5 px-1">Baca dalam 4 Langkah</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {STEPS.map((s, i) => (
            <div key={s.t} className="relative rounded-2xl border border-white/[0.06] bg-[#0b100e] p-4">
              <span className="absolute top-3 right-3 text-[11px] font-black text-white/15">{i + 1}</span>
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/12 ring-1 ring-primary/25 mb-2.5"><s.icon size={16} className="text-primary" /></span>
              <p className="text-[13px] font-bold mb-1">{s.t}</p>
              <p className="text-[11px] text-white/50 leading-snug">{s.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Legenda 3 pilar */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2.5 px-1">Signal Meter = 3 Pilar</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PILLARS.map(p => (
            <div key={p.t} className={`rounded-2xl border p-4 ${p.bg}`}>
              <p className={`flex items-center gap-2 text-sm font-black ${p.c}`}><p.icon size={15} /> {p.t}</p>
              <p className="text-[11px] text-white/55 mt-1">{p.d}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-white/45 mt-2 px-1"><b className="text-white/70">Confidence</b> = seberapa sepakat ketiga pilar. Tinggi (&gt;66%) = sinyal lebih bisa dipercaya; rendah = pilar bertentangan, kecilkan lot.</p>
      </div>

      {/* Accordion detail per bagian */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2.5 px-1">Pelajari Tiap Bagian <span className="text-white/25 normal-case font-medium">· klik untuk buka</span></p>
        <div className="space-y-2">
          <GuideAccordion title="Istilah Dasar" icon={Info} open={open === 'istilah'} onToggle={() => toggle('istilah')}>
            <p>• <b className="text-emerald-400">Bullish</b> = perkiraan harga naik. <b className="text-red-400">Bearish</b> = perkiraan turun. <b>Netral</b> = seimbang.</p>
            <p>• <b>Support (S)</b> = level bawah tempat harga sering memantul naik. <b>Resistance (R)</b> = level atas tempat harga sering tertahan.</p>
            <p>• <b>Timeframe scalping</b>: M5 & M15 = tempat entry/exit. H1 = konteks arah intraday. H4/Daily hanya angin latar, bukan penghalang setup scalping.</p>
            <p>• <b>Pips</b>: satuan gerak. Untuk XAU/USD, 1 pip = $0.10.</p>
          </GuideAccordion>
          <GuideAccordion title="Arah & Ringkasan per Sesi" icon={Clock} open={open === 'sesi'} onToggle={() => toggle('sesi')}>
            <p>Di tab <b>Ringkasan</b> ada panel <b>Asia · London · New York</b> (jam WIB) yang <b>reset tiap hari</b>.</p>
            <p>• Tiap sesi menampilkan status (berlangsung/selesai/belum), <b>range dalam pips</b>, dan <b>Open → harga sekarang</b>. Arah (bullish/bearish) baru muncul saat sesi <b>selesai</b> — sesi yang masih berjalan ditandai &quot;masih berjalan&quot; agar tidak menyesatkan.</p>
            <p>• Berguna untuk scalping: tahu sesi mana yang sedang bergerak & searah bias-mu.</p>
          </GuideAccordion>
          <GuideAccordion title="Teknikal" icon={Activity} open={open === 'teknikal'} onToggle={() => toggle('teknikal')}>
            <p>• <b>Chart</b> TradingView: bisa di-zoom/drag, klik "Perbesar" untuk layar penuh.</p>
            <p>• <b>Konfluensi M5/M15/H1</b>: kalau ketiganya searah = momentum scalping lebih kuat.</p>
            <p>• <b>Kekuatan tren</b>: makin kuat & searah = sinyal makin bisa diikuti; lemah/sideways = rawan tipu-tipu.</p>
            <p>• <b>Volatilitas</b>: besar pergerakan — jadi patokan jarak SL/TP scalping.</p>
          </GuideAccordion>
          <GuideAccordion title="Makro" icon={Landmark} open={open === 'makro'} onToggle={() => toggle('makro')}>
            <p>• <b>Kesimpulan Makro → XAU/USD</b>: kartu ringkas — makro sedang dukung atau tekan emas + pendorong utamanya.</p>
            <p>• <b>Indeks Dolar & yield</b>: naik → tekan emas; turun → dukung emas.</p>
            <p>• <b>Inflasi (CPI/Core PCE)</b>: mereda → peluang Fed pangkas bunga → bullish emas.</p>
            <p>• <b>Kalender Ekonomi</b>: rilis high-impact = volatilitas tinggi. Bukan larangan — pakai tab <b className="text-primary">Analisa News</b> untuk menyiasatinya.</p>
          </GuideAccordion>
          <GuideAccordion title="Sentimen" icon={Users} open={open === 'sentimen'} onToggle={() => toggle('sentimen')}>
            <p>• <b>Kesimpulan Sentimen → XAU/USD</b> + <b>Peta Sentimen</b>: bar tiap faktor (mood pasar, VIX, COT, saham) mendorong emas bullish/bearish.</p>
            <p>• <b>COT</b> (mingguan, CFTC): <b>Funds/Institusi</b> = smart money; <b>Retail</b> sering salah di titik ekstrem (kontrarian).</p>
            <p>• Kalau institusi & retail berlawanan → cenderung ikuti institusi.</p>
          </GuideAccordion>
          <GuideAccordion title="Analisa AI" icon={Brain} open={open === 'ai'} onToggle={() => toggle('ai')}>
            <p>Klik <b className="text-primary">Jalankan Analisa AI</b> — Datalitiq AI membaca SEMUA data + berita lalu memberi:</p>
            <p>• <b>Satu keputusan & arah</b> (Beli/Jual/Tunggu) + alasan + keyakinan. Selalu ada 1 arah, tidak menghindar.</p>
            <p>• <b>Strip M5/M15/H1</b> untuk cek keselarasan scalping; toggle <b>Ringkas/Lengkap</b> untuk detail.</p>
            <p>• <b>Tambah konteks</b> untuk menyesuaikan (mis. "scalping sesi London, fokus level entry").</p>
          </GuideAccordion>
          <GuideAccordion title="Analisa News" icon={Newspaper} open={open === 'news'} onToggle={() => toggle('news')}>
            <p>Untuk menyiasati rilis berita — <b>bukan menghindarinya</b>.</p>
            <p>• Pilih event (CPI, NFP, FOMC…), isi angka <b>Actual · Forecast · Previous</b> ala forexfactory.</p>
            <p>• AI memberi <b>prediksi arah emas</b> + rekomendasi pre-news (Long/Short/Tunggu), skenario reaksi + probabilitas, dan level kunci.</p>
            <p className="text-amber-400/80">⚠ Masuk sebelum berita = risiko tinggi (whipsaw). Pakai SL rapat / lot kecil.</p>
          </GuideAccordion>
        </div>
      </div>

      {/* Alur + disclaimer */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0b100e] p-5">
        <h3 className="flex items-center gap-2 text-sm font-black mb-2.5"><CheckCircle2 size={15} className="text-primary" /> Alur Scalping yang Disarankan</h3>
        <ol className="text-[12px] text-white/65 leading-relaxed space-y-1 list-decimal list-inside">
          <li>Buka <b>Ringkasan</b> → lihat Signal Meter, Confidence & panel <b>per Sesi</b>.</li>
          <li>Klik <b>Jalankan Analisa AI</b> → dapat 1 arah bias + strip M5/M15/H1.</li>
          <li>Konfirmasi di <b>Teknikal</b> & cek kartu <b>Kesimpulan Makro/Sentimen</b>.</li>
          <li>Kalau ada rilis besar dekat → mampir <b>Analisa News</b> untuk rencananya.</li>
          <li>Eksekusi dengan <b>SL selalu terpasang</b> & jarak sesuai volatilitas.</li>
        </ol>
        <p className="text-[11px] text-amber-400/80 mt-2.5">⚠ Terminal ini alat bantu analisa, <b>bukan nasihat keuangan</b>. Kelola risiko dengan disiplin.</p>
      </div>
    </div>
  )
}
