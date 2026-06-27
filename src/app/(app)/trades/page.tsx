'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useCurrency } from '@/hooks/useCurrency'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { TradeDetailDialog } from '@/components/trade/TradeDetailDialog'
import { Plus, TrendingUp, TrendingDown, Filter, Check, X } from 'lucide-react'
import type { Trade } from '@/types'

type FormData = {
  account_id: string; date: string; entry_time: string
  pair: string; direction: 'long' | 'short'
  result: 'win' | 'loss' | 'breakeven'; pnl: string; strategy: string
  followed_plan: 'yes' | 'no' | ''; know_direction: 'yes' | 'no' | ''
  screenshot_url: string; note: string
}

const empty: FormData = {
  account_id: '', date: new Date().toISOString().split('T')[0], entry_time: '',
  pair: 'XAUUSD', direction: 'long', result: 'win', pnl: '', strategy: '',
  followed_plan: '', know_direction: '', screenshot_url: '', note: '',
}

function YesNo({ value, onChange, label }: { value: string; onChange: (v: 'yes'|'no') => void; label: string }) {
  return (
    <div>
      <Label className="text-xs mb-2 block">{label}</Label>
      <div className="flex gap-2">
        {(['yes','no'] as const).map(v => (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-all
              ${value === v
                ? v === 'yes' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-red-500/10 border-red-500/40 text-red-400'
                : 'border-border text-muted-foreground hover:bg-muted'}`}>
            {v === 'yes' ? <><Check size={11}/> Ya</> : <><X size={11}/> Tidak</>}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function TradesPage() {
  const { trades, accounts, settings, addTrade, deleteTrade } = useStore()
  const fmt = useCurrency()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormData>(empty)
  const [filterDir, setFilterDir] = useState('all')
  const [filterResult, setFilterResult] = useState('all')
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<Trade | null>(null)

  const tradingAccounts = accounts.filter(a => a.type === 'trading')

  function set(key: keyof FormData, val: string) {
    setForm(p => ({ ...p, [key]: val }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const pnlVal = parseFloat(form.pnl)
    if (!form.pnl || isNaN(pnlVal)) return
    addTrade({
      account_id: form.account_id || tradingAccounts[0]?.id || '',
      date: form.date, entry_time: form.entry_time || undefined,
      pair: form.pair, direction: form.direction, result: form.result,
      pnl: form.result === 'loss' ? -Math.abs(pnlVal) : Math.abs(pnlVal),
      strategy: form.strategy || undefined,
      followed_plan: form.followed_plan === 'yes' ? true : form.followed_plan === 'no' ? false : undefined,
      know_direction: form.know_direction === 'yes' ? true : form.know_direction === 'no' ? false : undefined,
      screenshot_url: form.screenshot_url || undefined,
      note: form.note || undefined,
    })
    setForm(empty); setOpen(false)
  }

  const filtered = trades.filter(t => {
    if (filterDir    !== 'all' && t.direction !== filterDir) return false
    if (filterResult !== 'all' && t.result    !== filterResult) return false
    if (search && !t.pair.toLowerCase().includes(search.toLowerCase()) &&
        !(t.strategy ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).sort((a, b) => b.date.localeCompare(a.date))

  const wins   = trades.filter(t => t.result === 'win').length
  const losses = trades.filter(t => t.result === 'loss').length
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Trade</h1>
          <p className="text-sm text-muted-foreground">
            {trades.length} trade · {wins}W {losses}L ·{' '}
            <span className={totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}
            </span>
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-2"><Plus size={14}/> Tambah Trade</Button>} />
          <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Catat Trade Baru</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4 mt-2">

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Tanggal</Label>
                  <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} required /></div>
                <div><Label className="text-xs">Jam Masuk</Label>
                  <Input type="time" value={form.entry_time} onChange={e => set('entry_time', e.target.value)} /></div>
              </div>

              {/* Pair — XAUUSD as primary */}
              <div>
                <Label className="text-xs">Pair</Label>
                <div className="flex gap-2 mt-1">
                  {['XAUUSD','XAGUSD'].map(p => (
                    <button key={p} type="button" onClick={() => set('pair', p)}
                      className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${form.pair === p ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                      {p}
                    </button>
                  ))}
                  <Input
                    placeholder="Pair lain…"
                    value={!['XAUUSD','XAGUSD'].includes(form.pair) ? form.pair : ''}
                    onChange={e => set('pair', e.target.value || 'XAUUSD')}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              {/* Akun */}
              <div>
                <Label className="text-xs">Akun Trading</Label>
                <Select value={form.account_id || tradingAccounts[0]?.id} onValueChange={(v) => set('account_id', v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Pilih akun" /></SelectTrigger>
                  <SelectContent>{tradingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Direction */}
              <div>
                <Label className="text-xs mb-2 block">Posisi</Label>
                <div className="flex gap-2">
                  {([['long','Long / Buy', TrendingUp, 'emerald'],['short','Short / Sell', TrendingDown, 'red']] as const).map(([val, label, Icon, color]) => (
                    <button key={val} type="button" onClick={() => set('direction', val)}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-all
                        ${form.direction === val
                          ? color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-red-500/10 border-red-500/40 text-red-400'
                          : 'border-border text-muted-foreground hover:bg-muted'}`}>
                      <Icon size={14}/> {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Result */}
              <div>
                <Label className="text-xs mb-2 block">Hasil</Label>
                <div className="flex gap-2">
                  {([['win','✅ Win','emerald'],['loss','❌ Loss','red'],['breakeven','⚖️ BE','yellow']] as const).map(([val,label,color]) => (
                    <button key={val} type="button" onClick={() => set('result', val)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-all
                        ${form.result === val
                          ? color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                            : color === 'red' ? 'bg-red-500/10 border-red-500/40 text-red-400'
                            : 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400'
                          : 'border-border text-muted-foreground hover:bg-muted'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* PnL */}
              <div>
                <Label className="text-xs">
                  Nominal {form.result === 'win' ? 'Profit' : form.result === 'loss' ? 'Loss' : 'P&L'} ({settings.currency})
                </Label>
                <Input type="number" step="any" placeholder={settings.currency === 'IDR' ? '150000' : '75.00'}
                  value={form.pnl} onChange={e => set('pnl', e.target.value)} required />
                <p className="text-xs text-muted-foreground mt-1">Masukkan angka positif — tanda +/- otomatis dari Hasil</p>
              </div>

              {/* Strategi */}
              <div>
                <Label className="text-xs">Strategi</Label>
                <Select value={form.strategy} onValueChange={(v) => set('strategy', v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Pilih strategi" /></SelectTrigger>
                  <SelectContent>{settings.strategies.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Yes/No */}
              <div className="grid grid-cols-2 gap-3">
                <YesNo value={form.followed_plan} onChange={v => set('followed_plan', v)} label="Ikut Trading Plan?" />
                <YesNo value={form.know_direction} onChange={v => set('know_direction', v)} label="Tahu Arah Pasar?" />
              </div>

              {/* Screenshot */}
              <div>
                <Label className="text-xs">Link Screenshot TradingView</Label>
                <Input placeholder="https://www.tradingview.com/x/..." value={form.screenshot_url} onChange={e => set('screenshot_url', e.target.value)} />
              </div>

              {/* Note */}
              <div>
                <Label className="text-xs">Catatan</Label>
                <Textarea placeholder="Setup, alasan entry, pelajaran…" value={form.note} onChange={e => set('note', e.target.value)} rows={3} />
              </div>

              <Button type="submit" className="w-full">Simpan Trade</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={13} className="text-muted-foreground" />
        <Input placeholder="Cari pair / strategi…" value={search} onChange={e => setSearch(e.target.value)} className="w-40 h-8 text-sm" />
        <Select value={filterDir} onValueChange={(v) => setFilterDir(v ?? 'all')}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua arah</SelectItem>
            <SelectItem value="long">Long</SelectItem>
            <SelectItem value="short">Short</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterResult} onValueChange={(v) => setFilterResult(v ?? 'all')}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua hasil</SelectItem>
            <SelectItem value="win">Win</SelectItem>
            <SelectItem value="loss">Loss</SelectItem>
            <SelectItem value="breakeven">Breakeven</SelectItem>
          </SelectContent>
        </Select>
        {(filterDir !== 'all' || filterResult !== 'all' || search) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterDir('all'); setFilterResult('all'); setSearch('') }}>Reset</Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} trade ditampilkan</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {trades.length === 0 ? 'Belum ada trade. Klik "Tambah Trade" untuk mulai.' : 'Tidak ada trade yang cocok filter.'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20 text-[11px] text-muted-foreground">
                    {['Tanggal','Pair','Posisi','Strategi','P&L','Hasil','Plan','Arah?',''].map(h => (
                      <th key={h} className={`px-4 py-3 font-semibold ${h === 'P&L' ? 'text-right' : h === 'Hasil' ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.map(t => (
                    <tr key={t.id}
                      className="hover:bg-muted/20 cursor-pointer transition-colors group"
                      onClick={() => setDetail(t)}>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div className="font-medium">{t.date}</div>
                        {t.entry_time && <div className="text-muted-foreground/50">{t.entry_time}</div>}
                      </td>
                      <td className="px-4 py-3 font-bold">{t.pair}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 w-fit text-xs font-bold ${t.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.direction === 'long' ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                          {t.direction === 'long' ? 'LONG' : 'SHORT'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{t.strategy ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={t.result === 'win' ? 'default' : t.result === 'loss' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {t.result === 'win' ? 'WIN' : t.result === 'loss' ? 'LOSS' : 'BE'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {t.followed_plan === true ? <span className="text-emerald-400">✓</span>
                          : t.followed_plan === false ? <span className="text-red-400">✗</span>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {t.know_direction === true ? <span className="text-emerald-400">✓</span>
                          : t.know_direction === false ? <span className="text-red-400">✗</span>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">Detail →</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail popup */}
      <TradeDetailDialog
        trade={detail}
        open={detail !== null}
        onClose={() => setDetail(null)}
        onDelete={id => { deleteTrade(id); setDetail(null) }}
        fmt={fmt}
      />
    </div>
  )
}
