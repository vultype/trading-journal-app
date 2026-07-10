'use client'

import { useMemo, useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { useCurrency } from '@/hooks/useCurrency'
import { TradeDetailDialog } from '@/components/trade/TradeDetailDialog'
import { calcStats, buildEquityCurve, pnlByGroup, DAYS } from '@/lib/calculations'
import { EquityCurve } from '@/components/charts/EquityCurve'
import { PnLCalendar } from '@/components/charts/PnLCalendar'
import { HourAnalysis } from '@/components/charts/HourAnalysis'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, Legend, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Flame, AlertTriangle, Target, Brain, Award, XCircle, BookOpen, Pencil, Trash2, Save, X } from 'lucide-react'
import type { Trade } from '@/types'

const NOTE_SEP = '--- Analisa by Claude ---'
function parseCalNote(raw?: string | null) {
  if (!raw) return ''
  const idx = raw.indexOf(NOTE_SEP)
  return (idx === -1 ? raw : raw.slice(0, idx)).trim()
}

const C_WIN  = '#10b981'
const C_LOSS = '#ef4444'
const C_BLUE = '#6366f1'
const TooltipStyle = { backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }

function pfRating(pf: number): { label: string; color: string } {
  if (pf === Infinity || pf >= 3)   return { label: 'Excellent',   color: 'text-emerald-300' }
  if (pf >= 2)                       return { label: 'Sangat Baik', color: 'text-emerald-400' }
  if (pf >= 1.5)                     return { label: 'Baik',        color: 'text-blue-400' }
  if (pf >= 1.2)                     return { label: 'Cukup',       color: 'text-yellow-400' }
  if (pf >= 1)                       return { label: 'Pas-pasan',   color: 'text-orange-400' }
  return                              { label: 'Poor',               color: 'text-red-400' }
}

const MOODS: { value: 1|2|3|4|5; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Buruk' },
  { value: 2, emoji: '😕', label: 'Kurang' },
  { value: 3, emoji: '😐', label: 'Cukup' },
  { value: 4, emoji: '😊', label: 'Baik' },
  { value: 5, emoji: '🔥', label: 'Luar biasa' },
]

// Inline daily-journal editor used inside the calendar day popup
function CalendarDayJournal({ date, note, onSave, onDelete }: {
  date: string
  note?: { content: string; mood: 1|2|3|4|5 }
  onSave: (content: string, mood: 1|2|3|4|5) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(note?.content ?? '')
  const [mood, setMood]       = useState<1|2|3|4|5>(note?.mood ?? 3)

  // Reset local state whenever the day (or its saved note) changes
  useEffect(() => {
    setContent(note?.content ?? '')
    setMood(note?.mood ?? 3)
    setEditing(false)
  }, [date, note?.content, note?.mood])

  const moodMeta = MOODS.find(m => m.value === (note?.mood ?? 3))

  if (!editing) {
    return (
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-400/70 flex items-center gap-1.5">
            <BookOpen size={12} /> Jurnal Harian
          </p>
          {note ? (
            <div className="flex items-center gap-1">
              <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors" title="Edit">
                <Pencil size={12} />
              </button>
              <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors" title="Hapus">
                <Trash2 size={12} />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium">+ Tulis</button>
          )}
        </div>
        {note ? (
          <>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg leading-none">{moodMeta?.emoji}</span>
              <span className="text-xs text-muted-foreground">{moodMeta?.label}</span>
            </div>
            <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">{note.content}</p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">Belum ada catatan refleksi untuk hari ini.</p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-400/70 flex items-center gap-1.5">
          <BookOpen size={12} /> {note ? 'Edit Jurnal' : 'Tulis Jurnal'}
        </p>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground p-1"><X size={14} /></button>
      </div>
      <div className="flex gap-1.5">
        {MOODS.map(m => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMood(m.value)}
            className={`flex-1 rounded-lg border py-1.5 text-lg transition-all ${mood === m.value ? 'border-indigo-500/50 bg-indigo-500/15' : 'border-border/40 opacity-50 hover:opacity-100'}`}
            title={m.label}
          >
            {m.emoji}
          </button>
        ))}
      </div>
      <Textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Refleksi trading hari ini…"
        rows={4}
        className="text-sm resize-none"
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(false)}>Batal</Button>
        <Button
          size="sm"
          className="flex-1 gap-1.5"
          disabled={!content.trim()}
          onClick={() => { onSave(content.trim(), mood); setEditing(false) }}
        >
          <Save size={12} /> Simpan
        </Button>
      </div>
    </div>
  )
}

function MiniStat({ label, value, sub, green, red }: { label: string; value: React.ReactNode; sub?: string; green?: boolean; red?: boolean }) {
  return (
    <div className="rounded-xl bg-card border border-border/50 p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${green ? 'text-emerald-400' : red ? 'text-red-400' : ''}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AnalisisPage() {
  const { trades, transfers, deleteTrade, journalNotes, saveJournal, deleteJournal } = useStore()
  const fmt   = useCurrency()
  // Overtrades excluded from all analytics — only affect equity curve
  const normalTrades = useMemo(() => trades.filter(t => !t.is_overtrade), [trades])
  const sorted = useMemo(() => [...trades].sort((a, b) => a.date.localeCompare(b.date)), [trades])
  const stats  = useMemo(() => calcStats(trades, transfers), [trades, transfers])
  const curve  = useMemo(() => buildEquityCurve(sorted), [sorted])

  const [calDayTrades, setCalDayTrades] = useState<Trade[] | null>(null)
  const [calDayDate,   setCalDayDate]   = useState('')
  const [detailTrade,  setDetailTrade]  = useState<Trade | null>(null)

  const byStrategy  = useMemo(() => pnlByGroup(normalTrades, t => t.strategy ?? '—').sort((a,b) => b.total - a.total), [normalTrades])
  const byPair      = useMemo(() => pnlByGroup(normalTrades, t => t.pair).sort((a,b) => b.total - a.total).slice(0,8), [normalTrades])
  const byDirection = useMemo(() => pnlByGroup(normalTrades, t => t.direction), [normalTrades])

  const byDay = useMemo(() => {
    const map: Record<string, { pnl: number; total: number; wins: number }> = {}
    DAYS.forEach(d => { map[d] = { pnl: 0, total: 0, wins: 0 } })
    for (const t of normalTrades) {
      const day = DAYS[new Date(t.date + 'T00:00:00').getDay()]
      map[day].pnl += t.pnl; map[day].total++
      if (t.result === 'win') map[day].wins++
    }
    return DAYS.map(d => ({ name: d, pnl: map[d].pnl, total: map[d].total, winRate: map[d].total > 0 ? Math.round(map[d].wins / map[d].total * 100) : 0 }))
  }, [normalTrades])

  const byMonth = useMemo(() => {
    const map: Record<string, { pnl: number; wins: number; total: number }> = {}
    for (const t of normalTrades) {
      const key = t.date.slice(0,7)
      if (!map[key]) map[key] = { pnl: 0, wins: 0, total: 0 }
      map[key].pnl += t.pnl; map[key].total++
      if (t.result === 'win') map[key].wins++
    }
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b))
      .map(([k,v]) => ({ name: k.slice(5), pnl: v.pnl, winRate: v.total > 0 ? Math.round(v.wins/v.total*100) : 0, total: v.total }))
  }, [normalTrades])

  const planStats = useMemo(() => {
    const withPlan    = normalTrades.filter(t => t.followed_plan !== undefined)
    const followed    = withPlan.filter(t => t.followed_plan === true)
    const notFollowed = withPlan.filter(t => t.followed_plan === false)
    const wrF = followed.length    > 0 ? Math.round(followed.filter(t => t.result==='win').length / followed.length * 100) : null
    const wrN = notFollowed.length > 0 ? Math.round(notFollowed.filter(t => t.result==='win').length / notFollowed.length * 100) : null
    return { followed: followed.length, notFollowed: notFollowed.length, wrF, wrN,
      pnlF: followed.reduce((s,t)=>s+t.pnl,0), pnlN: notFollowed.reduce((s,t)=>s+t.pnl,0) }
  }, [normalTrades])

  const dirStats = useMemo(() => {
    const known  = normalTrades.filter(t => t.know_direction === true)
    const unsure = normalTrades.filter(t => t.know_direction === false)
    return {
      known: known.length, unsure: unsure.length,
      wrK: known.length  > 0 ? Math.round(known.filter(t=>t.result==='win').length / known.length * 100) : null,
      wrU: unsure.length > 0 ? Math.round(unsure.filter(t=>t.result==='win').length / unsure.length * 100) : null,
      pnlK: known.reduce((s,t)=>s+t.pnl,0), pnlU: unsure.reduce((s,t)=>s+t.pnl,0),
    }
  }, [normalTrades])

  const piePnL = useMemo(() => [
    { name: 'Win',  value: normalTrades.filter(t=>t.result==='win').length,       color: C_WIN  },
    { name: 'Loss', value: normalTrades.filter(t=>t.result==='loss').length,      color: C_LOSS },
    { name: 'BE',   value: normalTrades.filter(t=>t.result==='breakeven').length, color: '#f59e0b' },
  ].filter(x=>x.value>0), [normalTrades])

  // Stats for Win/Loss/PF cards
  const wins         = normalTrades.filter(t => t.result === 'win')
  const losses       = normalTrades.filter(t => t.result === 'loss')
  const grossProfit  = wins.reduce((s,t) => s + t.pnl, 0)
  const grossLoss    = Math.abs(losses.reduce((s,t) => s + t.pnl, 0))
  const largestWin   = wins.length > 0   ? Math.max(...wins.map(t=>t.pnl))   : 0
  const largestLoss  = losses.length > 0 ? Math.min(...losses.map(t=>t.pnl)) : 0
  const pf           = stats.profit_factor
  const rating       = pfRating(pf)

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
        <Target size={32}/>
        <p className="font-medium">Belum ada data trade</p>
        <p className="text-sm">Catat trade dulu di menu Trade</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold">Analisis</h1>
        <p className="text-sm text-muted-foreground">{trades.length} trade · insight mendalam performa kamu</p>
      </div>

      {/* ── WIN / LOSS / PF Cards (seperti screenshot) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Winning Trades */}
        <Card className="border-emerald-500/20 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10"><Award size={14} className="text-emerald-400"/></span>
              Winning Trades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Total Wins</p>
              <p className="text-3xl font-black text-emerald-400">{wins.length}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Average Win</p>
                <p className="font-bold text-emerald-400">{fmt(stats.avg_win)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Largest Win</p>
                <p className="font-bold text-emerald-400">{fmt(largestWin)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Win Amount</p>
              <p className="font-bold text-emerald-400">{fmt(grossProfit)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Losing Trades */}
        <Card className="border-red-500/20 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-red-500/10"><XCircle size={14} className="text-red-400"/></span>
              Losing Trades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Total Losses</p>
              <p className="text-3xl font-black text-red-400">{losses.length}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Average Loss</p>
                <p className="font-bold text-red-400">{fmt(stats.avg_loss > 0 ? -stats.avg_loss : 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Largest Loss</p>
                <p className="font-bold text-red-400">{fmt(largestLoss)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Loss Amount</p>
              <p className="font-bold text-red-400">{fmt(-grossLoss)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Profit Factor */}
        <Card className="border-blue-500/20 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10"><Target size={14} className="text-blue-400"/></span>
              Profit Factor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Current Factor</p>
              <p className={`text-3xl font-black ${rating.color}`}>
                {pf === Infinity ? '∞' : pf.toFixed(2)}
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Rating:</span>
                <span className={`text-xs font-bold ${rating.color}`}>{rating.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Gross Profit:</span>
                <span className="text-xs font-bold text-emerald-400">{fmt(grossProfit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Gross Loss:</span>
                <span className="text-xs font-bold text-red-400">{fmt(-grossLoss)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Overview stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Win Rate" value={`${stats.win_rate.toFixed(1)}%`} sub={`${wins.length}W / ${losses.length}L`} green={stats.win_rate>=50} red={stats.win_rate<50}/>
        <MiniStat label="Expectancy" value={fmt(stats.expectancy)} sub="per trade" green={stats.expectancy>0} red={stats.expectancy<0}/>
        <MiniStat label="Max Drawdown" value={fmt(stats.max_drawdown)} red/>
        <MiniStat label="Total P&L" value={fmt(stats.total_pnl)} green={stats.total_pnl>=0} red={stats.total_pnl<0}/>
      </div>

      {/* ── Streak banner ── */}
      {stats.current_streak > 0 && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${stats.current_streak_type==='win' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          {stats.current_streak_type==='win' ? <Flame size={20} className="text-emerald-400"/> : <AlertTriangle size={20} className="text-red-400"/>}
          <div>
            <p className={`font-bold text-sm ${stats.current_streak_type==='win' ? 'text-emerald-400' : 'text-red-400'}`}>
              Streak saat ini: {stats.current_streak}x {stats.current_streak_type==='win' ? 'WIN beruntun 🔥' : 'LOSS beruntun ⚠️'}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.current_streak_type==='loss' ? 'Pertimbangkan istirahat atau evaluasi ulang setup' : 'Jaga disiplin — jangan terlalu percaya diri'}
            </p>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="kalender">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="kalender">Kalender P&L</TabsTrigger>
          <TabsTrigger value="jam">Jam Trading</TabsTrigger>
          <TabsTrigger value="equity">Equity</TabsTrigger>
          <TabsTrigger value="strategi">Strategi</TabsTrigger>
          <TabsTrigger value="pair">Pair</TabsTrigger>
          <TabsTrigger value="waktu">Waktu</TabsTrigger>
          <TabsTrigger value="psikologi">Psikologi</TabsTrigger>
        </TabsList>

        {/* ── KALENDER ── */}
        <TabsContent value="kalender" className="mt-4">
          <Card>
            <CardContent className="pt-5">
              <PnLCalendar
                trades={trades}
                fmt={fmt}
                onDayClick={(date, dayTrades) => { setCalDayDate(date); setCalDayTrades(dayTrades) }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── JAM TRADING ── */}
        <TabsContent value="jam" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                ⏰ Analisa Jam Trading
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HourAnalysis trades={normalTrades} fmt={fmt} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── EQUITY ── */}
        <TabsContent value="equity" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Equity Curve</CardTitle></CardHeader>
            <CardContent>{curve.length > 1 ? <EquityCurve data={curve}/> : <p className="text-sm text-muted-foreground text-center py-8">Butuh minimal 2 trade</p>}</CardContent>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">P&L per Bulan</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byMonth} margin={{top:4,right:4,bottom:4,left:0}}>
                    <XAxis dataKey="name" tick={{fontSize:10}} tickLine={false} axisLine={false}/>
                    <YAxis tick={{fontSize:10}} tickLine={false} axisLine={false} width={55} tickFormatter={v=>fmt(v)}/>
                    <Tooltip contentStyle={TooltipStyle} formatter={(v)=>[fmt(Number(v)),'P&L']}/>
                    <ReferenceLine y={0} stroke="var(--border)"/>
                    <Bar dataKey="pnl" radius={[4,4,0,0]}>
                      {byMonth.map((e,i)=><Cell key={i} fill={e.pnl>=0?C_WIN:C_LOSS} fillOpacity={0.8}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribusi Hasil</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={piePnL} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {piePnL.map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Legend wrapperStyle={{fontSize:12}}/>
                    <Tooltip contentStyle={TooltipStyle}/>
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── STRATEGI ── */}
        <TabsContent value="strategi" className="mt-4 space-y-4">
          {byStrategy.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Belum ada data strategi</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-sm">Win Rate per Strategi</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {byStrategy.map((s,i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground">{s.winRate}% · {s.wins}/{s.total} · {s.pnl>=0?'+':''}{fmt(s.pnl)}</span>
                      </div>
                      <Progress value={s.winRate} className="h-2"/>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">P&L per Strategi</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(160, byStrategy.length * 36)}>
                    <BarChart data={byStrategy} layout="vertical" margin={{top:4,right:16,bottom:4,left:64}}>
                      <XAxis type="number" tick={{fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>fmt(v)}/>
                      <YAxis type="category" dataKey="name" tick={{fontSize:11}} tickLine={false} axisLine={false} width={60}/>
                      <Tooltip contentStyle={TooltipStyle} formatter={(v)=>[fmt(Number(v)),'P&L']}/>
                      <ReferenceLine x={0} stroke="var(--border)"/>
                      <Bar dataKey="pnl" radius={[0,4,4,0]}>
                        {byStrategy.map((e,i)=><Cell key={i} fill={e.pnl>=0?C_WIN:C_LOSS} fillOpacity={0.8}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── PAIR ── */}
        <TabsContent value="pair" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Win Rate per Pair</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {byPair.map((p,i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold">{p.name}</span>
                    <span className="text-muted-foreground">{p.winRate}% · {p.total} trade · {p.pnl>=0?'+':''}{fmt(p.pnl)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={p.winRate} className="h-1.5 flex-1"/>
                    <span className={`text-xs font-bold w-8 text-right ${p.winRate>=50?'text-emerald-400':'text-red-400'}`}>{p.winRate}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Pair Terbaik</CardTitle></CardHeader>
              <CardContent>
                {byPair.filter(p=>p.pnl>0).sort((a,b)=>b.pnl-a.pnl).slice(0,5).map((p,i)=>(
                  <div key={i} className="flex justify-between text-sm py-2 border-b border-border/40 last:border-0">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-emerald-400 font-bold">+{fmt(p.pnl)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Pair Terburuk</CardTitle></CardHeader>
              <CardContent>
                {byPair.filter(p=>p.pnl<0).sort((a,b)=>a.pnl-b.pnl).slice(0,5).map((p,i)=>(
                  <div key={i} className="flex justify-between text-sm py-2 border-b border-border/40 last:border-0">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-red-400 font-bold">{fmt(p.pnl)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── WAKTU ── */}
        <TabsContent value="waktu" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">P&L per Hari</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={byDay} margin={{top:4,right:4,bottom:4,left:0}}>
                    <XAxis dataKey="name" tick={{fontSize:10}} tickLine={false} axisLine={false}/>
                    <YAxis tick={{fontSize:10}} tickLine={false} axisLine={false} width={55} tickFormatter={v=>fmt(v)}/>
                    <Tooltip contentStyle={TooltipStyle} formatter={(v)=>[fmt(Number(v)),'P&L']}/>
                    <ReferenceLine y={0} stroke="var(--border)"/>
                    <Bar dataKey="pnl" radius={[4,4,0,0]}>
                      {byDay.map((e,i)=><Cell key={i} fill={e.pnl>=0?C_WIN:C_LOSS} fillOpacity={0.8}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Win Rate per Hari</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {byDay.filter(d=>d.total>0).sort((a,b)=>b.winRate-a.winRate).map((d,i)=>(
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="w-16 text-xs text-muted-foreground">{d.name}</span>
                    <Progress value={d.winRate} className="flex-1 h-2"/>
                    <span className={`text-xs font-bold w-8 text-right ${d.winRate>=50?'text-emerald-400':'text-red-400'}`}>{d.winRate}%</span>
                    <span className="text-xs text-muted-foreground w-10 text-right">{d.total}x</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Long vs Short</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {byDirection.map((d,i)=>(
                  <div key={i} className={`rounded-xl border p-4 ${d.name==='long'?'border-emerald-500/20 bg-emerald-500/5':'border-red-500/20 bg-red-500/5'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {d.name==='long'?<TrendingUp size={16} className="text-emerald-400"/>:<TrendingDown size={16} className="text-red-400"/>}
                      <span className="font-bold text-sm uppercase">{d.name}</span>
                    </div>
                    <p className={`text-3xl font-black ${d.name==='long'?'text-emerald-400':'text-red-400'}`}>{d.winRate}%</p>
                    <p className="text-xs text-muted-foreground mb-1">win rate · {d.total} trade</p>
                    <p className={`text-sm font-semibold ${d.pnl>=0?'text-emerald-400':'text-red-400'}`}>{d.pnl>=0?'+':''}{fmt(d.pnl)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PSIKOLOGI ── */}
        <TabsContent value="psikologi" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Brain size={14}/> Disiplin Trading Plan</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {planStats.wrF === null && planStats.wrN === null ? (
                  <p className="text-sm text-muted-foreground">Belum ada data. Isi kolom "Ikut Plan" saat input trade.</p>
                ) : (<>
                  {planStats.wrF !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-emerald-400 font-medium">✓ Ikut Plan ({planStats.followed})</span>
                        <span className="font-bold text-emerald-400">{planStats.wrF}%</span>
                      </div>
                      <Progress value={planStats.wrF} className="h-3"/>
                      <p className="text-xs text-muted-foreground">P&L: {fmt(planStats.pnlF)}</p>
                    </div>
                  )}
                  {planStats.wrN !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-red-400 font-medium">✗ Tidak Ikut ({planStats.notFollowed})</span>
                        <span className="font-bold text-red-400">{planStats.wrN}%</span>
                      </div>
                      <Progress value={planStats.wrN} className="h-3"/>
                      <p className="text-xs text-muted-foreground">P&L: {fmt(planStats.pnlN)}</p>
                    </div>
                  )}
                  {planStats.wrF !== null && planStats.wrN !== null && (
                    <div className={`rounded-lg p-3 text-xs font-medium border ${planStats.wrF > planStats.wrN ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                      {planStats.wrF > planStats.wrN ? `✅ Ikut plan = +${planStats.wrF-planStats.wrN}% win rate lebih tinggi` : `⚠️ Evaluasi trading plan kamu`}
                    </div>
                  )}
                </>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Target size={14}/> Keyakinan Arah</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {dirStats.wrK === null && dirStats.wrU === null ? (
                  <p className="text-sm text-muted-foreground">Belum ada data. Isi kolom "Tahu Arah" saat input trade.</p>
                ) : (<>
                  {dirStats.wrK !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-emerald-400 font-medium">✓ Yakin Arah ({dirStats.known})</span>
                        <span className="font-bold text-emerald-400">{dirStats.wrK}%</span>
                      </div>
                      <Progress value={dirStats.wrK} className="h-3"/>
                      <p className="text-xs text-muted-foreground">P&L: {fmt(dirStats.pnlK)}</p>
                    </div>
                  )}
                  {dirStats.wrU !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-yellow-400 font-medium">? Tidak Yakin ({dirStats.unsure})</span>
                        <span className="font-bold text-yellow-400">{dirStats.wrU}%</span>
                      </div>
                      <Progress value={dirStats.wrU} className="h-3"/>
                      <p className="text-xs text-muted-foreground">P&L: {fmt(dirStats.pnlU)}</p>
                    </div>
                  )}
                  {dirStats.wrK !== null && dirStats.wrU !== null && (
                    <div className={`rounded-lg p-3 text-xs font-medium border ${dirStats.wrK>dirStats.wrU?'bg-emerald-500/10 text-emerald-400 border-emerald-500/20':'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                      {dirStats.wrK>dirStats.wrU ? `✅ Saat yakin arah, win rate +${dirStats.wrK-dirStats.wrU}% lebih tinggi` : `⚠️ Evaluasi cara membaca arah pasar`}
                    </div>
                  )}
                </>)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Ringkasan</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-2xl font-bold">{trades.filter(t=>t.followed_plan===true).length}</p>
                  <p className="text-xs text-muted-foreground">Trade ikut plan</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-2xl font-bold text-emerald-400">{fmt(largestWin)}</p>
                  <p className="text-xs text-muted-foreground">Win terbesar</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-2xl font-bold text-red-400">{fmt(largestLoss)}</p>
                  <p className="text-xs text-muted-foreground">Loss terbesar</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-2xl font-bold">{stats.win_streak}x</p>
                  <p className="text-xs text-muted-foreground">Win streak terbaik</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Calendar day — Jurnal Harian popup */}
      <Dialog open={calDayTrades !== null} onOpenChange={v => !v && setCalDayTrades(null)}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[82vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              📒 {calDayDate}
            </DialogTitle>
          </DialogHeader>

          {/* Day summary */}
          {calDayTrades && (() => {
            const dayPnl  = calDayTrades.reduce((s,t) => s+t.pnl, 0)
            const dayNorm = calDayTrades.filter(t => !t.is_overtrade)
            const dayW    = dayNorm.filter(t => t.result==='win').length
            const dayL    = dayNorm.filter(t => t.result==='loss').length
            return (
              <div className="flex items-center gap-4 py-2 border-y border-border/30 text-xs">
                <span className="text-muted-foreground">{calDayTrades.length} trade</span>
                <span className={`font-bold ${dayPnl>=0?'text-emerald-400':'text-red-400'}`}>
                  {dayPnl>=0?'+':''}{fmt(dayPnl)}
                </span>
                <span className="text-muted-foreground ml-auto">{dayW}W / {dayL}L</span>
              </div>
            )
          })()}

          {/* Trade cards with journal content */}
          <div className="space-y-3 mt-1">
            {calDayTrades?.map(t => {
              const catatan = parseCalNote(t.note)
              return (
                <div key={t.id} className="rounded-xl border border-border/40 bg-muted/15 overflow-hidden">
                  {/* Trade header — tap to open detail */}
                  <button
                    onClick={() => setDetailTrade(t)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                  >
                    <span className={`text-xs font-black ${t.direction==='long'?'text-emerald-400':'text-red-400'}`}>
                      {t.direction==='long'?'↑':'↓'} {t.pair}
                    </span>
                    {t.entry_time && (
                      <span className="text-[10px] text-muted-foreground">{t.entry_time}</span>
                    )}
                    {t.strategy && (
                      <span className="text-[10px] text-muted-foreground/60 border border-border/40 rounded px-1.5 py-0.5">{t.strategy}</span>
                    )}
                    {t.is_overtrade && (
                      <span className="text-[9px] font-black bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded px-1 py-0.5">OT</span>
                    )}
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-black ${t.pnl>=0?'text-emerald-400':'text-red-400'}`}>
                        {t.pnl>=0?'+':''}{fmt(t.pnl)}
                      </span>
                      <Badge
                        variant={t.result==='win'?'default':t.result==='loss'?'destructive':'secondary'}
                        className="text-[9px] font-bold">
                        {t.result==='win'?'WIN':t.result==='loss'?'LOSS':'BE'}
                      </Badge>
                    </div>
                  </button>

                  {/* Jurnal content below */}
                  {catatan ? (
                    <div className="px-3 pb-3 pt-1 border-t border-border/25">
                      <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground/40 mb-1">Catatan</p>
                      <p className="text-xs leading-relaxed text-foreground/75 whitespace-pre-wrap">{catatan}</p>
                    </div>
                  ) : (
                    <div className="px-3 pb-2 pt-1 border-t border-border/25">
                      <p className="text-[10px] text-muted-foreground/35 italic">Tidak ada catatan</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Daily journal — editable & linked to this date */}
          {calDayDate && (
            <div className="mt-3">
              <CalendarDayJournal
                date={calDayDate}
                note={journalNotes.find(n => n.date === calDayDate)}
                onSave={(content, mood) => saveJournal({ date: calDayDate, content, mood })}
                onDelete={() => deleteJournal(calDayDate)}
              />
            </div>
          )}

          {/* Total footer */}
          {calDayTrades && calDayTrades.length > 1 && (
            <div className="flex justify-between text-sm font-bold pt-2 mt-1 border-t border-border/40">
              <span className="text-muted-foreground">Total P&L</span>
              <span className={calDayTrades.reduce((s,t)=>s+t.pnl,0)>=0?'text-emerald-400':'text-red-400'}>
                {calDayTrades.reduce((s,t)=>s+t.pnl,0)>=0?'+':''}{fmt(calDayTrades.reduce((s,t)=>s+t.pnl,0))}
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full trade detail dialog (opened from calendar day) */}
      <TradeDetailDialog
        trade={detailTrade}
        open={detailTrade !== null}
        onClose={() => setDetailTrade(null)}
        onDelete={(id) => {
          deleteTrade(id)
          setDetailTrade(null)
          setCalDayTrades(prev => prev ? prev.filter(t => t.id !== id) : null)
        }}
        fmt={fmt}
      />
    </div>
  )
}
