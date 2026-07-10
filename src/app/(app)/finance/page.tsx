'use client'

import { useState, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { useCurrency } from '@/hooks/useCurrency'
import { useT } from '@/lib/i18n'
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
  ArrowDownLeft, ArrowUpRight, Trash2, TrendingUp, TrendingDown,
  BarChart2, Landmark, PiggyBank, Coins,
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

export default function FinancePage() {
  const { accounts, trades, transfers, settings, addTransfer, deleteTransfer } = useStore()
  const fmt = useCurrency()
  const t = useT()

  // ── Filter akun (multi-akun) ──
  const [scope, setScope] = useState<string>('all')   // 'all' | account.id

  // ── Form catat dana ──
  const [type, setType]     = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState<number | ''>('')
  const [date, setDate]     = useState(new Date().toISOString().split('T')[0])
  const [note, setNote]     = useState('')
  const [formAcc, setFormAcc] = useState('')

  const selectedFormAcc = formAcc || accounts[0]?.id || ''

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0 || !selectedFormAcc) return
    addTransfer({ account_id: selectedFormAcc, type, amount: amt, note: note || undefined, date })
    setAmount(''); setNote('')
  }

  // ── Hitung angka sesuai scope (semua akun / satu akun) ──
  const inScope = <T extends { account_id: string }>(rows: T[]) =>
    scope === 'all' ? rows : rows.filter(r => r.account_id === scope)

  const scopedAccounts = scope === 'all' ? accounts : accounts.filter(a => a.id === scope)
  const scopedTransfers = inScope(transfers)
  const scopedTrades    = inScope(trades)

  const starting   = scopedAccounts.reduce((s, a) => s + (a.initial_balance ?? 0), 0)
  const deposited  = scopedTransfers.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  const withdrawn  = scopedTransfers.filter(t => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0)
  const pnl        = scopedTrades.reduce((s, t) => s + t.pnl, 0)
  const balance    = starting + deposited - withdrawn + pnl
  const invested   = starting + deposited
  const roi        = invested > 0 ? (pnl / invested) * 100 : null

  // ── Ringkasan per akun ──
  const perAccount = accounts.map(acc => {
    const deps = transfers.filter(t => t.type === 'deposit'  && t.account_id === acc.id).reduce((s, t) => s + t.amount, 0)
    const wds  = transfers.filter(t => t.type === 'withdraw' && t.account_id === acc.id).reduce((s, t) => s + t.amount, 0)
    const p    = trades.filter(t => t.account_id === acc.id).reduce((s, t) => s + t.pnl, 0)
    const init = acc.initial_balance ?? 0
    return { acc, init, deposited: deps, withdrawn: wds, pnl: p, balance: init + deps - wds + p }
  })

  // ── Data bulanan (sesuai scope) ──
  const byMonth = useMemo(() => {
    const map: Record<string, { pnl: number; deposit: number; withdraw: number }> = {}
    for (const t of scopedTrades) {
      const k = t.date.slice(0, 7)
      if (!map[k]) map[k] = { pnl: 0, deposit: 0, withdraw: 0 }
      map[k].pnl += t.pnl
    }
    for (const t of scopedTransfers) {
      const k = t.date.slice(0, 7)
      if (!map[k]) map[k] = { pnl: 0, deposit: 0, withdraw: 0 }
      if (t.type === 'deposit')  map[k].deposit  += t.amount
      if (t.type === 'withdraw') map[k].withdraw += t.amount
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ name: k.slice(5), full: k, ...v }))
  }, [scopedTrades, scopedTransfers])

  const cumulativePnl = useMemo(() => {
    // mulai dari saldo awal, akumulasi deposit − withdraw + pnl tiap bulan
    let base = starting
    return byMonth.map(m => { base += m.deposit - m.withdraw + m.pnl; return { name: m.name, equity: base } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byMonth])

  const monthStr = new Date().toISOString().slice(0, 7)
  const thisMonthDeposit  = scopedTransfers.filter(t => t.type === 'deposit'  && t.date.startsWith(monthStr)).reduce((s, t) => s + t.amount, 0)
  const thisMonthWithdraw = scopedTransfers.filter(t => t.type === 'withdraw' && t.date.startsWith(monthStr)).reduce((s, t) => s + t.amount, 0)
  const thisMonthPnl      = scopedTrades.filter(t => t.date.startsWith(monthStr)).reduce((s, t) => s + t.pnl, 0)

  // ── Riwayat transaksi (sesuai scope) ──
  const allTxns = useMemo(() => {
    return [...scopedTransfers]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(t => ({
        id: t.id,
        date: t.date,
        label: t.type === 'deposit' ? 'Deposit' : 'Withdraw',
        acc: accounts.find(a => a.id === t.account_id)?.name ?? '',
        sub: t.note ?? '',
        amount: t.type === 'deposit' ? t.amount : -t.amount,
        kind: t.type as string,
      }))
  }, [scopedTransfers, accounts])

  const scopeName = scope === 'all' ? 'Semua Akun' : (accounts.find(a => a.id === scope)?.name ?? 'Akun')

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">{t('Keuangan Broker')}</h1>
          <p className="text-sm text-muted-foreground">{t('Catatan dana di akun broker — deposit, withdraw, dan hasil trading')}</p>
        </div>
        {/* Pemilih akun */}
        {accounts.length > 0 && (
          <Select value={scope} onValueChange={v => setScope(v ?? 'all')}>
            <SelectTrigger className="w-48">
              <SelectValue>{scopeName}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Akun</SelectItem>
              {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── 4 Metrik Sederhana ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Landmark size={12} className="text-emerald-400"/>
              <p className="text-xs text-muted-foreground">{t('Saldo Sekarang')}</p>
            </div>
            <p className="text-2xl font-black tracking-tight">{fmt(balance)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t('Total uang di broker saat ini')}</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-500/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowDownLeft size={12} className="text-indigo-400"/>
              <p className="text-xs text-muted-foreground">{t('Total Deposit')}</p>
            </div>
            <p className="text-2xl font-black text-indigo-400 tracking-tight">{fmt(deposited)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t('Uang yang kamu setor')}</p>
          </CardContent>
        </Card>
        <Card className="border-violet-500/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowUpRight size={12} className="text-violet-400"/>
              <p className="text-xs text-muted-foreground">{t('Total Withdraw')}</p>
            </div>
            <p className="text-2xl font-black text-violet-400 tracking-tight">{fmt(withdrawn)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t('Uang yang sudah ditarik')}</p>
          </CardContent>
        </Card>
        <Card className={pnl >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-1.5 mb-1">
              {pnl >= 0 ? <TrendingUp size={12} className="text-emerald-400"/> : <TrendingDown size={12} className="text-red-400"/>}
              <p className="text-xs text-muted-foreground">{t('Profit Trading')}</p>
            </div>
            <p className={`text-2xl font-black tracking-tight ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {pnl >= 0 ? '+' : ''}{fmt(pnl)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t('Murni dari hasil trade')}{roi !== null ? ` · ROI ${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%` : ''}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Rincian saldo (rumus jelas) ── */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground mb-3">{t('Cara hitung saldo')} — {scope === 'all' ? t('Semua Akun') : scopeName}</p>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-2 text-sm">
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">{t('Saldo Awal')}</p>
              <p className="font-bold">{fmt(starting)}</p>
            </div>
            <span className="text-muted-foreground font-bold">+</span>
            <div className="rounded-lg bg-indigo-500/10 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">{t('Deposit')}</p>
              <p className="font-bold text-indigo-400">{fmt(deposited)}</p>
            </div>
            <span className="text-muted-foreground font-bold">−</span>
            <div className="rounded-lg bg-violet-500/10 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">{t('Withdraw')}</p>
              <p className="font-bold text-violet-400">{fmt(withdrawn)}</p>
            </div>
            <span className="text-muted-foreground font-bold">+</span>
            <div className="rounded-lg bg-emerald-500/10 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">{t('Profit')}</p>
              <p className={`font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pnl >= 0 ? '+' : ''}{fmt(pnl)}</p>
            </div>
            <span className="text-muted-foreground font-bold">=</span>
            <div className="rounded-lg bg-foreground/5 border border-border/60 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">{t('Saldo Sekarang')}</p>
              <p className="font-black">{fmt(balance)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Bulan ini ── */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-indigo-500/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">{t('Deposit Bln Ini')}</p>
            <p className="text-lg font-bold text-indigo-400">{fmt(thisMonthDeposit)}</p>
          </CardContent>
        </Card>
        <Card className="border-violet-500/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">{t('Withdraw Bln Ini')}</p>
            <p className="text-lg font-bold text-violet-400">{fmt(thisMonthWithdraw)}</p>
          </CardContent>
        </Card>
        <Card className={thisMonthPnl >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">{t('Profit Bln Ini')}</p>
            <p className={`text-lg font-bold ${thisMonthPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {thisMonthPnl >= 0 ? '+' : ''}{fmt(thisMonthPnl)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts ── */}
      {byMonth.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">{t('Profit Trading per Bulan')}</CardTitle></CardHeader>
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
            <CardHeader><CardTitle className="text-sm">{t('Deposit vs Withdraw')}</CardTitle></CardHeader>
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
            <CardHeader><CardTitle className="text-sm">{t('Pertumbuhan Saldo')}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={cumulativePnl} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                  <defs>
                    <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4}/>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={60} tickFormatter={v => fmt(v)}/>
                  <Tooltip contentStyle={TooltipStyle} formatter={v => [fmt(Number(v)), 'Saldo']}/>
                  <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} fill="url(#eqFill)"/>
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="catat">
        <TabsList>
          <TabsTrigger value="catat">{t('Catat Dana')}</TabsTrigger>
          <TabsTrigger value="riwayat">{t('Riwayat')}</TabsTrigger>
          <TabsTrigger value="akun">{t('Per Akun')}</TabsTrigger>
        </TabsList>

        {/* Form Catat Dana */}
        <TabsContent value="catat" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">{t('Catat Deposit / Withdraw')}</CardTitle></CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">{t('Tambah akun broker dulu di menu Setting.')}</p>
              ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="flex gap-2">
                  <Button type="button" variant={type === 'deposit' ? 'default' : 'outline'} className="flex-1 gap-2" onClick={() => setType('deposit')}>
                    <ArrowDownLeft size={14}/> Deposit
                  </Button>
                  <Button type="button" variant={type === 'withdraw' ? 'default' : 'outline'} className="flex-1 gap-2" onClick={() => setType('withdraw')}>
                    <ArrowUpRight size={14}/> Withdraw
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{t('Akun Broker')}</Label>
                    <Select value={selectedFormAcc} onValueChange={v => setFormAcc(v ?? '')}>
                      <SelectTrigger>
                        <SelectValue>{accounts.find(a => a.id === selectedFormAcc)?.name ?? t('Pilih akun')}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t('Tanggal')}</Label>
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} required/>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{t('Jumlah')} ({settings.currency})</Label>
                  <CurrencyInput value={amount} onChange={setAmount} placeholder="500.000"/>
                </div>
                <div>
                  <Label className="text-xs">{t('Catatan (opsional)')}</Label>
                  <Textarea placeholder={type === 'deposit' ? 'Misal: top-up modal' : 'Misal: tarik profit'} value={note} onChange={e => setNote(e.target.value)} rows={2}/>
                </div>
                <Button type="submit" className="w-full" disabled={!amount || Number(amount) <= 0}>
                  {type === 'deposit' ? t('Catat Deposit') : t('Catat Withdraw')}
                </Button>
              </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Riwayat */}
        <TabsContent value="riwayat" className="mt-4">
          {allTxns.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                <BarChart2 size={24} className="mx-auto mb-2 opacity-50"/>
                {t('Belum ada catatan dana. Catat deposit pertamamu.')}
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
                          <p className="font-medium">{t.label} · {t.acc}</p>
                          <p className="text-xs text-muted-foreground">{t.date}{t.sub ? ` · ${t.sub}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className={`font-bold ${t.amount >= 0 ? 'text-indigo-400' : 'text-violet-400'}`}>
                          {t.amount >= 0 ? '+' : '−'}{fmt(Math.abs(t.amount))}
                        </p>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteTransfer(t.id)}>
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

        {/* Per Akun */}
        <TabsContent value="akun" className="mt-4">
          <div className="space-y-3">
            {perAccount.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  {t('Tambah akun broker di menu Setting')}
                </CardContent>
              </Card>
            ) : perAccount.map(({ acc, init, deposited, withdrawn, pnl, balance }) => {
              const invested = init + deposited
              const accRoi = invested > 0 ? (pnl / invested) * 100 : 0
              return (
                <Card key={acc.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-semibold">{acc.name}</p>
                        <p className="text-xs text-muted-foreground">{acc.broker ?? 'Akun broker'} · {acc.currency}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-0.5">{t('Saldo Sekarang')}</p>
                        <p className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(balance)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                      <div className="rounded-lg bg-muted p-2.5 text-center">
                        <p className="text-muted-foreground mb-1 flex items-center justify-center gap-1"><PiggyBank size={10}/> {t('Awal')}</p>
                        <p className="font-semibold">{fmt(init)}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-2.5 text-center">
                        <p className="text-muted-foreground mb-1">{t('Deposit')}</p>
                        <p className="font-semibold text-indigo-400">{fmt(deposited)}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-2.5 text-center">
                        <p className="text-muted-foreground mb-1">{t('Withdraw')}</p>
                        <p className="font-semibold text-violet-400">{fmt(withdrawn)}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-2.5 text-center">
                        <p className="text-muted-foreground mb-1 flex items-center justify-center gap-1"><Coins size={10}/> {t('Profit')}</p>
                        <p className={`font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(pnl)}</p>
                      </div>
                    </div>
                    {invested > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{t('ROI Akun Ini')}</span>
                          <span className={pnl >= 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                            {accRoi >= 0 ? '+' : ''}{accRoi.toFixed(2)}%
                          </span>
                        </div>
                        <Progress value={Math.min(100, Math.max(0, accRoi))} className="h-1.5"/>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
