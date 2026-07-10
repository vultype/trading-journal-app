'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/ui/currency-input'
import { BrokerSelect } from '@/components/ui/broker-select'
import type { AppSettings } from '@/types'
import { TrendingUp, User, Building2, PiggyBank, Sparkles, Check, ArrowRight, ArrowLeft } from 'lucide-react'

const TOTAL = 4  // input steps 0..3, step 4 = success

export function SetupWizard() {
  const { accounts, settings, saveSettings, addAccount, updateAccount, addTrade } = useStore()
  const t = useT()

  const [step, setStep] = useState(0)

  // Step 0 — profil
  const [name, setName] = useState(settings.displayName ?? '')
  const [lang, setLang] = useState<AppSettings['language']>(settings.language ?? 'id')
  const [currency, setCurrency] = useState<AppSettings['currency']>(settings.currency ?? 'IDR')

  // Step 1 — broker
  const [broker, setBroker]   = useState(accounts[0]?.broker ?? '')
  const [accName, setAccName] = useState(accounts[0]?.name ?? '')

  // Step 2 — modal awal
  const [initial, setInitial] = useState<number | ''>(accounts[0]?.initial_balance || '')

  // Step 3 — trade pertama (opsional)
  const [pair, setPair]         = useState('XAUUSD')
  const [direction, setDir]     = useState<'long' | 'short'>('long')
  const [result, setResult]     = useState<'win' | 'loss'>('win')
  const [pnl, setPnl]           = useState<number | ''>('')

  function persistProfileAndAccount() {
    saveSettings({ displayName: name.trim() || undefined, language: lang, currency })
    const finalName = accName.trim() || broker.trim() || 'Akun Trading'
    const init = initial !== '' ? Number(initial) : 0
    let accountId = accounts[0]?.id
    if (accountId) {
      updateAccount(accountId, { name: finalName, broker: broker.trim() || undefined, initial_balance: init, currency })
    } else {
      const created = addAccount({ name: finalName, broker: broker.trim() || undefined, currency, initial_balance: init })
      accountId = created.id
    }
    return accountId
  }

  function finalize(withTrade: boolean) {
    const accountId = persistProfileAndAccount()
    if (withTrade && pnl !== '' && Number(pnl) > 0 && accountId) {
      addTrade({
        account_id: accountId,
        date: new Date().toISOString().split('T')[0],
        pair,
        direction,
        result,
        pnl: result === 'loss' ? -Math.abs(Number(pnl)) : Math.abs(Number(pnl)),
      })
    }
    setStep(4)
  }

  function complete() {
    saveSettings({ onboarded: true })
  }

  const canNext =
    step === 0 ? name.trim().length > 0 :
    step === 1 ? broker.trim().length > 0 :
    true

  return (
    <div className="fixed inset-0 z-30 bg-background flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md my-8">
        {/* Progress */}
        {step < 4 && (
          <div className="flex items-center gap-1.5 mb-6">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-5">
          {/* STEP 0 — profil */}
          {step === 0 && (
            <>
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-1">
                  <TrendingUp size={26} className="text-primary" />
                </div>
                <h2 className="text-xl font-black">{t('Selamat Datang')} 👋</h2>
                <p className="text-sm text-muted-foreground">{t('Ayo siapkan jurnal trading kamu dalam beberapa langkah singkat.')}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><User size={12} /> {t('Nama Lengkap')}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Trader" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('Bahasa')}</Label>
                  <Select value={lang} onValueChange={v => setLang((v ?? 'id') as AppSettings['language'])}>
                    <SelectTrigger className="w-full"><SelectValue>{lang === 'en' ? '🇬🇧 English' : '🇮🇩 Indonesia'}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="id">🇮🇩 Indonesia</SelectItem>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('Mata Uang')}</Label>
                  <Select value={currency} onValueChange={v => setCurrency((v ?? 'IDR') as AppSettings['currency'])}>
                    <SelectTrigger className="w-full"><SelectValue>{currency}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IDR">🇮🇩 IDR — Rupiah</SelectItem>
                      <SelectItem value="USD">🇺🇸 USD — Dollar</SelectItem>
                      <SelectItem value="EUR">🇪🇺 EUR — Euro</SelectItem>
                      <SelectItem value="USDT">💵 USDT — Tether</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* STEP 1 — broker */}
          {step === 1 && (
            <>
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-1">
                  <Building2 size={24} className="text-primary" />
                </div>
                <h2 className="text-lg font-black">{t('Pilih Broker')}</h2>
                <p className="text-sm text-muted-foreground">{t('Broker atau platform yang kamu pakai')}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('Broker / Platform')}</Label>
                <BrokerSelect value={broker} onChange={setBroker} customPlaceholder={t('Ketik nama broker…')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('Nama Akun')}</Label>
                <Input value={accName} onChange={e => setAccName(e.target.value)} placeholder={broker || 'Akun Utama'} />
                <p className="text-[10px] text-muted-foreground">{t('opsional')} — {t('Nama Akun').toLowerCase()}</p>
              </div>
            </>
          )}

          {/* STEP 2 — modal awal */}
          {step === 2 && (
            <>
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-1">
                  <PiggyBank size={24} className="text-primary" />
                </div>
                <h2 className="text-lg font-black">{t('Modal / Deposit Awal')}</h2>
                <p className="text-sm text-muted-foreground">{t('Berapa saldo awal di akun ini?')}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('Saldo Awal')} ({currency})</Label>
                <CurrencyInput value={initial} onChange={setInitial} placeholder={currency === 'IDR' ? '10.000.000' : '1.000'} />
              </div>
            </>
          )}

          {/* STEP 3 — trade pertama */}
          {step === 3 && (
            <>
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-1">
                  <TrendingUp size={24} className="text-primary" />
                </div>
                <h2 className="text-lg font-black">{t('Trade Pertama')}</h2>
                <p className="text-sm text-muted-foreground">{t('Catat satu trade untuk memulai (boleh dilewati)')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Pair</Label>
                  <Input value={pair} onChange={e => setPair(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">P&L ({currency})</Label>
                  <CurrencyInput value={pnl} onChange={setPnl} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex gap-2">
                  {(['long', 'short'] as const).map(d => (
                    <button key={d} type="button" onClick={() => setDir(d)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-all ${direction === d ? (d === 'long' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400') : 'border-border/50 text-muted-foreground'}`}>
                      {d === 'long' ? '↑ Long' : '↓ Short'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {(['win', 'loss'] as const).map(r => (
                    <button key={r} type="button" onClick={() => setResult(r)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-all ${result === r ? (r === 'win' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400') : 'border-border/50 text-muted-foreground'}`}>
                      {r === 'win' ? '✓ Win' : '✗ Loss'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* STEP 4 — success */}
          {step === 4 && (
            <div className="text-center space-y-4 py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15 mb-1">
                <Check size={30} className="text-emerald-400" />
              </div>
              <h2 className="text-xl font-black">{t('Selesai! Selamat trading 🎉')}</h2>
              <p className="text-sm text-muted-foreground">{t('Pengaturan awal selesai. Kamu bisa ubah kapan saja di menu Setting.')}</p>
              <Button className="w-full gap-2" onClick={complete}>
                <Sparkles size={14} /> {t('Masuk ke Dashboard')}
              </Button>
            </div>
          )}

          {/* Navigation */}
          {step < 4 && (
            <div className="flex items-center gap-2 pt-1">
              {step > 0 && (
                <Button variant="outline" className="gap-1.5" onClick={() => setStep(s => s - 1)}>
                  <ArrowLeft size={14} /> {t('Kembali')}
                </Button>
              )}
              {step < 3 && (
                <Button className="flex-1 gap-1.5" disabled={!canNext} onClick={() => setStep(s => s + 1)}>
                  {t('Lanjut')} <ArrowRight size={14} />
                </Button>
              )}
              {step === 3 && (
                <>
                  <Button variant="outline" className="flex-1" onClick={() => finalize(false)}>{t('Lewati')}</Button>
                  <Button className="flex-1 gap-1.5" onClick={() => finalize(true)}>
                    <Check size={14} /> {t('Selesai')}
                  </Button>
                </>
              )}
            </div>
          )}

          {step < 4 && (
            <p className="text-center text-[10px] text-muted-foreground">{t('Langkah')} {step + 1} / {TOTAL}</p>
          )}
        </div>
      </div>
    </div>
  )
}
