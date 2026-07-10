'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceLine,
  AreaChart, Area,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Trade, DashboardStats } from '@/types'

const TooltipStyle = {
  backgroundColor: 'var(--popover)', border: '1px solid var(--border)',
  borderRadius: 10, fontSize: 12,
}
const C_WIN = '#10b981', C_LOSS = '#ef4444'

// ── Datalitiq Score (radar + overall) ─────────────────────────────────────────
export function ScoreRadar({ stats, trades, equityBase }: {
  stats: DashboardStats; trades: Trade[]; equityBase: number
}) {
  const { metrics, overall } = useMemo(() => {
    const normal = trades.filter(t => !t.is_overtrade)
    // daily profitable ratio → consistency
    const byDay: Record<string, number> = {}
    for (const t of normal) byDay[t.date] = (byDay[t.date] ?? 0) + t.pnl
    const days = Object.values(byDay)
    const profitableDays = days.filter(d => d > 0).length
    const consistency = days.length > 0 ? (profitableDays / days.length) * 100 : 0

    const pf = stats.profit_factor === Infinity ? 3 : stats.profit_factor
    const wl = stats.avg_loss > 0 ? stats.avg_win / stats.avg_loss : stats.avg_win > 0 ? 3 : 0
    const ddPct = equityBase > 0 ? (stats.max_drawdown / equityBase) * 100 : 0
    const rf = stats.max_drawdown > 0 ? stats.total_pnl / stats.max_drawdown : stats.total_pnl > 0 ? 3 : 0

    const clamp = (n: number) => Math.max(0, Math.min(100, n))
    const metrics = [
      { label: 'Win %',        value: clamp(stats.win_rate) },
      { label: 'Profit Factor', value: clamp(pf / 3 * 100) },
      { label: 'Avg W/L',      value: clamp(wl / 3 * 100) },
      { label: 'Konsistensi',  value: clamp(consistency) },
      { label: 'Recovery',     value: clamp(rf / 3 * 100) },
      { label: 'Drawdown',     value: clamp(100 - ddPct * 2) },
    ]
    const overall = Math.round(metrics.reduce((s, m) => s + m.value, 0) / metrics.length)
    return { metrics, overall }
  }, [stats, trades, equityBase])

  const scoreColor = overall >= 70 ? '#10b981' : overall >= 45 ? '#f59e0b' : '#ef4444'
  const scoreLabel = overall >= 70 ? 'Sangat Baik' : overall >= 45 ? 'Cukup' : 'Perlu Ditingkatkan'

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold">Datalitiq Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative shrink-0">
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="48" fill="none" stroke="var(--muted)" strokeWidth="8" />
              <circle
                cx="55" cy="55" r="48" fill="none" stroke={scoreColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(overall / 100) * 301.6} 301.6`}
                transform="rotate(-90 55 55)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black tracking-tight" style={{ color: scoreColor }}>{overall}</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">/ 100</span>
            </div>
          </div>
          <div className="flex-1 w-full">
            <p className="text-sm font-semibold mb-2" style={{ color: scoreColor }}>{scoreLabel}</p>
            <ResponsiveContainer width="100%" height={160}>
              <RadarChart data={metrics} outerRadius="72%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} />
                <Radar dataKey="value" stroke={scoreColor} fill={scoreColor} fillOpacity={0.25} />
                <Tooltip contentStyle={TooltipStyle} formatter={(v) => [`${Math.round(Number(v))}/100`, 'Skor']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Net Daily P&L (bars) ───────────────────────────────────────────────────────
export function NetDailyPnL({ trades, fmt }: { trades: Trade[]; fmt: (n: number) => string }) {
  const data = useMemo(() => {
    const byDay: Record<string, number> = {}
    for (const t of trades) byDay[t.date] = (byDay[t.date] ?? 0) + t.pnl
    return Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).slice(-30)
      .map(([date, pnl]) => ({ date: date.slice(5), pnl }))
  }, [trades])

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Net P&L Harian</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={48} tickFormatter={v => fmt(v)} />
              <Tooltip contentStyle={TooltipStyle} formatter={v => [fmt(Number(v)), 'P&L']} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {data.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? C_WIN : C_LOSS} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// ── Drawdown (area, negative) ─────────────────────────────────────────────────
export function DrawdownChart({ trades, fmt }: { trades: Trade[]; fmt: (n: number) => string }) {
  const data = useMemo(() => {
    const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))
    let running = 0, peak = 0
    return sorted.map((t, i) => {
      running += t.pnl
      peak = Math.max(peak, running)
      return { i, date: t.date.slice(5), dd: running - peak }
    })
  }, [trades])

  const maxDD = Math.min(0, ...data.map(d => d.dd))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span>Drawdown</span>
          <span className="text-xs font-normal text-red-400">Max: {fmt(maxDD)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length < 2 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum cukup data</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C_LOSS} stopOpacity={0.05} />
                  <stop offset="100%" stopColor={C_LOSS} stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={48} tickFormatter={v => fmt(v)} />
              <Tooltip contentStyle={TooltipStyle} formatter={v => [fmt(Number(v)), 'Drawdown']} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Area type="monotone" dataKey="dd" stroke={C_LOSS} strokeWidth={1.5} fill="url(#ddFill)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
