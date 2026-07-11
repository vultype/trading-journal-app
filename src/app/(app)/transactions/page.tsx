'use client'

import { useState, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { useCurrency } from '@/hooks/useCurrency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/ui/currency-input'
import { ArrowDownLeft, ArrowUpRight, Trash2, Filter } from 'lucide-react'

export default function TransactionsPage() {
  const { accounts, transfers, settings, addTransfer, deleteTransfer } = useStore()
  const fmt = useCurrency()

  const [type, setType]     = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState<number | ''>('')
  const [date, setDate]     = useState(new Date().toISOString().split('T')[0])
  const [note, setNote]     = useState('')
  const [formAcc, setFormAcc] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdraw'>('all')
  const [filterAcc, setFilterAcc]   = useState('all')

  const selectedFormAcc = formAcc || accounts[0]?.id || ''

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0 || !selectedFormAcc) return
    addTransfer({ account_id: selectedFormAcc, type, amount: amt, note: note || undefined, date })
    setAmount(''); setNote('')
  }

  const totalDeposit  = transfers.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  const totalWithdraw = transfers.filter(t => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0)

  const list = useMemo(() => {
    return [...transfers]
      .filter(t => filterType === 'all' || t.type === filterType)
      .filter(t => filterAcc === 'all' || t.account_id === filterAcc)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(t => ({
        id: t.id, date: t.date, type: t.type, amount: t.amount, note: t.note ?? '',
        acc: accounts.find(a => a.id === t.account_id)?.name ?? '—',
      }))
  }, [transfers, accounts, filterType, filterAcc])

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold">Deposit &amp; Withdraw</h1>
        <p className="text-sm text-muted-foreground">Catat dan kelola aliran dana di akun broker kamu</p>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/8 to-transparent">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-1.5 mb-1"><ArrowDownLeft size={13} className="text-indigo-400" /><p className="text-xs text-muted-foreground">Total Deposit</p></div>
            <p className="text-2xl font-black text-indigo-400">{fmt(totalDeposit)}</p>
          </CardContent>
        </Card>
        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/8 to-transparent">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-1.5 mb-1"><ArrowUpRight size={13} className="text-violet-400" /><p className="text-xs text-muted-foreground">Total Withdraw</p></div>
            <p className="text-2xl font-black text-violet-400">{fmt(totalWithdraw)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Jumlah Transaksi</p>
            <p className="text-2xl font-black">{transfers.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Catat Transaksi</CardTitle></CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Tambah akun broker dulu di Setting.</p>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div className="flex gap-2">
                    <Button type="button" variant={type === 'deposit' ? 'default' : 'outline'} className="flex-1 gap-2" onClick={() => setType('deposit')}>
                      <ArrowDownLeft size={14} /> Deposit
                    </Button>
                    <Button type="button" variant={type === 'withdraw' ? 'default' : 'outline'} className="flex-1 gap-2" onClick={() => setType('withdraw')}>
                      <ArrowUpRight size={14} /> Withdraw
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">Akun Broker</Label>
                    <Select value={selectedFormAcc} onValueChange={v => setFormAcc(v ?? '')}>
                      <SelectTrigger><SelectValue>{accounts.find(a => a.id === selectedFormAcc)?.name ?? 'Pilih akun'}</SelectValue></SelectTrigger>
                      <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tanggal</Label>
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                  </div>
                  <div>
                    <Label className="text-xs">Jumlah ({settings.currency})</Label>
                    <CurrencyInput value={amount} onChange={setAmount} placeholder="500.000" />
                  </div>
                  <div>
                    <Label className="text-xs">Catatan (opsional)</Label>
                    <Textarea placeholder={type === 'deposit' ? 'Misal: top-up modal' : 'Misal: tarik profit'} value={note} onChange={e => setNote(e.target.value)} rows={2} />
                  </div>
                  <Button type="submit" className="w-full" disabled={!amount || Number(amount) <= 0}>
                    {type === 'deposit' ? 'Catat Deposit' : 'Catat Withdraw'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Riwayat */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-sm">Riwayat Transaksi</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={filterType} onValueChange={v => setFilterType((v ?? 'all') as any)}>
                    <SelectTrigger className="h-8 text-xs w-28"><SelectValue>{filterType === 'all' ? 'Semua' : filterType === 'deposit' ? 'Deposit' : 'Withdraw'}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua</SelectItem>
                      <SelectItem value="deposit">Deposit</SelectItem>
                      <SelectItem value="withdraw">Withdraw</SelectItem>
                    </SelectContent>
                  </Select>
                  {accounts.length > 1 && (
                    <Select value={filterAcc} onValueChange={v => setFilterAcc(v ?? 'all')}>
                      <SelectTrigger className="h-8 text-xs w-32"><SelectValue>{filterAcc === 'all' ? 'Semua Akun' : accounts.find(a => a.id === filterAcc)?.name}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Akun</SelectItem>
                        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {list.length === 0 ? (
                <div className="py-14 text-center">
                  <Filter size={22} className="mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Belum ada transaksi</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 text-[11px] text-muted-foreground">
                        <th className="text-left px-4 py-2.5 font-semibold">Tanggal</th>
                        <th className="text-left px-3 py-2.5 font-semibold">Tipe</th>
                        <th className="text-left px-3 py-2.5 font-semibold">Akun</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Jumlah</th>
                        <th className="px-3 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {list.map(t => (
                        <tr key={t.id} className="hover:bg-muted/20 transition-colors group">
                          <td className="px-4 py-3">
                            <div className="text-xs font-medium">{t.date}</div>
                            {t.note && <div className="text-[10px] text-muted-foreground/60 max-w-[160px] truncate">{t.note}</div>}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${t.type === 'deposit' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-violet-500/10 text-violet-400'}`}>
                              {t.type === 'deposit' ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                              {t.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{t.acc}</td>
                          <td className={`px-3 py-3 text-right font-bold ${t.type === 'deposit' ? 'text-indigo-400' : 'text-violet-400'}`}>
                            {t.type === 'deposit' ? '+' : '−'}{fmt(t.amount)}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button onClick={() => deleteTransfer(t.id)} className="text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
