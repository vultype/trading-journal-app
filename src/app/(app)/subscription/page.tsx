'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Sparkles, Crown } from 'lucide-react'
import { BASE, DURATIONS, pkgPrice, rp } from '@/lib/pricing'

type Plan = { id: 'standar' | 'pro'; name: string; icon: React.ElementType; tagline: string; features: string[]; highlight?: boolean; accent: string }

const PLANS: Plan[] = [
  {
    id: 'standar', name: 'Standar', icon: Sparkles, accent: 'text-muted-foreground',
    tagline: 'Untuk trader yang mulai serius',
    features: ['Catat trade tanpa batas', '1 akun broker', 'Dashboard & statistik dasar', 'Jurnal harian & Kalender P&L', 'Insight AI (3 temuan)'],
  },
  {
    id: 'pro', name: 'Professional', icon: Crown, accent: 'text-primary', highlight: true,
    tagline: 'Untuk trader yang serius berkembang',
    features: ['Semua fitur Standar', 'Multi akun broker', 'Insight AI lengkap + Datalitiq Score', 'Analisa jam & sesi trading', 'Komparasi strategi & pair', 'Upload screenshot chart', 'Export data (CSV / JSON)', 'Prioritas support'],
  },
]

export default function SubscriptionPage() {
  const [dur, setDur] = useState(0)
  const d = DURATIONS[dur]

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-black">Paket Langganan</h1>
        <p className="text-sm text-muted-foreground mt-1">Pilih paket & durasi yang sesuai kebutuhan trading kamu</p>
      </div>

      {/* Durasi */}
      <div className="flex justify-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-1 rounded-2xl bg-muted/60 p-1">
          {DURATIONS.map((x, i) => (
            <button key={i} onClick={() => setDur(i)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${dur === i ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {x.id}{x.off > 0 && <span className={`ml-1.5 text-[9px] font-bold ${dur === i ? 'text-primary-foreground/80' : 'text-primary'}`}>-{x.off}%</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {PLANS.map(plan => {
          const Icon = plan.icon
          const base = plan.id === 'pro' ? BASE.pro : BASE.standar
          const total = pkgPrice(base, d.months, d.off)
          const perMonth = total / d.months
          return (
            <Card key={plan.id} className={`relative flex flex-col overflow-visible ${plan.highlight ? 'border-primary/50 shadow-xl shadow-primary/10 ring-1 ring-primary/20' : ''}`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-lg">Paling Populer</div>
              )}
              <CardContent className="pt-7 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-2 rounded-xl ${plan.highlight ? 'bg-primary/15' : 'bg-muted'}`}><Icon size={18} className={plan.accent} /></div>
                  <h3 className="font-black text-xl">{plan.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-5">{plan.tagline}</p>

                <div className="mb-1 flex items-end gap-1.5">
                  <span className="text-4xl font-black tracking-tight">{rp(total)}</span>
                  <span className="text-sm text-muted-foreground mb-1">/ {d.id.toLowerCase()}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-5">
                  {d.months > 1 ? `≈ ${rp(perMonth)}/bln · ` : ''}
                  {d.off > 0 ? <span className="text-primary font-semibold">hemat {d.off}%</span> : `${rp(base)}/bln`}
                </p>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <span className={`shrink-0 mt-0.5 rounded-full p-0.5 ${plan.highlight ? 'bg-primary/15' : 'bg-emerald-500/10'}`}><Check size={12} className={plan.highlight ? 'text-primary' : 'text-emerald-400'} /></span>
                      <span className="text-foreground/85">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link href={`/checkout?plan=${plan.id}&months=${d.months}`} className="w-full">
                  <Button className={`w-full gap-2 ${plan.highlight ? '' : 'variant-outline'}`} variant={plan.highlight ? 'default' : 'outline'}>
                    <Crown size={14} /> Pilih {plan.name}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Pembayaran via transfer bank Mandiri · Aktivasi setelah verifikasi admin · bisa berhenti kapan saja.
      </p>
    </div>
  )
}
