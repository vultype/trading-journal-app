'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DURATIONS, pkgPrice, planBase, planName, rp, type PlanId } from '@/lib/pricing'
import {
  Crown, Sparkles, ShieldCheck, ArrowLeft, Loader2, CreditCard, Wallet, AlertCircle,
} from 'lucide-react'

declare global {
  interface Window { snap?: { pay: (token: string, opts?: Record<string, unknown>) => void } }
}

const CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
const IS_SANDBOX = CLIENT_KEY.startsWith('SB-')
const SNAP_URL = IS_SANDBOX ? 'https://app.sandbox.midtrans.com/snap/snap.js' : 'https://app.midtrans.com/snap/snap.js'

function CheckoutInner() {
  const params = useSearchParams()
  const router = useRouter()
  const { userId } = useStore()

  const pParam = params.get('plan')
  const plan = (pParam === 'standar' ? 'standar' : pParam === 'pro' ? 'pro' : 'terminal') as PlanId
  const months = Number(params.get('months') || 1)
  const dur = DURATIONS.find(d => d.months === months) ?? DURATIONS[0]
  const base = useMemo(() => pkgPrice(planBase(plan), dur.months, dur.off), [plan, dur])

  const [step, setStep] = useState<'review' | 'processing'>(params.get('status') === 'finish' ? 'processing' : 'review')
  const [busy, setBusy] = useState(false)
  const [snapReady, setSnapReady] = useState(false)

  useEffect(() => {
    if (!CLIENT_KEY) return
    if (document.getElementById('midtrans-snap')) { setSnapReady(true); return }
    const s = document.createElement('script')
    s.id = 'midtrans-snap'; s.src = SNAP_URL; s.setAttribute('data-client-key', CLIENT_KEY); s.async = true
    s.onload = () => setSnapReady(true)
    document.body.appendChild(s)
  }, [])

  async function payWithMidtrans() {
    if (!userId) return
    setBusy(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { toast.error('Sesi habis, silakan login ulang'); setBusy(false); return }
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan, months: dur.months, origin: window.location.origin }),
      })
      const j = await res.json()
      if (!res.ok || !j.token) { toast.error(j.error || 'Gagal memulai pembayaran'); setBusy(false); return }
      setBusy(false)
      if (!window.snap) { window.location.href = j.redirectUrl; return }
      window.snap.pay(j.token, {
        onSuccess: () => setStep('processing'),
        onPending: () => setStep('processing'),
        onError: () => toast.error('Pembayaran gagal. Coba lagi.'),
        onClose: () => { /* user menutup popup — tetap di review */ },
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <Link href="/subscription" className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-xl font-bold">Checkout</h1>
          <p className="text-sm text-muted-foreground">Selesaikan pembayaran untuk mengaktifkan paket</p>
        </div>
      </div>

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
          <CardHeader className="pb-2"><CardTitle className="text-sm">Metode Pembayaran</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center text-sm pb-3 border-b border-border/50">
              <span className="font-bold">Total</span>
              <span className="text-xl font-black text-primary">{rp(base)}</span>
            </div>

            {CLIENT_KEY ? (
              <>
                <Button className="w-full gap-2 h-11" onClick={payWithMidtrans} disabled={busy || !userId || !snapReady}>
                  {busy ? <><Loader2 size={15} className="animate-spin" /> Memproses…</> : !snapReady ? <><Loader2 size={15} className="animate-spin" /> Menyiapkan…</> : <><CreditCard size={16} /> Bayar Sekarang</>}
                </Button>
                <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <Wallet size={12} /> Kartu · QRIS · GoPay/OVO/Dana · Virtual Account
                  {IS_SANDBOX && <span className="text-amber-400 font-semibold">· MODE SANDBOX</span>}
                </div>
                <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1"><ShieldCheck size={11} /> Pembayaran aman via Midtrans · Akses aktif otomatis</p>
              </>
            ) : (
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 p-3">
                <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/90">
                  <p className="font-semibold">Pembayaran sedang disiapkan.</p>
                  <p className="mt-0.5">Sistem pembayaran online belum aktif. Silakan hubungi admin lewat <Link href="/kontak" className="underline">halaman Kontak</Link> untuk mengaktifkan langganan.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'processing' && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15"><Loader2 size={30} className="text-emerald-400 animate-spin" /></div>
            <h2 className="text-xl font-black">Mengonfirmasi Pembayaran…</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">Pembayaran kamu sedang dikonfirmasi Midtrans. Paket <strong>{planName(plan)}</strong> akan <strong>aktif otomatis</strong> begitu terkonfirmasi (biasanya beberapa detik untuk QRIS/e-wallet/kartu).</p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={() => router.push('/billing')}>Lihat Status Pesanan</Button>
              <Button onClick={() => router.push(plan === 'terminal' ? '/terminal' : '/jurnal')}>{plan === 'terminal' ? 'Ke Terminal' : 'Ke Dashboard'}</Button>
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
