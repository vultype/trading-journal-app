'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { useCurrency } from '@/hooks/useCurrency'
import { useT } from '@/lib/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'
import { TradeDetailDialog } from '@/components/trade/TradeDetailDialog'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Plus, TrendingUp, TrendingDown, Filter, Check, X, RotateCcw, Link2, Upload, Loader2, MoveHorizontal, SlidersHorizontal, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from '@/lib/toast'
import type { Trade } from '@/types'

function AutoTextarea({ value, onChange, placeholder, className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    ref.current.style.height = ref.current.scrollHeight + 'px'
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className={[
        'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors',
        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden',
        className,
      ].filter(Boolean).join(' ')}
    />
  )
}

function ChipBtn({ active, color, onClick, children }: {
  active: boolean
  color: 'green' | 'red' | 'teal' | 'orange'
  onClick: () => void
  children: React.ReactNode
}) {
  const activeMap = {
    green:  'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
    red:    'bg-red-500/20 border-red-500/50 text-red-400',
    teal:   'bg-teal-500/20 border-teal-500/50 text-teal-400',
    orange: 'bg-orange-500/20 border-orange-500/50 text-orange-400',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all
        ${active ? activeMap[color] : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'}`}
    >
      {children}
    </button>
  )
}

type MarketStructure = 'bullish' | 'bearish' | 'ranging' | ''

// Tag sesi market dari jam entry (WIB). Selaras dengan HourAnalysis.
function sessionTag(time: string): { label: string; emoji: string; color: string } | null {
  const h = parseInt(time.slice(0, 2), 10)
  if (isNaN(h)) return null
  if (h >= 5 && h < 15)  return { label: 'Asia',    emoji: '🌏', color: 'text-sky-400/70' }
  if (h >= 15 && h < 20) return { label: 'London',  emoji: '🇬🇧', color: 'text-violet-400/70' }
  if (h >= 20 && h < 24) return { label: 'Overlap', emoji: '🔥', color: 'text-orange-400/70' }
  return { label: 'New York', emoji: '🗽', color: 'text-amber-400/70' }
}

type FormData = {
  account_id: string; date: string; entry_time: string
  pair: string; direction: 'long' | 'short'
  result: 'win' | 'loss' | 'breakeven'; pnl: number | ''; strategy: string
  market_structure: MarketStructure
  followed_plan: 'yes' | 'no' | ''; know_direction: 'yes' | 'no' | ''
  screenshot_url: string; note: string; ai_analysis: string
  is_overtrade: boolean
  // advanced (detail)
  entry_price: number | ''; exit_price: number | ''
  lot_size: number | ''; rr_ratio: number | ''; fees: number | ''
}

const empty: FormData = {
  account_id: '', date: new Date().toISOString().split('T')[0], entry_time: '',
  pair: 'XAUUSD', direction: 'long', result: 'win', pnl: '', strategy: '',
  market_structure: '',
  followed_plan: '', know_direction: '', screenshot_url: '', note: '', ai_analysis: '',
  is_overtrade: false,
  entry_price: '', exit_price: '', lot_size: '', rr_ratio: '', fees: '',
}

function ToggleGroup({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; color?: 'green' | 'red' | 'yellow' }[]
}) {
  const colorMap = {
    green:  'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    red:    'bg-red-500/10 border-red-500/30 text-red-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  }
  return (
    <div className="flex gap-2">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-all
            ${value === o.value
              ? (o.color ? colorMap[o.color] : 'bg-primary/10 border-primary/30 text-primary')
              : 'border-border/60 text-muted-foreground hover:bg-muted'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function TradesPage() {
  const { trades, accounts, transfers, settings, addTrade, deleteTrade } = useStore()
  const fmt = useCurrency()
  const t = useT()
  // Basis equity untuk hitung %change per trade (saldo awal + deposit − withdraw)
  const equityBase = useMemo(() => {
    const initial = accounts.reduce((s, a) => s + (a.initial_balance ?? 0), 0)
    const dep = transfers.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
    const wd  = transfers.filter(t => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0)
    return initial + dep - wd
  }, [accounts, transfers])
  const [open, setOpen]         = useState(false)
  const [form, setForm]         = useState<FormData>(empty)
  const [detail, setDetail]     = useState<Trade | null>(null)
  const [imgMode, setImgMode]   = useState<'link' | 'upload'>('link')
  const [uploading, setUploading] = useState(false)

  // Filter states
  const [quickFilter, setQuickFilter]         = useState<'' | 'winners' | 'losers' | 'bigwin' | 'bigloss'>('')
  const [filterResult, setFilterResult]       = useState('all')
  const [filterDir, setFilterDir]             = useState('all')
  const [filterPair, setFilterPair]           = useState('all')
  const [filterStrategy, setFilterStrategy]   = useState('all')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate]     = useState('')
  const [filterMinProfit, setFilterMinProfit] = useState('')
  const [filterMaxLoss, setFilterMaxLoss]     = useState('')
  const [showAdvanced, setShowAdvanced]       = useState(false)

  const tradingAccounts = accounts   // semua akun sekarang akun broker/trading
  const allPairs = useMemo(() => [...new Set(trades.map(t => t.pair))].sort(), [trades])
  const allStrategies = useMemo(() => {
    const fromTrades = trades.map(t => t.strategy).filter(Boolean) as string[]
    return [...new Set([...settings.strategies, ...fromTrades])].sort()
  }, [trades, settings.strategies])

  useEffect(() => {
    if (!form.account_id && tradingAccounts.length > 0) {
      setForm(p => ({ ...p, account_id: tradingAccounts[0].id }))
    }
  }, [tradingAccounts.length])

  // Apply default pair from settings for fresh (empty) trades
  useEffect(() => {
    if (settings.defaultPair && form.pair === 'XAUUSD' && !form.pnl) {
      setForm(p => ({ ...p, pair: settings.defaultPair! }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.defaultPair])

  function set<K extends keyof FormData>(key: K, val: FormData[K]) {
    setForm(p => ({ ...p, [key]: val }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const pnlVal = Number(form.pnl)
    if (!form.pnl || isNaN(pnlVal) || pnlVal <= 0) return

    addTrade({
      account_id:       form.account_id || tradingAccounts[0]?.id || '',
      date:             form.date,
      entry_time:       form.entry_time || undefined,
      pair:             form.pair,
      direction:        form.direction,
      result:           form.result,
      pnl:              form.result === 'loss' || form.is_overtrade ? -Math.abs(pnlVal) : Math.abs(pnlVal),
      strategy:         form.strategy || undefined,
      market_structure: form.market_structure || undefined,
      followed_plan:    form.followed_plan === 'yes' ? true : form.followed_plan === 'no' ? false : undefined,
      screenshot_url:   form.screenshot_url || undefined,
      note:             form.note || undefined,
      is_overtrade:     form.is_overtrade,
    })
    setForm({ ...empty, account_id: form.account_id })
    setOpen(false)
  }

  // Upload gambar chart ke Supabase Storage
  async function handleImageUpload(file: File) {
    if (!file) return
    setUploading(true)
    try {
      const { createClient } = await import('@/lib/supabase')
      const sb = createClient()
      const ext = file.name.split('.').pop() || 'png'
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await sb.storage.from('trade-screenshots').upload(path, file, { upsert: true })
      if (error) { toast.error('Upload gagal: ' + error.message); setUploading(false); return }
      const { data } = sb.storage.from('trade-screenshots').getPublicUrl(path)
      set('screenshot_url', data.publicUrl)
      toast.success('Gambar berhasil diupload')
    } catch (err) {
      toast.error('Upload gagal')
    } finally {
      setUploading(false)
    }
  }

  const activeCount = [
    quickFilter, filterResult !== 'all', filterDir !== 'all', filterPair !== 'all',
    filterStrategy !== 'all', filterStartDate, filterEndDate, filterMinProfit, filterMaxLoss,
  ].filter(Boolean).length
  const hasFilter = activeCount > 0

  function resetFilters() {
    setQuickFilter(''); setFilterResult('all'); setFilterDir('all')
    setFilterPair('all'); setFilterStrategy('all')
    setFilterStartDate(''); setFilterEndDate('')
    setFilterMinProfit(''); setFilterMaxLoss('')
  }

  const BIG = 1_000_000

  const filtered = trades.filter(t => {
    // Quick chips override the result filter
    if (quickFilter === 'winners') { if (t.result !== 'win') return false }
    else if (quickFilter === 'losers') { if (t.result !== 'loss') return false }
    else if (quickFilter === 'bigwin') { if (t.result !== 'win' || t.pnl < BIG) return false }
    else if (quickFilter === 'bigloss') { if (t.result !== 'loss' || t.pnl > -BIG) return false }
    else {
      if (filterResult !== 'all' && t.result !== filterResult) return false
    }

    if (filterDir !== 'all' && t.direction !== filterDir) return false
    if (filterPair !== 'all' && t.pair !== filterPair) return false
    if (filterStrategy !== 'all' && (t.strategy ?? '') !== filterStrategy) return false
    if (filterStartDate && t.date < filterStartDate) return false
    if (filterEndDate && t.date > filterEndDate) return false
    if (filterMinProfit !== '' && !isNaN(Number(filterMinProfit)) && t.pnl < Number(filterMinProfit)) return false
    if (filterMaxLoss !== '' && !isNaN(Number(filterMaxLoss))) {
      const threshold = Math.abs(Number(filterMaxLoss))
      if (t.pnl > -threshold) return false
    }

    return true
  }).sort((a, b) => b.date.localeCompare(a.date))

  // Stats from filtered trades
  const filteredNormal   = filtered.filter(t => !t.is_overtrade)
  const filteredWins     = filteredNormal.filter(t => t.result === 'win')
  const filteredLosses   = filteredNormal.filter(t => t.result === 'loss')
  const filteredPnl      = filtered.reduce((s, t) => s + t.pnl, 0)
  const filteredWinRate  = filteredNormal.length > 0 ? (filteredWins.length / filteredNormal.length) * 100 : 0

  // Header stats (all trades, non-overtrade for w/l)
  const normalTrades = trades.filter(t => !t.is_overtrade)
  const wins         = normalTrades.filter(t => t.result === 'win').length
  const losses       = normalTrades.filter(t => t.result === 'loss').length
  const totalPnl     = trades.reduce((s, t) => s + t.pnl, 0)

  const selectedAccount = tradingAccounts.find(a => a.id === form.account_id) || tradingAccounts[0]

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('Trade')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {trades.length} total · {wins}W {losses}L ·{' '}
            <span className={totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}
            </span>
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={
            <Button size="sm" className="gap-2 shrink-0">
              <Plus size={14}/> {t('Catat Trade')}
            </Button>
          } />
          <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <TrendingUp size={18} className="text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold">Catat Trade Baru</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Isi detail posisi trading kamu</p>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={submit} className="space-y-5 mt-2">

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <DatePicker value={form.date} onChange={v => set('date', v)} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Entry Time</Label>
                  <Input type="time" value={form.entry_time} onChange={e => set('entry_time', e.target.value)} />
                </div>
              </div>

              {/* Pair */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Pair</Label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => set('pair', 'XAUUSD')}
                    className={`px-4 py-2 rounded-lg border text-xs font-bold transition-all
                      ${form.pair === 'XAUUSD' ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted'}`}>
                    XAUUSD
                  </button>
                  <Input
                    placeholder="Other pair…"
                    value={form.pair !== 'XAUUSD' ? form.pair : ''}
                    onChange={e => set('pair', e.target.value || 'XAUUSD')}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              {/* Account */}
              {tradingAccounts.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Trading Account</Label>
                  <Select value={selectedAccount?.id} onValueChange={v => set('account_id', v ?? '')}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{selectedAccount?.name || 'Select account'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {tradingAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Market Structure */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Market Structure</Label>
                <div className="flex gap-2">
                  {([
                    { val: 'bullish', label: 'Bullish', icon: TrendingUp,    activeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
                    { val: 'bearish', label: 'Bearish', icon: TrendingDown,  activeClass: 'bg-red-500/10 border-red-500/30 text-red-400' },
                    { val: 'ranging', label: 'Ranging', icon: MoveHorizontal, activeClass: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
                  ] as const).map(({ val, label, icon: Icon, activeClass }) => (
                    <button key={val} type="button"
                      onClick={() => set('market_structure', form.market_structure === val ? '' : val)}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-all
                        ${form.market_structure === val ? activeClass : 'border-border/60 text-muted-foreground hover:bg-muted'}`}>
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Direction */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Direction</Label>
                <div className="flex gap-2">
                  {([
                    { val: 'long',  label: '↑ Long / Buy',   activeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
                    { val: 'short', label: '↓ Short / Sell', activeClass: 'bg-red-500/10 border-red-500/30 text-red-400' },
                  ] as const).map(({ val, label, activeClass }) => (
                    <button key={val} type="button" onClick={() => set('direction', val)}
                      className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-all
                        ${form.direction === val ? activeClass : 'border-border/60 text-muted-foreground hover:bg-muted'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Result */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Result</Label>
                <ToggleGroup
                  value={form.result}
                  onChange={v => set('result', v as FormData['result'])}
                  options={[
                    { value: 'win',       label: '✓ Win',       color: 'green' },
                    { value: 'loss',      label: '✗ Loss',      color: 'red' },
                    { value: 'breakeven', label: '= Breakeven', color: 'yellow' },
                  ]}
                />
              </div>

              {/* Overtrade toggle */}
              <button
                type="button"
                onClick={() => set('is_overtrade', !form.is_overtrade)}
                className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-all text-left
                  ${form.is_overtrade
                    ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                    : 'border-border/50 text-muted-foreground hover:bg-muted/40'}`}
              >
                <div>
                  <p className={`text-sm font-bold ${form.is_overtrade ? 'text-orange-400' : 'text-foreground/70'}`}>
                    ⚠️ Overtrade
                  </p>
                  <p className="text-xs mt-0.5 text-muted-foreground">
                    Equity berkurang, tidak masuk statistik trading
                  </p>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0
                  ${form.is_overtrade ? 'bg-orange-500' : 'bg-border'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                    ${form.is_overtrade ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                </div>
              </button>

              {/* P&L */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">P&L Amount ({settings.currency})</Label>
                <CurrencyInput
                  value={form.pnl}
                  onChange={v => set('pnl', v)}
                  placeholder={settings.currency === 'IDR' ? '150.000' : '75.00'}
                  required
                />
                <p className="text-xs text-muted-foreground">Masukkan angka positif — tanda +/− otomatis dari Result</p>
              </div>

              {/* Strategy */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Strategy</Label>
                <Select value={form.strategy} onValueChange={v => set('strategy', v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {settings.strategies.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Followed Plan */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ikut Trading Plan?</Label>
                <div className="flex gap-2">
                  {(['yes', 'no'] as const).map(v => (
                    <button key={v} type="button" onClick={() => set('followed_plan', v)}
                      className={`flex-1 flex items-center justify-center gap-1 rounded-lg border py-2.5 text-sm font-semibold transition-all
                        ${form.followed_plan === v
                          ? v === 'yes' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                          : 'border-border/60 text-muted-foreground hover:bg-muted'}`}>
                      {v === 'yes' ? <><Check size={12}/> Ya, sesuai plan</> : <><X size={12}/> Tidak</>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Screenshot: Link atau Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Screenshot Chart</Label>
                  <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
                    {([
                      { val: 'link',   label: 'Link',   icon: Link2 },
                      { val: 'upload', label: 'Upload', icon: Upload },
                    ] as const).map(({ val, label, icon: Icon }) => (
                      <button key={val} type="button" onClick={() => setImgMode(val)}
                        className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all
                          ${imgMode === val ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                        <Icon size={11} /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                {imgMode === 'link' ? (
                  <Input
                    placeholder="https://www.tradingview.com/x/…"
                    value={form.screenshot_url}
                    onChange={e => set('screenshot_url', e.target.value)}
                  />
                ) : (
                  <div className="space-y-2">
                    <label className={`flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-4 text-sm cursor-pointer transition-colors hover:bg-muted/40 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                      {uploading ? <><Loader2 size={15} className="animate-spin" /> Mengupload…</> : <><Upload size={15} /> Pilih gambar dari perangkat</>}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }} />
                    </label>
                    {form.screenshot_url && !uploading && (
                      <div className="rounded-lg overflow-hidden border border-border/40">
                        <img src={form.screenshot_url} alt="preview" className="w-full max-h-40 object-contain bg-black/20" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Catatan */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Catatan</Label>
                <Textarea
                  placeholder="Setup, alasan entry, pelajaran…"
                  value={form.note}
                  onChange={e => set('note', e.target.value)}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full">Simpan Trade</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Filter Card (modern) ──────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10"><Filter size={13} className="text-primary"/></span>
              <span className="text-sm font-semibold">Filter Trades</span>
              {activeCount > 0 && <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">{activeCount} aktif</span>}
            </div>
            <div className="flex items-center gap-2">
              {hasFilter && (
                <button type="button" onClick={resetFilters}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                  <RotateCcw size={11}/> Reset
                </button>
              )}
              <button type="button" onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                <SlidersHorizontal size={12}/> {showAdvanced ? 'Sembunyikan' : 'Filter lanjutan'}
              </button>
            </div>
          </div>

          {/* Quick chips (dengan icon) */}
          <div className="flex flex-wrap gap-2">
            <ChipBtn active={quickFilter === 'winners'} color="green" onClick={() => setQuickFilter(quickFilter === 'winners' ? '' : 'winners')}>
              <TrendingUp size={12}/> Winners
            </ChipBtn>
            <ChipBtn active={quickFilter === 'losers'} color="red" onClick={() => setQuickFilter(quickFilter === 'losers' ? '' : 'losers')}>
              <TrendingDown size={12}/> Losers
            </ChipBtn>
            <ChipBtn active={quickFilter === 'bigwin'} color="teal" onClick={() => setQuickFilter(quickFilter === 'bigwin' ? '' : 'bigwin')}>
              <ArrowUp size={12}/> Big Wins (1M+)
            </ChipBtn>
            <ChipBtn active={quickFilter === 'bigloss'} color="orange" onClick={() => setQuickFilter(quickFilter === 'bigloss' ? '' : 'bigloss')}>
              <ArrowDown size={12}/> Big Losses (1M+)
            </ChipBtn>
          </div>

          {/* Dropdowns */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Result</Label>
              <Select value={filterResult} onValueChange={v => setFilterResult(v ?? 'all')}>
                <SelectTrigger className="h-9 text-xs w-full"><SelectValue>{filterResult === 'all' ? 'Semua' : filterResult === 'win' ? 'Win' : filterResult === 'loss' ? 'Loss' : 'Breakeven'}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Hasil</SelectItem>
                  <SelectItem value="win">Win</SelectItem>
                  <SelectItem value="loss">Loss</SelectItem>
                  <SelectItem value="breakeven">Breakeven</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Arah</Label>
              <Select value={filterDir} onValueChange={v => setFilterDir(v ?? 'all')}>
                <SelectTrigger className="h-9 text-xs w-full"><SelectValue>{filterDir === 'all' ? 'Semua' : filterDir === 'long' ? 'Long' : 'Short'}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Arah</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Symbol</Label>
              <Select value={filterPair} onValueChange={v => setFilterPair(v ?? 'all')}>
                <SelectTrigger className="h-9 text-xs w-full"><SelectValue>{filterPair === 'all' ? 'Semua Pair' : filterPair}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Pair</SelectItem>
                  {allPairs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Strategi</Label>
              <Select value={filterStrategy} onValueChange={v => setFilterStrategy(v ?? 'all')}>
                <SelectTrigger className="h-9 text-xs w-full"><SelectValue>{filterStrategy === 'all' ? 'Semua' : filterStrategy}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Strategi</SelectItem>
                  {allStrategies.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date & amount filters (collapsible) */}
          {showAdvanced && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-border/40">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Dari Tanggal</Label>
                <Input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="h-9 text-xs"/>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Sampai Tanggal</Label>
                <Input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="h-9 text-xs"/>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Min Profit ({settings.currency})</Label>
                <Input type="number" placeholder="1000000" value={filterMinProfit} onChange={e => setFilterMinProfit(e.target.value)} className="h-9 text-xs"/>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Max Loss ({settings.currency})</Label>
                <Input type="number" placeholder="-1000000" value={filterMaxLoss} onChange={e => setFilterMaxLoss(e.target.value)} className="h-9 text-xs"/>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Summary Stats Bar ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Trades',
            value: String(filtered.length),
            colored: false,
          },
          {
            label: 'Total P&L',
            value: (filteredPnl >= 0 ? '+' : '') + fmt(filteredPnl),
            colored: true,
            positive: filteredPnl >= 0,
          },
          {
            label: 'Win Rate',
            value: `${filteredWinRate.toFixed(1)}%`,
            colored: false,
          },
          {
            label: 'W/L Ratio',
            value: `${filteredWins.length}/${filteredLosses.length}`,
            colored: false,
          },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-muted/20 border border-border/25 px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-xl font-black tracking-tight ${s.colored ? (s.positive ? 'text-emerald-400' : 'text-red-400') : ''}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Trade Table ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {trades.length === 0
              ? 'No trades yet. Click "Add Trade" to get started.'
              : 'No trades match the current filters.'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-[11px] text-muted-foreground">
                    {['Tanggal','Jam','Pair','Arah','Strategi','P&L','Hasil','Plan',''].map(h => (
                      <th key={h} className={`px-3 py-3 font-semibold ${h === 'P&L' ? 'text-right' : h === 'Hasil' ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.map(t => (
                    <tr key={t.id}
                      className="hover:bg-muted/20 cursor-pointer transition-colors group"
                      onClick={() => setDetail(t)}>
                      <td className="px-3 py-3">
                        <div className="text-xs font-medium">{t.date}</div>
                      </td>
                      <td className="px-3 py-3">
                        {t.entry_time ? (() => { const s = sessionTag(t.entry_time!); return (
                          <>
                            <div className="text-xs font-semibold tabular-nums">{t.entry_time}</div>
                            {s && <div className={`text-[9px] font-medium ${s.color}`}>{s.emoji} {s.label}</div>}
                          </>
                        ) })() : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{t.pair}</span>
                          {t.is_overtrade && (
                            <span className="text-[9px] font-black bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded px-1 py-0.5 leading-none">OT</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`flex items-center gap-1 w-fit text-xs font-bold ${t.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.direction === 'long' ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                          {t.direction === 'long' ? 'LONG' : 'SHORT'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{t.strategy ?? '—'}</td>
                      <td className={`px-3 py-3 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        <div>{t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}</div>
                        {equityBase > 0 && (
                          <div className={`text-[10px] font-medium ${t.pnl >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                            {t.pnl >= 0 ? '+' : ''}{(t.pnl / equityBase * 100).toFixed(2)}%
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Badge
                          variant={t.result === 'win' ? 'default' : t.result === 'loss' ? 'destructive' : 'secondary'}
                          className="text-[10px]">
                          {t.result === 'win' ? 'WIN' : t.result === 'loss' ? 'LOSS' : 'BE'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-center text-xs">
                        {t.followed_plan === true  ? <span className="text-emerald-400">✓</span>
                          : t.followed_plan === false ? <span className="text-red-400">✗</span>
                          : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">Detail →</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
