'use client'

import { useState, useEffect, useRef } from 'react'
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
import { DatePicker } from '@/components/ui/date-picker'
import { TradeDetailDialog } from '@/components/trade/TradeDetailDialog'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Plus, TrendingUp, TrendingDown, Filter, Check, X } from 'lucide-react'
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

type MarketStructure = 'bullish' | 'bearish' | 'ranging' | ''

type FormData = {
  account_id: string; date: string; entry_time: string
  pair: string; direction: 'long' | 'short'
  result: 'win' | 'loss' | 'breakeven'; pnl: number | ''; strategy: string
  market_structure: MarketStructure
  followed_plan: 'yes' | 'no' | ''; know_direction: 'yes' | 'no' | ''
  screenshot_url: string; note: string; ai_analysis: string
  is_overtrade: boolean
}

const empty: FormData = {
  account_id: '', date: new Date().toISOString().split('T')[0], entry_time: '',
  pair: 'XAUUSD', direction: 'long', result: 'win', pnl: '', strategy: '',
  market_structure: '',
  followed_plan: '', know_direction: '', screenshot_url: '', note: '', ai_analysis: '',
  is_overtrade: false,
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
  const { trades, accounts, settings, addTrade, deleteTrade } = useStore()
  const fmt = useCurrency()
  const [open, setOpen]                   = useState(false)
  const [form, setForm]                   = useState<FormData>(empty)
  const [filterDir, setFilterDir]         = useState('all')
  const [filterResult, setFilterResult]   = useState('all')
  const [search, setSearch]               = useState('')
  const [detail, setDetail]               = useState<Trade | null>(null)

  const tradingAccounts = accounts.filter(a => a.type === 'trading')

  useEffect(() => {
    if (!form.account_id && tradingAccounts.length > 0) {
      setForm(p => ({ ...p, account_id: tradingAccounts[0].id }))
    }
  }, [tradingAccounts.length])

  function set<K extends keyof FormData>(key: K, val: FormData[K]) {
    setForm(p => ({ ...p, [key]: val }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const pnlVal = Number(form.pnl)
    if (!form.pnl || isNaN(pnlVal) || pnlVal <= 0) return

    // Combine catatan + analisa ke field note
    const parts = [form.note, form.ai_analysis ? `--- Analisa by Claude ---\n${form.ai_analysis}` : ''].filter(Boolean)
    const combinedNote = parts.join('\n\n')

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
      know_direction:   form.know_direction === 'yes' ? true : form.know_direction === 'no' ? false : undefined,
      screenshot_url:   form.screenshot_url || undefined,
      note:             combinedNote || undefined,
      is_overtrade:     form.is_overtrade,
    })
    setForm({ ...empty, account_id: form.account_id })
    setOpen(false)
  }

  const filtered = trades.filter(t => {
    if (filterDir    !== 'all' && t.direction !== filterDir) return false
    if (filterResult !== 'all' && t.result    !== filterResult) return false
    if (search && !t.pair.toLowerCase().includes(search.toLowerCase()) &&
        !(t.strategy ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).sort((a, b) => b.date.localeCompare(a.date))

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
          <h1 className="text-xl font-bold">Trades</h1>
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
              <Plus size={14}/> Add Trade
            </Button>
          } />
          <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Trade</DialogTitle>
            </DialogHeader>

            <form onSubmit={submit} className="space-y-5 mt-1">

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
                    { val: 'bullish', label: '🐂 Bullish', activeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
                    { val: 'bearish', label: '🐻 Bearish', activeClass: 'bg-red-500/10 border-red-500/30 text-red-400' },
                    { val: 'ranging', label: '↔ Ranging',  activeClass: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
                  ] as const).map(({ val, label, activeClass }) => (
                    <button key={val} type="button"
                      onClick={() => set('market_structure', form.market_structure === val ? '' : val)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-all
                        ${form.market_structure === val ? activeClass : 'border-border/60 text-muted-foreground hover:bg-muted'}`}>
                      {label}
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

              {/* Yes/No questions */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Followed Plan?</Label>
                  <div className="flex gap-2">
                    {(['yes', 'no'] as const).map(v => (
                      <button key={v} type="button" onClick={() => set('followed_plan', v)}
                        className={`flex-1 flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-semibold transition-all
                          ${form.followed_plan === v
                            ? v === 'yes' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                            : 'border-border/60 text-muted-foreground hover:bg-muted'}`}>
                        {v === 'yes' ? <><Check size={10}/> Yes</> : <><X size={10}/> No</>}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Know Direction?</Label>
                  <div className="flex gap-2">
                    {(['yes', 'no'] as const).map(v => (
                      <button key={v} type="button" onClick={() => set('know_direction', v)}
                        className={`flex-1 flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-semibold transition-all
                          ${form.know_direction === v
                            ? v === 'yes' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                            : 'border-border/60 text-muted-foreground hover:bg-muted'}`}>
                        {v === 'yes' ? <><Check size={10}/> Yes</> : <><X size={10}/> No</>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Screenshot */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">TradingView Screenshot URL</Label>
                <Input
                  placeholder="https://www.tradingview.com/x/…"
                  value={form.screenshot_url}
                  onChange={e => set('screenshot_url', e.target.value)}
                />
              </div>

              {/* Catatan */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Catatan</Label>
                <Textarea
                  placeholder="Setup, entry reason, lessons learned…"
                  value={form.note}
                  onChange={e => set('note', e.target.value)}
                  rows={2}
                />
              </div>

              {/* Analisa by Claude */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="text-purple-400">✦</span> Analisa by Claude
                </Label>
                <AutoTextarea
                  value={form.ai_analysis}
                  onChange={v => set('ai_analysis', v)}
                  placeholder="Paste analisa dari Claude di sini…"
                  className="text-xs min-h-[80px]"
                />
              </div>

              <Button type="submit" className="w-full">Save Trade</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={13} className="text-muted-foreground" />
        <Input
          placeholder="Search pair / strategy…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-44 h-8 text-sm"
        />
        <Select value={filterDir} onValueChange={v => setFilterDir(v ?? 'all')}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All directions</SelectItem>
            <SelectItem value="long">Long</SelectItem>
            <SelectItem value="short">Short</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterResult} onValueChange={v => setFilterResult(v ?? 'all')}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="win">Win</SelectItem>
            <SelectItem value="loss">Loss</SelectItem>
            <SelectItem value="breakeven">Breakeven</SelectItem>
          </SelectContent>
        </Select>
        {(filterDir !== 'all' || filterResult !== 'all' || search) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs"
            onClick={() => { setFilterDir('all'); setFilterResult('all'); setSearch('') }}>
            Reset
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} trades</span>
      </div>

      {/* Trade table */}
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
                    {['Date','Pair','MS','Direction','Strategy','P&L','Result','Plan','Arah?',''].map(h => (
                      <th key={h} className={`px-3 py-3 font-semibold ${h === 'P&L' ? 'text-right' : h === 'Result' ? 'text-center' : 'text-left'}`}>{h}</th>
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
                        {t.entry_time && <div className="text-[10px] text-muted-foreground/60">{t.entry_time}</div>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{t.pair}</span>
                          {t.is_overtrade && (
                            <span className="text-[9px] font-black bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded px-1 py-0.5 leading-none">OT</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {t.market_structure === 'bullish' && <span title="Bullish">🐂</span>}
                        {t.market_structure === 'bearish' && <span title="Bearish">🐻</span>}
                        {t.market_structure === 'ranging' && <span title="Ranging">↔</span>}
                        {!t.market_structure && <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`flex items-center gap-1 w-fit text-xs font-bold ${t.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.direction === 'long' ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                          {t.direction === 'long' ? 'LONG' : 'SHORT'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{t.strategy ?? '—'}</td>
                      <td className={`px-3 py-3 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
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
                      <td className="px-3 py-3 text-center text-xs">
                        {t.know_direction === true  ? <span className="text-emerald-400">✓</span>
                          : t.know_direction === false ? <span className="text-red-400">✗</span>
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
