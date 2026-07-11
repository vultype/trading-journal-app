'use client'

import Link from 'next/link'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Sparkles, Crown } from 'lucide-react'

type Plan = {
  id: 'free' | 'pro'
  name: string
  icon: React.ElementType
  price: { IDR: number; USD: number }
  tagline: string
  features: string[]
  highlight?: boolean
  accent: string
}

const PLANS: Plan[] = [
  {
    id: 'free', name: 'Standar', icon: Sparkles, price: { IDR: 0, USD: 0 },
    tagline: 'Untuk mulai mencatat trading',
    accent: 'text-muted-foreground',
    features: [
      'Catat trade tanpa batas',
      '1 akun broker',
      'Dashboard & statistik dasar',
      'Jurnal harian & Kalender P&L',
      'Insight AI (3 temuan)',
    ],
  },
  {
    id: 'pro', name: 'Professional', icon: Crown, price: { IDR: 99000, USD: 7 },
    tagline: 'Untuk trader yang serius berkembang',
    accent: 'text-primary', highlight: true,
    features: [
      'Semua fitur Standar',
      'Multi akun broker',
      'Insight AI lengkap + Datalitiq Score',
      'Analisa jam & sesi trading',
      'Komparasi strategi & pair',
      'Upload screenshot chart',
      'Export data (CSV / JSON)',
      'Prioritas support',
    ],
  },
]

export default function SubscriptionPage() {
  const { settings } = useStore()
  const t = useT()
  const current: 'free' | 'pro' = 'free'  // default Free

  const cur = settings.currency === 'USD' ? 'USD' : 'IDR'
  const fmtPrice = (n: number) =>
    n === 0 ? t('Gratis') : cur === 'USD' ? `$${n}` : `Rp${n.toLocaleString('id-ID')}`

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-black">{t('Paket Langganan')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('Pilih paket yang sesuai kebutuhan trading kamu')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {PLANS.map(plan => {
          const Icon = plan.icon
          const isCurrent = plan.id === current
          return (
            <Card key={plan.id} className={`relative flex flex-col overflow-visible ${plan.highlight ? 'border-primary/50 shadow-xl shadow-primary/10 ring-1 ring-primary/20' : ''}`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-lg">
                  {t('Paling Populer')}
                </div>
              )}
              <CardContent className="pt-7 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-2 rounded-xl ${plan.highlight ? 'bg-primary/15' : 'bg-muted'}`}>
                    <Icon size={18} className={plan.accent} />
                  </div>
                  <h3 className="font-black text-xl">{plan.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-5">{plan.tagline}</p>

                <div className="mb-5 flex items-end gap-1">
                  <span className="text-4xl font-black tracking-tight">{fmtPrice(plan.price[cur])}</span>
                  {plan.price[cur] > 0
                    ? <span className="text-sm text-muted-foreground mb-1">{t('/bulan')}</span>
                    : <span className="text-sm text-muted-foreground mb-1"> · {t('selamanya')}</span>}
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <span className={`shrink-0 mt-0.5 rounded-full p-0.5 ${plan.highlight ? 'bg-primary/15' : 'bg-emerald-500/10'}`}>
                        <Check size={12} className={plan.highlight ? 'text-primary' : 'text-emerald-400'} />
                      </span>
                      <span className="text-foreground/85">{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>{t('Paket Sekarang')}</Button>
                ) : (
                  <Link href="/billing" className="w-full">
                    <Button className="w-full gap-2">
                      <Crown size={14} /> Upgrade ke {plan.name}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Pembayaran via transfer bank BCA. Lihat menu <Link href="/billing" className="text-primary hover:underline">Tagihan</Link> untuk detail.
      </p>
    </div>
  )
}
