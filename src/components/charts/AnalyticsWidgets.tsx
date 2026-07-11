'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, Cell,
  ReferenceLine, CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTip } from '@/components/ui/info-tip'
import { Lightbulb, TrendingUp, TrendingDown, Clock, CalendarDays, Coins, ShieldCheck } from 'lucide-react'
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
export function InsightsCard({ trades, stats, fmt }: { trades: Trade[]; stats: DashboardStats; fmt: (n: number) => string }) {
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

    return out.slice(0, 5)
  }, [trades, stats, fmt])

  if (insights.length === 0) return null

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
          {insights.map((ins, i) => (
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
