'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Sparkles, Crown, Rocket } from 'lucide-react'
import { toast } from '@/lib/toast'

type Plan = {
  id: 'free' | 'pro' | 'premium'
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
    id: 'free', name: 'Free', icon: Sparkles, price: { IDR: 0, USD: 0 },
    tagline: 'Untuk mulai mencatat trading',
    accent: 'text-muted-foreground',
    features: ['Catat trade tanpa batas', '1 akun broker', 'Dashboard & statistik dasar', 'Jurnal harian'],
  },
  {
    id: 'pro', name: 'Pro', icon: Rocket, price: { IDR: 99000, USD: 7 },
    tagline: 'Untuk trader yang serius berkembang',
    accent: 'text-primary', highlight: true,
    features: ['Semua fitur Free', 'Multi akun broker', 'Analisa jam & sesi trading', 'Analisa strategi & psikologi', 'Export data (CSV/JSON)'],
  },
  {
    id: 'premium', name: 'Premium', icon: Crown, price: { IDR: 199000, USD: 14 },
    tagline: 'Untuk trader profesional',
    accent: 'text-amber-400',
    features: ['Semua fitur Pro', 'Analisa by Claude (AI)', 'Laporan lanjutan', 'Prioritas support', 'Akses fitur beta'],
  },
]

export default function SubscriptionPage() {
  const { settings } = useStore()
  const t = useT()
  const [current] = useState<'free' | 'pro' | 'premium'>('free')  // mockup: default Free

  const cur = settings.currency === 'USD' ? 'USD' : 'IDR'
  const fmtPrice = (n: number) =>
    n === 0 ? t('Gratis') : cur === 'USD' ? `$${n}` : `Rp${n.toLocaleString('id-ID')}`

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold">{t('Paket Langganan')}</h1>
        <p className="text-sm text-muted-foreground">{t('Pilih paket yang sesuai kebutuhan trading kamu')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map(plan => {
          const Icon = plan.icon
          const isCurrent = plan.id === current
          return (
            <Card key={plan.id} className={`relative flex flex-col ${plan.highlight ? 'border-primary/40 shadow-lg shadow-primary/5' : ''}`}>
              {plan.highlight && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wide">
                  {t('Paling Populer')}
                </div>
              )}
              <CardContent className="pt-6 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={18} className={plan.accent} />
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{plan.tagline}</p>

                <div className="mb-4">
                  <span className="text-3xl font-black tracking-tight">{fmtPrice(plan.price[cur])}</span>
                  {plan.price[cur] > 0 && <span className="text-sm text-muted-foreground">{t('/bulan')}</span>}
                  {plan.price[cur] === 0 && <span className="text-sm text-muted-foreground"> · {t('selamanya')}</span>}
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check size={14} className={`${plan.accent} shrink-0 mt-0.5`} />
                      <span className="text-foreground/85">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={isCurrent ? 'outline' : plan.highlight ? 'default' : 'outline'}
                  className="w-full"
                  disabled={isCurrent}
                  onClick={() => toast.success(`${t('Pilih Paket')}: ${plan.name} — segera hadir`)}
                >
                  {isCurrent ? t('Paket Sekarang') : t('Pilih Paket')}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        💳 Pembayaran (Midtrans / Stripe) akan segera tersedia.
      </p>
    </div>
  )
}
