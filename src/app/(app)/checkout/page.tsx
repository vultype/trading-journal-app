'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BASE, DURATIONS, pkgPrice, planBase, planName, rp, BANK, genUniqueCode, type PlanId,
} from '@/lib/pricing'
import {
  Crown, Sparkles, Copy, Check, Building2, MessageCircle, ShieldCheck, ArrowLeft, Loader2, Clock,
} from 'lucide-react'

function CheckoutInner() {
  const params = useSearchParams()
  const router = useRouter()
  const { userId } = useStore()

  const pParam = params.get('plan')
  const plan = (pParam === 'terminal' ? 'terminal' : pParam === 'pro' ? 'pro' : 'standar') as PlanId
  const months = Number(params.get('months') || 1)
  const dur = DURATIONS.find(d => d.months === months) ?? DURATIONS[0]

  const base = useMemo(() => pkgPrice(planBase(plan), dur.months, dur.off), [plan, dur])
  const [code] = useState(genUniqueCode)
  const total = base + code

  const [step, setStep] = useState<'review' | 'pay' | 'done'>('review')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<'no' | 'total'>('no')
  const [orderId, setOrderId] = useState<string | null>(null)

  async function createOrder() {
    if (!userId) return
    setBusy(true)
    const sb = createClient()
    const { data, error } = await sb.from('payment_orders').insert({
      user_id: userId, plan, months: dur.months,
      base_amount: base, unique_code: code, total,
      bank: BANK.name, account_no: BANK.number, status: 'menunggu_pembayaran',
    }).select('id').single()
    setBusy(false)
    if (error) { toast.error('Gagal membuat pesanan: ' + error.message); return }
    setOrderId(data?.id ?? null)
    setStep('pay')
  }

  async function confirmPaid() {
    if (!orderId) { setStep('done'); return }
    setBusy(true)
    const sb = createClient()
    await sb.from('payment_orders').update({ status: 'menunggu_verifikasi', updated_at: new Date().toISOString() }).eq('id', orderId)
    setBusy(false)
    setStep('done')
  }

  function copyTotal() {
    navigator.clipboard.writeText(String(total))
    setCopied('total'); toast.success('Nominal disalin')
    setTimeout(() => setCopied('no'), 2000)
  }

  const waText = encodeURIComponent(`Halo admin, saya sudah transfer ${rp(total)} untuk paket ${planName(plan)} (${dur.id}). Order: ${orderId ?? '-'}`)

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <Link href="/subscription" className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-xl font-bold">Checkout</h1>
          <p className="text-sm text-muted-foreground">Selesaikan pembayaran untuk mengaktifkan paket</p>
        </div>
      </div>

      {/* Ringkasan pesanan */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/8 to-transparent">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-primary/15">{plan === 'standar' ? <Sparkles size={18} className="text-primary" /> : <Crown size={18} className="text-primary" />}</span>
              <div>
                <p className="font-bold">Paket {planName(plan)}</p>
                <p className="text-xs text-muted-foreground">{dur.id}{dur.off > 0 ? ` · hemat ${dur.off}%` : ''}</p>
              </div>
            </div>
            <p className="text-2xl font-black">{rp(base)}</p>
          </div>
        </CardContent>
      </Card>

      {step === 'review' && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Rincian Pembayaran</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Harga paket</span><span className="font-semibold">{rp(base)}</span></div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">Kode unik <span className="text-[10px] text-muted-foreground/60">(identifikasi transfer)</span></span>
              <span className="font-semibold text-primary">+{code}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-border/50">
              <span className="text-sm font-bold">Total transfer</span>
              <span className="text-xl font-black text-primary">{rp(total)}</span>
            </div>
            <Button className="w-full mt-2" onClick={createOrder} disabled={busy || !userId}>
              {busy ? <><Loader2 size={15} className="animate-spin mr-1.5" /> Memproses…</> : 'Lanjut ke Pembayaran'}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1"><ShieldCheck size={11} /> Transfer manual · Aktivasi setelah verifikasi admin</p>
          </CardContent>
        </Card>
      )}

      {step === 'pay' && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Transfer ke Rekening Berikut</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="flex items-center gap-2 mb-3"><Building2 size={16} className="text-blue-400" /><span className="font-bold text-blue-400">Bank {BANK.name}</span></div>
              <div className="mb-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">No. Rekening</p>
                <p className="text-lg font-black tracking-wider tabular-nums">{BANK.number}</p>
              </div>
              <div className="mb-3 pt-3 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Atas Nama</p>
                <p className="text-sm font-semibold">{BANK.holder}</p>
              </div>
              <div className="pt-3 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nominal Transfer (harus tepat)</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-2xl font-black text-primary tabular-nums">{rp(total)}</p>
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={copyTotal}>
                    {copied === 'total' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}{copied === 'total' ? 'Tersalin' : 'Salin'}
                  </Button>
                </div>
                <p className="text-[11px] text-amber-400 mt-1.5">⚠ Transfer TEPAT sampai 3 digit terakhir ({code}) agar otomatis teridentifikasi.</p>
              </div>
            </div>

            <a href={`https://wa.me/${BANK.wa}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="outline" className="w-full gap-2"><MessageCircle size={15} /> Kirim bukti transfer via WhatsApp</Button>
            </a>
            <Button className="w-full gap-2" onClick={confirmPaid} disabled={busy}>
              {busy ? <><Loader2 size={15} className="animate-spin" /> Menyimpan…</> : <><Check size={15} /> Saya Sudah Transfer</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'done' && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15"><Clock size={30} className="text-emerald-400" /></div>
            <h2 className="text-xl font-black">Pembayaran Sedang Diverifikasi</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">Terima kasih! Pesanan kamu tercatat. Paket <strong>{planName(plan)}</strong> akan aktif setelah admin memverifikasi transfer (maks. 1×24 jam).</p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={() => router.push('/billing')}>Lihat Status</Button>
              <Button onClick={() => router.push('/jurnal')}>Ke Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function CheckoutPage() {
  return <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>}><CheckoutInner /></Suspense>
}
