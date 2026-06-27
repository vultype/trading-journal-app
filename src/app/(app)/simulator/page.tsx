'use client'

import { useState, useMemo, useEffect } from 'react'
import { useCurrency } from '@/hooks/useCurrency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, LineChart, Line, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, RotateCcw, Shuffle, FlaskConical,
  Activity, Target, Zap, BookMarked, Trophy, Plus, Trash2,
} from 'lucide-react'

const TooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 11,
}

// ─────────────────────────────────────────────
// Manual Simulator
// ─────────────────────────────────────────────
type SimTrade = { id: number; result: 'win' | 'loss'; rr: number; pnl: number; balance: number }

function ManualSimulator({ fmt }: { fmt: (n: number) => string }) {
  const [initEquity, setInitEquity] = useState(10_000_000)
  const [riskPct,    setRiskPct]    = useState(1)
  const [rrFixed,    setRrFixed]    = useState(2)
  const [rrMode,     setRrMode]     = useState<'fixed' | 'random'>('fixed')
  const [rrMin,      setRrMin]      = useState(1)
  const [rrMax,      setRrMax]      = useState(3)
  const [compound,   setCompound]   = useState<'fixed' | 'compound'>('fixed')
  const [trades,     setTrades]     = useState<SimTrade[]>([])

  const currentEq = trades.length > 0 ? trades[trades.length - 1].balance : initEquity
  const isProfit  = currentEq >= initEquity

  const riskBase = compound === 'compound' ? currentEq : initEquity
  const lossAmt  = riskBase * riskPct / 100
  const winAmt   = lossAmt * rrFixed

  function getRR() {
    if (rrMode === 'fixed') return rrFixed
    return parseFloat((rrMin + Math.random() * (rrMax - rrMin)).toFixed(2))
  }

  function execute(result: 'win' | 'loss') {
    const rr   = getRR()
    const risk = (compound === 'compound' ? currentEq : initEquity) * riskPct / 100
    const pnl  = result === 'win' ? risk * rr : -risk
    setTrades(prev => [...prev, { id: prev.length + 1, result, rr, pnl, balance: currentEq + pnl }])
  }

  function reset() { setTrades([]) }

  const stats = useMemo(() => {
    if (trades.length === 0) return { wins: 0, losses: 0, winRate: 0, pf: 0, netProfit: 0, returnPct: 0, maxDD: 0, gProfit: 0, gLoss: 0 }
    const wins    = trades.filter(t => t.result === 'win')
    const losses  = trades.filter(t => t.result === 'loss')
    const gProfit = wins.reduce((s, t) => s + t.pnl, 0)
    const gLoss   = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
    const winRate = wins.length / trades.length * 100
    const pf      = gLoss > 0 ? gProfit / gLoss : gProfit > 0 ? Infinity : 0
    const net     = currentEq - initEquity
    let peak = initEquity, maxDD = 0
    for (const b of [initEquity, ...trades.map(t => t.balance)]) {
      if (b > peak) peak = b
      const dd = peak > 0 ? (b - peak) / peak * 100 : 0
      if (dd < maxDD) maxDD = dd
    }
    return { wins: wins.length, losses: losses.length, winRate, pf, netProfit: net, returnPct: net / initEquity * 100, maxDD, gProfit, gLoss }
  }, [trades, currentEq, initEquity])

  const chartData = useMemo(() => [
    { id: 0, balance: initEquity },
    ...trades.map(t => ({ id: t.id, balance: t.balance })),
  ], [trades, initEquity])

  const statCards = [
    { label: 'Total Ekuitas', value: fmt(currentEq), sub: 'Saldo Akhir', color: isProfit ? 'text-emerald-400' : 'text-red-400' },
    { label: 'Net Profit',    value: (stats.netProfit >= 0 ? '+' : '') + fmt(stats.netProfit), sub: `${stats.returnPct.toFixed(1)}% Return`, color: stats.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400' },
    { label: 'Win Rate',      value: `${stats.winRate.toFixed(1)}%`, sub: `${stats.wins}W / ${stats.losses}L`, color: stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400' },
    { label: 'Profit Factor', value: stats.pf === Infinity ? '∞' : stats.pf.toFixed(2), sub: `${fmt(stats.gProfit)} / ${fmt(stats.gLoss)}`, color: stats.pf >= 1.5 ? 'text-emerald-400' : stats.pf >= 1 ? 'text-yellow-400' : 'text-red-400' },
    { label: 'Max Drawdown',  value: `${stats.maxDD.toFixed(2)}%`, sub: 'Penurunan Maks', color: 'text-red-400' },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── Left: Settings + Execute ── */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2"><Activity size={13}/> Pengaturan Sesi</span>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={reset}>
                <RotateCcw size={11}/> Reset
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Ekuitas Awal (Rp)</Label>
              <Input type="number" step="any" value={initEquity}
                onChange={e => { setInitEquity(+e.target.value || 0); setTrades([]) }}
                className="mt-1"/>
            </div>

            <div>
              <Label className="text-xs">Risiko / Trade (%)</Label>
              <Input type="number" step="0.1" min="0.1" max="100" value={riskPct}
                onChange={e => setRiskPct(+e.target.value || 1)} className="mt-1"/>
              <p className="text-xs text-red-400 mt-1 font-medium">Loss: −{fmt(lossAmt)}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Reward Rasio (1 : X)</Label>
                <Button
                  variant={rrMode === 'random' ? 'default' : 'outline'}
                  size="sm" className="h-6 px-2 gap-1 text-xs"
                  onClick={() => setRrMode(m => m === 'fixed' ? 'random' : 'fixed')}
                >
                  <Shuffle size={10}/> Acak
                </Button>
              </div>
              {rrMode === 'fixed' ? (
                <>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground font-medium shrink-0">1 :</span>
                    <Input type="number" step="0.1" min="0.1" value={rrFixed}
                      onChange={e => setRrFixed(+e.target.value || 1)}/>
                  </div>
                  <p className="text-xs text-emerald-400 mt-1 font-medium">Profit: +{fmt(winAmt)}</p>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Min RR</Label>
                      <Input type="number" step="0.1" min="0.1" value={rrMin}
                        onChange={e => setRrMin(+e.target.value || 0.5)} className="mt-0.5"/>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Max RR</Label>
                      <Input type="number" step="0.1" min="0.1" value={rrMax}
                        onChange={e => setRrMax(+e.target.value || 3)} className="mt-0.5"/>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Acak {rrMin} – {rrMax} tiap trade</p>
                </>
              )}
            </div>

            <div>
              <Label className="text-xs">Tipe Kompon (Perhitungan Risiko)</Label>
              <div className="flex gap-2 mt-1">
                <Button type="button" size="sm" className="flex-1 text-xs"
                  variant={compound === 'fixed' ? 'default' : 'outline'}
                  onClick={() => setCompound('fixed')}>Tetap (Fixed)</Button>
                <Button type="button" size="sm" className="flex-1 text-xs"
                  variant={compound === 'compound' ? 'default' : 'outline'}
                  onClick={() => setCompound('compound')}>Majemuk</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Execute */}
        <Card className={isProfit ? 'border-emerald-500/25' : 'border-red-500/25'}>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Saldo Aktif</p>
              <p className={`text-lg font-black ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(currentEq)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => execute('win')}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 transition-all p-5 group"
              >
                <TrendingUp size={26} className="text-emerald-400 group-hover:scale-110 transition-transform"/>
                <span className="font-black text-emerald-400 text-sm tracking-widest">WIN</span>
              </button>
              <button
                onClick={() => execute('loss')}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-red-500/40 bg-red-500/10 hover:bg-red-500/20 active:scale-95 transition-all p-5 group"
              >
                <TrendingDown size={26} className="text-red-400 group-hover:scale-110 transition-transform"/>
                <span className="font-black text-red-400 text-sm tracking-widest">LOSE</span>
              </button>
            </div>
            {trades.length > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                {trades.length} trade · {stats.wins}W {stats.losses}L
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Right: Stats + Chart + History ── */}
      <div className="lg:col-span-2 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {statCards.map((s, i) => (
            <Card key={i} className="border-border/40">
              <CardContent className="pt-3 pb-3 px-3">
                <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider mb-1 leading-tight">{s.label}</p>
                <p className={`text-sm font-black leading-tight ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Equity Curve */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Activity size={13}/> Kurva Ekuitas Sesi Ini</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length < 2 ? (
              <div className="h-44 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Zap size={24} className="opacity-40"/>
                Klik WIN atau LOSE untuk mulai simulasi
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{top:4,right:4,bottom:0,left:0}}>
                  <defs>
                    <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3}/>
                  <XAxis dataKey="id" tick={{fontSize:9}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:9}} tickLine={false} axisLine={false} width={65} tickFormatter={v=>fmt(v)}/>
                  <Tooltip contentStyle={TooltipStyle} formatter={(v)=>[fmt(Number(v)),'Ekuitas']}/>
                  <ReferenceLine y={initEquity} stroke="var(--border)" strokeDasharray="4 4"
                    label={{value:'Modal Awal',position:'right',fontSize:9,fill:'var(--muted-foreground)'}}/>
                  <Area type="monotone" dataKey="balance"
                    stroke={isProfit ? '#10b981' : '#ef4444'} strokeWidth={2}
                    fill="url(#simGrad)"
                    dot={chartData.length <= 20 ? {r:3,fill:isProfit?'#10b981':'#ef4444'} : false}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Trade History */}
        {trades.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Riwayat Trade</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card border-b border-border/50 z-10">
                    <tr>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">No</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Hasil</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">RR</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">P/L (Rp)</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Saldo Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {[...trades].reverse().map(t => (
                      <tr key={t.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 text-muted-foreground">#{t.id}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.result === 'win' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                            {t.result === 'win' ? 'WIN' : 'LOSE'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">1:{t.rr}</td>
                        <td className={`px-3 py-2 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{fmt(t.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// KPI Projector
// ─────────────────────────────────────────────
type MonthRow = {
  month: number; openEq: number; wins: number; losses: number
  gProfit: number; gLoss: number; netPnl: number; retPct: number; closeEq: number
}

function KpiProjector({ fmt }: { fmt: (n: number) => string }) {
  const [equity,   setEquity]   = useState(10_000_000)
  const [winRate,  setWinRate]  = useState(55)
  const [riskPct,  setRiskPct]  = useState(1)
  const [rrRatio,  setRrRatio]  = useState(2)
  const [tradesM,  setTradesM]  = useState(20)
  const [months,   setMonths]   = useState(12)
  const [compound, setCompound] = useState<'fixed' | 'compound'>('compound')

  const projection = useMemo<MonthRow[]>(() => {
    const rows: MonthRow[] = []
    let eq = equity
    for (let m = 1; m <= months; m++) {
      const openEq   = eq
      const riskBase = compound === 'compound' ? openEq : equity
      const riskAmt  = riskBase * riskPct / 100
      const wins     = tradesM * winRate / 100
      const losses   = tradesM - wins
      const gProfit  = wins * riskAmt * rrRatio
      const gLoss    = losses * riskAmt
      const netPnl   = gProfit - gLoss
      const retPct   = openEq > 0 ? netPnl / openEq * 100 : 0
      const closeEq  = openEq + netPnl
      rows.push({ month: m, openEq, wins: +wins.toFixed(1), losses: +losses.toFixed(1), gProfit, gLoss, netPnl, retPct, closeEq })
      eq = closeEq
    }
    return rows
  }, [equity, winRate, riskPct, rrRatio, tradesM, months, compound])

  const lastRow     = projection[projection.length - 1]
  const totalReturn = lastRow ? (lastRow.closeEq - equity) / equity * 100 : 0
  const avgMonthly  = projection.length > 0 ? projection.reduce((s, r) => s + r.retPct, 0) / projection.length : 0
  const avgMonthlyPnl = projection.length > 0 ? projection.reduce((s, r) => s + r.netPnl, 0) / projection.length : 0
  const bePct       = 1 / (1 + rrRatio) * 100
  const evUnit      = winRate / 100 * rrRatio - (1 - winRate / 100)
  const isViable    = evUnit > 0
  const bestMonth   = projection.length > 0 ? projection.reduce((a, b) => b.netPnl > a.netPnl ? b : a, projection[0]) : null
  const worstMonth  = projection.length > 0 ? projection.reduce((a, b) => b.netPnl < a.netPnl ? b : a, projection[0]) : null

  const chartData = projection.map(r => ({ month: `M${r.month}`, equity: r.closeEq, pnl: r.netPnl }))
  const isPositive = totalReturn >= 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* ── Input Panel ── */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Target size={13}/> Parameter KPI</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Ekuitas Awal</Label>
              <Input type="number" step="any" value={equity} onChange={e => setEquity(+e.target.value || 0)} className="mt-1"/>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Win Rate (%)</Label>
                <Input type="number" step="1" min="1" max="99" value={winRate}
                  onChange={e => setWinRate(Math.min(99, Math.max(1, +e.target.value || 50)))} className="mt-1"/>
              </div>
              <div>
                <Label className="text-xs">Risiko / Trade (%)</Label>
                <Input type="number" step="0.1" min="0.1" value={riskPct}
                  onChange={e => setRiskPct(+e.target.value || 1)} className="mt-1"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Reward Ratio (RR)</Label>
                <Input type="number" step="0.1" min="0.1" value={rrRatio}
                  onChange={e => setRrRatio(+e.target.value || 1)} className="mt-1"/>
              </div>
              <div>
                <Label className="text-xs">Trade / Bulan</Label>
                <Input type="number" step="1" min="1" value={tradesM}
                  onChange={e => setTradesM(+e.target.value || 1)} className="mt-1"/>
              </div>
            </div>
            <div>
              <Label className="text-xs">Proyeksi (Bulan)</Label>
              <Input type="number" step="1" min="1" max="120" value={months}
                onChange={e => setMonths(Math.min(120, Math.max(1, +e.target.value || 12)))} className="mt-1"/>
            </div>
            <div>
              <Label className="text-xs">Tipe Kompon</Label>
              <div className="flex gap-2 mt-1">
                <Button type="button" size="sm" className="flex-1 text-xs"
                  variant={compound === 'fixed' ? 'default' : 'outline'} onClick={() => setCompound('fixed')}>Tetap</Button>
                <Button type="button" size="sm" className="flex-1 text-xs"
                  variant={compound === 'compound' ? 'default' : 'outline'} onClick={() => setCompound('compound')}>Majemuk</Button>
              </div>
            </div>

            {/* EV Insight */}
            <div className={`rounded-xl p-3 text-xs border ${isViable ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-red-500/10 border-red-500/25'}`}>
              <p className={`font-bold mb-1.5 ${isViable ? 'text-emerald-400' : 'text-red-400'}`}>
                {isViable ? '✅ Strategi Viable' : '❌ Strategi Merugi'}
              </p>
              <p className="text-muted-foreground">EV/trade: <span className={`font-semibold ${evUnit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(evUnit * 100).toFixed(2)}% risk</span></p>
              <p className="text-muted-foreground mt-0.5">Break-even WR: <span className="font-semibold text-foreground">{bePct.toFixed(1)}%</span></p>
            </div>
          </CardContent>
        </Card>

        {/* ── Results ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className={isPositive ? 'border-emerald-500/25' : 'border-red-500/25'}>
              <CardContent className="pt-3 pb-3 px-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Return Total</p>
                <p className={`text-2xl font-black ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(1)}%
                </p>
                <p className="text-[9px] text-muted-foreground">{months} bulan</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3 px-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Ekuitas Akhir</p>
                <p className={`text-base font-black ${lastRow && lastRow.closeEq >= equity ? 'text-emerald-400' : 'text-red-400'}`}>
                  {lastRow ? fmt(lastRow.closeEq) : fmt(equity)}
                </p>
                <p className={`text-[9px] ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {lastRow ? (lastRow.closeEq >= equity ? '+' : '') + fmt(lastRow.closeEq - equity) : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3 px-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Rata-rata / Bulan</p>
                <p className={`text-2xl font-black ${avgMonthly >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {avgMonthly >= 0 ? '+' : ''}{avgMonthly.toFixed(2)}%
                </p>
                <p className="text-[9px] text-muted-foreground">{fmt(avgMonthlyPnl)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3 px-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Break-even WR</p>
                <p className={`text-2xl font-black ${winRate >= bePct ? 'text-emerald-400' : 'text-red-400'}`}>
                  {bePct.toFixed(1)}%
                </p>
                <p className="text-[9px] text-muted-foreground">WR kamu: <span className={winRate >= bePct ? 'text-emerald-400' : 'text-red-400'}>{winRate}%</span></p>
              </CardContent>
            </Card>
          </div>

          {/* Extra stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-card border border-border/40 p-3 text-xs">
              <p className="text-muted-foreground mb-1">Bulan Terbaik</p>
              <p className="text-emerald-400 font-bold text-sm">{bestMonth ? fmt(bestMonth.netPnl) : '—'}</p>
              {bestMonth && <p className="text-muted-foreground">{bestMonth.retPct.toFixed(2)}% return · Bulan {bestMonth.month}</p>}
            </div>
            <div className="rounded-xl bg-card border border-border/40 p-3 text-xs">
              <p className="text-muted-foreground mb-1">Bulan Terburuk</p>
              <p className="text-red-400 font-bold text-sm">{worstMonth ? fmt(worstMonth.netPnl) : '—'}</p>
              {worstMonth && <p className="text-muted-foreground">{worstMonth.retPct.toFixed(2)}% return · Bulan {worstMonth.month}</p>}
            </div>
          </div>

          {/* Equity Projection Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Proyeksi Ekuitas — {months} Bulan ({compound === 'compound' ? 'Majemuk' : 'Tetap'})</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{top:4,right:4,bottom:0,left:0}}>
                  <defs>
                    <linearGradient id="kpiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3}/>
                  <XAxis dataKey="month" tick={{fontSize:9}} tickLine={false} axisLine={false}
                    interval={Math.max(0, Math.floor(months / 8) - 1)}/>
                  <YAxis tick={{fontSize:9}} tickLine={false} axisLine={false} width={70} tickFormatter={v=>fmt(v)}/>
                  <Tooltip contentStyle={TooltipStyle} formatter={(v)=>[fmt(Number(v)),'Ekuitas']}/>
                  <ReferenceLine y={equity} stroke="var(--border)" strokeDasharray="4 4"
                    label={{value:'Modal Awal',position:'right',fontSize:9,fill:'var(--muted-foreground)'}}/>
                  <Area type="monotone" dataKey="equity"
                    stroke={isPositive ? '#10b981' : '#ef4444'} strokeWidth={2}
                    fill="url(#kpiGrad)"
                    dot={months <= 24 ? {r:3,fill:isPositive?'#10b981':'#ef4444'} : false}/>
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Rincian Per Bulan</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card border-b border-border/50 z-10">
                    <tr>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Bulan</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Modal Awal</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">W / L</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Net P&L</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Return</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Saldo Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {projection.map(r => (
                      <tr key={r.month} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">Bln {r.month}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{fmt(r.openEq)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-emerald-400">{r.wins}</span>
                          <span className="text-muted-foreground/50"> / </span>
                          <span className="text-red-400">{r.losses}</span>
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${r.netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.netPnl >= 0 ? '+' : ''}{fmt(r.netPnl)}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${r.retPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.retPct >= 0 ? '+' : ''}{r.retPct.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right font-bold">{fmt(r.closeEq)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-card border-t border-border/50">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 font-bold text-xs">TOTAL</td>
                      <td className={`px-3 py-2 text-right font-bold ${totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {totalReturn >= 0 ? '+' : ''}{fmt((lastRow?.closeEq ?? equity) - equity)}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right font-bold">{lastRow ? fmt(lastRow.closeEq) : fmt(equity)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Plan Comparison
// ─────────────────────────────────────────────
const PLAN_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

type Plan = {
  id: string
  name: string
  equity: number
  winRate: number
  rrRatio: number
  riskPct: number
  tradesPerMonth: number
  compound: boolean
}

function calcPlanStats(p: Plan) {
  const wr               = p.winRate / 100
  const expectancy       = wr * p.rrRatio - (1 - wr)
  const profitFactor     = (1 - wr) > 0 ? (wr * p.rrRatio) / (1 - wr) : Infinity
  const breakEvenWR      = 1 / (1 + p.rrRatio) * 100
  const isViable         = expectancy > 0
  // Fixed-capital monthly expected return %
  const monthlyReturnPct = p.tradesPerMonth * expectancy * p.riskPct

  // 12-month equity curve (compound if enabled)
  let eq = p.equity
  const curve: number[] = [eq]
  for (let m = 0; m < 12; m++) {
    const base   = p.compound ? eq : p.equity
    const risk   = base * p.riskPct / 100
    const netPnl = p.tradesPerMonth * (wr * risk * p.rrRatio - (1 - wr) * risk)
    eq += netPnl
    curve.push(eq)
  }

  return {
    expectancy, profitFactor, breakEvenWR, isViable,
    monthlyReturnPct,
    annualReturnPct:  monthlyReturnPct * 12,
    finalEquity12m:   eq,
    totalReturn12m:   p.equity > 0 ? (eq - p.equity) / p.equity * 100 : 0,
    curve,
  }
}

type PlanStats = ReturnType<typeof calcPlanStats>

function PlanComparison({ fmt }: { fmt: (n: number) => string }) {
  const [plans, setPlans] = useState<Plan[]>(() => {
    try { return JSON.parse(localStorage.getItem('sim_plans') ?? '[]') } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem('sim_plans', JSON.stringify(plans))
  }, [plans])

  // ── Form state ──
  const [fname,   setFname]   = useState('Plan A')
  const [fequity, setFequity] = useState(10_000_000)
  const [fwr,     setFwr]     = useState(55)
  const [frr,     setFrr]     = useState(2)
  const [frisk,   setFrisk]   = useState(1)
  const [ftrades, setFtrades] = useState(20)
  const [fcomp,   setFcomp]   = useState(true)

  function addPlan() {
    if (!fname.trim() || plans.length >= 5) return
    setPlans(prev => {
      const next = [...prev, {
        id: Math.random().toString(36).slice(2),
        name: fname.trim(), equity: fequity, winRate: fwr,
        rrRatio: frr, riskPct: frisk, tradesPerMonth: ftrades, compound: fcomp,
      }]
      const letter = String.fromCharCode(65 + next.length)
      setFname(`Plan ${letter}`)
      return next
    })
  }

  const allStats = useMemo(
    () => plans.map((p, i) => ({ plan: p, stats: calcPlanStats(p), color: PLAN_COLORS[i % PLAN_COLORS.length] })),
    [plans]
  )

  // ── Chart data: 13 points (M0–M12) ──
  const chartData = useMemo(() =>
    Array.from({ length: 13 }, (_, i) => {
      const pt: Record<string, string | number> = { month: i === 0 ? 'Start' : `M${i}` }
      allStats.forEach(({ plan, stats }) => { pt[plan.id] = stats.curve[i] })
      return pt
    }), [allStats])

  // ── Comparison table metric rows ──
  type Row = {
    label: string
    val:  (p: Plan, s: PlanStats) => string
    num?: (p: Plan, s: PlanStats) => number
    best?: 'high' | 'low'
  }
  const rows: Row[] = [
    { label: 'Win Rate',            val: p     => `${p.winRate}%`,                                                              num: p     => p.winRate,                                                   best: 'high' },
    { label: 'RR Ratio',            val: p     => `1 : ${p.rrRatio}`,                                                           num: p     => p.rrRatio,                                                   best: 'high' },
    { label: 'Risk / Trade',        val: p     => `${p.riskPct}%`,                                                              num: p     => p.riskPct                                                              },
    { label: 'Trades / Month',      val: p     => `${p.tradesPerMonth}`,                                                        num: p     => p.tradesPerMonth                                                       },
    { label: 'Expectancy (R)',       val: (_,s) => `${s.expectancy >= 0 ? '+' : ''}${s.expectancy.toFixed(3)}R`,                num: (_,s) => s.expectancy,                                                best: 'high' },
    { label: 'Profit Factor',       val: (_,s) => s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2),               num: (_,s) => s.profitFactor === Infinity ? 9999 : s.profitFactor,        best: 'high' },
    { label: 'Break-even WR',       val: (_,s) => `${s.breakEvenWR.toFixed(1)}%`,                                              num: (_,s) => s.breakEvenWR,                                              best: 'low'  },
    { label: 'Monthly Return (est)',val: (_,s) => `${s.monthlyReturnPct >= 0 ? '+' : ''}${s.monthlyReturnPct.toFixed(2)}%`,    num: (_,s) => s.monthlyReturnPct,                                          best: 'high' },
    { label: 'Annual Return (est)', val: (_,s) => `${s.annualReturnPct >= 0 ? '+' : ''}${s.annualReturnPct.toFixed(1)}%`,      num: (_,s) => s.annualReturnPct,                                           best: 'high' },
    { label: '12M Total Return',    val: (_,s) => `${s.totalReturn12m >= 0 ? '+' : ''}${s.totalReturn12m.toFixed(1)}%`,        num: (_,s) => s.totalReturn12m,                                            best: 'high' },
    { label: '12M Final Equity',    val: (_,s) => fmt(s.finalEquity12m),                                                       num: (_,s) => s.finalEquity12m,                                            best: 'high' },
  ]

  function getBestIdx(row: Row): number | null {
    if (!row.best || !row.num || allStats.length < 2) return null
    const vals = allStats.map((x, i) => ({ i, v: row.num!(x.plan, x.stats) }))
    return (row.best === 'high'
      ? vals.reduce((a, b) => b.v > a.v ? b : a)
      : vals.reduce((a, b) => b.v < a.v ? b : a)
    ).i
  }

  // ── Live preview for form ──
  const fwrN    = fwr / 100
  const fev     = fwrN * frr - (1 - fwrN)
  const fpf     = (1 - fwrN) > 0 ? fwrN * frr / (1 - fwrN) : Infinity
  const fviable = fev > 0
  const fmonth  = ftrades * fev * frisk

  // ── Conclusion ──
  const conclusion = useMemo(() => {
    if (allStats.length < 2) return null
    const viable    = allStats.filter(x => x.stats.isViable)
    const nonViable = allStats.filter(x => !x.stats.isViable)

    if (viable.length === 0) return {
      grade: 'danger' as const,
      insights: ['All plans have negative expected value (EV < 0). Increase your win rate or RR ratio before trading live.'],
      recommendation: null,
      winnerColor: PLAN_COLORS[0],
    }

    const byEV  = [...viable].sort((a, b) => b.stats.expectancy       - a.stats.expectancy)
    const byRet = [...viable].sort((a, b) => b.stats.totalReturn12m   - a.stats.totalReturn12m)
    const byPF  = [...viable].sort((a, b) => {
      const av = a.stats.profitFactor === Infinity ? 9999 : a.stats.profitFactor
      const bv = b.stats.profitFactor === Infinity ? 9999 : b.stats.profitFactor
      return bv - av
    })

    const topEV  = byEV[0]
    const topRet = byRet[0]
    const topPF  = byPF[0]

    const insights: string[] = [
      `🏆 Best expectancy: ${topEV.plan.name} (+${topEV.stats.expectancy.toFixed(3)}R/trade) — returns the most per unit of risk on average.`,
      `📈 Best 12-month projection: ${topRet.plan.name} (+${topRet.stats.totalReturn12m.toFixed(1)}% → ${fmt(topRet.stats.finalEquity12m)} after 12 months${topRet.plan.compound ? ' compound' : ''}).`,
    ]

    if (topPF.plan.id !== topEV.plan.id) {
      insights.push(`🛡️ Strongest statistical edge: ${topPF.plan.name} (PF ${topPF.stats.profitFactor === Infinity ? '∞' : topPF.stats.profitFactor.toFixed(2)}) — most consistent win/loss ratio.`)
    }

    if (nonViable.length > 0) {
      insights.push(`⚠️ Negative EV plans (avoid): ${nonViable.map(x => x.plan.name).join(', ')} — these lose money long-term regardless of short-term luck.`)
    }

    // Pick overall winner: prefer the one that is best in both EV and return, else go by EV
    const winner = topEV.plan.id === topRet.plan.id ? topEV : topEV
    const recommendation = `${winner.plan.name} is the recommended primary plan — ${winner.plan.winRate}% win rate with 1:${winner.plan.rrRatio} RR gives +${winner.stats.monthlyReturnPct.toFixed(2)}%/month expected return and an expectancy of +${winner.stats.expectancy.toFixed(3)}R per trade.`

    return { grade: nonViable.length === 0 ? 'success' as const : 'warning' as const, insights, recommendation, winner, winnerColor: winner.color }
  }, [allStats, fmt])

  return (
    <div className="space-y-5">
      {/* ── Add Plan ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookMarked size={13}/> Add Trading Plan
            <span className="ml-auto text-xs text-muted-foreground font-normal">{plans.length} / 5 plans saved</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Plan Name</Label>
              <Input value={fname} onChange={e => setFname(e.target.value)} className="mt-1" placeholder="e.g. Breakout 2R"/>
            </div>
            <div>
              <Label className="text-xs">Starting Equity</Label>
              <Input type="number" step="any" value={fequity} onChange={e => setFequity(+e.target.value || 0)} className="mt-1"/>
            </div>
            <div>
              <Label className="text-xs">Win Rate (%)</Label>
              <Input type="number" step="1" min="1" max="99" value={fwr}
                onChange={e => setFwr(Math.min(99, Math.max(1, +e.target.value || 50)))} className="mt-1"/>
            </div>
            <div>
              <Label className="text-xs">RR Ratio (1:X)</Label>
              <Input type="number" step="0.1" min="0.1" value={frr}
                onChange={e => setFrr(+e.target.value || 1)} className="mt-1"/>
            </div>
            <div>
              <Label className="text-xs">Risk / Trade (%)</Label>
              <Input type="number" step="0.1" min="0.1" value={frisk}
                onChange={e => setFrisk(+e.target.value || 1)} className="mt-1"/>
            </div>
            <div>
              <Label className="text-xs">Trades / Month</Label>
              <Input type="number" step="1" min="1" value={ftrades}
                onChange={e => setFtrades(+e.target.value || 1)} className="mt-1"/>
            </div>
            <div>
              <Label className="text-xs">Compounding</Label>
              <div className="flex gap-2 mt-1">
                <Button type="button" size="sm" className="flex-1 text-xs"
                  variant={fcomp ? 'default' : 'outline'} onClick={() => setFcomp(true)}>Yes</Button>
                <Button type="button" size="sm" className="flex-1 text-xs"
                  variant={!fcomp ? 'default' : 'outline'} onClick={() => setFcomp(false)}>No</Button>
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={addPlan} disabled={!fname.trim() || plans.length >= 5} className="w-full gap-2">
                <Plus size={13}/> Add Plan
              </Button>
            </div>
          </div>

          {/* Live EV preview */}
          <div className={`rounded-lg px-4 py-2.5 text-xs border flex flex-wrap items-center gap-x-4 gap-y-1 ${fviable ? 'bg-emerald-500/8 border-emerald-500/25 text-emerald-400' : 'bg-red-500/8 border-red-500/25 text-red-400'}`}>
            <span className="font-bold">{fviable ? '✅ Viable' : '❌ Not viable'}</span>
            <span className="text-muted-foreground">Expectancy: <strong className={fviable ? 'text-emerald-400' : 'text-red-400'}>{fev >= 0 ? '+' : ''}{fev.toFixed(3)}R</strong></span>
            <span className="text-muted-foreground">Profit Factor: <strong className={fviable ? 'text-emerald-400' : 'text-red-400'}>{fpf === Infinity ? '∞' : fpf.toFixed(2)}</strong></span>
            <span className="text-muted-foreground">Monthly est: <strong className={fviable ? 'text-emerald-400' : 'text-red-400'}>{fmonth >= 0 ? '+' : ''}{fmonth.toFixed(2)}%</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* ── Plan chips ── */}
      {plans.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allStats.map(({ plan, color }) => (
            <div key={plan.id} className="flex items-center gap-2 rounded-full px-3 py-1.5 border text-xs font-semibold"
              style={{ borderColor: color + '50', backgroundColor: color + '18', color }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }}/>
              {plan.name}
              <span className="text-muted-foreground font-normal">
                {plan.winRate}% WR · 1:{plan.rrRatio} RR · {plan.riskPct}% risk
              </span>
              <button onClick={() => setPlans(p => p.filter(x => x.id !== plan.id))}
                className="ml-1 opacity-50 hover:opacity-100 transition-opacity">
                <Trash2 size={11}/>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {plans.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <BookMarked size={28} className="mx-auto mb-3 text-muted-foreground/40"/>
            <p className="font-medium text-muted-foreground">No plans saved yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add at least 2 plans above to start comparing them</p>
          </CardContent>
        </Card>
      )}

      {/* ── Comparison Table ── */}
      {plans.length >= 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Target size={13}/> Metric Comparison</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs min-w-[380px]">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium w-44 shrink-0">Metric</th>
                  {allStats.map(({ plan, color }) => (
                    <th key={plan.id} className="text-right px-4 py-3 font-bold whitespace-nowrap" style={{ color }}>
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/25">
                {rows.map((row, ri) => {
                  const bestIdx = getBestIdx(row)
                  return (
                    <tr key={ri} className="hover:bg-muted/10">
                      <td className="px-4 py-2.5 text-muted-foreground font-medium whitespace-nowrap">{row.label}</td>
                      {allStats.map(({ plan, stats, color }, pi) => (
                        <td key={plan.id} className="px-4 py-2.5 text-right font-semibold whitespace-nowrap"
                          style={pi === bestIdx ? { color } : undefined}>
                          {row.val(plan, stats)}
                          {pi === bestIdx && plans.length > 1 && <span className="ml-1 opacity-60">★</span>}
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {/* Viability row */}
                <tr className="hover:bg-muted/10">
                  <td className="px-4 py-2.5 text-muted-foreground font-medium">Viable?</td>
                  {allStats.map(({ plan, stats }) => (
                    <td key={plan.id} className="px-4 py-2.5 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${stats.isViable ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                        {stats.isViable ? 'YES ✓' : 'NO ✗'}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── 12-Month Equity Chart ── */}
      {plans.length >= 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity size={13}/> 12-Month Equity Projection
              <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                ({plans.some(p => p.compound) ? 'compound where enabled' : 'fixed capital'})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{top:4,right:16,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3}/>
                <XAxis dataKey="month" tick={{fontSize:9}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fontSize:9}} tickLine={false} axisLine={false} width={70} tickFormatter={v=>fmt(v)}/>
                <Tooltip
                  contentStyle={TooltipStyle}
                  formatter={(v, name) => {
                    const plan = plans.find(p => p.id === String(name))
                    return [fmt(Number(v)), plan?.name ?? String(name)]
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={name => plans.find(p => p.id === String(name))?.name ?? String(name)}
                />
                {allStats.map(({ plan, color }) => (
                  <Line key={plan.id} type="monotone" dataKey={plan.id}
                    stroke={color} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: color }}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Conclusion ── */}
      {conclusion && (
        <Card className={
          conclusion.grade === 'success' ? 'border-emerald-500/30' :
          conclusion.grade === 'warning' ? 'border-yellow-500/30' : 'border-red-500/30'
        }>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy size={13} className={
                conclusion.grade === 'success' ? 'text-emerald-400' :
                conclusion.grade === 'warning' ? 'text-yellow-400' : 'text-red-400'
              }/>
              Analysis & Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {conclusion.insights.map((line, i) => (
                <p key={i} className="text-sm text-foreground/80 leading-relaxed">{line}</p>
              ))}
            </div>
            {conclusion.recommendation && (
              <div className={`rounded-xl p-3.5 border text-sm font-medium leading-relaxed ${
                conclusion.grade === 'success'
                  ? 'bg-emerald-500/8 border-emerald-500/25 text-emerald-300'
                  : 'bg-yellow-500/8 border-yellow-500/25 text-yellow-300'
              }`}>
                ✅ {conclusion.recommendation}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function SimulatorPage() {
  const fmt = useCurrency()
  const [tab, setTab] = useState<'manual' | 'kpi' | 'compare'>('manual')

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <FlaskConical size={20} className="text-primary"/>
          </div>
          <div>
            <h1 className="text-xl font-bold">Trading Simulator</h1>
            <p className="text-sm text-muted-foreground">Test, simulate, and compare your trading plans</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant={tab === 'manual'  ? 'default' : 'outline'} onClick={() => setTab('manual')}>
            Manual Session
          </Button>
          <Button size="sm" variant={tab === 'kpi'     ? 'default' : 'outline'} onClick={() => setTab('kpi')}>
            KPI Projector
          </Button>
          <Button size="sm" variant={tab === 'compare' ? 'default' : 'outline'} onClick={() => setTab('compare')}
            className="gap-1.5">
            <BookMarked size={13}/> Plan Comparison
          </Button>
        </div>
      </div>

      {tab === 'manual'  && <ManualSimulator fmt={fmt}/>}
      {tab === 'kpi'     && <KpiProjector    fmt={fmt}/>}
      {tab === 'compare' && <PlanComparison  fmt={fmt}/>}
    </div>
  )
}
