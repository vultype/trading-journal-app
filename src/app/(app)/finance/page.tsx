'use client'

import { useState, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { useCurrency } from '@/hooks/useCurrency'
import { calcStats } from '@/lib/calculations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { CurrencyInput } from '@/components/ui/currency-input'
import {
  ArrowDownLeft, ArrowUpRight, Trash2, Wallet, TrendingUp, TrendingDown,
  BarChart2, Target, Activity, Landmark, LineChart, ShieldCheck,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  AreaChart, Area, ReferenceLine, CartesianGrid, Legend,
} from 'recharts'

const TooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
}

function HealthBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium" style={{ color }}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }}/>
      </div>
    </div>
  )
}

export default function FinancePage() {
  const { accounts, trades, transfers, settings, addTransfer, deleteTransfer } = useStore()
  const fmt   = useCurrency()
  const stats = calcStats(trades, transfers)

  const [type, setType]           = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount]       = useState<number | ''>('')
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [note, setNote]           = useState('')
  const [tradingAccId, setTradingAccId] = useState('')

  const personalAcc      = accounts.find(a => a.type === 'personal')
  const tradingAccounts  = accounts.filter(a => a.type === 'trading')
  const selectedTradingAcc = tradingAccId || tradingAccounts[0]?.id || ''

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0) return
    addTransfer({
      from_account_id: type === 'deposit' ? (personalAcc?.id ?? 'personal') : selectedTradingAcc,
      to_account_id:   type === 'deposit' ? selectedTradingAcc : (personalAcc?.id ?? 'personal'),
      type, amount: amt, note: note || undefined, date,
    })
    setAmount(''); setNote('')
  }

  const accountCapital = tradingAccounts.map(acc => {
    const deps = transfers.filter(t => t.type === 'deposit'  && t.to_account_id   === acc.id).reduce((s, t) => s + t.amount, 0)
    const wds  = transfers.filter(t => t.type === 'withdraw' && t.from_account_id  === acc.id).reduce((s, t) => s + t.amount, 0)
    const pnl  = trades.filter(t => t.account_id === acc.id).reduce((s, t) => s + t.pnl, 0)
    return { acc, deposited: deps, withdrawn: wds, pnl, balance: deps - wds + pnl }
  })

  const monthStr = new Date().toISOString().slice(0, 7)
  const { targetBulanan = 0 } = settings

  const byMonth = useMemo(() => {
    const map: Record<string, { pnl: number; deposit: number; withdraw: number }> = {}
    for (const t of trades) {
      const k = t.date.slice(0, 7)
      if (!map[k]) map[k] = { pnl: 0, deposit: 0, withdraw: 0 }
      map[k].pnl += t.pnl
    }
    for (const t of transfers) {
      const k = t.date.slice(0, 7)
      if (!map[k]) map[k] = { pnl: 0, deposit: 0, withdraw: 0 }
      if (t.type === 'deposit')  map[k].deposit  += t.amount
      if (t.type === 'withdraw') map[k].withdraw += t.amount
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ name: k.slice(5), full: k, ...v }))
  }, [trades, transfers])

  const cumulativePnl = useMemo(() => {
    let running = 0
    return byMonth.map(m => { running += m.pnl; return { name: m.name, equity: running } })
  }, [byMonth])

  const thisMonthDeposit  = transfers.filter(t => t.type === 'deposit'  && t.date.startsWith(monthStr)).reduce((s, t) => s + t.amount, 0)
  const thisMonthWithdraw = transfers.filter(t => t.type === 'withdraw' && t.date.startsWith(monthStr)).reduce((s, t) => s + t.amount, 0)
  const thisMonthPnl      = trades.filter(t => t.date.startsWith(monthStr)).reduce((s, t) => s + t.pnl, 0)
  const thisMonthNet      = thisMonthPnl - thisMonthDeposit + thisMonthWithdraw

  const roi           = stats.total_deposited > 0 ? (stats.net_profit / stats.total_deposited) * 100 : null
  const capitalGrowth = stats.total_deposited > 0 ? ((stats.trading_capital / stats.total_deposited) - 1) * 100 : null
  const avgMonthly    = byMonth.length > 0 ? byMonth.reduce((s, m) => s + m.pnl, 0) / byMonth.length : 0
  const bestMonth     = byMonth.length > 0 ? byMonth.reduce((a, b) => b.pnl > a.pnl ? b : a, byMonth[0]) : null
  const capitalDeployed = stats.total_deposited - stats.total_withdrawn
  const deployedPct     = stats.total_deposited > 0 ? (capitalDeployed / stats.total_deposited) * 100 : 0

  const allTxns = useMemo(() => {
    return [...transfers]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(t => ({
        id: t.id,
        date: t.date,
        label: t.type === 'deposit' ? 'Deposit Modal' : 'Withdraw Profit',
        sub: t.note ?? (accounts.find(a => a.id === (t.type === 'deposit' ? t.to_account_id : t.from_account_id))?.name ?? ''),
        amount: t.type === 'deposit' ? t.amount : -t.amount,
        kind: t.type as string,
      }))
  }, [transfers, accounts])

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold">Laporan Keuangan</h1>
        <p className="text-sm text-muted-foreground">Ringkasan lengkap keuangan trading dan aliran dana</p>
      </div>

      {/* ── Net Worth Hero ── */}
      <Card className="relative overflow-hidden border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent">
        <CardContent className="pt-6 pb-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1.5">
                <Landmark size={11} className="inline mr-1.5 mb-0.5"/>Saldo Aktif Trading
              </p>
              <p className="text-4xl font-black tracking-tight">{fmt(stats.trading_capital)}</p>
              {capitalGrowth !== null && (
                <div className="flex items-center gap-2 mt-2.5">
                  <Badge
                    className={`text-xs font-semibold ${capitalGrowth >= 0 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-red-500/15 text-red-400 border-red-500/20'}`}
                    variant="outline"
                  >
                    {capitalGrowth >= 0 ? '↑' : '↓'} {Math.abs(capitalGrowth).toFixed(1)}% dari modal
                  </Badge>
                  {roi !== null && (
                    <span className="text-xs text-muted-foreground">ROI {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</span>
                  )}
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-0.5">Profit Trading</p>
              <p className={`text-xl font-bold ${stats.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.total_pnl >= 0 ? '+' : ''}{fmt(stats.total_pnl)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/40">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Total Deposit</p>
              <p className="font-bold text-indigo-400">{fmt(stats.total_deposited)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Total Withdraw</p>
              <p className="font-bold text-violet-400">{fmt(stats.total_withdrawn)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Modal Aktif</p>
              <p className="font-bold">{fmt(capitalDeployed)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Bulan Ini ── */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          <Activity size={11} className="inline mr-1.5 mb-0.5"/>Bulan Ini — {monthStr}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-indigo-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowDownLeft size={12} className="text-indigo-400"/>
                <p className="text-xs text-muted-foreground">Deposit</p>
              </div>
              <p className="text-xl font-bold text-indigo-400">{fmt(thisMonthDeposit)}</p>
            </CardContent>
          </Card>
          <Card className="border-violet-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowUpRight size={12} className="text-violet-400"/>
                <p className="text-xs text-muted-foreground">Withdraw</p>
              </div>
              <p className="text-xl font-bold text-violet-400">{fmt(thisMonthWithdraw)}</p>
            </CardContent>
          </Card>
          <Card className={thisMonthPnl >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 mb-1">
                {thisMonthPnl >= 0
                  ? <TrendingUp size={12} className="text-emerald-400"/>
                  : <TrendingDown size={12} className="text-red-400"/>}
                <p className="text-xs text-muted-foreground">P&L Trading</p>
              </div>
              <p className={`text-xl font-bold ${thisMonthPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {thisMonthPnl >= 0 ? '+' : ''}{fmt(thisMonthPnl)}
              </p>
            </CardContent>
          </Card>
          <Card className={thisMonthNet >= 0 ? 'border-emerald-500/20' : 'border-orange-500/20'}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 mb-1">
                <LineChart size={12} className={thisMonthNet >= 0 ? 'text-emerald-400' : 'text-orange-400'}/>
                <p className="text-xs text-muted-foreground">Net Bulan Ini</p>
              </div>
              <p className={`text-xl font-bold ${thisMonthNet >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                {thisMonthNet >= 0 ? '+' : ''}{fmt(thisMonthNet)}
              </p>
            </CardContent>
          </Card>
        </div>

        {targetBulanan > 0 && (
          <div className="mt-3 rounded-xl border border-border/50 bg-card px-4 py-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center gap-1.5">
                <Target size={12} className="text-amber-400"/>
                <span className="font-medium">Target Bulanan</span>
              </div>
              <span className={thisMonthPnl >= targetBulanan ? 'text-emerald-400 font-bold' : 'text-muted-foreground'}>
                {fmt(thisMonthPnl)} / {fmt(targetBulanan)} ({Math.min(100, Math.max(0, Math.round(thisMonthPnl / targetBulanan * 100)))}%)
              </span>
            </div>
            <Progress value={Math.min(100, Math.max(0, thisMonthPnl / targetBulanan * 100))} className="h-1.5"/>
          </div>
        )}
      </div>

      {/* ── Financial Health ── */}
      {stats.total_deposited > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-400"/>Kesehatan Keuangan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <HealthBar label="Capital Growth" value={Math.max(0, capitalGrowth ?? 0)} max={50} color="#10b981"/>
                <HealthBar
                  label="Return / Bulan"
                  value={byMonth.length > 0 ? Math.max(0, (avgMonthly / stats.total_deposited) * 100) : 0}
                  max={10}
                  color="#6366f1"
                />
              </div>
              <div className="space-y-3">
                <HealthBar label="Modal Masih Aktif" value={deployedPct} max={100} color="#f59e0b"/>
                <HealthBar label="Win Rate" value={stats.win_rate} max={100} color="#8b5cf6"/>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Bulan Terbaik</p>
                  <p className="text-sm font-bold text-emerald-400">
                    {bestMonth && bestMonth.pnl > 0 ? fmt(bestMonth.pnl) : '—'}
                  </p>
                  {bestMonth && bestMonth.pnl > 0 && (
                    <p className="text-xs text-muted-foreground">{bestMonth.full}</p>
                  )}
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Avg / Bulan</p>
                  <p className={`text-sm font-bold ${avgMonthly >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {byMonth.length > 0 ? fmt(avgMonthly) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">P&L</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Charts ── */}
      {byMonth.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">P&L per Bulan</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byMonth} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={60} tickFormatter={v => fmt(v)}/>
                  <Tooltip contentStyle={TooltipStyle} formatter={v => [fmt(Number(v)), 'P&L']}/>
                  <ReferenceLine y={0} stroke="var(--border)"/>
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {byMonth.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.8}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Arus Kas — Deposit vs Withdraw</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byMonth} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={60} tickFormatter={v => fmt(v)}/>
                  <Tooltip contentStyle={TooltipStyle} formatter={(v, name) => [fmt(Number(v)), name === 'deposit' ? 'Deposit' : 'Withdraw']}/>
                  <Legend wrapperStyle={{ fontSize: 10 }} formatter={v => v === 'deposit' ? 'Deposit' : 'Withdraw'}/>
                  <Bar dataKey="deposit"  name="deposit"  fill="#6366f1" fillOpacity={0.7} radius={[3, 3, 0, 0]}/>
                  <Bar dataKey="withdraw" name="withdraw" fill="#8b5cf6" fillOpacity={0.7} radius={[3, 3, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-sm">Kumulatif P&L</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={cumulativePnl} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                  <defs>
                    <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4}/>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={60} tickFormatter={v => fmt(v)}/>
                  <Tooltip contentStyle={TooltipStyle} formatter={v => [fmt(Number(v)), 'Kumulatif P&L']}/>
                  <ReferenceLine y={0} stroke="var(--border)"/>
                  <Area type="monotone" dataKey="equity" stroke="#6366f1" strokeWidth={2} fill="url(#eqFill)"/>
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="transfer">
        <TabsList>
          <TabsTrigger value="transfer">Catat Transfer</TabsTrigger>
          <TabsTrigger value="monthly">Laporan Bulanan</TabsTrigger>
          <TabsTrigger value="history">Riwayat</TabsTrigger>
          <TabsTrigger value="accounts">Per Akun</TabsTrigger>
        </TabsList>

        {/* Transfer Form */}
        <TabsContent value="transfer" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Catat Transfer Dana</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="flex gap-2">
                  <Button type="button" variant={type === 'deposit' ? 'default' : 'outline'} className="flex-1 gap-2" onClick={() => setType('deposit')}>
                    <ArrowDownLeft size={14}/> Deposit
                  </Button>
                  <Button type="button" variant={type === 'withdraw' ? 'default' : 'outline'} className="flex-1 gap-2" onClick={() => setType('withdraw')}>
                    <ArrowUpRight size={14}/> Withdraw
                  </Button>
                </div>
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Wallet size={12}/>
                  {type === 'deposit'
                    ? `Personal → ${accounts.find(a => a.id === selectedTradingAcc)?.name ?? 'Akun Trading'}`
                    : `${accounts.find(a => a.id === selectedTradingAcc)?.name ?? 'Akun Trading'} → Personal`}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Akun Trading</Label>
                    <Select value={selectedTradingAcc} onValueChange={(v) => setTradingAccId(v ?? '')}>
                      <SelectTrigger>
                        <SelectValue>
                          {tradingAccounts.find(a => a.id === selectedTradingAcc)?.name ?? 'Pilih akun'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {tradingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tanggal</Label>
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} required/>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Jumlah ({settings.currency})</Label>
                  <CurrencyInput value={amount} onChange={setAmount} placeholder="500.000"/>
                </div>
                <div>
                  <Label className="text-xs">Catatan (opsional)</Label>
                  <Textarea placeholder="Misal: top-up modal bulan ini" value={note} onChange={e => setNote(e.target.value)} rows={2}/>
                </div>
                <Button type="submit" className="w-full" disabled={!amount || Number(amount) <= 0}>
                  {type === 'deposit' ? 'Catat Deposit' : 'Catat Withdraw'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Ledger */}
        <TabsContent value="monthly" className="mt-4">
          {byMonth.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                <BarChart2 size={24} className="mx-auto mb-2 opacity-50"/>
                Belum ada data.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-sm">Ringkasan per Bulan</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Bulan</th>
                        <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Deposit</th>
                        <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Withdraw</th>
                        <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">P&L</th>
                        <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {[...byMonth].reverse().map(m => {
                        const net = m.pnl - m.deposit + m.withdraw
                        return (
                          <tr key={m.full} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">{m.full}</td>
                            <td className="px-4 py-3 text-right text-indigo-400">{m.deposit > 0 ? fmt(m.deposit) : '—'}</td>
                            <td className="px-4 py-3 text-right text-violet-400">{m.withdraw > 0 ? fmt(m.withdraw) : '—'}</td>
                            <td className={`px-4 py-3 text-right font-semibold ${m.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {m.pnl >= 0 ? '+' : ''}{fmt(m.pnl)}
                            </td>
                            <td className={`px-4 py-3 text-right font-bold ${net >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                              {net >= 0 ? '+' : ''}{fmt(net)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="border-t border-border">
                      <tr className="bg-muted/30">
                        <td className="px-4 py-2.5 font-bold">Total</td>
                        <td className="px-4 py-2.5 text-right font-bold text-indigo-400">{fmt(stats.total_deposited)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-violet-400">{fmt(stats.total_withdrawn)}</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${stats.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {stats.total_pnl >= 0 ? '+' : ''}{fmt(stats.total_pnl)}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold ${stats.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {stats.net_profit >= 0 ? '+' : ''}{fmt(stats.net_profit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="mt-4">
          {allTxns.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                <BarChart2 size={24} className="mx-auto mb-2 opacity-50"/>
                Belum ada transfer. Catat deposit pertamamu.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {allTxns.map(t => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${t.kind === 'deposit' ? 'bg-indigo-500/10' : 'bg-violet-500/10'}`}>
                          {t.kind === 'deposit'
                            ? <ArrowDownLeft size={13} className="text-indigo-400"/>
                            : <ArrowUpRight size={13} className="text-violet-400"/>}
                        </div>
                        <div>
                          <p className="font-medium">{t.label}</p>
                          <p className="text-xs text-muted-foreground">{t.date}{t.sub ? ` · ${t.sub}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className={`font-bold ${t.amount >= 0 ? 'text-indigo-400' : 'text-violet-400'}`}>
                          {t.amount >= 0 ? '+' : ''}{fmt(Math.abs(t.amount))}
                        </p>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteTransfer(t.id)}
                        >
                          <Trash2 size={13}/>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Per Account */}
        <TabsContent value="accounts" className="mt-4">
          <div className="space-y-3">
            {accountCapital.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Tambah akun trading di menu Setting
                </CardContent>
              </Card>
            ) : accountCapital.map(({ acc, deposited, withdrawn, pnl, balance }) => (
              <Card key={acc.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">{acc.broker ?? 'Trading account'} · {acc.currency}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-0.5">Saldo</p>
                      <p className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(balance)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                    <div className="rounded-lg bg-muted p-2.5 text-center">
                      <p className="text-muted-foreground mb-1">Deposited</p>
                      <p className="font-semibold text-indigo-400">{fmt(deposited)}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-2.5 text-center">
                      <p className="text-muted-foreground mb-1">P&L Trading</p>
                      <p className={`font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(pnl)}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-2.5 text-center">
                      <p className="text-muted-foreground mb-1">Withdrawn</p>
                      <p className="font-semibold text-violet-400">{fmt(withdrawn)}</p>
                    </div>
                  </div>
                  {deposited > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>ROI Akun Ini</span>
                        <span className={pnl >= 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                          {(pnl / deposited * 100).toFixed(2)}%
                        </span>
                      </div>
                      <Progress value={Math.min(100, Math.max(0, pnl / deposited * 100))} className="h-1.5"/>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
