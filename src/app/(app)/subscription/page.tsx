'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Activity, ShieldCheck, Gauge, Landmark, Newspaper, Bell, MessageSquare, BookOpen } from 'lucide-react'
import { BASE, rp } from '@/lib/pricing'

const FEATURES = [
  { icon: Gauge, t: 'Kesimpulan arah pasar + tingkat keyakinan real-time' },
  { icon: Landmark, t: 'Analisa makro ekonomi & sentimen pasar' },
  { icon: Activity, t: 'Level kunci & konteks multi-timeframe' },
  { icon: MessageSquare, t: 'Analisa AI sesuai permintaan' },
  { icon: Bell, t: 'Notifikasi kondisi pasar penting (Telegram)' },
  { icon: BookOpen, t: 'Bonus gratis: Jurnal, Simulator, Risk Calculator' },
]

export default function SubscriptionPage() {
  const price = BASE.terminal

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-black">Langganan Datalitiq AI Terminal</h1>
        <p className="text-sm text-muted-foreground mt-1">Satu paket, semua fitur. Tanpa tingkatan yang membingungkan.</p>
      </div>

      <Card className="relative overflow-visible border-primary/50 shadow-xl shadow-primary/10 ring-1 ring-primary/20">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-lg">Akses Penuh</div>
        <CardContent className="pt-7 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-primary/15"><Activity size={18} className="text-primary" /></div>
            <h3 className="font-black text-xl">Datalitiq AI Terminal</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-5">Analisa emas XAU/USD berbasis AI, real-time.</p>

          <div className="mb-1 flex items-end gap-1.5">
            <span className="text-4xl font-black tracking-tight">{rp(price)}</span>
            <span className="text-sm text-muted-foreground mb-1">/ bulan</span>
          </div>
          <p className="text-xs text-muted-foreground mb-6">≈ Rp6 ribu/hari · tanpa kontrak, berhenti kapan saja</p>

          <ul className="space-y-2.5 mb-6">
            {FEATURES.map(f => (
              <li key={f.t} className="flex items-start gap-2.5 text-sm">
                <span className="shrink-0 mt-0.5 rounded-full p-0.5 bg-primary/15"><Check size={12} className="text-primary" /></span>
                <span className="text-foreground/85">{f.t}</span>
              </li>
            ))}
          </ul>

          <Link href="/checkout?plan=terminal&months=1" className="w-full">
            <Button className="w-full gap-2 h-11">Mulai Berlangganan</Button>
          </Link>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <ShieldCheck size={12} /> Pembayaran aman via Midtrans (kartu, QRIS, e-wallet, VA) · Akses aktif otomatis
      </p>
    </div>
  )
}
