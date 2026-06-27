'use client'

import { useState, useMemo } from 'react'
import { useCurrency } from '@/hooks/useCurrency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, TrendingDown, RotateCcw, Shuffle, FlaskConical,
  Activity, Target, Zap,
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
// Page
// ─────────────────────────────────────────────
export default function SimulatorPage() {
  const fmt = useCurrency()
  const [tab, setTab] = useState<'manual' | 'kpi'>('manual')

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <FlaskConical size={20} className="text-primary"/>
          </div>
          <div>
            <h1 className="text-xl font-bold">Simulator Trading</h1>
            <p className="text-sm text-muted-foreground">Uji, simulasikan, dan proyeksikan strategi trading kamu</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant={tab === 'manual' ? 'default' : 'outline'} onClick={() => setTab('manual')}>
            Sesi Manual
          </Button>
          <Button size="sm" variant={tab === 'kpi' ? 'default' : 'outline'} onClick={() => setTab('kpi')}>
            Proyeksi KPI
          </Button>
        </div>
      </div>

      {tab === 'manual' ? <ManualSimulator fmt={fmt}/> : <KpiProjector fmt={fmt}/>}
    </div>
  )
}
