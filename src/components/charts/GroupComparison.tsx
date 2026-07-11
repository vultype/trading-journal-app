'use client'

import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTip } from '@/components/ui/info-tip'
import { ArrowUpDown, Check } from 'lucide-react'

const TT = { backgroundColor: 'rgba(15,20,30,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12, color: '#f1f5f9' }
const TTI = { color: '#f1f5f9', fontWeight: 700 }
const TTL = { color: '#94a3b8', fontSize: 11, fontWeight: 600 }

export type GroupRow = { name: string; winRate: number; pnl: number; total: number; wins: number }
type SortKey = 'pnl' | 'winRate' | 'total'

export function GroupComparison({ data, fmt, label }: { data: GroupRow[]; fmt: (n: number) => string; label: string }) {
  const [selected, setSelected] = useState<string[]>(() => data.map(d => d.name))
  const [sortKey, setSortKey] = useState<SortKey>('pnl')

  // keep selection valid if data changes
  const validSel = selected.filter(s => data.some(d => d.name === s))
  const activeSel = validSel.length ? validSel : data.map(d => d.name)

  const rows = useMemo(() => {
    return data
      .filter(d => activeSel.includes(d.name))
      .map(d => ({ ...d, avg: d.total > 0 ? d.pnl / d.total : 0 }))
      .sort((a, b) => sortKey === 'pnl' ? b.pnl - a.pnl : sortKey === 'winRate' ? b.winRate - a.winRate : b.total - a.total)
  }, [data, activeSel, sortKey])

  const bestPnl = rows.length ? Math.max(...rows.map(r => r.pnl)) : 0
  const worstPnl = rows.length ? Math.min(...rows.map(r => r.pnl)) : 0

  function toggle(name: string) {
    setSelected(prev => {
      const base = prev.length ? prev : data.map(d => d.name)
      return base.includes(name) ? base.filter(n => n !== name) : [...base, name]
    })
  }

  if (data.length === 0) {
    return <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Belum ada data {label.toLowerCase()}</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground mb-2">Pilih {label.toLowerCase()} untuk dibandingkan</p>
          <div className="flex flex-wrap gap-2">
            {data.map(d => {
              const on = activeSel.includes(d.name)
              return (
                <button key={d.name} type="button" onClick={() => toggle(d.name)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all
                    ${on ? 'bg-primary/15 border-primary/40 text-primary' : 'border-border/40 text-muted-foreground hover:text-foreground'}`}>
                  {on && <Check size={12} />} {d.name}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* P&L comparison chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5">Perbandingan P&L per {label} <InfoTip text={`Total profit/loss untuk setiap ${label.toLowerCase()} yang dipilih.`} /></CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 42)}>
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => fmt(v)} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
              <Tooltip contentStyle={TT} itemStyle={TTI} labelStyle={TTL} formatter={(v: any) => [fmt(Number(v)), 'P&L']} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} />
              <ReferenceLine x={0} stroke="var(--border)" />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                {rows.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Comparison table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Tabel Perbandingan</CardTitle>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-muted-foreground flex items-center gap-1"><ArrowUpDown size={11} /> Urut:</span>
              {(['pnl', 'winRate', 'total'] as SortKey[]).map(k => (
                <button key={k} onClick={() => setSortKey(k)}
                  className={`rounded px-2 py-0.5 font-semibold transition-colors ${sortKey === k ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                  {k === 'pnl' ? 'P&L' : k === 'winRate' ? 'Win%' : 'Trade'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-[11px] text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-semibold">{label}</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Trade</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Win Rate</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Avg/Trade</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Total P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {rows.map(r => (
                  <tr key={r.name} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <span className="flex items-center gap-2">
                        {r.name}
                        {r.pnl === bestPnl && r.pnl > 0 && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">TERBAIK</span>}
                        {r.pnl === worstPnl && r.pnl < 0 && <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">TERBURUK</span>}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{r.total}</td>
                    <td className={`px-3 py-3 text-right font-semibold ${r.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{r.winRate}%</td>
                    <td className={`px-3 py-3 text-right ${r.avg >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>{r.avg >= 0 ? '+' : ''}{fmt(r.avg)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${r.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.pnl >= 0 ? '+' : ''}{fmt(r.pnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
