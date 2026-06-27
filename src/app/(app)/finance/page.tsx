'use client'

import { useState, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { useCurrency } from '@/hooks/useCurrency'
import { calcStats } from '@/lib/calculations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  ArrowDownLeft, ArrowUpRight, Trash2, Wallet, TrendingUp, TrendingDown,
  BarChart2, PiggyBank, Target,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  AreaChart, Area, ReferenceLine, CartesianGrid,
} from 'recharts'

const TooltipStyle = { backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }

export default function FinancePage() {
  const { accounts, trades, transfers, settings, addTransfer, deleteTransfer } = useStore()
  const fmt   = useCurrency()
  const stats = calcStats(trades, transfers)

  const [type, setType]           = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount]       = useState('')
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [note, setNote]           = useState('')
  const [tradingAccId, setTradingAccId] = useState('')

  const personalAcc    = accounts.find(a => a.type === 'personal')
  const tradingAccounts = accounts.filter(a => a.type === 'trading')
  const selectedTradingAcc = tradingAccId || tradingAccounts[0]?.id || ''

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    addTransfer({
      from_account_id: type === 'deposit' ? (personalAcc?.id ?? 'personal') : selectedTradingAcc,
      to_account_id:   type === 'deposit' ? selectedTradingAcc : (personalAcc?.id ?? 'personal'),
      type, amount: amt, note: note || undefined, date,
    })
    setAmount(''); setNote('')
  }

  // Per-account capital
  const accountCapital = tradingAccounts.map(acc => {
    const deps = transfers.filter(t => t.type === 'deposit'  && t.to_account_id   === acc.id).reduce((s, t) => s + t.amount, 0)
    const wds  = transfers.filter(t => t.type === 'withdraw' && t.from_account_id  === acc.id).reduce((s, t) => s + t.amount, 0)
    const pnl  = trades.filter(t => t.account_id === acc.id).reduce((s, t) => s + t.pnl, 0)
    return { acc, deposited: deps, withdrawn: wds, pnl, balance: deps - wds + pnl }
  })

  // Monthly P&L
  const byMonth = useMemo(() => {
    const map: Record<string, { pnl: number; deposit: number; withdraw: number }> = {}
    for (const t of trades) {
      const k = t.date.slice(0,7)
      if (!map[k]) map[k] = { pnl: 0, deposit: 0, withdraw: 0 }
      map[k].pnl += t.pnl
    }
    for (const t of transfers) {
      const k = t.date.slice(0,7)
      if (!map[k]) map[k] = { pnl: 0, deposit: 0, withdraw: 0 }
      if (t.type === 'deposit')  map[k].deposit  += t.amount
      if (t.type === 'withdraw') map[k].withdraw += t.amount
    }
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => ({ name: k.slice(5), full: k, ...v }))
  }, [trades, transfers])

  // Cumulative equity
  const cumulative = useMemo(() => {
    let running = 0
    return byMonth.map(m => { running += m.pnl; return { name: m.name, equity: running } })
  }, [byMonth])

  // ROI
  const roi = stats.total_deposited > 0 ? (stats.net_profit / stats.total_deposited * 100) : null

  // Biggest month
  const bestMonth  = byMonth.length > 0 ? byMonth.reduce((a,b) => b.pnl > a.pnl ? b : a, byMonth[0]) : null
  const worstMonth = byMonth.length > 0 ? byMonth.reduce((a,b) => b.pnl < a.pnl ? b : a, byMonth[0]) : null
  const avgMonthly = byMonth.length > 0 ? byMonth.reduce((s,m) => s+m.pnl, 0) / byMonth.length : 0

  const monthStr = new Date().toISOString().slice(0,7)
  const monthPnl = trades.filter(t => t.date.startsWith(monthStr)).reduce((s,t) => s+t.pnl, 0)
  const { targetBulanan = 0 } = settings

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold">Keuangan</h1>
        <p className="text-sm text-muted-foreground">Pisahkan dana personal dan trading, analisa keuangan lengkap</p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <PiggyBank size={13} className="text-blue-400"/>
              <p className="text-xs text-muted-foreground">Modal Trading</p>
            </div>
            <p className="text-2xl font-bold text-blue-400">{fmt(stats.trading_capital)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Saldo aktif sekarang</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownLeft size={13} className="text-indigo-400"/>
              <p className="text-xs text-muted-foreground">Total Deposit</p>
            </div>
            <p className="text-2xl font-bold text-indigo-400">{fmt(stats.total_deposited)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Modal masuk</p>
          </CardContent>
        </Card>
        <Card className="border-violet-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight size={13} className="text-violet-400"/>
              <p className="text-xs text-muted-foreground">Total Withdraw</p>
            </div>
            <p className="text-2xl font-bold text-violet-400">{fmt(stats.total_withdrawn)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Dana ditarik</p>
          </CardContent>
        </Card>
        <Card className={stats.net_profit >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              {stats.net_profit >= 0 ? <TrendingUp size={13} className="text-emerald-400"/> : <TrendingDown size={13} className="text-red-400"/>}
              <p className="text-xs text-muted-foreground">Profit Bersih Riil</p>
            </div>
            <p className={`text-2xl font-bold ${stats.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(stats.net_profit)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Withdraw − Deposit</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Analisis Ringkas ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-card border border-border/50 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">ROI</p>
          <p className={`text-2xl font-black ${roi !== null && roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {roi !== null ? `${roi.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-card border border-border/50 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Rata-rata / Bulan</p>
          <p className={`text-2xl font-black ${avgMonthly >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{byMonth.length > 0 ? fmt(avgMonthly) : '—'}</p>
        </div>
        <div className="rounded-xl bg-card border border-border/50 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Bulan Terbaik</p>
          <p className="text-lg font-black text-emerald-400">{bestMonth && bestMonth.pnl > 0 ? fmt(bestMonth.pnl) : '—'}</p>
          {bestMonth && bestMonth.pnl > 0 && <p className="text-xs text-muted-foreground">{bestMonth.full}</p>}
        </div>
        <div className="rounded-xl bg-card border border-border/50 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Bulan Terburuk</p>
          <p className="text-lg font-black text-red-400">{worstMonth && worstMonth.pnl < 0 ? fmt(worstMonth.pnl) : '—'}</p>
          {worstMonth && worstMonth.pnl < 0 && <p className="text-xs text-muted-foreground">{worstMonth.full}</p>}
        </div>
      </div>

      {/* Monthly Target */}
      {targetBulanan > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Target size={14}/> Monthly Target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{monthStr}</span>
                <span className={monthPnl >= targetBulanan ? 'text-emerald-400 font-bold' : 'text-muted-foreground'}>
                  {fmt(monthPnl)} / {fmt(targetBulanan)} ({Math.min(100,Math.max(0,Math.round(monthPnl/targetBulanan*100)))}%)
                </span>
              </div>
              <Progress value={Math.min(100,Math.max(0,monthPnl/targetBulanan*100))} className="h-2"/>
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
                <BarChart data={byMonth} margin={{top:4,right:4,bottom:4,left:0}}>
                  <XAxis dataKey="name" tick={{fontSize:10}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:10}} tickLine={false} axisLine={false} width={60} tickFormatter={v=>fmt(v)}/>
                  <Tooltip contentStyle={TooltipStyle} formatter={(v)=>[fmt(Number(v)),'P&L']}/>
                  <ReferenceLine y={0} stroke="var(--border)"/>
                  <Bar dataKey="pnl" radius={[4,4,0,0]}>
                    {byMonth.map((e,i) => <Cell key={i} fill={e.pnl>=0?'#10b981':'#ef4444'} fillOpacity={0.8}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Kumulatif P&L</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={cumulative} margin={{top:4,right:4,bottom:4,left:0}}>
                  <defs>
                    <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4}/>
                  <XAxis dataKey="name" tick={{fontSize:10}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:10}} tickLine={false} axisLine={false} width={60} tickFormatter={v=>fmt(v)}/>
                  <Tooltip contentStyle={TooltipStyle} formatter={(v)=>[fmt(Number(v)),'Kumulatif']}/>
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
          <TabsTrigger value="history">Riwayat</TabsTrigger>
          <TabsTrigger value="accounts">Per Akun</TabsTrigger>
        </TabsList>

        {/* Transfer Form */}
        <TabsContent value="transfer" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Transfer Dana</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="flex gap-2">
                  <Button type="button" variant={type === 'deposit' ? 'default' : 'outline'} className="flex-1 gap-2" onClick={() => setType('deposit')}>
                    <ArrowDownLeft size={14} /> Deposit
                  </Button>
                  <Button type="button" variant={type === 'withdraw' ? 'default' : 'outline'} className="flex-1 gap-2" onClick={() => setType('withdraw')}>
                    <ArrowUpRight size={14} /> Withdraw
                  </Button>
                </div>
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Wallet size={12} />
                  {type === 'deposit'
                    ? `Personal → ${accounts.find(a => a.id === selectedTradingAcc)?.name ?? 'Akun Trading'}`
                    : `${accounts.find(a => a.id === selectedTradingAcc)?.name ?? 'Akun Trading'} → Personal`}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Akun Trading</Label>
                    <Select value={selectedTradingAcc} onValueChange={(v) => setTradingAccId(v ?? '')}>
                      <SelectTrigger><SelectValue placeholder="Pilih akun" /></SelectTrigger>
                      <SelectContent>
                        {tradingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tanggal</Label>
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Jumlah ({settings.currency})</Label>
                  <Input type="number" step="any" placeholder="500000" value={amount} onChange={e => setAmount(e.target.value)} required />
                </div>
                <div>
                  <Label className="text-xs">Catatan (opsional)</Label>
                  <Textarea placeholder="Misal: top-up modal bulan ini" value={note} onChange={e => setNote(e.target.value)} rows={2} />
                </div>
                <Button type="submit" className="w-full">
                  {type === 'deposit' ? 'Catat Deposit' : 'Catat Withdraw'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="mt-4">
          {transfers.length === 0 ? (
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
                  {[...transfers].sort((a,b) => b.date.localeCompare(a.date)).map(t => {
                    const fromAcc = accounts.find(a => a.id === t.from_account_id)?.name ?? t.from_account_id
                    const toAcc   = accounts.find(a => a.id === t.to_account_id)?.name ?? t.to_account_id
                    return (
                      <div key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-full ${t.type === 'deposit' ? 'bg-indigo-500/10' : 'bg-violet-500/10'}`}>
                            {t.type === 'deposit' ? <ArrowDownLeft size={13} className="text-indigo-400"/> : <ArrowUpRight size={13} className="text-violet-400"/>}
                          </div>
                          <div>
                            <p className="font-medium">{fromAcc} → {toAcc}</p>
                            <p className="text-xs text-muted-foreground">{t.date}{t.note ? ` · ${t.note}` : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <Badge variant={t.type === 'deposit' ? 'default' : 'secondary'} className="text-xs mb-1">
                              {t.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                            </Badge>
                            <p className="font-bold">{fmt(t.amount)}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTransfer(t.id)}>
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
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
                <CardContent className="py-12 text-center text-sm text-muted-foreground">Tambah akun trading di menu Setting</CardContent>
              </Card>
            ) : accountCapital.map(({ acc, deposited, withdrawn, pnl, balance }) => (
              <Card key={acc.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">{acc.broker ?? 'Trading account'} · {acc.currency}</p>
                    </div>
                    <p className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(balance)}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg bg-muted p-2 text-center">
                      <p className="text-muted-foreground mb-1">Deposited</p>
                      <p className="font-semibold text-indigo-400">{fmt(deposited)}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-2 text-center">
                      <p className="text-muted-foreground mb-1">P&L Trading</p>
                      <p className={`font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(pnl)}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-2 text-center">
                      <p className="text-muted-foreground mb-1">Withdrawn</p>
                      <p className="font-semibold text-violet-400">{fmt(withdrawn)}</p>
                    </div>
                  </div>
                  {deposited > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>ROI</span>
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
