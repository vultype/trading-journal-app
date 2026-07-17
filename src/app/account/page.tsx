'use client'

// Pengaturan Akun User — standalone (gaya hub), berbeda dari Setting Jurnal.
// Profil (nama), email, ganti password, dan detail langganan + kadaluarsa.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useSubscription } from '@/hooks/useSubscription'
import { useCredits } from '@/hooks/useCredits'
import { rp } from '@/lib/pricing'
import { AI_ACTION_LABEL, type AiAction } from '@/lib/ai-credits'
import {
  ArrowLeft, Loader2, UserCog, Mail, Lock, Crown, Calendar, Receipt, ShieldCheck,
  Save, LogOut, CheckCircle2, Sparkles, ArrowRight, Coins, Zap, Plus, Infinity as InfinityIcon,
} from 'lucide-react'

const fmtDate = (d: Date | null) => d ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

export default function AccountPage() {
  const router = useRouter()
  const sub = useSubscription()
  const credits = useCredits()
  const [topupBusy, setTopupBusy] = useState<string | null>(null)
  const [topupFinish, setTopupFinish] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [origEmail, setOrigEmail] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [pw1, setPw1] = useState(''); const [pw2, setPw2] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) { router.replace('/login?next=%2Faccount'); return }
      setName((u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || '')
      setEmail(u.email ?? ''); setOrigEmail(u.email ?? '')
      setLoaded(true)
    })
  }, [router])

  async function saveProfile() {
    setSavingProfile(true)
    const sb = createClient()
    const payload: { data?: Record<string, unknown>; email?: string } = { data: { full_name: name.trim() } }
    const emailChanged = email.trim() && email.trim() !== origEmail
    if (emailChanged) payload.email = email.trim()
    const { error } = await sb.auth.updateUser(payload)
    setSavingProfile(false)
    if (error) { toast.error('Gagal: ' + error.message); return }
    if (emailChanged) toast.success('Profil disimpan. Cek email baru untuk konfirmasi perubahan email.')
    else toast.success('Profil disimpan')
  }

  async function changePassword() {
    if (pw1.length < 6) { toast.error('Password minimal 6 karakter'); return }
    if (pw1 !== pw2) { toast.error('Konfirmasi password tidak cocok'); return }
    setSavingPw(true)
    const { error } = await createClient().auth.updateUser({ password: pw1 })
    setSavingPw(false)
    if (error) { toast.error('Gagal: ' + error.message); return }
    setPw1(''); setPw2(''); toast.success('Password berhasil diubah')
  }

  // Kembali dari pembayaran topup DOKU (?topup=finish) — tampilkan notice & refresh saldo.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('topup') === 'finish') {
      setTopupFinish(true)
      const iv = setInterval(() => credits.refresh(), 4000)
      const stop = setTimeout(() => clearInterval(iv), 30000)
      return () => { clearInterval(iv); clearTimeout(stop) }
    }
  }, [credits])

  async function buyTopup(packageId: string) {
    setTopupBusy(packageId)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { toast.error('Sesi habis, login ulang'); setTopupBusy(null); return }
      const res = await fetch('/api/credits/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ packageId, origin: window.location.origin }),
      })
      const j = await res.json()
      if (!res.ok || !j.paymentUrl) { toast.error(j.error || 'Gagal memulai pembayaran'); setTopupBusy(null); return }
      window.location.href = j.paymentUrl
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan'); setTopupBusy(null)
    }
  }

  async function logout() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  if (!loaded || sub.loading) {
    return <div className="min-h-screen bg-[#060a09] flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  const expiredSoon = sub.daysLeft != null && sub.daysLeft <= 7
  const expired = sub.daysLeft != null && sub.daysLeft < 0

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-primary/10 blur-[150px] rounded-full pointer-events-none" />
      <header className="relative max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/hub" className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"><ArrowLeft size={16} /> Ke Hub</Link>
        <button onClick={logout} className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors"><LogOut size={14} /> Keluar</button>
      </header>

      <main className="relative max-w-3xl mx-auto px-5 pt-6 pb-20 space-y-5">
        <div className="mb-2">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Pengaturan Akun</h1>
          <p className="text-sm text-white/50 mt-1.5">Kelola profil, keamanan & langganan kamu. Untuk pengaturan jurnal (mata uang, strategi, akun broker), buka <Link href="/settings" className="text-primary hover:underline">Setting Jurnal</Link>.</p>
        </div>

        {/* Langganan */}
        <div className={`relative rounded-3xl p-[1px] ${sub.isPro ? 'bg-gradient-to-br from-primary/70 via-primary/20 to-cyan-500/30' : 'bg-white/10'}`}>
          <div className="rounded-3xl bg-[#0a1110] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Crown size={17} className={sub.isPro ? 'text-primary' : 'text-white/40'} />
              <h2 className="text-sm font-black uppercase tracking-widest text-white/70">Status Langganan</h2>
              <span className={`ml-auto text-[10px] font-bold uppercase rounded-full px-2.5 py-1 ${sub.isPro ? 'bg-primary/15 text-primary' : 'bg-white/10 text-white/50'}`}>{sub.isAdmin ? 'ADMIN' : sub.isPro ? 'PRO' : 'GRATIS'}</span>
            </div>

            {sub.isPro ? (
              <>
                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                    <p className="flex items-center gap-1.5 text-[11px] text-white/45 uppercase tracking-wider mb-1"><Sparkles size={12} className="text-primary" /> Paket</p>
                    <p className="text-lg font-black">Datalitiq AI Terminal</p>
                    <p className="text-xs text-white/45 mt-0.5">{sub.order ? `${sub.order.months} bulan` : 'akses penuh'}{sub.isAdmin && !sub.order ? ' · akses admin' : ''}</p>
                  </div>
                  <div className={`rounded-xl border p-4 ${expired ? 'bg-red-500/[0.06] border-red-500/25' : expiredSoon ? 'bg-amber-500/[0.06] border-amber-500/25' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                    <p className="flex items-center gap-1.5 text-[11px] text-white/45 uppercase tracking-wider mb-1"><Calendar size={12} className={expired ? 'text-red-400' : expiredSoon ? 'text-amber-400' : 'text-primary'} /> Berlaku Sampai</p>
                    <p className="text-lg font-black">{sub.isAdmin && !sub.order ? 'Tak terbatas' : fmtDate(sub.expiresAt)}</p>
                    {sub.daysLeft != null && <p className={`text-xs mt-0.5 font-semibold ${expired ? 'text-red-400' : expiredSoon ? 'text-amber-400' : 'text-white/45'}`}>{expired ? 'Sudah kadaluarsa' : `${sub.daysLeft} hari lagi`}</p>}
                  </div>
                </div>
                {sub.order?.invoice_number && <p className="flex items-center gap-1.5 text-[11px] text-white/35 mb-3"><Receipt size={12} /> Invoice terakhir: <span className="text-white/55 tabular-nums">{sub.order.invoice_number}</span>{sub.order.total ? ` · ${rp(sub.order.total)}` : ''}</p>}
                {!sub.isAdmin && (
                  <Link href="/checkout?plan=terminal&months=1" className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">{expired || expiredSoon ? 'Perpanjang Langganan' : 'Perpanjang / Tambah Durasi'} <ArrowRight size={14} /></Link>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-white/60 mb-4">Kamu belum berlangganan. Buka Terminal AI XAU/USD + semua tools bonus dengan upgrade ke Pro.</p>
                <Link href="/upgrade" className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"><Crown size={15} /> Upgrade ke Pro</Link>
              </div>
            )}
          </div>
        </div>

        {/* Token AI — saldo & top up */}
        <div id="token" className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 scroll-mt-20">
          <div className="flex items-center gap-2 mb-4">
            <Coins size={17} className="text-primary" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white/70">Token AI</h2>
            {credits.unlimited
              ? <span className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase rounded-full px-2.5 py-1 bg-primary/15 text-primary"><InfinityIcon size={11} /> UNLIMITED</span>
              : <span className="ml-auto text-[10px] font-bold uppercase rounded-full px-2.5 py-1 bg-white/10 text-white/60 tabular-nums">{credits.loading ? '…' : `${credits.total} kredit`}</span>}
          </div>

          {topupFinish && (
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3.5 mb-4">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-200/90 leading-relaxed">Pembayaran top up sedang dikonfirmasi. Saldo kredit akan bertambah otomatis dalam beberapa detik setelah pembayaran berhasil.</p>
            </div>
          )}

          {credits.unlimited ? (
            <p className="text-sm text-white/55 leading-relaxed">Sebagai admin, kamu punya akses AI tak terbatas — tidak ada pemotongan kredit.</p>
          ) : (
            <>
              <p className="text-xs text-white/50 leading-relaxed mb-4">Setiap analisa AI di Terminal memakai kredit. Langganan Pro sudah termasuk <b className="text-white/75">jatah bulanan</b>; kalau habis, kamu bisa top up kredit yang <b className="text-white/75">tidak pernah hangus</b>.</p>

              {/* Dua bucket saldo */}
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <p className="flex items-center gap-1.5 text-[11px] text-white/45 uppercase tracking-wider mb-1.5"><Zap size={12} className="text-primary" /> Jatah Bulanan</p>
                  <p className="text-xl font-black tabular-nums">{credits.loading ? '…' : credits.allowance}<span className="text-sm text-white/40 font-semibold"> / {credits.allowanceCap} kredit</span></p>
                  {credits.allowanceCap > 0 ? (
                    <>
                      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, Math.round((credits.allowance / Math.max(1, credits.allowanceCap)) * 100))}%` }} />
                      </div>
                      <p className="text-[10px] text-white/40 mt-1.5">Reset tiap bulan mengikuti siklus langganan. Sisa tidak roll-over.</p>
                    </>
                  ) : <p className="text-[10px] text-white/40 mt-1.5">Aktif saat langganan Pro berjalan.</p>}
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <p className="flex items-center gap-1.5 text-[11px] text-white/45 uppercase tracking-wider mb-1.5"><Coins size={12} className="text-primary" /> Saldo Top Up</p>
                  <p className="text-xl font-black tabular-nums">{credits.loading ? '…' : credits.topup}<span className="text-sm text-white/40 font-semibold"> kredit</span></p>
                  <p className="text-[10px] text-white/40 mt-1.5">Permanen — tidak pernah hangus. Dipakai setelah jatah bulanan habis.</p>
                </div>
              </div>

              {/* Tabel biaya per aksi */}
              <div className="rounded-xl bg-black/20 border border-white/[0.06] p-4 mb-4">
                <p className="text-[11px] font-semibold text-white/45 uppercase tracking-wider mb-2.5">Biaya per Analisa</p>
                <div className="space-y-1.5">
                  {(Object.keys(AI_ACTION_LABEL) as AiAction[]).map(a => (
                    <div key={a} className="flex items-center justify-between text-xs">
                      <span className="text-white/60">{AI_ACTION_LABEL[a]}</span>
                      <span className="tabular-nums font-semibold text-white/80">{credits.cost[a] || '—'} kredit</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Paket top up */}
              <p className="text-[11px] font-semibold text-white/45 uppercase tracking-wider mb-2.5">Top Up Kredit</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {credits.packages?.length ? credits.packages.map(pkg => (
                  <button key={pkg.id} onClick={() => buyTopup(pkg.id)} disabled={!!topupBusy}
                    className={`relative rounded-2xl border p-4 text-left transition-all disabled:opacity-50 ${pkg.popular ? 'border-primary/40 bg-primary/[0.06] hover:border-primary/60' : 'border-white/10 bg-white/[0.02] hover:border-white/25'}`}>
                    {pkg.popular && <span className="absolute -top-2 right-3 text-[8px] font-bold uppercase bg-primary text-primary-foreground rounded-full px-2 py-0.5">Populer</span>}
                    <p className="text-lg font-black tabular-nums">{pkg.credits} <span className="text-xs font-semibold text-white/45">kredit</span></p>
                    <p className="text-sm font-bold text-primary mt-0.5">{rp(pkg.price)}</p>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/70 mt-2.5">
                      {topupBusy === pkg.id ? <><Loader2 size={12} className="animate-spin" /> Mengalihkan…</> : <><Plus size={12} /> Top Up</>}
                    </span>
                  </button>
                )) : (
                  <p className="sm:col-span-3 text-xs text-white/40">Paket top up belum tersedia.</p>
                )}
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-white/35 mt-3"><ShieldCheck size={12} className="text-primary/70" /> Pembayaran aman via DOKU · kredit masuk otomatis setelah lunas.</p>
            </>
          )}
        </div>

        {/* Profil */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white/70 mb-4"><UserCog size={15} className="text-primary" /> Profil</h2>
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center text-primary font-black text-lg shrink-0">{(name || email || '?').charAt(0).toUpperCase()}</div>
            <div className="min-w-0"><p className="text-sm font-semibold truncate">{name || 'Trader'}</p><p className="text-xs text-white/45 truncate">{origEmail}</p></div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-white/45 uppercase tracking-wider">Nama Tampilan</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama kamu" className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/40" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-white/45 uppercase tracking-wider"><Mail size={12} /> Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/40" />
              {email.trim() !== origEmail && <p className="text-[11px] text-amber-400 mt-1">Ubah email butuh konfirmasi via link yang dikirim ke email baru.</p>}
            </div>
            <button onClick={saveProfile} disabled={savingProfile} className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">{savingProfile ? <><Loader2 size={14} className="animate-spin" /> Menyimpan…</> : <><Save size={14} /> Simpan Profil</>}</button>
          </div>
        </div>

        {/* Keamanan / Password */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white/70 mb-4"><Lock size={15} className="text-primary" /> Ganti Password</h2>
          <div className="space-y-3 max-w-sm">
            <input value={pw1} onChange={e => setPw1(e.target.value)} type="password" placeholder="Password baru (min. 6 karakter)" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/40" />
            <input value={pw2} onChange={e => setPw2(e.target.value)} type="password" placeholder="Ulangi password baru" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/40" />
            <button onClick={changePassword} disabled={savingPw || !pw1} className="inline-flex items-center gap-2 border border-white/15 text-white/85 rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-white/5 disabled:opacity-50 transition-colors">{savingPw ? <><Loader2 size={14} className="animate-spin" /> Menyimpan…</> : <><CheckCircle2 size={14} className="text-primary" /> Ubah Password</>}</button>
          </div>
        </div>

        {sub.isAdmin && (
          <Link href="/admin" className="flex items-center gap-3 rounded-2xl border border-red-500/25 bg-red-500/[0.05] p-4 hover:border-red-500/40 transition-colors">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/15 text-red-400 shrink-0"><ShieldCheck size={18} /></span>
            <div className="flex-1 min-w-0"><p className="text-sm font-bold">Panel Admin (CMS)</p><p className="text-xs text-white/45">Kelola user, langganan, konten & branding</p></div>
            <ArrowRight size={16} className="text-white/40" />
          </Link>
        )}
      </main>
    </div>
  )
}
