'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/lib/toast'
import { Sparkles, Copy, Check, Building2, MessageCircle, Crown } from 'lucide-react'

// Rekening admin — ganti sesuai rekening kamu
const BCA = {
  bank: 'BCA',
  number: '1234567890',
  holder: 'ADMIN VULTYPE',
  waNumber: '6281234567890',
}
const PRO_PRICE = { IDR: 99000, USD: 7 }

export default function BillingPage() {
  const { settings } = useStore()
  const t = useT()
  const [copied, setCopied] = useState(false)

  const cur = settings.currency === 'USD' ? 'USD' : 'IDR'
  const price = cur === 'USD' ? `$${PRO_PRICE.USD}` : `Rp${PRO_PRICE.IDR.toLocaleString('id-ID')}`

  function copyNumber() {
    navigator.clipboard.writeText(BCA.number)
    setCopied(true)
    toast.success('Nomor rekening disalin')
    setTimeout(() => setCopied(false), 2000)
  }

  const waText = encodeURIComponent(`Halo admin, saya sudah transfer untuk upgrade Pro (${price}). Nama akun: ${settings.displayName || '-'}`)

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold">{t('Tagihan & Pembayaran')}</h1>
        <p className="text-sm text-muted-foreground">Upgrade ke Pro dengan transfer bank</p>
      </div>

      {/* Paket aktif */}
      <Card className="border-border/60">
        <CardContent className="pt-5 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-muted"><Sparkles size={18} className="text-muted-foreground" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{t('Paket Aktif')}</p>
              <p className="text-lg font-black">Standar</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">{settings.displayName || 'Trader'}</Badge>
        </CardContent>
      </Card>

      {/* Upgrade box */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/8 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Crown size={15} className="text-primary" /> Upgrade ke Pro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black">{price}</span>
            <span className="text-sm text-muted-foreground">/ bulan</span>
          </div>

          {/* Langkah pembayaran */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Cara Pembayaran</p>

            {/* Step 1 — transfer */}
            <div className="rounded-xl border border-border/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold">1</span>
                <p className="text-sm font-semibold">Transfer ke rekening berikut</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={16} className="text-blue-400" />
                  <span className="font-bold text-blue-400">Bank {BCA.bank}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">No. Rekening</p>
                    <p className="text-xl font-black tracking-wider tabular-nums">{BCA.number}</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={copyNumber}>
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    {copied ? 'Tersalin' : 'Salin'}
                  </Button>
                </div>
                <div className="mt-3 pt-3 border-t border-border/40">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Atas Nama</p>
                  <p className="text-sm font-semibold">{BCA.holder}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-border/40">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nominal Transfer</p>
                  <p className="text-lg font-black text-primary">{price}</p>
                </div>
              </div>
            </div>

            {/* Step 2 — konfirmasi */}
            <div className="rounded-xl border border-border/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold">2</span>
                <p className="text-sm font-semibold">Konfirmasi ke admin</p>
              </div>
              <p className="text-xs text-muted-foreground">Kirim bukti transfer via WhatsApp. Akun kamu akan diupgrade ke Pro dalam 1×24 jam.</p>
              <a href={`https://wa.me/${BCA.waNumber}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <MessageCircle size={15} /> Konfirmasi via WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Pembayaran diproses manual oleh admin. Butuh bantuan? Hubungi WhatsApp di atas.
      </p>
    </div>
  )
}
