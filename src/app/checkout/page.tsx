'use client'

// Checkout — standalone (bukan di dalam layout Jurnal Tools), gaya gelap
// konsisten dengan /terminal, /hub, /upgrade. Route group (app) sebelumnya
// cuma soal layout, bukan URL — jadi /checkout tetap /checkout.
import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { DURATIONS, pkgPrice, planBase, planName, rp, BANK, genUniqueCode, type PlanId } from '@/lib/pricing'
import {
  Crown, Sparkles, ShieldCheck, ArrowLeft, Loader2, CreditCard, Wallet, Check, ArrowRight,
  Building2, Copy, Upload, FileImage, Clock, HelpCircle, Receipt,
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
  'Bonus: Jurnal, Simulator, Risk Calculator',
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

  const [step, setStep] = useState<'review' | 'pay' | 'done' | 'processing'>(params.get('status') === 'finish' ? 'processing' : 'review')
  const [busy, setBusy] = useState(false)
  const [snapReady, setSnapReady] = useState(false)
  const [uniqueCode] = useState(genUniqueCode)
  const total = base + uniqueCode
  const [orderId, setOrderId] = useState<string | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [proofUrl, setProofUrl] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace(`/login?next=${encodeURIComponent('/checkout?' + params.toString())}`); return }
      setUserId(data.user.id)
    })
  }, [router, params])

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

  // DOKU: redirect-based. Buat order + sesi checkout di server → arahkan ke halaman DOKU.
  async function payWithDoku() {
    if (!userId) return
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

  // Transfer manual: buat order (invoice_number ter-generate otomatis di database).
  async function startManualTransfer() {
    if (!userId) return
    setBusy(true)
    const sb = createClient()
    const { data, error } = await sb.from('payment_orders').insert({
      user_id: userId, plan, months: dur.months,
      base_amount: base, unique_code: uniqueCode, total,
      bank: BANK.name, account_no: BANK.number, status: 'menunggu_pembayaran', method: 'manual',
    }).select('id, invoice_number').single()
    setBusy(false)
    if (error || !data) { toast.error('Gagal membuat pesanan: ' + (error?.message ?? '')); return }
    setOrderId(data.id); setInvoiceNumber(data.invoice_number as string | null)
    setStep('pay')
  }

  function copyTotal() {
    navigator.clipboard.writeText(String(total))
    setCopied(true); toast.success('Nominal disalin')
    setTimeout(() => setCopied(false), 2000)
  }

  async function uploadProof(file: File) {
    if (!orderId) return
    if (file.size > 5_000_000) { toast.error('Ukuran file maksimal 5 MB'); return }
    setUploading(true)
    try {
      const sb = createClient()
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `payment-proof/${orderId}-${Date.now()}.${ext}`
      const { error: upErr } = await sb.storage.from('trade-screenshots').upload(path, file, { upsert: true })
      if (upErr) { toast.error('Upload gagal: ' + upErr.message); return }
      const url = sb.storage.from('trade-screenshots').getPublicUrl(path).data.publicUrl
      const { error: dbErr } = await sb.from('payment_orders').update({ proof_url: url, status: 'menunggu_verifikasi', updated_at: new Date().toISOString() }).eq('id', orderId)
      if (dbErr) { toast.error('Gagal menyimpan bukti: ' + dbErr.message); return }
      setProofUrl(url)
      setStep('done')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload gagal')
    } finally { setUploading(false) }
  }

  if (userId === undefined) {
    return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[140px] rounded-full pointer-events-none" />

      <header className="relative max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/subscription" className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"><ArrowLeft size={16} /> Kembali</Link>
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
                <p className="text-[11px] text-white/35 text-center flex items-center justify-center gap-1.5 mt-2"><ShieldCheck size={12} className="text-primary/70" /> Pembayaran aman via DOKU · Akses aktif otomatis</p>
                <div className="flex items-center gap-3 my-4"><div className="h-px flex-1 bg-white/10" /><span className="text-[10px] text-white/35 uppercase tracking-wider">atau</span><div className="h-px flex-1 bg-white/10" /></div>
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
                <div className="flex items-center gap-3 my-4"><div className="h-px flex-1 bg-white/10" /><span className="text-[10px] text-white/35 uppercase tracking-wider">atau</span><div className="h-px flex-1 bg-white/10" /></div>
              </>
            ) : null}
            <button onClick={startManualTransfer} disabled={busy || !userId}
              className="group w-full flex items-center justify-center gap-2 border border-white/15 text-white/85 rounded-xl px-6 py-3.5 text-sm font-bold hover:bg-white/5 disabled:opacity-50 transition-colors">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Menyiapkan pesanan…</> : <><Building2 size={16} className="text-primary" /> Transfer Bank</>}
            </button>
            <p className="text-[11px] text-white/35 text-center flex items-center justify-center gap-1.5 mt-2"><Receipt size={11} className="text-primary/70" /> Invoice resmi diterbitkan otomatis · verifikasi cepat</p>
          </div>
        )}

        {step === 'pay' && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-white/40">Rekening Pembayaran Resmi</p>
              {invoiceNumber && <span className="text-[11px] font-bold text-primary tabular-nums">{invoiceNumber}</span>}
            </div>

            <div className="rounded-xl bg-black/25 border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-3.5"><Building2 size={16} className="text-primary" /><span className="font-bold text-white/90">Bank {BANK.name}</span></div>
              <div className="mb-3.5">
                <p className="text-[10px] text-white/35 uppercase tracking-wider">No. Rekening</p>
                <p className="text-lg font-black tracking-wider tabular-nums">{BANK.number}</p>
              </div>
              <div className="mb-3.5 pt-3.5 border-t border-white/[0.06]">
                <p className="text-[10px] text-white/35 uppercase tracking-wider">Atas Nama</p>
                <p className="text-sm font-semibold text-white/85">{BANK.holder}</p>
              </div>
              <div className="pt-3.5 border-t border-white/[0.06]">
                <p className="text-[10px] text-white/35 uppercase tracking-wider">Nominal Transfer (harus tepat)</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-2xl font-black text-primary tabular-nums">{rp(total)}</p>
                  <button onClick={copyTotal} className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold border border-white/15 text-white/75 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors">
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}{copied ? 'Tersalin' : 'Salin'}
                  </button>
                </div>
                <p className="text-[11px] text-amber-400 mt-2">⚠ Transfer TEPAT sampai 3 digit terakhir agar sistem otomatis mencocokkan pesanan.</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Unggah Bukti Transfer</p>
              <label className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 py-8 cursor-pointer hover:border-primary/40 hover:bg-primary/[0.03] transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                {uploading ? <Loader2 size={22} className="animate-spin text-primary" /> : <Upload size={22} className="text-white/40" />}
                <span className="text-sm font-semibold text-white/70">{uploading ? 'Mengunggah…' : 'Pilih screenshot / foto bukti transfer'}</span>
                <span className="text-[11px] text-white/35">JPG/PNG, maks 5 MB</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadProof(f) }} />
              </label>
              <p className="text-[11px] text-white/35 mt-2 flex items-center gap-1.5"><FileImage size={12} /> Setelah diunggah, pesanan otomatis masuk status &ldquo;Menunggu Verifikasi&rdquo; — tidak perlu menghubungi siapa pun.</p>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-8 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15"><Clock size={30} className="text-emerald-400" /></div>
            <h2 className="text-xl font-black">Bukti Transfer Diterima</h2>
            {invoiceNumber && <p className="text-xs text-white/40 tabular-nums">Invoice {invoiceNumber}</p>}
            <p className="text-sm text-white/55 max-w-sm mx-auto leading-relaxed">Pesanan kamu sedang diverifikasi. Paket <strong className="text-white/85">{planName(plan)}</strong> akan aktif otomatis setelah transfer terkonfirmasi — biasanya dalam beberapa menit hingga maksimal 1×24 jam.</p>
            {proofUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proofUrl} alt="Bukti transfer" className="mx-auto max-h-32 rounded-lg border border-white/10 object-contain" />
            )}
            <div className="flex gap-2.5 justify-center pt-3">
              <button onClick={() => router.push('/billing')} className="text-sm font-semibold border border-white/15 text-white/80 rounded-xl px-4 py-2.5 hover:bg-white/5 transition-colors">Lihat Status Pesanan</button>
              <button onClick={() => router.push(plan === 'terminal' ? '/terminal' : '/jurnal')} className="text-sm font-semibold bg-primary text-primary-foreground rounded-xl px-4 py-2.5 hover:opacity-90 transition-opacity">{plan === 'terminal' ? 'Ke Terminal' : 'Ke Dashboard'}</button>
            </div>
            <p className="pt-2"><Link href="/kontak" className="inline-flex items-center gap-1.5 text-[11px] text-white/35 hover:text-white/60 transition-colors"><HelpCircle size={11} /> Butuh bantuan? Hubungi Customer Support</Link></p>
          </div>
        )}

        {step === 'processing' && (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-8 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15"><Loader2 size={30} className="text-emerald-400 animate-spin" /></div>
            <h2 className="text-xl font-black">Mengonfirmasi Pembayaran…</h2>
            <p className="text-sm text-white/55 max-w-sm mx-auto leading-relaxed">Pembayaran kamu sedang dikonfirmasi. Paket <strong className="text-white/85">{planName(plan)}</strong> akan <strong className="text-white/85">aktif otomatis</strong> begitu terkonfirmasi (biasanya beberapa detik untuk QRIS/e-wallet/kartu).</p>
            <div className="flex gap-2.5 justify-center pt-3">
              <button onClick={() => router.push('/billing')} className="text-sm font-semibold border border-white/15 text-white/80 rounded-xl px-4 py-2.5 hover:bg-white/5 transition-colors">Lihat Status Pesanan</button>
              <button onClick={() => router.push(plan === 'terminal' ? '/terminal' : '/jurnal')} className="text-sm font-semibold bg-primary text-primary-foreground rounded-xl px-4 py-2.5 hover:opacity-90 transition-opacity">{plan === 'terminal' ? 'Ke Terminal' : 'Ke Dashboard'}</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function CheckoutPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>}><CheckoutInner /></Suspense>
}
