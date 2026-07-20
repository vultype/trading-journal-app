'use client'

// Checkout — standalone (bukan di dalam layout Jurnal Tools), gaya gelap konsisten
// dengan /terminal, /hub, /upgrade. Mendukung gateway online (DOKU/iPaymu/Midtrans)
// DAN transfer manual (upload bukti + kode unik), dipilih dari Admin → Pembayaran.
import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { DURATIONS, pkgPrice, planBase, planName, rp, BANK, type PlanId } from '@/lib/pricing'
import { Confetti } from '@/components/ui/Confetti'
import { track, trackPurchaseOnce } from '@/lib/pixel'
import {
  Crown, Sparkles, ShieldCheck, ArrowLeft, Loader2, CreditCard, Wallet, Check, ArrowRight, AlertCircle, PartyPopper,
  Building2, Copy, Upload, Clock,
} from 'lucide-react'

declare global {
  interface Window { snap?: { pay: (token: string, opts?: Record<string, unknown>) => void } }
}

// Gateway aktif TIDAK lagi dari env — diambil dari /api/payment/gateway (diatur admin
// lewat UI). Endpoint itu hanya mengembalikan nama gateway + client key Midtrans (publik);
// semua secret tetap server-side.
type GatewayInfo = { gateway: 'none' | 'doku' | 'ipaymu' | 'midtrans' | 'mayar' | 'manual'; midtransClientKey: string; midtransProduction: boolean }
// Order transfer manual yang sudah dibuat (menunggu transfer + bukti)
type ManualOrder = { orderId: string; invoice: string; baseAmount: number; uniqueCode: number; total: number }

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
  const [gw, setGw] = useState<GatewayInfo | null>(null)   // null = masih memuat
  const [manual, setManual] = useState<ManualOrder | null>(null)  // order transfer manual aktif
  const [uploading, setUploading] = useState(false)
  const [proofDone, setProofDone] = useState(false)

  // Ambil gateway aktif dari server (diatur admin lewat UI)
  useEffect(() => {
    let stop = false
    fetch('/api/payment/gateway').then(r => r.json())
      .then(j => { if (!stop) setGw({ gateway: j.gateway ?? 'none', midtransClientKey: j.midtransClientKey ?? '', midtransProduction: !!j.midtransProduction }) })
      .catch(() => { if (!stop) setGw({ gateway: 'none', midtransClientKey: '', midtransProduction: false }) })
    return () => { stop = true }
  }, [])

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

  // Snap.js hanya dimuat kalau Midtrans yang aktif.
  useEffect(() => {
    if (gw?.gateway !== 'midtrans' || !gw.midtransClientKey) return
    if (document.getElementById('midtrans-snap')) { setSnapReady(true); return }
    const s = document.createElement('script')
    s.id = 'midtrans-snap'
    s.src = gw.midtransProduction ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js'
    s.setAttribute('data-client-key', gw.midtransClientKey); s.async = true
    s.onload = () => setSnapReady(true)
    document.body.appendChild(s)
  }, [gw])

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

  // Gateway redirect-based (DOKU / iPaymu): buat order + sesi di server → arahkan ke halaman bayar.
  async function payRedirect(endpoint: string) {
    if (!userId) return
    track('InitiateCheckout', { content_name: `Paket ${planName(plan)}`, value: base, currency: 'IDR' })
    setBusy(true)

    // Popup HARUS dibuka sinkron di sini — saat masih dalam konteks gestur klik.
    // Kalau window.open dipanggil setelah `await fetch`, browser menganggapnya
    // bukan hasil klik langsung dan memblokirnya. Jadi dibuka blank dulu, lalu
    // diarahkan ke URL pembayaran begitu datang.
    const w = 460, h = 760
    const y = window.top!.outerHeight / 2 + window.top!.screenY - h / 2
    const x = window.top!.outerWidth / 2 + window.top!.screenX - w / 2
    const popup = window.open('about:blank', 'datalitiq_pay',
      `popup,width=${w},height=${h},left=${Math.max(0, x)},top=${Math.max(0, y)}`)
    // Halaman tunggu ringkas selama menunggu URL (agar popup tak tampak macet).
    if (popup) popup.document.write('<title>Memuat pembayaran…</title><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;color:#334155">Menyiapkan pembayaran…</body>')

    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { toast.error('Sesi habis, silakan login ulang'); popup?.close(); setBusy(false); return }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan, months: dur.months, origin: window.location.origin }),
      })
      const j = await res.json()
      if (!res.ok || !j.paymentUrl) { toast.error(j.error || 'Gagal memulai pembayaran'); popup?.close(); setBusy(false); return }

      if (popup && !popup.closed) {
        popup.location.href = j.paymentUrl
        popup.focus()
      } else {
        // Popup diblokir browser → jangan buntu, arahkan di tab ini saja.
        window.location.href = j.paymentUrl
        return
      }
      setBusy(false)
    } catch (e) {
      popup?.close()
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan')
      setBusy(false)
    }
  }

  // ── Transfer manual: buat order (server hitung harga + kode unik) ──
  async function startManual() {
    if (!userId) return
    track('InitiateCheckout', { content_name: `Paket ${planName(plan)}`, value: base, currency: 'IDR' })
    setBusy(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) { toast.error('Sesi habis, silakan login ulang'); return }
      const res = await fetch('/api/payment/manual/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan, months: dur.months }),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || 'Gagal membuat pesanan'); return }
      setManual({ orderId: j.orderId, invoice: j.invoice, baseAmount: j.baseAmount, uniqueCode: j.uniqueCode, total: j.total })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan') } finally { setBusy(false) }
  }

  // ── Unggah bukti transfer: upload ke storage, lalu server tandai menunggu verifikasi ──
  async function uploadProof(file: File) {
    if (!manual || !userId) return
    if (!file.type.startsWith('image/')) { toast.error('File harus berupa gambar (JPG/PNG)'); return }
    if (file.size > 5_000_000) { toast.error('Ukuran gambar maksimal 5 MB'); return }
    setUploading(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { toast.error('Sesi habis, silakan login ulang'); return }
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `bukti-transfer/${userId}-${manual.invoice}-${Date.now()}.${ext}`
      const up = await sb.storage.from('trade-screenshots').upload(path, file, { upsert: true })
      if (up.error) { toast.error('Upload gagal: ' + up.error.message); return }
      const { data: pub } = sb.storage.from('trade-screenshots').getPublicUrl(path)
      const res = await fetch('/api/payment/manual/proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId: manual.orderId, proofUrl: pub.publicUrl }),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || 'Gagal mengirim bukti'); return }
      setProofDone(true)
      toast.success('Bukti transfer terkirim — menunggu verifikasi admin')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan') } finally { setUploading(false) }
  }

  const copy = (t: string, label: string) => { navigator.clipboard?.writeText(t).then(() => toast.success(`${label} disalin`)).catch(() => {}) }
  const activeGw = gw?.gateway ?? 'none'
  const onlineActive = activeGw !== 'none'

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

            {!gw ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-white/40"><Loader2 size={15} className="animate-spin" /> Menyiapkan pembayaran…</div>
            ) : activeGw === 'manual' ? (
              !manual ? (
                <>
                  <button onClick={startManual} disabled={busy || !userId}
                    className="group w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-xl shadow-primary/25">
                    {busy ? <><Loader2 size={16} className="animate-spin" /> Menyiapkan…</> : <><Building2 size={16} /> Bayar via Transfer Bank <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" /></>}
                  </button>
                  <div className="flex items-center justify-center gap-2 text-[11px] text-white/40 mt-3"><Building2 size={12} /> Transfer manual ke {BANK.name} · verifikasi oleh admin</div>
                </>
              ) : proofDone ? (
                <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.07] p-5 text-center space-y-2">
                  <Clock size={26} className="text-blue-400 mx-auto" />
                  <p className="text-sm font-black">Bukti transfer diterima</p>
                  <p className="text-[12px] text-white/60 leading-relaxed">Invoice <b className="text-white/85">{manual.invoice}</b> sedang diverifikasi admin (biasanya &lt; 1×24 jam). Akses Pro otomatis aktif setelah disetujui.</p>
                  <button onClick={() => router.push('/account')} className="text-[12px] font-semibold text-primary hover:underline mt-1">Lihat status langganan →</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Nominal WAJIB persis (termasuk kode unik) */}
                  <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Transfer tepat sejumlah</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black tabular-nums">{rp(manual.total)}</span>
                      <button onClick={() => copy(String(manual.total), 'Nominal')} className="text-white/40 hover:text-primary" title="Salin nominal"><Copy size={14} /></button>
                    </div>
                    <p className="text-[11px] text-white/55 mt-1.5">{rp(manual.baseAmount)} + <b className="text-primary">{manual.uniqueCode}</b> (kode unik). <b className="text-white/80">Jangan dibulatkan</b> — kode unik dipakai untuk mencocokkan pembayaranmu otomatis.</p>
                  </div>
                  {/* Rekening tujuan */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Rekening Tujuan</p>
                    <div className="flex items-center justify-between"><span className="text-[12px] text-white/50">Bank</span><span className="text-[13px] font-bold">{BANK.name}</span></div>
                    <div className="flex items-center justify-between"><span className="text-[12px] text-white/50">No. Rekening</span><span className="flex items-center gap-2"><span className="text-[13px] font-black tabular-nums">{BANK.number}</span><button onClick={() => copy(BANK.number, 'Nomor rekening')} className="text-white/40 hover:text-primary"><Copy size={13} /></button></span></div>
                    <div className="flex items-center justify-between"><span className="text-[12px] text-white/50">Atas Nama</span><span className="text-[13px] font-bold">{BANK.holder}</span></div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]"><span className="text-[12px] text-white/50">Invoice</span><span className="text-[12px] font-mono text-white/70">{manual.invoice}</span></div>
                  </div>
                  {/* Upload bukti */}
                  <div>
                    <label className={`flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] px-4 py-4 text-sm font-bold cursor-pointer hover:bg-primary/[0.08] transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                      {uploading ? <><Loader2 size={16} className="animate-spin" /> Mengunggah…</> : <><Upload size={16} className="text-primary" /> Unggah Bukti Transfer</>}
                      <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadProof(f) }} />
                    </label>
                    <p className="text-[11px] text-white/35 text-center mt-2">JPG/PNG, maks 5 MB. Setelah diunggah, admin akan memverifikasi & mengaktifkan akses Pro.</p>
                  </div>
                </div>
              )
            ) : activeGw === 'doku' || activeGw === 'ipaymu' || activeGw === 'mayar' ? (
              <>
                <button onClick={() => payRedirect(`/api/payment/${activeGw}/create`)} disabled={busy || !userId}
                  className="group w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-xl shadow-primary/25">
                  {busy ? <><Loader2 size={16} className="animate-spin" /> Mengalihkan ke pembayaran…</> : <><CreditCard size={16} /> Bayar Online <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" /></>}
                </button>
                <div className="flex items-center justify-center gap-2 text-[11px] text-white/40 mt-3">
                  <Wallet size={12} /> Kartu · QRIS · GoPay/OVO/Dana · Virtual Account · Alfamart/Indomaret
                </div>
                <p className="text-[11px] text-white/35 text-center flex items-center justify-center gap-1.5 mt-2"><ShieldCheck size={12} className="text-primary/70" /> Pembayaran aman & terenkripsi · Akses aktif otomatis</p>
              </>
            ) : activeGw === 'midtrans' ? (
              <>
                <button onClick={payWithMidtrans} disabled={busy || !userId || !snapReady}
                  className="group w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-xl shadow-primary/25">
                  {busy ? <><Loader2 size={16} className="animate-spin" /> Memproses…</> : !snapReady ? <><Loader2 size={16} className="animate-spin" /> Menyiapkan…</> : <><CreditCard size={16} /> Bayar Sekarang <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" /></>}
                </button>
                <div className="flex items-center justify-center gap-2 text-[11px] text-white/40 mt-3">
                  <Wallet size={12} /> Kartu · QRIS · GoPay/OVO/Dana · Virtual Account
                  {!gw.midtransProduction && <span className="text-amber-400 font-semibold">· MODE SANDBOX</span>}
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
