'use client'

import Link from 'next/link'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, CreditCard, Receipt, ArrowUpRight } from 'lucide-react'

export default function BillingPage() {
  const { settings } = useStore()
  const t = useT()
  const name = settings.displayName || 'Trader'

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">{t('Tagihan & Pembayaran')}</h1>
        <p className="text-sm text-muted-foreground">{t('Kelola langganan dan lihat riwayat pembayaran')}</p>
      </div>

      {/* Active plan */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('Paket Aktif')}</p>
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-muted-foreground" />
                <span className="text-2xl font-black">Free</span>
                <Badge variant="secondary" className="text-[10px]">{name}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1.5">{t('Tanggal Perpanjangan')}: —</p>
            </div>
            <Link href="/subscription">
              <Button size="sm" className="gap-1.5">
                <ArrowUpRight size={14} /> Upgrade
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Payment method */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CreditCard size={14} /> {t('Metode Pembayaran')}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border/60 px-4 py-6">
            <p className="text-sm text-muted-foreground">Belum ada metode pembayaran</p>
            <Button variant="outline" size="sm" disabled>Tambah Kartu</Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment history */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Receipt size={14} /> {t('Riwayat Pembayaran')}</CardTitle></CardHeader>
        <CardContent>
          <div className="py-10 text-center">
            <Receipt size={26} className="mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('Belum ada pembayaran')}</p>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        💳 Integrasi pembayaran (Midtrans / Stripe) akan segera tersedia.
      </p>
    </div>
  )
}
