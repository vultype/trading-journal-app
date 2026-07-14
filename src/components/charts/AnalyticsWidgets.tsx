'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, Cell,
  ReferenceLine, CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { InfoTip } from '@/components/ui/info-tip'
import { Lightbulb, TrendingUp, TrendingDown, Clock, CalendarDays, Coins, ShieldCheck, Target, Flame, AlertTriangle, Sparkles } from 'lucide-react'
import type { Trade, DashboardStats } from '@/types'

const TooltipStyle = {
  backgroundColor: 'rgba(15,20,30,0.97)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, fontSize: 12, color: '#f1f5f9', boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
}
const tipItem = { color: '#f1f5f9', fontWeight: 700 }
const tipLabel = { color: '#94a3b8', fontSize: 11, marginBottom: 2, fontWeight: 600 }
const C_WIN = '#10b981', C_LOSS = '#ef4444', C_BE = '#6366f1'
const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

// ── Trade Time Performance (scatter: jam × P&L) ────────────────────────────────
export function TradeTimeScatter({ trades, fmt }: { trades: Trade[]; fmt: (n: number) => string }) {
  const data = useMemo(() => {
    return trades
      .filter(t => t.entry_time && /^\d{1,2}:/.test(t.entry_time))
      .map(t => {
        const [h, m] = t.entry_time!.split(':').map(Number)
        return { hour: h + (m || 0) / 60, pnl: t.pnl, result: t.result, pair: t.pair }
      })
  }, [trades])

  const color = (r: string) => (r === 'win' ? C_WIN : r === 'loss' ? C_LOSS : C_BE)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          Performa per Waktu <InfoTip text="Setiap titik = 1 trade. Sumbu X = jam entry, sumbu Y = P&L. Hijau = win, merah = loss, biru = breakeven." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Isi jam entry di trade untuk lihat grafik ini.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} />
              <XAxis type="number" dataKey="hour" domain={[0, 24]} ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]}
                tickFormatter={(v) => `${String(v).padStart(2, '0')}:00`} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis type="number" dataKey="pnl" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={52} tickFormatter={v => fmt(v)} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Tooltip contentStyle={TooltipStyle} itemStyle={tipItem} labelStyle={tipLabel} cursor={{ strokeDasharray: '3 3' }}
                formatter={(v: any, n: any) => n === 'pnl' ? [fmt(Number(v)), 'P&L'] : [v, n]}
                labelFormatter={() => ''} />
              <Scatter data={data}>
                {data.map((e, i) => <Cell key={i} fill={color(e.result)} fillOpacity={0.75} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// ── Ringkasan per Hari ─────────────────────────────────────────────────────────
export function DaySummaryTable({ trades, fmt }: { trades: Trade[]; fmt: (n: number) => string }) {
  const rows = useMemo(() => {
    return DAYS_ID.map((name, idx) => {
      const dayTrades = trades.filter(t => new Date(t.date + 'T00:00:00').getDay() === idx)
      const normal = dayTrades.filter(t => !t.is_overtrade)
      const wins = normal.filter(t => t.result === 'win')
      const losses = normal.filter(t => t.result === 'loss')
      const winRate = normal.length > 0 ? (wins.length / normal.length) * 100 : 0
      const net = dayTrades.reduce((s, t) => s + t.pnl, 0)
      const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0
      const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0
      return { name, count: dayTrades.length, winRate, net, avgWin, avgLoss }
    })
  }, [trades])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          Ringkasan per Hari <InfoTip text="Statistik trading dikelompokkan per hari dalam seminggu — untuk tahu hari terbaik & terburuk kamu." />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium">Hari</th>
                <th className="text-right px-3 py-2.5 font-medium">Win %</th>
                <th className="text-right px-3 py-2.5 font-medium">Net P&L</th>
                <th className="text-right px-3 py-2.5 font-medium">Trade</th>
                <th className="text-right px-3 py-2.5 font-medium">Avg Win</th>
                <th className="text-right px-4 py-2.5 font-medium">Avg Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {rows.map(r => (
                <tr key={r.name} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{r.name}</td>
                  <td className="px-3 py-2.5 text-right">{r.count > 0 ? `${r.winRate.toFixed(0)}%` : '—'}</td>
                  <td className={`px-3 py-2.5 text-right font-semibold ${r.net > 0 ? 'text-emerald-400' : r.net < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                    {r.count > 0 ? `${r.net >= 0 ? '+' : ''}${fmt(r.net)}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{r.count}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-400/80">{r.avgWin > 0 ? fmt(r.avgWin) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-red-400/80">{r.avgLoss < 0 ? fmt(r.avgLoss) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Auto Insights ──────────────────────────────────────────────────────────────
export function InsightsCard({ trades, stats, fmt, variant = 'default' }: { trades: Trade[]; stats: DashboardStats; fmt: (n: number) => string; variant?: 'default' | 'hero' }) {
  const insights = useMemo(() => {
    const normal = trades.filter(t => !t.is_overtrade)
    if (normal.length < 3) return []
    const out: { icon: React.ElementType; color: string; text: string }[] = []

    // Best day of week
    const byDay: Record<number, number> = {}
    for (const t of normal) { const d = new Date(t.date + 'T00:00:00').getDay(); byDay[d] = (byDay[d] ?? 0) + t.pnl }
    const dayEntries = Object.entries(byDay)
    if (dayEntries.length) {
      const best = dayEntries.reduce((a, b) => b[1] > a[1] ? b : a)
      const worst = dayEntries.reduce((a, b) => b[1] < a[1] ? b : a)
      if (best[1] > 0) out.push({ icon: CalendarDays, color: 'text-emerald-400', text: `Hari paling profit: ${DAYS_ID[+best[0]]} (${fmt(best[1])}).` })
      if (worst[1] < 0) out.push({ icon: CalendarDays, color: 'text-red-400', text: `Hati-hati hari ${DAYS_ID[+worst[0]]} — sering rugi (${fmt(worst[1])}).` })
    }

    // Best hour
    const byHour: Record<number, number> = {}
    for (const t of normal) { if (t.entry_time) { const h = parseInt(t.entry_time); if (!isNaN(h)) byHour[h] = (byHour[h] ?? 0) + t.pnl } }
    const hourEntries = Object.entries(byHour)
    if (hourEntries.length) {
      const best = hourEntries.reduce((a, b) => b[1] > a[1] ? b : a)
      if (best[1] > 0) out.push({ icon: Clock, color: 'text-primary', text: `Jam terbaik entry: ${String(best[0]).padStart(2, '0')}:00 (${fmt(best[1])}).` })
    }

    // Best / worst pair
    const byPair: Record<string, number> = {}
    for (const t of normal) byPair[t.pair] = (byPair[t.pair] ?? 0) + t.pnl
    const pairEntries = Object.entries(byPair)
    if (pairEntries.length > 1) {
      const best = pairEntries.reduce((a, b) => b[1] > a[1] ? b : a)
      if (best[1] > 0) out.push({ icon: Coins, color: 'text-emerald-400', text: `Pair paling cuan: ${best[0]} (${fmt(best[1])}).` })
    }

    // Discipline
    const plan = normal.filter(t => t.followed_plan === true)
    const noPlan = normal.filter(t => t.followed_plan === false)
    if (plan.length >= 2 && noPlan.length >= 2) {
      const wrPlan = plan.filter(t => t.result === 'win').length / plan.length * 100
      const wrNo = noPlan.filter(t => t.result === 'win').length / noPlan.length * 100
      if (wrPlan > wrNo) out.push({ icon: ShieldCheck, color: 'text-emerald-400', text: `Saat ikut plan, win rate ${(wrPlan - wrNo).toFixed(0)}% lebih tinggi. Tetap disiplin!` })
    }

    // Profit factor note
    if (stats.profit_factor !== Infinity && stats.profit_factor < 1 && normal.length >= 5) {
      out.push({ icon: TrendingDown, color: 'text-red-400', text: `Profit factor ${stats.profit_factor.toFixed(2)} (<1) — evaluasi ukuran loss & strategi.` })
    } else if (stats.profit_factor >= 2) {
      out.push({ icon: TrendingUp, color: 'text-emerald-400', text: `Profit factor ${stats.profit_factor === Infinity ? '∞' : stats.profit_factor.toFixed(2)} — sangat sehat, pertahankan!` })
    }

    // Direction bias (long vs short)
    const longs = normal.filter(t => t.direction === 'long')
    const shorts = normal.filter(t => t.direction === 'short')
    if (longs.length >= 2 && shorts.length >= 2) {
      const wrL = longs.filter(t => t.result === 'win').length / longs.length * 100
      const wrS = shorts.filter(t => t.result === 'win').length / shorts.length * 100
      const better = wrL >= wrS ? 'Long' : 'Short'
      out.push({ icon: better === 'Long' ? TrendingUp : TrendingDown, color: 'text-primary', text: `Kamu lebih jago ${better} — win rate ${Math.round(Math.max(wrL, wrS))}% vs ${Math.round(Math.min(wrL, wrS))}%.` })
    }

    // Best strategy
    const byStrat: Record<string, number> = {}
    for (const t of normal) { if (t.strategy) byStrat[t.strategy] = (byStrat[t.strategy] ?? 0) + t.pnl }
    const stratEntries = Object.entries(byStrat)
    if (stratEntries.length) {
      const best = stratEntries.reduce((a, b) => b[1] > a[1] ? b : a)
      const worst = stratEntries.reduce((a, b) => b[1] < a[1] ? b : a)
      if (best[1] > 0) out.push({ icon: Target, color: 'text-emerald-400', text: `Strategi paling profit: "${best[0]}" (${fmt(best[1])}).` })
      if (worst[1] < 0 && stratEntries.length > 1) out.push({ icon: Target, color: 'text-red-400', text: `Strategi "${worst[0]}" masih minus (${fmt(worst[1])}) — perlu dievaluasi.` })
    }

    // Overtrade impact — framing ikut tanda P&L asli, jangan asumsikan selalu rugi
    const overtrades = trades.filter(t => t.is_overtrade)
    if (overtrades.length) {
      const otPnl = overtrades.reduce((s, t) => s + t.pnl, 0)
      const otText = otPnl < 0
        ? `${overtrades.length} overtrade menggerus equity sebesar ${fmt(otPnl)}. Kurangi trading emosional.`
        : otPnl > 0
          ? `${overtrades.length} overtrade kebetulan profit ${fmt(otPnl)} — tapi tetap di luar rencana. Disiplin plan lebih penting daripada hasil sesaat.`
          : `${overtrades.length} overtrade tercatat (impas). Evaluasi kenapa keluar dari rencana.`
      out.push({ icon: AlertTriangle, color: 'text-orange-400', text: otText })
    }

    // Streaks
    if (stats.current_streak >= 2) {
      out.push({ icon: stats.current_streak_type === 'win' ? Flame : AlertTriangle, color: stats.current_streak_type === 'win' ? 'text-emerald-400' : 'text-red-400',
        text: stats.current_streak_type === 'win' ? `Sedang ${stats.current_streak}x WIN beruntun 🔥 — jaga disiplin.` : `Sedang ${stats.current_streak}x LOSS beruntun ⚠️ — pertimbangkan istirahat.` })
    }
    if (stats.win_streak >= 3) out.push({ icon: Flame, color: 'text-emerald-400', text: `Rekor win streak terbaik: ${stats.win_streak}x berturut-turut.` })

    // Largest win / loss
    const wins2 = normal.filter(t => t.result === 'win')
    const losses2 = normal.filter(t => t.result === 'loss')
    if (wins2.length) out.push({ icon: TrendingUp, color: 'text-emerald-400', text: `Kemenangan terbesar: ${fmt(Math.max(...wins2.map(t => t.pnl)))}.` })
    if (losses2.length) out.push({ icon: TrendingDown, color: 'text-red-400', text: `Kerugian terbesar: ${fmt(Math.min(...losses2.map(t => t.pnl)))} — pastikan risk management ketat.` })

    // Consistency (profitable days)
    const dPnl: Record<string, number> = {}
    for (const t of normal) dPnl[t.date] = (dPnl[t.date] ?? 0) + t.pnl
    const days2 = Object.values(dPnl)
    if (days2.length >= 3) {
      const profDays = days2.filter(d => d > 0).length
      const pct = Math.round(profDays / days2.length * 100)
      out.push({ icon: pct >= 50 ? ShieldCheck : AlertTriangle, color: pct >= 50 ? 'text-emerald-400' : 'text-amber-400', text: `Konsistensi: ${pct}% hari trading kamu profit (${profDays}/${days2.length} hari).` })
    }

    // Avg RR
    if (stats.avg_loss > 0 && stats.avg_win > 0) {
      const rr = stats.avg_win / stats.avg_loss
      out.push({ icon: rr >= 1.5 ? TrendingUp : AlertTriangle, color: rr >= 1.5 ? 'text-emerald-400' : 'text-amber-400', text: `Rata-rata risk:reward ${rr.toFixed(2)} — ${rr >= 1.5 ? 'bagus, reward > risk.' : 'usahakan reward minimal 1.5x risk.'}` })
    }

    // Recent trend (last 10)
    const recent = [...normal].sort((a, b) => a.date.localeCompare(b.date)).slice(-10)
    if (recent.length >= 5) {
      const rPnl = recent.reduce((s, t) => s + t.pnl, 0)
      const rWr = Math.round(recent.filter(t => t.result === 'win').length / recent.length * 100)
      out.push({ icon: rPnl >= 0 ? TrendingUp : TrendingDown, color: rPnl >= 0 ? 'text-emerald-400' : 'text-red-400', text: `10 trade terakhir: ${fmt(rPnl)} (${rWr}% WR) — ${rPnl >= 0 ? 'momentum positif.' : 'sedang kurang bagus, hati-hati.'}` })
    }

    // Expectancy
    if (normal.length >= 5) {
      out.push({ icon: stats.expectancy >= 0 ? TrendingUp : TrendingDown, color: stats.expectancy >= 0 ? 'text-emerald-400' : 'text-red-400', text: `Expectancy ${fmt(stats.expectancy)} per trade — ${stats.expectancy >= 0 ? 'sistem kamu menguntungkan jangka panjang.' : 'sistem masih merugi, perlu perbaikan.'}` })
    }

    return out
  }, [trades, stats, fmt])

  const [open, setOpen] = useState(false)

  if (insights.length === 0) return null
  const top = insights.slice(0, variant === 'hero' ? 6 : 5)

  if (variant === 'hero') {
    return (
      <>
      <div className="relative rounded-3xl overflow-hidden p-[1px] bg-gradient-to-br from-primary/50 via-white/5 to-cyan-500/30">
        <div className="relative rounded-[calc(1.5rem-1px)] bg-[#070c0b] overflow-hidden">
          {/* soft radial glows (clean, no grid) */}
          <div className="absolute -top-28 right-4 w-80 h-80 rounded-full bg-primary/20 blur-[90px]" />
          <div className="absolute -bottom-32 -left-20 w-72 h-72 rounded-full bg-cyan-500/10 blur-[90px]" />

          {/* Round AI button — modern */}
          <button onClick={() => setOpen(true)} title="Lihat semua insight AI"
            className="absolute top-5 right-5 z-10 group w-12 h-12">
            <span className="absolute inset-[-3px] rounded-full dtq-halo" />
            <span className="absolute inset-0 rounded-full bg-primary/50 blur-md dtq-breathe" />
            <span className="relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary via-emerald-400 to-cyan-500 ring-1 ring-white/25 shadow-xl shadow-primary/30 transition-transform duration-300 group-hover:scale-110 group-active:scale-95">
              <Sparkles size={19} className="text-white drop-shadow" />
            </span>
          </button>

          <div className="relative p-7">
            <div className="flex items-center gap-3.5 mb-6 pr-16">
              <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/25 to-cyan-500/15 ring-1 ring-primary/30 shadow-lg shadow-primary/10">
                <Lightbulb size={22} className="text-primary" />
              </span>
              <div>
                <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2.5">
                  Insight by AI
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary px-2 py-0.5 rounded-full bg-primary/10 ring-1 ring-primary/25">Datalitiq AI</span>
                </h3>
                <p className="text-[13px] text-white/40 mt-0.5">Analisa performa trading kamu secara otomatis</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {top.map((ins, i) => (
                <div key={i} className="flex items-start gap-3 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.07] px-4 py-3.5 transition-colors hover:bg-white/[0.05]">
                  <span className={`shrink-0 mt-0.5 ${ins.color}`}><ins.icon size={16} /></span>
                  <p className="text-[13.5px] text-white/85 leading-relaxed">{ins.text}</p>
                </div>
              ))}
            </div>
            {insights.length > top.length && (
              <button onClick={() => setOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:gap-2.5 transition-all">
                <Sparkles size={13} /> Lihat {insights.length - top.length} insight lainnya →
              </button>
            )}
          </div>
        </div>

        <style jsx>{`
          .dtq-halo {
            background: conic-gradient(from 0deg, #10b981, #22d3ee, transparent 55%, #10b981);
            animation: dtq-spin 3.5s linear infinite;
            filter: blur(1px);
          }
          @keyframes dtq-spin { to { transform: rotate(360deg) } }
          .dtq-breathe { animation: dtq-breathe 2.6s ease-in-out infinite; }
          @keyframes dtq-breathe { 0%,100% { opacity: .35; transform: scale(1) } 50% { opacity: .7; transform: scale(1.18) } }
        `}</style>
      </div>

      {/* Dialog with ALL insights */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-cyan-500 shadow-md">
                <Sparkles size={17} className="text-white" />
              </span>
              <div>
                <p className="text-base font-black">Analisa AI Lengkap</p>
                <p className="text-[11px] font-normal text-muted-foreground">{insights.length} temuan dari data trading kamu</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-muted/30 ring-1 ring-border/40 px-3.5 py-3">
                <span className={`shrink-0 mt-0.5 ${ins.color}`}><ins.icon size={16} /></span>
                <p className="text-sm text-foreground/90 leading-snug">{ins.text}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      </>
    )
  }

  return (
    <Card className="h-full relative overflow-hidden bg-gradient-to-br from-primary/8 via-transparent to-transparent">
      <div className="absolute -top-16 -right-12 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
      <CardHeader className="pb-2 relative">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/15 ring-1 ring-primary/25">
            <Lightbulb size={14} className="text-primary" />
          </span>
          Insight Otomatis
          <span className="text-[9px] font-semibold uppercase tracking-widest text-primary/70 px-1.5 py-0.5 rounded bg-primary/10 ring-1 ring-primary/20">AI</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="space-y-2">
          {top.map((ins, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl bg-muted/30 ring-1 ring-border/40 px-3 py-2.5 transition-colors hover:bg-muted/50">
              <span className={`shrink-0 mt-0.5 ${ins.color}`}><ins.icon size={15} /></span>
              <p className="text-sm text-foreground/85 leading-snug">{ins.text}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
