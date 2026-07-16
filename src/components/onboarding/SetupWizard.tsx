'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/ui/currency-input'
import { BrokerSelect } from '@/components/ui/broker-select'
import type { AppSettings } from '@/types'
import { TrendingUp, User, Building2, PiggyBank, Check, ArrowRight, ArrowLeft } from 'lucide-react'

const TOTAL = 3

export function SetupWizard() {
  const { accounts, settings, saveSettings, addAccount, updateAccount } = useStore()
  const t = useT()
  const router = useRouter()

  const [step, setStep] = useState(0)

  // Step 0 — profil
  const [name, setName] = useState(settings.displayName ?? '')
  const [lang, setLang] = useState<AppSettings['language']>(settings.language ?? 'id')
  const [currency, setCurrency] = useState<AppSettings['currency']>(settings.currency ?? 'IDR')

  // Step 1 — broker (selalu mulai kosong — wizard dari awal)
  const [broker, setBroker]   = useState('')
  const [accName, setAccName] = useState('')

  // Step 2 — modal awal
  const [initial, setInitial] = useState<number | ''>('')

  function finishWizard() {
    saveSettings({ displayName: name.trim() || undefined, language: lang, currency, onboarded: true })

    const finalName = accName.trim() || broker.trim() || 'Akun Trading'
    const init = initial !== '' ? Number(initial) : 0
    const accountId = accounts[0]?.id
    if (accountId) {
      updateAccount(accountId, { name: finalName, broker: broker.trim() || undefined, initial_balance: init, currency })
    } else {
      addAccount({ name: finalName, broker: broker.trim() || undefined, currency, initial_balance: init })
    }

    router.push('/jurnal')
  }

  const canNext =
    step === 0 ? name.trim().length > 0 :
    step === 1 ? broker.trim().length > 0 :
    true

  return (
    <div className="fixed inset-0 z-30 bg-background flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md my-8">
        {/* Progress */}
        <div className="flex items-center gap-1.5 mb-6">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

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
                <p className="text-[10px] text-muted-foreground">Trade pertama kamu bisa langsung dicatat di Dashboard setelah ini.</p>
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-2 pt-1">
            {step > 0 && (
              <Button variant="outline" className="gap-1.5" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft size={14} /> {t('Kembali')}
              </Button>
            )}
            {step < TOTAL - 1 && (
              <Button className="flex-1 gap-1.5" disabled={!canNext} onClick={() => setStep(s => s + 1)}>
                {t('Lanjut')} <ArrowRight size={14} />
              </Button>
            )}
            {step === TOTAL - 1 && (
              <Button className="flex-1 gap-1.5" onClick={finishWizard}>
                <Check size={14} /> {t('Selesai')}
              </Button>
            )}
          </div>

          <p className="text-center text-[10px] text-muted-foreground">{t('Langkah')} {step + 1} / {TOTAL}</p>
        </div>
      </div>
    </div>
  )
}
