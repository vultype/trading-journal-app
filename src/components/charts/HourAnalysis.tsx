'use client'

import { useMemo, useState } from 'react'
import { Clock, TrendingUp, TrendingDown, Sparkles, AlertTriangle, Lightbulb, Target, ShieldAlert } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid, LabelList,
} from 'recharts'
import type { Trade } from '@/types'

// Ambang jumlah trade minimal agar sebuah jam/sesi dianggap "cukup signifikan"
// untuk disimpulkan — mencegah over-reading sampel kecil (1-2 trade).
const MIN_SAMPLE = 5

type HourBucket = {
  hour: number
  total: number
  wins: number
  losses: number
  pnl: number
  winRate: number
  avg: number          // expectancy: P&L rata-rata per trade
  avgWin: number
  avgLoss: number
  payoff: number       // avgWin / avgLoss (payoff ratio)
  planRate: number     // % ikut plan
  overtradeRate: number
  significant: boolean
  trades: Trade[]
}

type Session = { key: string; label: string; emoji: string; test: (h: number) => boolean }
// Sesi market dalam WIB (UTC+7). Selaras dengan tag di list trades.
const SESSIONS: Session[] = [
  { key: 'asia',    label: 'Asia (Tokyo)',   emoji: '🌏', test: h => h >= 5 && h < 15 },
  { key: 'london',  label: 'London',         emoji: '🇬🇧', test: h => h >= 15 && h < 20 },
  { key: 'overlap', label: 'Overlap LDN–NY', emoji: '🔥', test: h => h >= 20 && h < 24 },
  { key: 'ny',      label: 'New York (dini)', emoji: '🗽', test: h => h >= 0 && h < 5 },
]

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)

export function HourAnalysis({ trades, fmt }: { trades: Trade[]; fmt: (n: number) => string }) {
  const [selected, setSelected] = useState<number | null>(null)

  const withTime = useMemo(() => trades.filter(t => t.entry_time && /^\d{1,2}:/.test(t.entry_time)), [trades])

  const buckets = useMemo<HourBucket[]>(() => {
    const map: Record<number, Trade[]> = {}
    for (let h = 0; h < 24; h++) map[h] = []
    for (const t of withTime) {
      const h = parseInt(t.entry_time!.slice(0, 2))
      if (isNaN(h) || h < 0 || h > 23) continue
      map[h].push(t)
    }
    return Object.entries(map).map(([h, ts]) => {
      const hour = Number(h)
      const total = ts.length
      const wins = ts.filter(t => t.result === 'win').length
      const losses = ts.filter(t => t.result === 'loss').length
      const pnl = ts.reduce((n, t) => n + t.pnl, 0)
      const avgWin = mean(ts.filter(t => t.pnl > 0).map(t => t.pnl))
      const avgLoss = mean(ts.filter(t => t.pnl < 0).map(t => Math.abs(t.pnl)))
      return {
        hour, total, wins, losses, pnl,
        winRate: total ? Math.round(wins / total * 100) : 0,
        avg: total ? pnl / total : 0,
        avgWin, avgLoss,
        payoff: avgLoss ? avgWin / avgLoss : (avgWin ? Infinity : 0),
        planRate: total ? Math.round(ts.filter(t => t.followed_plan === true).length / total * 100) : 0,
        overtradeRate: total ? Math.round(ts.filter(t => t.is_overtrade).length / total * 100) : 0,
        significant: total >= MIN_SAMPLE,
        trades: ts,
      }
    })
  }, [withTime])

  const active = buckets.filter(b => b.total > 0)
  const maxAbsPnl = Math.max(1, ...active.map(b => Math.abs(b.pnl)))

  // Best/worst dipilih berdasarkan EXPECTANSI (P&L/trade) di antara jam yang sampelnya cukup.
  const sigPool = active.filter(b => b.significant)
  const pool = sigPool.length ? sigPool : active
  const bestHour  = pool.length ? pool.reduce((a, b) => b.avg > a.avg ? b : a) : null
  const worstHour = pool.length ? pool.reduce((a, b) => b.avg < a.avg ? b : a) : null

  const sessionStats = useMemo(() => SESSIONS.map(s => {
    const bs = buckets.filter(b => s.test(b.hour))
    const total = bs.reduce((n, b) => n + b.total, 0)
    const wins  = bs.reduce((n, b) => n + b.wins, 0)
    const pnl   = bs.reduce((n, b) => n + b.pnl, 0)
    return { ...s, total, wins, pnl, winRate: total > 0 ? Math.round(wins / total * 100) : 0, avg: total ? pnl / total : 0 }
  }), [buckets])

  const bestSession = sessionStats.filter(s => s.total > 0).sort((a, b) => b.avg - a.avg)[0] ?? null

  if (withTime.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
        <Clock size={28} className="opacity-40" />
        <p className="text-sm font-medium">Belum ada data jam</p>
        <p className="text-xs">Isi kolom <strong>Jam entry</strong> saat mencatat trade untuk melihat analisa jam terbaik.</p>
      </div>
    )
  }

  const sel = selected !== null ? buckets[selected] : null
  const hhmm = (h: number) => `${String(h).padStart(2, '0')}:00`
  const pf = (n: number) => (n >= 0 ? '+' : '') + fmt(n)
  const payoffStr = (p: number) => p === Infinity ? '∞' : p.toFixed(2)

  function cellColor(b: HourBucket) {
    if (b.total === 0) return 'bg-muted/20 border-transparent text-muted-foreground/30'
    const intensity = Math.min(1, Math.abs(b.pnl) / maxAbsPnl)
    const strong = intensity > 0.5
    if (b.pnl > 0) return strong ? 'bg-emerald-500/30 border-emerald-500/40 text-emerald-300' : 'bg-emerald-500/12 border-emerald-500/25 text-emerald-400'
    if (b.pnl < 0) return strong ? 'bg-red-500/30 border-red-500/40 text-red-300' : 'bg-red-500/12 border-red-500/25 text-red-400'
    return 'bg-yellow-500/12 border-yellow-500/25 text-yellow-400'
  }

  const chartData = active.slice().sort((a, b) => a.hour - b.hour).map(b => ({
    jam: hhmm(b.hour).slice(0, 2), hour: b.hour, pnl: Math.round(b.pnl), wr: b.winRate,
    avg: b.avg, total: b.total, wins: b.wins, losses: b.losses, significant: b.significant,
  }))
  // Headroom domain agar bar (& label) tidak menabrak sumbu/label
  const pnlVals = chartData.map(d => d.pnl)
  const pMax = Math.max(0, ...pnlVals), pMin = Math.min(0, ...pnlVals)
  const pPad = Math.max(20, (pMax - pMin) * 0.2)
  const pnlDomain: [number, number] = [Math.floor(pMin - pPad), Math.ceil(pMax + pPad)]

  // Tooltip kaya untuk kedua chart
  const HourTip = ({ active: on, payload }: { active?: boolean; payload?: { payload: typeof chartData[number] }[] }) => {
    if (!on || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="rounded-lg border border-border/60 bg-[rgba(15,20,30,0.97)] px-3 py-2 text-xs shadow-xl">
        <p className="font-bold mb-1 text-foreground">Jam {hhmm(d.hour)}–{hhmm((d.hour + 1) % 24)} WIB {!d.significant && <span className="text-[9px] font-medium text-amber-400">· sampel kecil</span>}</p>
        <div className="space-y-0.5 text-muted-foreground">
          <p>Trade: <span className="text-foreground font-semibold">{d.total}</span> · Win Rate: <span className={`font-semibold ${d.wr >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{d.wr}%</span></p>
          <p>P&L total: <span className={`font-semibold ${d.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pf(d.pnl)}</span></p>
          <p>Rata²/trade: <span className={`font-semibold ${d.avg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pf(d.avg)}</span></p>
        </div>
      </div>
    )
  }

  const sampleTag = (b: HourBucket) => b.significant
    ? <span className="text-[9px] font-semibold text-emerald-400/70">n={b.total} cukup</span>
    : <span className="text-[9px] font-semibold text-amber-400/80">n={b.total} tipis</span>

  return (
    <div className="space-y-5">
      {/* Highlight cards — kini pakai expectancy + sample size */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {bestHour && bestHour.avg > 0 && (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5"><Sparkles size={13} className="text-emerald-400" /><p className="text-[10px] uppercase tracking-widest font-bold text-emerald-400/70">Jam Paling Cuan</p></span>
              {sampleTag(bestHour)}
            </div>
            <p className="text-2xl font-black text-emerald-400">{hhmm(bestHour.hour)}</p>
            <p className="text-xs text-muted-foreground mt-0.5"><span className="text-emerald-400 font-semibold">{pf(bestHour.avg)}/trade</span> · {bestHour.winRate}% WR · {bestHour.total}x</p>
          </div>
        )}
        {worstHour && worstHour.avg < 0 && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5"><AlertTriangle size={13} className="text-red-400" /><p className="text-[10px] uppercase tracking-widest font-bold text-red-400/70">Jam Paling Rugi</p></span>
              {sampleTag(worstHour)}
            </div>
            <p className="text-2xl font-black text-red-400">{hhmm(worstHour.hour)}</p>
            <p className="text-xs text-muted-foreground mt-0.5"><span className="text-red-400 font-semibold">{pf(worstHour.avg)}/trade</span> · {worstHour.winRate}% WR · {worstHour.total}x</p>
          </div>
        )}
        {bestSession && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5"><Clock size={13} className="text-primary" /><p className="text-[10px] uppercase tracking-widest font-bold text-primary/70">Sesi Terbaik</p></span>
              <span className="text-[9px] font-semibold text-muted-foreground">n={bestSession.total}</span>
            </div>
            <p className="text-2xl font-black">{bestSession.emoji} {bestSession.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5"><span className={bestSession.avg >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>{pf(bestSession.avg)}/trade</span> · {bestSession.winRate}% WR</p>
          </div>
        )}
      </div>

      {/* Rekomendasi tajam */}
      {(() => {
        const focus = sigPool.filter(b => b.avg > 0).sort((a, b) => b.avg - a.avg).slice(0, 3)
        const avoid = sigPool.filter(b => b.avg < 0).sort((a, b) => a.avg - b.avg).slice(0, 2)
        const thin = active.length > 0 && sigPool.length === 0
        return (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-primary/70 mb-2 flex items-center gap-1.5"><Target size={12} /> Rekomendasi Jam (berbasis expectancy & sampel ≥{MIN_SAMPLE})</p>
            {thin ? (
              <p className="text-sm text-foreground/80">Belum ada jam dengan sampel cukup (≥{MIN_SAMPLE} trade). Angka di bawah masih indikatif — kumpulkan lebih banyak trade agar kesimpulan kuat.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {focus.length > 0 && (
                  <p className="flex gap-2"><span className="text-emerald-400 shrink-0 font-bold">✓ Fokus</span>
                    <span className="text-foreground/85">{focus.map(b => `${hhmm(b.hour)} (${pf(b.avg)}/trade, ${b.winRate}% WR, n=${b.total})`).join(' · ')}</span></p>
                )}
                {avoid.length > 0 && (
                  <p className="flex gap-2"><span className="text-red-400 shrink-0 font-bold">✕ Hindari</span>
                    <span className="text-foreground/85">{avoid.map(b => `${hhmm(b.hour)} (${pf(b.avg)}/trade, ${b.winRate}% WR, n=${b.total})`).join(' · ')}</span></p>
                )}
                {focus.length === 0 && avoid.length === 0 && <p className="text-foreground/70">Belum ada jam signifikan yang menonjol cuan/rugi.</p>}
              </div>
            )}
          </div>
        )
      })()}

      {/* Hour heat grid */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Klik jam untuk detail — warna = besarnya P&L (WIB)</p>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
          {buckets.map(b => (
            <button
              key={b.hour}
              type="button"
              disabled={b.total === 0}
              onClick={() => setSelected(selected === b.hour ? null : b.hour)}
              className={[
                'aspect-square rounded-lg border flex flex-col items-center justify-center transition-all relative',
                cellColor(b),
                b.total > 0 ? 'cursor-pointer hover:scale-105' : 'cursor-default',
                selected === b.hour ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : '',
              ].join(' ')}
              title={`${hhmm(b.hour)} — ${b.total} trade`}
            >
              <span className="text-[10px] font-bold leading-none">{String(b.hour).padStart(2, '0')}</span>
              {b.total > 0 && <span className="text-[8px] opacity-70 leading-none mt-0.5">{b.total}x</span>}
              {b.total > 0 && !b.significant && <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-amber-400/70" />}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5">Titik amber = sampel masih tipis (&lt;{MIN_SAMPLE} trade).</p>
      </div>

      {/* Selected hour detail — kini dengan expectancy, payoff, perilaku */}
      {sel && sel.total > 0 && (
        <div className="rounded-xl border border-border/50 bg-muted/15 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm flex items-center gap-2"><Clock size={14} className="text-primary" /> Jam {hhmm(sel.hour)} – {hhmm((sel.hour + 1) % 24)} WIB {!sel.significant && <span className="text-[10px] font-medium text-amber-400">· sampel kecil</span>}</p>
            <span className={`text-lg font-black ${sel.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pf(sel.pnl)}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {[
              { l: 'Trade', v: String(sel.total) },
              { l: 'Win Rate', v: `${sel.winRate}%`, c: sel.winRate >= 50 ? 'text-emerald-400' : 'text-red-400' },
              { l: 'P&L / trade', v: pf(sel.avg), c: sel.avg >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { l: 'Payoff', v: payoffStr(sel.payoff), c: sel.payoff >= 1 ? 'text-emerald-400' : 'text-red-400' },
            ].map(s => (
              <div key={s.l} className="rounded-lg bg-background/50 py-2">
                <p className={`text-lg font-black ${s.c ?? ''}`}>{s.v}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.l}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
            <div className="rounded-lg bg-background/40 py-1.5"><p className="font-bold text-emerald-400/90">{fmt(sel.avgWin)}</p><p className="text-[9px] text-muted-foreground">rata² win</p></div>
            <div className="rounded-lg bg-background/40 py-1.5"><p className="font-bold text-red-400/90">{fmt(sel.avgLoss)}</p><p className="text-[9px] text-muted-foreground">rata² loss</p></div>
            <div className="rounded-lg bg-background/40 py-1.5"><p className={`font-bold ${sel.planRate >= 50 ? 'text-emerald-400/90' : 'text-amber-400/90'}`}>{sel.planRate}%</p><p className="text-[9px] text-muted-foreground">ikut plan</p></div>
            <div className="rounded-lg bg-background/40 py-1.5"><p className={`font-bold ${sel.overtradeRate > 30 ? 'text-red-400/90' : 'text-muted-foreground'}`}>{sel.overtradeRate}%</p><p className="text-[9px] text-muted-foreground">overtrade</p></div>
          </div>
          {sel.overtradeRate > 30 && <p className="text-[11px] text-red-400/80 flex items-center gap-1.5"><ShieldAlert size={12} /> {sel.overtradeRate}% trade jam ini overtrade — waspadai disiplin di jam ini.</p>}
          <div className="flex flex-wrap gap-1.5">
            {sel.trades.map(t => (
              <span key={t.id} className={`text-[10px] px-2 py-1 rounded-full border font-medium ${t.pnl >= 0 ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-red-500/30 text-red-400 bg-red-500/5'}`}>
                {t.direction === 'long' ? '↑' : '↓'} {t.pair} {pf(t.pnl)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CHART 1 — P&L per jam (satu sumbu, diverging hijau/merah) */}
      <div>
        <p className="text-xs font-semibold text-foreground/80 mb-0.5">P&L Total per Jam</p>
        <p className="text-[10px] text-muted-foreground mb-2">Hijau = profit, merah = loss. Hover untuk detail.</p>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={chartData} margin={{ top: 18, right: 10, bottom: 18, left: 6 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.35} />
            <XAxis dataKey="jam" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false}
              label={{ value: 'Jam (WIB)', position: 'insideBottom', offset: -8, fontSize: 10, fill: 'var(--muted-foreground)' }} />
            <YAxis domain={pnlDomain} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={54} tickFormatter={v => fmt(v)} />
            <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
            <Tooltip content={<HourTip />} cursor={{ fill: 'var(--muted)', fillOpacity: 0.15 }} />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={44}>
              {chartData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={d.significant ? 0.9 : 0.45} />)}
              <LabelList dataKey="pnl" position="top" fontSize={9} fill="var(--muted-foreground)" formatter={(v) => { const n = Number(v); return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}` }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* CHART 2 — Win Rate per jam (satu sumbu, garis acuan 50%) */}
      <div>
        <p className="text-xs font-semibold text-foreground/80 mb-0.5">Win Rate per Jam</p>
        <p className="text-[10px] text-muted-foreground mb-2">Garis putus-putus = 50%. Bar pudar = sampel tipis.</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 18, right: 10, bottom: 18, left: 6 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.35} />
            <XAxis dataKey="jam" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false}
              label={{ value: 'Jam (WIB)', position: 'insideBottom', offset: -8, fontSize: 10, fill: 'var(--muted-foreground)' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={38} tickFormatter={v => `${v}%`} />
            <ReferenceLine y={50} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.6} />
            <Tooltip content={<HourTip />} cursor={{ fill: 'var(--muted)', fillOpacity: 0.15 }} />
            <Bar dataKey="wr" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={44}>
              {chartData.map((d, i) => <Cell key={i} fill={d.wr >= 50 ? '#10b981' : '#f59e0b'} fillOpacity={d.significant ? 0.9 : 0.45} />)}
              <LabelList dataKey="wr" position="top" fontSize={9} fill="var(--muted-foreground)" formatter={(v) => `${Number(v)}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Session breakdown bars — expectancy + WIB */}
      <div>
        <p className="text-xs font-semibold text-foreground/80 mb-2">Performa per Sesi Market (WIB)</p>
        <div className="space-y-2">
          {sessionStats.filter(s => s.total > 0).map(s => (
            <div key={s.key} className="flex items-center gap-3">
              <span className="w-28 text-xs font-medium shrink-0">{s.emoji} {s.label}</span>
              <div className="flex-1 h-6 rounded-md bg-muted/30 overflow-hidden relative">
                <div className={`h-full ${s.pnl >= 0 ? 'bg-emerald-500/40' : 'bg-red-500/40'} transition-all`}
                  style={{ width: `${Math.min(100, Math.abs(s.pnl) / maxAbsPnl * 50 + s.winRate / 2)}%` }} />
                <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold">{s.winRate}% WR · {s.total}x · {pf(s.avg)}/trade</span>
              </div>
              <span className={`w-24 text-right text-xs font-bold shrink-0 ${s.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pf(s.pnl)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Insight teks — sharper */}
      {(() => {
        const busiest = active.length ? active.reduce((a, b) => b.total > a.total ? b : a) : null
        const worstSession = sessionStats.filter(s => s.total > 0).sort((a, b) => a.avg - b.avg)[0] ?? null
        const items: string[] = []
        if (bestHour && bestHour.avg > 0) items.push(`Jam ${hhmm(bestHour.hour)} expektasi terbaik: ${pf(bestHour.avg)}/trade (${bestHour.winRate}% WR, n=${bestHour.total}${bestHour.significant ? '' : ' — masih tipis'}).`)
        if (worstHour && worstHour.avg < 0) items.push(`Hindari jam ${hhmm(worstHour.hour)}: rata² ${pf(worstHour.avg)}/trade${worstHour.significant ? '' : ' (sampel kecil)'}.`)
        if (busiest && !busiest.significant) items.push(`Jam tersibuk ${hhmm(busiest.hour)} (${busiest.total}x) tapi belum cukup untuk disimpulkan.`)
        else if (busiest) items.push(`Jam tersibuk: ${hhmm(busiest.hour)} (${busiest.total} trade).`)
        if (bestSession) items.push(`Sesi terbaik: ${bestSession.label} — ${pf(bestSession.avg)}/trade, ${bestSession.winRate}% WR.`)
        if (worstSession && worstSession.avg < 0 && worstSession.key !== bestSession?.key) items.push(`Sesi ${worstSession.label} merugi: ${pf(worstSession.avg)}/trade.`)
        const badPlan = active.filter(b => b.significant && b.avg < 0 && b.overtradeRate > 30)
        if (badPlan.length) items.push(`Jam rugi sering diwarnai overtrade: ${badPlan.map(b => hhmm(b.hour)).join(', ')} — disiplin di jam ini.`)
        if (!items.length) return null
        return (
          <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70 mb-2 flex items-center gap-1.5"><Lightbulb size={12} /> Insight Jam Trading</p>
            <ul className="space-y-1.5">
              {items.map((it, i) => (
                <li key={i} className="text-sm text-foreground/85 leading-snug flex gap-2"><span className="text-primary shrink-0">•</span>{it}</li>
              ))}
            </ul>
          </div>
        )
      })()}

      <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5 flex-wrap">
        <TrendingUp size={11} className="text-emerald-400/60" /> Hijau = profit
        <TrendingDown size={11} className="text-red-400/60 ml-1" /> Merah = loss ·
        <span className="ml-1">Expectancy = P&L rata² per trade (metrik paling tajam). Berdasarkan {withTime.length} trade ber-jam · sampel signifikan ≥{MIN_SAMPLE}x.</span>
      </p>
    </div>
  )
}
