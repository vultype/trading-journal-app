'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2, Wallet, TrendingUp, Save, CheckCircle2, UserCog } from 'lucide-react'
import { CurrencyInput } from '@/components/ui/currency-input'
import type { AccountType, AppSettings } from '@/types'

export default function SettingsPage() {
  const { accounts, trades, transfers, settings, userEmail, isAdmin, addAccount, deleteAccount, saveSettings } = useStore()

  // ─── Pengaturan Umum ───
  const [currency, setCurrency] = useState<AppSettings['currency']>(settings.currency)
  const [targetD, setTargetD]   = useState<number | ''>(settings.targetHarian ?? '')
  const [targetW, setTargetW]   = useState<number | ''>(settings.targetMingguan ?? '')
  const [targetM, setTargetM]   = useState<number | ''>(settings.targetBulanan ?? '')
  const [displayName, setDisplayName] = useState(settings.displayName ?? '')
  const [defaultPair, setDefaultPair] = useState(settings.defaultPair ?? '')
  const [weekMon, setWeekMon]   = useState(settings.weekStartsMonday ?? false)
  const [saved, setSaved] = useState(false)

  function handleSaveSettings() {
    saveSettings({
      currency,
      targetHarian:   targetD !== '' ? Number(targetD) : undefined,
      targetMingguan: targetW !== '' ? Number(targetW) : undefined,
      targetBulanan:  targetM !== '' ? Number(targetM) : undefined,
      displayName:    displayName.trim() || undefined,
      defaultPair:    defaultPair.trim() || undefined,
      weekStartsMonday: weekMon,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ─── Strategi ───
  const [newStrategy, setNewStrategy] = useState('')

  function addStrategy() {
    const s = newStrategy.trim()
    if (!s || settings.strategies.includes(s)) return
    saveSettings({ strategies: [...settings.strategies, s] })
    setNewStrategy('')
  }

  function removeStrategy(s: string) {
    saveSettings({ strategies: settings.strategies.filter(x => x !== s) })
  }

  // ─── Akun ───
  const [accName, setAccName]     = useState('')
  const [accType, setAccType]     = useState<AccountType>('trading')
  const [accBroker, setAccBroker] = useState('')
  const [accCur, setAccCur]       = useState('USD')

  function submitAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!accName.trim()) return
    addAccount({ name: accName.trim(), type: accType, broker: accBroker || undefined, currency: accCur })
    setAccName(''); setAccBroker('')
  }

  function canDelete(id: string) {
    return !trades.some(t => t.account_id === id) &&
           !transfers.some(t => t.from_account_id === id || t.to_account_id === id)
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ accounts, trades, transfers, settings }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `trading-journal-${new Date().toISOString().split('T')[0]}.json`; a.click()
  }

  function exportCSV() {
    const header = ['date','entry_time','pair','direction','result','pnl','strategy','followed_plan','know_direction','screenshot_url','note']
    const rows   = trades.map(t => header.map(k => {
      const v = (t as Record<string, unknown>)[k]
      if (v === true) return 'ya'
      if (v === false) return 'tidak'
      return v ?? ''
    }).join(','))
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `trades-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Profil, konfigurasi, strategi, dan akun</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserCog size={14}/> Profil</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
            <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center text-primary font-black text-lg shrink-0">
              {(displayName || userEmail || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{displayName || 'Trader'}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail ?? '—'}</p>
            </div>
            <Badge variant={isAdmin ? 'default' : 'secondary'} className={`ml-auto text-[10px] ${isAdmin ? 'bg-red-500/15 text-red-400 border-red-500/20' : ''}`}>
              {isAdmin ? 'ADMIN' : 'USER'}
            </Badge>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nama Tampilan</Label>
            <Input placeholder="Nama kamu" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full sm:w-72" />
          </div>
        </CardContent>
      </Card>

      {/* General */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Umum</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Default Currency</Label>
            <Select value={currency} onValueChange={(v) => setCurrency((v ?? 'USD') as AppSettings['currency'])}>
              <SelectTrigger className="w-52"><SelectValue>
                {currency === 'IDR' ? '🇮🇩 IDR — Indonesian Rupiah' : currency === 'USD' ? '🇺🇸 USD — US Dollar' : currency === 'EUR' ? '🇪🇺 EUR — Euro' : '💵 USDT — Tether'}
              </SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">🇺🇸 USD — US Dollar</SelectItem>
                <SelectItem value="IDR">🇮🇩 IDR — Indonesian Rupiah</SelectItem>
                <SelectItem value="EUR">🇪🇺 EUR — Euro</SelectItem>
                <SelectItem value="USDT">💵 USDT — Tether</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Mempengaruhi semua angka P&L di aplikasi</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Pair Default</Label>
            <Input placeholder="XAUUSD" value={defaultPair} onChange={e => setDefaultPair(e.target.value)} className="w-52" />
            <p className="text-xs text-muted-foreground">Pair yang otomatis terpilih saat Add Trade</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Target Harian ({currency})</Label>
              <CurrencyInput value={targetD} onChange={setTargetD} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Target Mingguan ({currency})</Label>
              <CurrencyInput value={targetW} onChange={setTargetW} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Target Bulanan ({currency})</Label>
              <CurrencyInput value={targetM} onChange={setTargetM} placeholder="0" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setWeekMon(v => !v)}
            className="w-full flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
          >
            <div>
              <p className="text-sm font-medium">Minggu Mulai Hari Senin</p>
              <p className="text-xs text-muted-foreground mt-0.5">Untuk perhitungan laporan mingguan</p>
            </div>
            <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${weekMon ? 'bg-primary' : 'bg-border'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${weekMon ? 'translate-x-5' : 'translate-x-0.5'}`}/>
            </div>
          </button>

          <Button onClick={handleSaveSettings} size="sm" className="gap-2">
            {saved ? <><CheckCircle2 size={13} /> Tersimpan!</> : <><Save size={13} /> Simpan Pengaturan</>}
          </Button>
        </CardContent>
      </Card>

      {/* Strategies */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Strategies</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {settings.strategies.map(s => (
              <span key={s} className="flex items-center gap-1.5 text-xs bg-muted rounded-full px-3 py-1.5 font-medium">
                {s}
                <button onClick={() => removeStrategy(s)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={10} />
                </button>
              </span>
            ))}
            {settings.strategies.length === 0 && (
              <p className="text-xs text-muted-foreground">No strategies yet</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="New strategy name…"
              value={newStrategy}
              onChange={e => setNewStrategy(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addStrategy())}
              className="text-sm"
            />
            <Button size="sm" onClick={addStrategy} className="gap-1.5 shrink-0">
              <Plus size={13} /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Saved Accounts */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Accounts</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${a.type === 'personal' ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
                    {a.type === 'personal' ? <Wallet size={14} className="text-blue-400" /> : <TrendingUp size={14} className="text-emerald-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.broker ? `${a.broker} · ` : ''}{a.currency}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.type === 'personal' ? 'secondary' : 'default'} className="text-xs capitalize">{a.type}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={!canDelete(a.id)} title={!canDelete(a.id) ? 'In use' : 'Delete'}
                    onClick={() => deleteAccount(a.id)}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Account */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Add Account</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submitAccount} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Account Name</Label>
                <Input placeholder="My Broker" value={accName} onChange={e => setAccName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={accType} onValueChange={(v) => setAccType((v ?? 'trading') as AccountType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trading">Trading</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Broker / Platform</Label>
                <Input placeholder="MT4, MT5, Bybit…" value={accBroker} onChange={e => setAccBroker(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Currency</Label>
                <Select value={accCur} onValueChange={(v) => setAccCur(v ?? 'USD')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="IDR">IDR</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" size="sm" className="gap-2"><Plus size={13} /> Add Account</Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Data Backup */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Data Backup</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-2xl font-bold">{trades.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Trades</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-2xl font-bold">{transfers.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Transfers</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-2xl font-bold">{settings.strategies.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Strategies</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportJSON} className="flex-1">Export JSON</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}  className="flex-1">Export CSV</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
