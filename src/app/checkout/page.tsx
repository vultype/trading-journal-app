'use client'

// Checkout — standalone (bukan di dalam layout Jurnal Tools), gaya gelap konsisten
// dengan /terminal, /hub, /upgrade. Pembayaran online saja (DOKU utama, Midtrans
// fallback). Transfer manual sudah dihapus.
import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { DURATIONS, pkgPrice, planBase, planName, rp, type PlanId } from '@/lib/pricing'
import { Confetti } from '@/components/ui/Confetti'
import { track, trackPurchaseOnce } from '@/lib/pixel'
import {
  Crown, Sparkles, ShieldCheck, ArrowLeft, Loader2, CreditCard, Wallet, Check, ArrowRight, AlertCircle, PartyPopper,
} from 'lucide-react'

declare global {
  interface Window { snap?: { pay: (token: string, opts?: Record<string, unknown>) => void } }
}

const CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
const IS_SANDBOX = CLIENT_KEY.startsWith('SB-')
const SNAP_URL = IS_SANDBOX ? 'https://app.sandbox.midtrans.com/snap/snap.js' : 'https://app.midtrans.com/snap/snap.js'
// DOKU sebagai gateway online utama (redirect-based). Flag publik hanya penanda tampil,
// kredensial asli tetap server-side.
const DOKU_ENABLED = process.env.NEXT_PUBLIC_DOKU_ENABLED === 'true'

const INCLUDED = [
  'Kesimpulan arah pasar + tingkat keyakinan real-time',
  'Analisa Teknikal, Makro & Sentimen AI — tanpa batas',
  'Analisa News AI sebelum rilis besar',
  'Alert Telegram otomatis',
  'Bonus: Jurnal, Strategy Backtesting, KPI Projection, Risk Calculator',
]

function CheckoutInner() {
  const params = useSearchParams()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null | undefined>(undefined)

  const pParam = params.get('plan')
  const plan = (pParam === 'standar' ? 'standar' : pParam === 'pro' ? 'pro' : 'terminal') as PlanId
  const months = Number(params.get('months') || 1)
  const dur = DURATIONS.find(d => d.months === months) ?? DURATIONS[0]
  const base = useMemo(() => pkgPrice(planBase(plan), dur.months, dur.off), [plan, dur])

  const [step, setStep] = useState<'review' | 'processing' | 'success'>(params.get('status') === 'finish' ? 'processing' : 'review')
  const [busy, setBusy] = useState(false)
  const [snapReady, setSnapReady] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace(`/login?next=${encodeURIComponent('/checkout?' + params.toString())}`); return }
      setUserId(data.user.id)
    })
  }, [router, params])

  // Meta Pixel — Lead: pengguna sampai di halaman checkout (intent beli kuat). Sekali per load.
  useEffect(() => { track('Lead', { content_name: `Paket ${planName(plan)}`, value: base, currency: 'IDR' }) }, [plan, base])

  // Meta Pixel — Purchase: begitu status order 'aktif' (step success), kirim sekali per invoice.
  useEffect(() => {
    if (step !== 'success') return
    trackPurchaseOnce(params.get('inv') || `${plan}-${dur.months}`, base)
  }, [step, params, plan, dur.months, base])

  // Setelah kembali dari pembayaran (?status=finish&inv=…): pantau status order.
  // Begitu 'aktif' → tampilkan popup selamat + confetti. Aktivasi async via webhook.
  useEffect(() => {
    if (step !== 'processing') return
    const inv = params.get('inv')
    if (!inv) return
    const sb = createClient()
    let stop = false
    const check = async () => {
      const { data } = await sb.from('payment_orders').select('status').eq('invoice_number', inv).maybeSingle()
      if (!stop && data?.status === 'aktif') { setStep('success'); return true }
      return false
    }
    check()
    const id = setInterval(async () => { if (await check()) clearInterval(id) }, 3500)
    const stopAt = setTimeout(() => clearInterval(id), 120_000) // berhenti polling setelah 2 menit
    return () => { stop = true; clearInterval(id); clearTimeout(stopAt) }
  }, [step, params])

  useEffect(() => {
    if (!CLIENT_KEY || DOKU_ENABLED) return
    if (document.getElementById('midtrans-snap')) { setSnapReady(true); return }
    const s = document.createElement('script')
    s.id = 'midtrans-snap'; s.src = SNAP_URL; s.setAttribute('data-client-key', CLIENT_KEY); s.async = true
    s.onload = () => setSnapReady(true)
    document.body.appendChild(s)
  }, [])

  async function payWithMidtrans() {
    if (!userId) return
    track('InitiateCheckout', { content_name: `Paket ${planName(plan)}`, value: base, currency: 'IDR' })
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

  // DOKU: redirect-based. Buat order + sesi checkout di server → arahkan ke halaman DOKU.
  async function payWithDoku() {
    if (!userId) return
    track('InitiateCheckout', { content_name: `Paket ${planName(plan)}`, value: base, currency: 'IDR' })
    setBusy(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { toast.error('Sesi habis, silakan login ulang'); setBusy(false); return }
      const res = await fetch('/api/payment/doku/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan, months: dur.months, origin: window.location.origin }),
      })
      const j = await res.json()
      if (!res.ok || !j.paymentUrl) { toast.error(j.error || 'Gagal memulai pembayaran'); setBusy(false); return }
      window.location.href = j.paymentUrl
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan')
      setBusy(false)
    }
  }

  const onlineActive = DOKU_ENABLED || !!CLIENT_KEY

  if (userId === undefined) {
    return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[140px] rounded-full pointer-events-none" />

      <header className="relative max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/hub" className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"><ArrowLeft size={16} /> Kembali</Link>
        <span className="text-lg font-black tracking-tight">Datalitiq</span>
      </header>

      <main className="relative max-w-lg mx-auto px-5 pt-6 pb-20 space-y-5">
        <div className="text-center mb-2">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Checkout</h1>
          <p className="text-sm text-white/50 mt-1.5">Selesaikan pembayaran untuk mengaktifkan paket</p>
        </div>

        {/* Ringkasan pesanan */}
        <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-primary/60 via-primary/15 to-cyan-500/25">
          <div className="rounded-3xl bg-[#0a1110] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/15 ring-1 ring-primary/30 text-primary shrink-0">{plan === 'standar' ? <Sparkles size={19} /> : <Crown size={19} />}</span>
                <div>
                  <p className="font-black">Paket {planName(plan)}</p>
                  <p className="text-xs text-white/45">{dur.id}{dur.off > 0 ? ` · hemat ${dur.off}%` : ''}</p>
                </div>
              </div>
              <p className="text-2xl font-black tracking-tight">{rp(base)}</p>
            </div>
            <ul className="space-y-2 pt-4 border-t border-white/[0.06]">
              {INCLUDED.map(f => <li key={f} className="flex items-start gap-2.5 text-sm text-white/70"><span className="shrink-0 mt-0.5 rounded-full bg-primary/15 p-0.5"><Check size={12} className="text-primary" /></span>{f}</li>)}
            </ul>
          </div>
        </div>

        {step === 'review' && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Metode Pembayaran</p>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.06]">
              <span className="text-sm font-bold text-white/70">Total</span>
              <span className="text-xl font-black text-primary">{rp(base)}</span>
            </div>

            {DOKU_ENABLED ? (
              <>
                <button onClick={payWithDoku} disabled={busy || !userId}
                  className="group w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-xl shadow-primary/25">
                  {busy ? <><Loader2 size={16} className="animate-spin" /> Mengalihkan ke pembayaran…</> : <><CreditCard size={16} /> Bayar Online <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" /></>}
                </button>
                <div className="flex items-center justify-center gap-2 text-[11px] text-white/40 mt-3">
                  <Wallet size={12} /> Kartu · QRIS · GoPay/OVO/Dana · Virtual Account · Alfamart/Indomaret
                </div>
                <p className="text-[11px] text-white/35 text-center flex items-center justify-center gap-1.5 mt-2"><ShieldCheck size={12} className="text-primary/70" /> Pembayaran aman & terenkripsi · Akses aktif otomatis</p>
              </>
            ) : CLIENT_KEY ? (
              <>
                <button onClick={payWithMidtrans} disabled={busy || !userId || !snapReady}
                  className="group w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-xl shadow-primary/25">
                  {busy ? <><Loader2 size={16} className="animate-spin" /> Memproses…</> : !snapReady ? <><Loader2 size={16} className="animate-spin" /> Menyiapkan…</> : <><CreditCard size={16} /> Bayar Sekarang <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" /></>}
                </button>
                <div className="flex items-center justify-center gap-2 text-[11px] text-white/40 mt-3">
                  <Wallet size={12} /> Kartu · QRIS · GoPay/OVO/Dana · Virtual Account
                  {IS_SANDBOX && <span className="text-amber-400 font-semibold">· MODE SANDBOX</span>}
                </div>
                <p className="text-[11px] text-white/35 text-center flex items-center justify-center gap-1.5 mt-2"><ShieldCheck size={12} className="text-primary/70" /> Pembayaran aman via Midtrans · Akses aktif otomatis</p>
              </>
            ) : (
              <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 p-4">
                <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/90 leading-relaxed">
                  <p className="font-semibold">Pembayaran online belum aktif.</p>
                  <p className="mt-0.5">Silakan hubungi admin lewat <Link href="/kontak" className="underline">halaman Kontak</Link> untuk mengaktifkan langganan.</p>
                </div>
              </div>
            )}
            {onlineActive && <p className="text-[11px] text-white/30 text-center mt-4">Setelah pembayaran terkonfirmasi, akses Pro terbuka otomatis.</p>}
          </div>
        )}

        {step === 'processing' && (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-8 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15"><Loader2 size={30} className="text-emerald-400 animate-spin" /></div>
            <h2 className="text-xl font-black">Mengonfirmasi Pembayaran…</h2>
            <p className="text-sm text-white/55 max-w-sm mx-auto leading-relaxed">Pembayaran kamu sedang dikonfirmasi. Paket <strong className="text-white/85">{planName(plan)}</strong> akan <strong className="text-white/85">aktif otomatis</strong> begitu terkonfirmasi (biasanya beberapa detik untuk QRIS/e-wallet/kartu).</p>
            <div className="flex gap-2.5 justify-center pt-3">
              <button onClick={() => router.push('/account')} className="text-sm font-semibold border border-white/15 text-white/80 rounded-xl px-4 py-2.5 hover:bg-white/5 transition-colors">Lihat Status Langganan</button>
              <button onClick={() => router.push(plan === 'terminal' ? '/terminal' : '/hub')} className="text-sm font-semibold bg-primary text-primary-foreground rounded-xl px-4 py-2.5 hover:opacity-90 transition-opacity">{plan === 'terminal' ? 'Ke Terminal' : 'Ke Hub'}</button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <>
            <Confetti />
            <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-primary/70 via-primary/25 to-cyan-500/40 animate-in fade-in zoom-in duration-500">
              <div className="rounded-3xl bg-[#0a1110] p-8 text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/15 ring-1 ring-primary/30">
                  <PartyPopper size={38} className="text-primary" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1">Pembayaran Berhasil 🎉</p>
                  <h2 className="text-2xl font-black tracking-tight">Selamat, kamu sekarang Pro!</h2>
                  <p className="text-sm text-white/60 mt-2 max-w-sm mx-auto leading-relaxed">Langganan <strong className="text-white/85">{planName(plan)}</strong> ({dur.id}) sudah <strong className="text-primary">aktif</strong>. Terminal AI XAU/USD & semua tools bonus terbuka penuh — plus jatah kredit AI bulananmu.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
                  <button onClick={() => router.push('/terminal')} className="group inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/25">
                    <Sparkles size={15} /> Buka Terminal AI <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                  <button onClick={() => router.push('/account')} className="inline-flex items-center justify-center gap-2 border border-white/15 text-white/80 rounded-xl px-5 py-3 text-sm font-semibold hover:bg-white/5 transition-colors">Lihat Langganan</button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default function CheckoutPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>}><CheckoutInner /></Suspense>
}
