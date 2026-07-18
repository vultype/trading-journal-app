'use client'

// ─────────────────────────────────────────────────────────────────────────────
// TERMINAL GBP/USD — modul TERPISAH dari terminal emas (khusus ADMIN).
// Menumpang data ber-cache yang sudah ada (crossasset, macro AS) + jalur baru
// GBP (quote/candle GBP/USD, makro UK, COT GBP). Mesin teknikal dipakai ulang
// dari terminal-signal (instrument-agnostic) — TIDAK menyentuh logika emas.
// Model skor: kerangka CURRENCY-PAIR (selisih AS vs UK + risk appetite),
// bukan kerangka safe-haven emas.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import { TradingViewChart } from '@/components/terminal/TradingViewChart'
import {
  TFS, clamp, adxLabel, computeTF, riskOnScore, regimeOf, efficiencyRatio, confluence, usMarketOpen,
  type TF, type Candle, type TFData, type CrossQuote, type RegimePhase,
} from '@/lib/terminal-signal'
import type { MacroPoint } from '@/lib/fred'
import {
  Activity, ArrowLeft, Loader2, Gauge, Landmark, Users, BookOpen, LayoutDashboard,
  TrendingUp, TrendingDown, Minus, Clock, Signal, Scale, GitBranch, Info, ShieldCheck, Flag, Circle,
} from 'lucide-react'

// ── data hooks (polling ringan; semua route server sudah ber-cache) ──
type HTF = 'H4' | 'D1'
const HTFS: HTF[] = ['H4', 'D1']
const SYM = 'GBP/USD'
const f5 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 })

type Quote = { price: number; changePct: number; dayHigh: number; dayLow: number; open: number; previousClose: number }
type Feed = { quote: Quote | null; tf: Partial<Record<TF | HTF, TFData>>; candlesAt: number | null }

function useGbpFeed(active: boolean): Feed {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [tf, setTf] = useState<Partial<Record<TF | HTF, TFData>>>({})
  const [candlesAt, setCandlesAt] = useState<number | null>(null)
  const raw = useRef<Partial<Record<TF | HTF, Candle[]>>>({})
  useEffect(() => {
    if (!active) return
    let stop = false
    const hidden = () => typeof document !== 'undefined' && document.hidden
    const pollQuote = async () => { try { const j = await (await fetch(`/api/terminal/quote?symbol=${encodeURIComponent(SYM)}`)).json(); if (!stop && j.price) setQuote(j) } catch { } }
    const pollTf = async (t: TF | HTF) => {
      try {
        const arr = await (await fetch(`/api/terminal/candles?tf=${t}&symbol=${encodeURIComponent(SYM)}`)).json()
        if (stop || !Array.isArray(arr) || !arr.length) return
        raw.current[t] = arr.map((c: Candle) => ({ ...c, v: 1 }))
        setTf(prev => ({ ...prev, [t]: computeTF(raw.current[t]!) }))
        setCandlesAt(Date.now())
      } catch { }
    }
    pollQuote(); TFS.forEach(pollTf); HTFS.forEach(pollTf)
    const q = setInterval(() => { if (!hidden()) pollQuote() }, 8_000)
    const c = setInterval(() => { if (!hidden()) TFS.forEach(pollTf) }, 60_000)
    const h = setInterval(() => { if (!hidden()) HTFS.forEach(pollTf) }, 300_000)
    return () => { stop = true; clearInterval(q); clearInterval(c); clearInterval(h) }
  }, [active])
  return { quote, tf, candlesAt }
}

function useJson<T>(url: string, intervalMs: number, active: boolean): T | null {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    if (!active) return
    let stop = false
    const poll = async () => { try { const j = await (await fetch(url)).json(); if (!stop && j && !j.error) setData(j) } catch { } }
    poll()
    const id = setInterval(() => { if (typeof document === 'undefined' || !document.hidden) poll() }, intervalMs)
    return () => { stop = true; clearInterval(id) }
  }, [url, intervalMs, active])
  return data
}

type CotGroup = { long: number; short: number; net: number; deltaNet: number }
type CotGbp = { date: string; funds: CotGroup; commercials: CotGroup; retail: CotGroup }
type CrossMap = Record<string, CrossQuote>

// ── skor pilar GBP/USD (kerangka currency-pair, lokal modul ini) ──
function gbpScores(tf: Partial<Record<TF, TFData>>, us: Record<string, MacroPoint>, uk: Record<string, MacroPoint>, riskOn: number, dollarLive: number | null, cotDir: number) {
  const t5 = tf.M5, t15 = tf.M15, t1 = tf.H1
  const tech = t5 && t15 && t1 ? clamp((t5.bias.score + t15.bias.score + t1.bias.score) / 9, -1, 1) * 100 : 0
  const dir = (m: Record<string, MacroPoint>, k: string) => { const p = m[k]; return p ? Math.sign(p.value - p.prior) : 0 }
  // Dolar broad naik → GBP/USD turun. Yield AS naik → turun. Yield/rate/CPI UK naik → hawkish BoE → naik.
  const dollarDir = dollarLive != null && Math.abs(dollarLive) > 0.02 ? Math.sign(dollarLive) : dir(us, 'dollar')
  const macro = clamp(
    -dollarDir * 0.35 - dir(us, 'us10y') * 0.20 + dir(uk, 'uk10y') * 0.20 + dir(uk, 'sonia') * 0.15 + dir(uk, 'ukcpi') * 0.10,
    -1, 1) * 100
  // GBP = mata uang risiko: risk-on → GBP menguat (kebalikan emas). COT funds menambah/mengurangi net → arah.
  const senti = clamp(riskOn * 0.6 + cotDir * 0.4, -1, 1) * 100
  const overall = macro * 0.3 + tech * 0.45 + senti * 0.25
  const label = overall > 20 ? 'BULLISH' : overall < -20 ? 'BEARISH' : 'NETRAL'
  const sgn = (x: number) => Math.sign(Math.round(x))
  const agree = new Set([sgn(macro), sgn(tech), sgn(senti)]).size === 1 ? 3 : (sgn(macro) === sgn(tech) || sgn(tech) === sgn(senti) || sgn(macro) === sgn(senti)) ? 2 : 1
  const mag = (Math.abs(macro) + Math.abs(tech) + Math.abs(senti)) / 3
  const confidence = Math.round(clamp((agree / 3) * 0.6 + (mag / 100) * 0.4, 0, 1) * 100)
  return { macro, tech, senti, overall, label, confidence }
}

// ── sesi WIB (jendela sama dgn terminal emas; pip GBP = 0.0001) ──
const WIB = 7 * 3_600_000
const SESSIONS = [{ name: 'Asia', s: 6, e: 14 }, { name: 'London', s: 14, e: 19 }, { name: 'New York', s: 19, e: 23 }] as const
function sessionRows(candles: Candle[] | undefined, now: number) {
  const dayStart = Math.floor((now + WIB) / 86_400_000) * 86_400_000 - WIB
  return SESSIONS.map(x => {
    const from = dayStart + x.s * 3_600_000, to = dayStart + x.e * 3_600_000
    const status = now < from ? 'belum' : now >= to ? 'selesai' : 'berlangsung'
    const cs = (candles ?? []).filter(c => c.t >= from && c.t < to)
    if (!cs.length) return { name: x.name, status, arah: null as string | null, open: 0, close: 0, rangePips: 0 }
    const open = cs[0].o, close = cs[cs.length - 1].c
    const hi = Math.max(...cs.map(c => c.h)), lo = Math.min(...cs.map(c => c.l))
    const chg = close - open
    const arah = chg > 0.0008 ? 'Bullish' : chg < -0.0008 ? 'Bearish' : 'Flat'
    return { name: x.name, status, arah, open, close, rangePips: Math.round((hi - lo) * 10_000) }
  })
}

// ── UI kecil ──
function Panel({ title, icon: Ic, children, right, info }: { title: string; icon: React.ElementType; children: React.ReactNode; right?: React.ReactNode; info?: string }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[#0b100e] p-4" title={info}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[13px] font-bold flex items-center gap-2"><Ic size={14} className="text-primary" /> {title}</p>
        {right}
      </div>
      {children}
    </section>
  )
}
function PillarRow({ label, score, desc }: { label: string; score: number; desc: string }) {
  const c = score > 15 ? '#34d399' : score < -15 ? '#f87171' : 'rgba(255,255,255,0.45)'
  return (
    <div className="py-2">
      <div className="flex justify-between text-[11px] mb-1"><span className="font-bold text-white/80">{label}</span><span className="font-black tabular-nums" style={{ color: c }}>{score >= 0 ? '+' : ''}{Math.round(score)}</span></div>
      <div className="relative h-1.5 rounded-full bg-white/[0.06]">
        <span className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
        <span className="absolute top-0 bottom-0 rounded-full" style={{ left: score >= 0 ? '50%' : `${50 + score / 2}%`, width: `${Math.abs(score) / 2}%`, background: c }} />
      </div>
      <p className="text-[10px] text-white/40 mt-1">{desc}</p>
    </div>
  )
}
function MacroRow({ p, corr }: { p: MacroPoint | undefined; corr: number }) {
  if (!p) return null
  const up = p.value >= p.prior
  const impact = (up ? 1 : -1) * corr
  const c = impact > 0 ? 'text-emerald-400' : impact < 0 ? 'text-red-400' : 'text-white/50'
  return (
    <div className="flex items-center justify-between py-1.5 border-t border-white/[0.05] first:border-t-0">
      <span className="text-[12px] text-white/70">{p.key}</span>
      <span className="text-[12px] font-bold tabular-nums">{p.value.toFixed(2)} <span className="text-[10px] text-white/35">← {p.prior.toFixed(2)}</span></span>
      <span className={`text-[10px] font-bold ${c}`}>{impact > 0 ? '↑ GBP' : impact < 0 ? '↓ GBP' : '·'}</span>
    </div>
  )
}

const TABS = [
  { id: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'teknikal', label: 'Teknikal', icon: Activity },
  { id: 'makro', label: 'Makro AS vs UK', icon: Landmark },
  { id: 'sentimen', label: 'Sentimen', icon: Users },
  { id: 'panduan', label: 'Panduan', icon: BookOpen },
] as const
type Tab = typeof TABS[number]['id']

export default function TerminalGbpPage() {
  const router = useRouter()
  const sub = useSubscription()
  const [tab, setTab] = useState<Tab>('ringkasan')
  const [now, setNow] = useState(Date.now())
  const regimeRef = useRef<RegimePhase | undefined>(undefined)

  const isAdmin = sub.isAdmin
  const feed = useGbpFeed(isAdmin)
  const usMacroArr = useJson<MacroPoint[]>('/api/terminal/macro', 3600_000, isAdmin)
  const ukMacroArr = useJson<MacroPoint[]>('/api/terminal/gbp-macro', 3600_000, isAdmin)
  const cross = useJson<CrossMap>('/api/terminal/crossasset', 45_000, isAdmin)
  const cot = useJson<CotGbp>('/api/terminal/cot-gbp', 6 * 3600_000, isAdmin)

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace('/login?next=%2Fterminal-gbp')
    else if (!sub.loading && sub.userId && !sub.isAdmin) router.replace('/hub')
  }, [sub.loading, sub.userId, sub.isAdmin, router])

  if (sub.loading || !isAdmin) return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>

  const us: Record<string, MacroPoint> = Object.fromEntries((usMacroArr ?? []).map(p => [p.key, p]))
  const uk: Record<string, MacroPoint> = Object.fromEntries((ukMacroArr ?? []).map(p => [p.key, p]))
  const riskOn = cross ? riskOnScore({ spy: cross.SPY ?? null, qqq: cross.QQQ ?? null, vixy: cross.VIXY ?? null, btc: cross['BTC/USD'] ?? null }, usMarketOpen(now)) : 0
  const cotDir = cot ? clamp(cot.funds.net / 60_000, -1, 1) : 0
  const dollarLive = cross?.UUP?.changePct ?? null
  const sc = gbpScores(feed.tf as Partial<Record<TF, TFData>>, us, uk, riskOn, dollarLive, cotDir)
  const conf = feed.tf.M5 && feed.tf.M15 && feed.tf.H1 ? confluence(feed.tf as Record<TF, TFData>) : null

  const t15 = feed.tf.M15
  const regime = t15 ? regimeOf({
    bbSqueeze: t15.boll.squeeze, adx: t15.adx, adxTrend: t15.adxTrend, trendUp: t15.plusDI >= t15.minusDI,
    er: efficiencyRatio(t15.candles.map(c => c.c), 14), diSpread: Math.abs(t15.plusDI - t15.minusDI),
    m5: feed.tf.M5 ? { adx: feed.tf.M5.adx, trendUp: feed.tf.M5.plusDI >= feed.tf.M5.minusDI } : undefined,
    h1: feed.tf.H1 ? { adx: feed.tf.H1.adx, trendUp: feed.tf.H1.plusDI >= feed.tf.H1.minusDI } : undefined,
    prevPhase: regimeRef.current,
  }) : null
  if (regime) regimeRef.current = regime.phase

  const sesi = sessionRows(feed.tf.M15?.candles, now)
  const rateDiff = us.us10y && uk.uk10y ? us.us10y.value - uk.uk10y.value : null
  const q = feed.quote
  const scColor = sc.label === 'BULLISH' ? 'text-emerald-400' : sc.label === 'BEARISH' ? 'text-red-400' : 'text-white/70'

  return (
    <div className="min-h-screen bg-[#060a09] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#060a09]/95 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/hub" className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors shrink-0"><ArrowLeft size={15} /> Hub</Link>
          <span className="w-px h-4 bg-white/10" />
          <span className="flex items-center gap-1.5 text-sm font-bold"><Flag size={14} className="text-primary" /> Terminal GBP/USD <span className="text-[8px] font-bold uppercase rounded-full bg-red-500/15 text-red-400 px-1.5 py-0.5">Admin</span></span>
          <div className="ml-auto flex items-center gap-3">
            {q && <span className={`text-sm font-black tabular-nums ${q.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{f5(q.price)} <span className="text-[10px]">{q.changePct >= 0 ? '+' : ''}{q.changePct.toFixed(2)}%</span></span>}
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-white/40"><Circle size={6} className="fill-primary text-primary" /> {new Date(now).toLocaleTimeString('id-ID')} WIB</span>
          </div>
        </div>
        {/* Tab bar */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto pb-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors ${tab === t.id ? 'bg-primary/15 text-primary' : 'text-white/45 hover:text-white/80 hover:bg-white/5'}`}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        {tab === 'ringkasan' && (
          <>
            {/* Verdict hero */}
            <section className="rounded-2xl border border-white/[0.08] bg-[#0b100e] p-5 grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Bias GBP/USD</p>
                <p className={`text-3xl font-black ${scColor}`}>{sc.label === 'BULLISH' ? '↗ Bullish' : sc.label === 'BEARISH' ? '↘ Bearish' : '→ Netral'}</p>
                <p className="text-[11px] text-white/45 mt-1.5">Confidence <b className="text-white/80">{sc.confidence}%</b> · skor {Math.round(sc.overall)}</p>
              </div>
              <div className="md:col-span-2 md:border-l md:border-white/[0.06] md:pl-5">
                <PillarRow label="Makro (AS vs UK)" score={sc.macro} desc="Dolar & yield AS melawan yield/rate/CPI Inggris" />
                <PillarRow label="Teknikal" score={sc.tech} desc="Bias M5 + M15 + H1 candle GBP/USD" />
                <PillarRow label="Sentimen" score={sc.senti} desc="Risk-on/off (GBP = mata uang risiko) + COT GBP" />
              </div>
            </section>

            {/* Regime + rate differential */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Panel title="Regime Pasar" icon={Signal} info="Mesin sama dgn terminal emas (skor kekuatan tren M15 + histeresis + konteks M5/H1).">
                {regime ? <><p className={`text-lg font-black ${regime.c}`}>{regime.label}</p><p className="text-[11px] text-white/50 mt-1">{regime.desc}</p></> : <p className="text-white/30 text-sm">Memuat…</p>}
              </Panel>
              <Panel title="Selisih Yield AS − UK" icon={GitBranch} info="US10Y − UK10Y Gilt. Melebar (AS makin unggul) → dukung USD → tekan GBP/USD; menyempit → dukung GBP.">
                {rateDiff != null ? (
                  <>
                    <p className="text-lg font-black tabular-nums">{rateDiff >= 0 ? '+' : ''}{rateDiff.toFixed(2)}%</p>
                    <p className="text-[11px] text-white/50 mt-1">{rateDiff > 0 ? 'Yield AS lebih tinggi — dolar unggul secara imbal hasil.' : 'Yield UK lebih tinggi — sterling unggul secara imbal hasil.'}</p>
                  </>
                ) : <p className="text-white/30 text-sm">Memuat…</p>}
              </Panel>
            </div>

            {/* Chart */}
            <Panel title="Chart GBP/USD" icon={Activity} right={<span className="text-[9px] text-white/30">TradingView · OANDA</span>}>
              <TradingViewChart symbol="OANDA:GBPUSD" interval="15" chartStyle="2" minimal height={380} />
            </Panel>

            {/* Sesi */}
            <Panel title="Arah & Ringkasan per Sesi" icon={Clock} info="Jam WIB: Asia 06-14, London 14-19, NY 19-23. Arah tampil setelah sesi selesai. 1 pip = 0.0001." right={<span className="text-[10px] text-white/35">reset harian · WIB</span>}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {sesi.map(s => {
                  const live = s.status === 'berlangsung'
                  const verdict = live ? null : s.arah
                  const clr = verdict === 'Bullish' ? 'text-emerald-400' : verdict === 'Bearish' ? 'text-red-400' : 'text-white/60'
                  return (
                    <div key={s.name} className={`rounded-xl border p-3 ${s.status === 'belum' ? 'border-white/[0.07] opacity-60' : live ? 'border-primary/20 bg-primary/[0.04]' : 'border-white/10 bg-white/[0.02]'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-bold">{s.name}</p>
                        <span className={`text-[9px] font-bold uppercase rounded-full px-2 py-0.5 ${live ? 'bg-primary/15 text-primary' : 'bg-white/10 text-white/50'}`}>{live ? '● Berjalan' : s.status === 'selesai' ? 'Selesai' : 'Belum'}</span>
                      </div>
                      {s.arah ? (
                        <>
                          {verdict ? <p className={`text-sm font-black ${clr}`}>{verdict}</p> : <p className="text-[12px] font-bold text-primary">Sesi masih berjalan</p>}
                          <p className="text-[10px] text-white/45 mt-1 tabular-nums">{f5(s.open)} → {f5(s.close)} · {s.rangePips} pips</p>
                        </>
                      ) : <p className="text-[11px] text-white/30">{s.status === 'belum' ? 'Menunggu…' : 'Belum ada data'}</p>}
                    </div>
                  )
                })}
              </div>
            </Panel>

            {/* Konfluensi MTF */}
            {conf && (
              <Panel title="Konfluensi Timeframe" icon={Gauge} info="Kesepakatan bias M5/M15/H1.">
                <div className="flex items-center gap-3">
                  <p className={`text-lg font-black ${conf.label === 'BULLISH' ? 'text-emerald-400' : conf.label === 'BEARISH' ? 'text-red-400' : 'text-white/60'}`}>{conf.label}</p>
                  <span className="text-[11px] text-white/45">{conf.bulls} bull / {conf.bears} bear · {conf.strength}</span>
                </div>
              </Panel>
            )}
          </>
        )}

        {tab === 'teknikal' && (
          <>
            <Panel title="Matriks Teknikal per Timeframe" icon={Activity} info="Semua indikator dihitung dari candle GBP/USD tertutup (anti-repaint), mesin sama dgn terminal emas.">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead><tr className="text-[10px] text-white/40 border-b border-white/[0.06]">
                    <th className="text-left py-2 pr-3">TF</th><th className="text-left pr-3">Bias</th><th className="text-right pr-3">RSI</th><th className="text-right pr-3">ADX</th><th className="text-right pr-3">MACD hist</th><th className="text-right pr-3">%B</th><th className="text-left pr-3">Struktur</th><th className="text-right">Momentum</th>
                  </tr></thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {([...TFS, ...HTFS] as (TF | HTF)[]).map(t => {
                      const d = feed.tf[t]
                      if (!d) return <tr key={t}><td className="py-2 pr-3 font-bold">{t}</td><td colSpan={7} className="text-white/30">memuat…</td></tr>
                      const bc = d.bias.label === 'BULLISH' ? 'text-emerald-400' : d.bias.label === 'BEARISH' ? 'text-red-400' : 'text-white/50'
                      return (
                        <tr key={t}>
                          <td className="py-2 pr-3 font-bold">{t}</td>
                          <td className={`pr-3 font-bold ${bc}`}>{d.bias.label}</td>
                          <td className="text-right pr-3 tabular-nums">{d.rsi.toFixed(0)}</td>
                          <td className="text-right pr-3 tabular-nums">{d.adx.toFixed(0)} <span className="text-[9px] text-white/35">{adxLabel(d.adx)}</span></td>
                          <td className={`text-right pr-3 tabular-nums ${d.macd.hist >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{d.macd.hist.toFixed(5)}</td>
                          <td className="text-right pr-3 tabular-nums">{(d.boll.pctB * 100).toFixed(0)}%</td>
                          <td className="pr-3">{d.structure.label}</td>
                          <td className={`text-right tabular-nums font-bold ${d.momentum >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{d.momentum >= 0 ? '+' : ''}{Math.round(d.momentum)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
            {feed.tf.M15?.reversal && feed.tf.M15.reversal.skor > 0 && (
              <Panel title="Sinyal Pembalikan (M15)" icon={TrendingUp} info="Cross EMA/DI/MACD & perubahan struktur yang baru terjadi.">
                <p className={`text-sm font-bold ${feed.tf.M15.reversal.arah === 'bullish' ? 'text-emerald-400' : feed.tf.M15.reversal.arah === 'bearish' ? 'text-red-400' : 'text-white/60'}`}>{feed.tf.M15.reversal.arah} · skor {feed.tf.M15.reversal.skor}/4</p>
                <ul className="mt-2 space-y-1">{feed.tf.M15.reversal.sinyal.map(s => <li key={s} className="text-[11px] text-white/55">• {s}</li>)}</ul>
              </Panel>
            )}
            <Panel title="Chart" icon={Activity}><TradingViewChart symbol="OANDA:GBPUSD" interval="15" chartStyle="1" height={420} /></Panel>
          </>
        )}

        {tab === 'makro' && (
          <>
            <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent p-4">
              <p className="text-[13px] text-white/60 leading-relaxed">GBP/USD adalah <b className="text-white/85">pertarungan dua ekonomi</b>: kebijakan The Fed (dolar) vs Bank of England (sterling). Yield & inflasi AS naik → dolar unggul → GBP/USD tertekan; yield/rate/CPI Inggris naik → BoE hawkish → GBP/USD terdorong.</p>
            </section>
            <div className="grid md:grid-cols-2 gap-4">
              <Panel title="Sisi AS (tekan GBP bila menguat)" icon={Landmark} right={<span className="text-[9px] text-white/30">FRED · cache bersama emas</span>}>
                {usMacroArr ? ['dollar', 'us10y', 'us02y', 'cpi', 'fedfunds', 'nfp'].map(k => <MacroRow key={k} p={us[k]} corr={-1} />) : <p className="text-white/30 text-sm py-3">Memuat…</p>}
              </Panel>
              <Panel title="Sisi Inggris (dukung GBP bila menguat)" icon={Flag} right={<span className="text-[9px] text-white/30">FRED · UK</span>}>
                {ukMacroArr ? ['uk10y', 'sonia', 'ukcpi', 'ukunrate'].map(k => <MacroRow key={k} p={uk[k]} corr={k === 'ukunrate' ? -1 : 1} />) : <p className="text-white/30 text-sm py-3">Memuat…</p>}
              </Panel>
            </div>
            <Panel title="Selisih Yield 10Y (AS − UK)" icon={GitBranch}>
              {rateDiff != null ? (
                <div className="flex items-center gap-4">
                  <p className="text-2xl font-black tabular-nums">{rateDiff >= 0 ? '+' : ''}{rateDiff.toFixed(2)}%</p>
                  <p className="text-[12px] text-white/55 leading-relaxed flex-1">{rateDiff > 0.5 ? 'Selisih lebar ke AS — tekanan struktural pada GBP/USD.' : rateDiff < -0.2 ? 'UK unggul — dukungan struktural untuk GBP/USD.' : 'Selisih tipis — makro netral, teknikal lebih menentukan.'}</p>
                </div>
              ) : <p className="text-white/30 text-sm">Memuat…</p>}
            </Panel>
          </>
        )}

        {tab === 'sentimen' && (
          <>
            <Panel title="Selera Risiko Pasar" icon={Scale} info="GBP mata uang risiko: risk-on (saham naik, VIX turun) → dukung GBP; risk-off → dukung USD (safe haven).">
              <p className={`text-lg font-black ${riskOn > 0.1 ? 'text-emerald-400' : riskOn < -0.1 ? 'text-red-400' : 'text-white/70'}`}>{riskOn > 0.1 ? 'Risk-On — dukung GBP' : riskOn < -0.1 ? 'Risk-Off — dukung USD' : 'Netral'}</p>
              <div className="grid grid-cols-4 gap-1.5 mt-3">
                {([['S&P', 'SPY'], ['Nasdaq', 'QQQ'], ['VIX', 'VIXY'], ['BTC', 'BTC/USD']] as const).map(([l, k]) => {
                  const c = cross?.[k]
                  return <div key={k} className="rounded-lg bg-white/[0.03] py-1.5 text-center"><p className="text-[8px] text-white/35">{l}</p><p className={`text-[11px] font-bold tabular-nums ${c ? (c.changePct >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-white/30'}`}>{c ? `${c.changePct >= 0 ? '+' : ''}${c.changePct.toFixed(1)}%` : '—'}</p></div>
                })}
              </div>
              <p className="text-[10px] text-white/35 mt-2">Data lintas-aset dipakai bersama terminal emas (cache sama — tanpa beban API tambahan).</p>
            </Panel>
            <Panel title="COT — British Pound Futures" icon={Users} right={cot ? <span className="text-[9px] text-white/30">{cot.date} · CFTC</span> : null} info="Posisi futures GBP di CME (kode 096742). Funds net long = institusi bullish sterling.">
              {cot ? (
                <div className="space-y-2.5">
                  {([['Funds (Institusi)', cot.funds], ['Commercials (Hedger)', cot.commercials], ['Retail', cot.retail]] as const).map(([l, g]) => {
                    const total = g.long + g.short || 1
                    return (
                      <div key={l}>
                        <div className="flex justify-between text-[11px] mb-1"><span className="text-white/70">{l}</span><span className={`font-bold ${g.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{g.net >= 0 ? 'Net Long' : 'Net Short'} {(g.net / 1000).toFixed(1)}K <span className="text-[9px] opacity-70">Δ{(g.deltaNet / 1000).toFixed(1)}K</span></span></div>
                        <div className="h-2 rounded-full overflow-hidden bg-red-500/40 flex"><div className="bg-emerald-500/70 h-full" style={{ width: `${(g.long / total) * 100}%` }} /></div>
                      </div>
                    )
                  })}
                  <p className="text-[10px] text-white/40 pt-1">{cot.funds.net >= 0 ? 'Institusi net long sterling — sentimen posisi mendukung GBP/USD.' : 'Institusi net short sterling — sentimen posisi menekan GBP/USD.'} Mingguan (lagging) — konteks, bukan sinyal entry.</p>
                </div>
              ) : <p className="text-white/30 text-sm py-3">Memuat COT…</p>}
            </Panel>
          </>
        )}

        {tab === 'panduan' && (
          <div className="space-y-3 max-w-3xl">
            {[
              { t: 'Apa bedanya dengan terminal emas?', d: 'Mesin teknikal (EMA, RSI, ADX, MACD, regime, sesi) sama persis. Yang beda: kerangka makro & sentimen. Emas = aset safe-haven (real yield & ketakutan pasar). GBP/USD = duel dua mata uang — selisih yield AS vs UK, kebijakan Fed vs BoE, dan GBP diuntungkan saat pasar risk-on (kebalikan emas).' },
              { t: 'Pilar Makro (AS vs UK)', d: 'Dolar broad & yield AS naik → GBP/USD tertekan. Yield gilt UK, SONIA (suku bunga BoE) & CPI Inggris naik → BoE hawkish → GBP/USD terdorong. Selisih US10Y − UK10Y adalah jangkar strukturalnya.' },
              { t: 'Pilar Sentimen', d: 'GBP adalah mata uang risiko: saham reli & VIX kalem (risk-on) → dana keluar dari dolar → GBP menguat. Ditambah posisi COT British Pound futures (institusi net long/short sterling).' },
              { t: 'Pip & sesi', d: '1 pip GBP/USD = 0.0001. Sesi paling aktif untuk cable: London (14:00–19:00 WIB) & overlap London×NY (19:00–21:00 WIB). Rilis data UK biasanya ~13:00–16:00 WIB.' },
              { t: 'Performa & terminal emas', d: 'Modul ini terpisah penuh: data lintas-aset & makro AS dibaca dari cache yang sama (tanpa panggilan API tambahan), dan jalur baru (quote/candle GBP, makro UK, COT GBP) punya cache sendiri. Logika emas tidak disentuh sama sekali.' },
            ].map(x => (
              <details key={x.t} className="group rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none text-[13px] font-bold"><span className="flex items-center gap-2"><Info size={14} className="text-primary" /> {x.t}</span><Minus size={14} className="text-white/30 group-open:rotate-90 transition-transform" /></summary>
                <p className="px-4 pb-4 text-[13px] text-white/60 leading-relaxed">{x.d}</p>
              </details>
            ))}
            <p className="text-[10px] text-white/30 flex items-center gap-1.5 pt-1"><ShieldCheck size={11} /> Modul eksperimental khusus admin — bukan nasihat keuangan.</p>
          </div>
        )}

        <p className="text-[9px] text-white/25 text-center pt-2 flex items-center justify-center gap-1"><TrendingDown size={9} /> Data: Twelve Data · FRED (AS + UK) · CFTC · candle terakhir {feed.candlesAt ? new Date(feed.candlesAt).toLocaleTimeString('id-ID') : '—'}</p>
      </main>
    </div>
  )
}
