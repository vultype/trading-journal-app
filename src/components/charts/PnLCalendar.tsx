'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Trade } from '@/types'

const DAYS   = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

type DayData = { pnl: number; count: number; trades: Trade[] }
type Props   = {
  trades: Trade[]
  fmt: (n: number) => string
  onDayClick?: (date: string, trades: Trade[]) => void
}

export function PnLCalendar({ trades, fmt, onDayClick }: Props) {
  const [view, setView] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const { year, month } = view

  const monthStr    = `${year}-${String(month + 1).padStart(2, '0')}`
  const dayMap: Record<number, DayData> = {}
  for (const t of trades) {
    if (t.date.startsWith(monthStr)) {
      const day = parseInt(t.date.slice(8, 10))
      if (!dayMap[day]) dayMap[day] = { pnl: 0, count: 0, trades: [] }
      dayMap[day].pnl += t.pnl
      dayMap[day].count++
      dayMap[day].trades.push(t)
    }
  }

  const monthPnl    = Object.values(dayMap).reduce((s, d) => s + d.pnl, 0)
  const monthTrades = Object.values(dayMap).reduce((s, d) => s + d.count, 0)

  const firstDow    = new Date(year, month, 1).getDay()
  const startOffset = firstDow === 0 ? 6 : firstDow - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Build weeks array (each week = 7 slots, null = empty cell)
  const weeks: Array<Array<number | null>> = []
  let week: Array<number | null> = Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  while (week.length > 0 && week.length < 7) week.push(null)
  if (week.length > 0) weeks.push(week)

  const today   = new Date()
  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  function cellCls(data: DayData | undefined) {
    if (!data) return ''
    if (data.pnl > 0) return 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
    if (data.pnl < 0) return 'bg-red-500/20 border-red-500/30 text-red-300'
    return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
  }

  function prevMonth() { setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 }) }
  function nextMonth() { setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 }) }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">{MONTHS[month]} {year}</h3>
          <p className="text-xs text-muted-foreground">
            {monthTrades} trade ·{' '}
            <span className={monthPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {monthPnl >= 0 ? '+' : ''}{fmt(monthPnl)}
            </span>
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={prevMonth}><ChevronLeft size={13}/></Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={nextMonth}><ChevronRight size={13}/></Button>
        </div>
      </div>

      {/* Grid: 8 columns (7 days + weekly total) */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 560 }}>
          {/* Column headers */}
          <div className="grid grid-cols-8 gap-1 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
            ))}
            <div className="text-center text-[10px] font-semibold text-primary/70 py-1">Total</div>
          </div>

          {/* Week rows */}
          {weeks.map((wk, wi) => {
            const weekPnl   = wk.reduce<number>((s, d) => s + (d != null ? (dayMap[d]?.pnl ?? 0) : 0), 0)
            const weekCount = wk.reduce<number>((s, d) => s + (d != null ? (dayMap[d]?.count ?? 0) : 0), 0)
            const weekWins  = wk.reduce<number>((s, d) => {
              if (d == null) return s
              return s + (dayMap[d]?.trades.filter(t => t.result === 'win').length ?? 0)
            }, 0)
            const weekLoss  = wk.reduce<number>((s, d) => {
              if (d == null) return s
              return s + (dayMap[d]?.trades.filter(t => t.result === 'loss').length ?? 0)
            }, 0)
            const hasData   = weekCount > 0

            return (
              <div key={wi} className="grid grid-cols-8 gap-1 mb-1">
                {wk.map((day, di) => {
                  const data    = day !== null ? dayMap[day] : undefined
                  const dateStr = day !== null ? `${monthStr}-${String(day).padStart(2, '0')}` : ''
                  const valid   = day !== null

                  return (
                    <div
                      key={di}
                      onClick={() => valid && data && onDayClick?.(dateStr, data.trades)}
                      className={[
                        'relative rounded-lg border min-h-[56px] p-1.5 text-[10px] transition-all',
                        !valid ? 'opacity-0 pointer-events-none border-transparent' : 'border-border/30',
                        data ? `${cellCls(data)} ${onDayClick ? 'cursor-pointer hover:opacity-80' : ''}` : valid ? 'bg-muted/10' : '',
                        valid && isToday(day!) ? 'ring-1 ring-primary ring-offset-1 ring-offset-background' : '',
                      ].join(' ')}
                    >
                      <span className={`font-semibold text-[11px] block ${valid && isToday(day!) ? 'text-primary' : data ? '' : 'text-muted-foreground/60'}`}>
                        {valid ? day : ''}
                      </span>
                      {data && (
                        <div className="mt-0.5 space-y-0.5">
                          <p className="font-bold text-[9px] leading-tight">
                            {data.pnl >= 0 ? '+' : ''}{fmt(data.pnl)}
                          </p>
                          <p className="text-[9px] opacity-60">{data.count}x</p>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Weekly total cell */}
                <div className={[
                  'rounded-lg border min-h-[56px] p-1.5 flex flex-col justify-center items-center text-center gap-0.5',
                  !hasData ? 'border-transparent bg-transparent' :
                  weekPnl > 0 ? 'bg-emerald-500/10 border-emerald-500/25' :
                  weekPnl < 0 ? 'bg-red-500/10 border-red-500/25' :
                  'bg-yellow-500/5 border-yellow-500/15',
                ].join(' ')}>
                  {hasData && (
                    <>
                      <p className={`text-[10px] font-black leading-tight ${weekPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {weekPnl >= 0 ? '+' : ''}{fmt(weekPnl)}
                      </p>
                      <div className="flex gap-1 text-[9px] mt-0.5">
                        <span className="text-emerald-400 font-medium">{weekWins}W</span>
                        <span className="text-muted-foreground/50">/</span>
                        <span className="text-red-400 font-medium">{weekLoss}L</span>
                      </div>
                      <p className="text-[8px] text-muted-foreground/50">{weekCount} trade</p>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/30 inline-block"/> Profit</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500/30 inline-block"/> Loss</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-yellow-500/20 inline-block"/> Breakeven</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded border border-primary inline-block"/> Hari ini</span>
        <span className="flex items-center gap-1 ml-auto text-primary/70 font-medium">Total = P&L per minggu</span>
      </div>
    </div>
  )
}
