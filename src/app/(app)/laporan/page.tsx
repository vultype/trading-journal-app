'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useCurrency } from '@/hooks/useCurrency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Trophy, Target, BarChart2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'

const DAYS_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

function getWeekRange(offset: number) {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday, sunday }
}

function toStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtWeekLabel(monday: Date, sunday: Date) {
  const sameMonth = monday.getMonth() === sunday.getMonth()
  if (sameMonth) {
    return `${monday.getDate()} – ${sunday.getDate()} ${MONTHS_ID[monday.getMonth()]} ${monday.getFullYear()}`
  }
  return `${monday.getDate()} ${MONTHS_ID[monday.getMonth()]} – ${sunday.getDate()} ${MONTHS_ID[sunday.getMonth()]} ${sunday.getFullYear()}`
}

export default function LaporanPage() {
  const { trades } = useStore()
  const fmt = useCurrency()
  const [weekOffset, setWeekOffset] = useState(0)

  const { monday, sunday } = getWeekRange(weekOffset)
  const mondayStr = toStr(monday)
  const sundayStr = toStr(sunday)

  const weekTrades  = trades.filter(t => t.date >= mondayStr && t.date <= sundayStr)
  const normalWeek  = weekTrades.filter(t => !t.is_overtrade)
  const wins   = normalWeek.filter(t => t.result === 'win').length
  const losses = normalWeek.filter(t => t.result === 'loss').length
  const bes    = normalWeek.filter(t => t.result === 'breakeven').length
  const totalPnl = weekTrades.reduce((s, t) => s + t.pnl, 0)  // all → equity
  const winRate  = normalWeek.length > 0 ? (wins / normalWeek.length * 100) : 0
  const grossWin  = normalWeek.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(normalWeek.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0))
  const pf = grossLoss > 0 ? (grossWin / grossLoss) : grossWin > 0 ? Infinity : 0
  const bestTrade  = normalWeek.length > 0 ? normalWeek.reduce((a, b) => a.pnl > b.pnl ? a : b) : null
  const worstTrade = normalWeek.length > 0 ? normalWeek.reduce((a, b) => a.pnl < b.pnl ? a : b) : null

  // Day-by-day breakdown
  const dayData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const ds = toStr(d)
    const dayTrades = weekTrades.filter(t => t.date === ds)
    const normalDay = dayTrades.filter(t => !t.is_overtrade)
    return {
      label: DAYS_ID[d.getDay()].slice(0, 3),
      date: ds,
      pnl: dayTrades.reduce((s, t) => s + t.pnl, 0),  // all → equity
      count: normalDay.length,
      wins:   normalDay.filter(t => t.result === 'win').length,
      losses: normalDay.filter(t => t.result === 'loss').length,
    }
  })

  // Strategy breakdown
  const stratMap: Record<string, { pnl: number; count: number; wins: number }> = {}
  weekTrades.forEach(t => {
    const s = t.strategy || 'Tanpa Strategi'
    if (!stratMap[s]) stratMap[s] = { pnl: 0, count: 0, wins: 0 }
    stratMap[s].pnl += t.pnl
    stratMap[s].count++
    if (t.result === 'win') stratMap[s].wins++
  })
  const strategies = Object.entries(stratMap).sort((a, b) => b[1].pnl - a[1].pnl)

  const sortedTrades = [...weekTrades].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Laporan Mingguan</h1>
          <p className="text-sm text-muted-foreground">{fmtWeekLabel(monday, sunday)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(o => o - 1)}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
            <ChevronLeft size={16}/>
          </button>
          <button onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">
            Minggu ini
          </button>
          <button onClick={() => setWeekOffset(o => o + 1)}
            disabled={weekOffset >= 0}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-30">
            <ChevronRight size={16}/>
          </button>
        </div>
      </div>

      {weekTrades.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <BarChart2 size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium text-muted-foreground">Tidak ada trade minggu ini</p>
            <p className="text-sm text-muted-foreground mt-1">Pindah minggu lain atau tambahkan trade baru</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Total P&L</p>
                <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{weekTrades.length} trade</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                <p className={`text-2xl font-bold ${winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {winRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">{wins}W · {losses}L{bes > 0 ? ` · ${bes}BE` : ''}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Profit Factor</p>
                <p className={`text-2xl font-bold ${pf >= 1.5 ? 'text-emerald-400' : pf >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {pf === Infinity ? '∞' : pf.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Gross W: {fmt(grossWin)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Avg per Trade</p>
                <p className={`text-2xl font-bold ${totalPnl/weekTrades.length >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(totalPnl/weekTrades.length) >= 0 ? '+' : ''}{fmt(totalPnl/weekTrades.length)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">per trade</p>
              </CardContent>
            </Card>
          </div>

          {/* Best / Worst */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {bestTrade && (
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy size={13} className="text-emerald-400"/>
                    <span className="text-xs font-semibold text-emerald-400">Trade Terbaik</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{bestTrade.pair}</p>
                      <p className="text-xs text-muted-foreground">{bestTrade.date} · {bestTrade.strategy || '—'}</p>
                    </div>
                    <p className="text-xl font-bold text-emerald-400">+{fmt(bestTrade.pnl)}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {worstTrade && worstTrade.pnl < 0 && (
              <Card className="border-red-500/20 bg-red-500/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={13} className="text-red-400"/>
                    <span className="text-xs font-semibold text-red-400">Trade Terburuk</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{worstTrade.pair}</p>
                      <p className="text-xs text-muted-foreground">{worstTrade.date} · {worstTrade.strategy || '—'}</p>
                    </div>
                    <p className="text-xl font-bold text-red-400">{fmt(worstTrade.pnl)}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Daily bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">P&L per Hari</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dayData} barSize={32}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={60}
                    tickFormatter={v => v === 0 ? '0' : v > 0 ? `+${(v/1000).toFixed(0)}k` : `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v) => [fmt(Number(v)), 'P&L']}
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  />
                  <ReferenceLine y={0} stroke="var(--border)" />
                  <Bar dataKey="pnl" radius={[4,4,0,0]}>
                    {dayData.map((d, i) => (
                      <Cell key={i} fill={d.pnl >= 0 ? 'oklch(0.65 0.18 145)' : 'oklch(0.65 0.22 25)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Day table */}
              <div className="mt-3 grid grid-cols-7 gap-1">
                {dayData.map((d, i) => (
                  <div key={i} className="text-center space-y-0.5">
                    <p className={`text-xs font-bold ${d.pnl > 0 ? 'text-emerald-400' : d.pnl < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {d.count > 0 ? (d.pnl >= 0 ? '+' : '') + fmt(d.pnl).replace(/[^0-9,.-]/g, '') : '—'}
                    </p>
                    {d.count > 0 && <p className="text-[10px] text-muted-foreground">{d.wins}W{d.losses > 0 ? `/${d.losses}L` : ''}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Strategy breakdown */}
          {strategies.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Performa per Strategi</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-[11px] text-muted-foreground">
                      <th className="px-4 py-2 text-left font-semibold">Strategi</th>
                      <th className="px-4 py-2 text-center font-semibold">Trade</th>
                      <th className="px-4 py-2 text-center font-semibold">Win Rate</th>
                      <th className="px-4 py-2 text-right font-semibold">P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {strategies.map(([name, s]) => (
                      <tr key={name} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">{name}</td>
                        <td className="px-4 py-2.5 text-center text-muted-foreground">{s.count}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={s.count > 0 && s.wins/s.count >= 0.5 ? 'text-emerald-400' : 'text-red-400'}>
                            {s.count > 0 ? (s.wins/s.count*100).toFixed(0) : 0}%
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold ${s.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {s.pnl >= 0 ? '+' : ''}{fmt(s.pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Trade list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Daftar Trade Minggu Ini</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/30">
                {sortedTrades.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={t.result === 'win' ? 'default' : t.result === 'loss' ? 'destructive' : 'secondary'}
                        className="text-[10px] w-10 justify-center">
                        {t.result === 'win' ? 'WIN' : t.result === 'loss' ? 'LOSS' : 'BE'}
                      </Badge>
                      <div>
                        <p className="text-sm font-semibold flex items-center gap-1">
                          {t.direction === 'long' ? <TrendingUp size={11} className="text-emerald-400"/> : <TrendingDown size={11} className="text-red-400"/>}
                          {t.pair}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {DAYS_ID[new Date(t.date + 'T00:00:00').getDay()]}, {t.date}
                          {t.strategy ? ` · ${t.strategy}` : ''}
                        </p>
                      </div>
                    </div>
                    <p className={`font-bold text-sm ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
