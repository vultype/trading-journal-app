'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { Lock, Mail, AlertCircle, Loader2, User, Eye, EyeOff, ArrowLeft, Activity, Check } from 'lucide-react'
import { toast } from '@/lib/toast'

// Origin untuk redirect OAuth/konfirmasi email.
// WAJIB = origin tempat login DIMULAI: PKCE menyimpan "code verifier" per-origin
// (cookie/localStorage host-only), jadi callback harus mendarat di origin yang sama.
// Memaksa domain lain (mis. apex → www) bikin verifier tak ketemu → error PKCE.
function siteOrigin() {
  if (typeof window !== 'undefined') return window.location.origin
  return (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
}

export default function LoginPage() {
  const router   = useRouter()
  const [name,   setName]   = useState('')
  const [email,  setEmail]  = useState('')
  const [pass,   setPass]   = useState('')
  const [pass2,  setPass2]  = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const [mode,   setMode]   = useState<'signin' | 'signup'>('signin')
  const [error,  setError]  = useState('')
  const [busy,   setBusy]   = useState(false)
  const [done,   setDone]   = useState(false)  // after signup confirmation
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [sideImage, setSideImage] = useState<string | null>(null)

  useEffect(() => {
    createClient().from('app_config').select('logo_url, login_image_url').eq('id', 1).maybeSingle()
      .then(({ data }) => {
        setLogoUrl((data?.logo_url as string | null) ?? null)
        setSideImage((data?.login_image_url as string | null) ?? null)
      })
    if (typeof window !== 'undefined') {
      const err = new URLSearchParams(window.location.search).get('error')
      if (err) setError(err === 'missing_code' ? 'Login gagal — kode otorisasi tidak ada. Coba lagi.' : `Login gagal: ${err}`)
    }
  }, [])

  // Hanya izinkan path relatif (diawali '/') untuk mencegah open-redirect.
  function nextTarget() {
    if (typeof window === 'undefined') return '/hub'
    const n = new URLSearchParams(window.location.search).get('next')
    return n && n.startsWith('/') && !n.startsWith('//') ? n : '/hub'
  }

  async function loginWithGoogle() {
    setError(''); setBusy(true)
    const { error: err } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${siteOrigin()}/auth/callback?next=${encodeURIComponent(nextTarget())}` },
    })
    if (err) { setError(err.message); setBusy(false) }
  }

  async function forgotPassword() {
    if (!email.trim()) { setError('Isi email kamu dulu, lalu klik "Lupa password?".'); return }
    setBusy(true); setError('')
    const { error: err } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${siteOrigin()}/auth/callback?next=%2Faccount` })
    setBusy(false)
    if (err) { setError(err.message); return }
    toast.success('Link reset password dikirim ke email kamu. Cek inbox/spam.')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (mode === 'signup') {
      if (!name.trim()) { setError('Nama tidak boleh kosong.'); return }
      if (pass.length < 6) { setError('Password minimal 6 karakter.'); return }
      if (pass !== pass2) { setError('Konfirmasi password tidak cocok.'); return }
    }
    setBusy(true)
    try {
      const sb = createClient()
      if (mode === 'signup') {
        const { data, error: err } = await sb.auth.signUp({
          email, password: pass,
          options: { data: { full_name: name.trim() }, emailRedirectTo: `${siteOrigin()}/auth/callback` },
        })
        if (err) { setError(err.message); setBusy(false); return }
        if (data.session) { router.replace(nextTarget()); return }
        setDone(true); setBusy(false); return
      }
      const { error: err } = await sb.auth.signInWithPassword({ email, password: pass })
      if (err) { setError('Email atau password salah.'); setBusy(false); return }
      router.replace(nextTarget())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.')
      setBusy(false)
    }
  }

  const isSignup = mode === 'signup'

  return (
    <div className="min-h-screen bg-[#060a09] text-white flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 rounded-3xl overflow-hidden border border-white/[0.07] bg-[#0a1110] shadow-2xl shadow-black/50">

        {/* ── Kiri: gambar (uploadable admin) / gradien default ── */}
        <div className="relative hidden lg:block">
          {sideImage ? (
            <img src={sideImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[#04100c]">
              <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-primary/25 blur-[120px]" />
              <div className="absolute bottom-0 right-0 w-[360px] h-[360px] rounded-full bg-emerald-500/20 blur-[120px]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity size={120} className="text-primary/30" strokeWidth={1} />
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40" />
          <div className="absolute top-7 left-7">
            <Link href="/"><BrandLogo url={logoUrl} /></Link>
          </div>
          <div className="absolute bottom-9 left-9 right-9">
            <h2 className="text-2xl xl:text-3xl font-black leading-tight tracking-tight">Trading Emas dengan Data.<br/>Bukan Feeling.</h2>
            <p className="text-sm text-white/60 mt-3 leading-relaxed max-w-sm">Terminal XAU/USD kelas institusi untuk trader retail — arah pasar, keyakinan & alasannya dalam satu layar.</p>
          </div>
        </div>

        {/* ── Kanan: form ── */}
        <div className="p-7 sm:p-10 flex flex-col">
          {/* Baris atas: link beranda + toggle */}
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors"><ArrowLeft size={14} /> Beranda</Link>
            <button type="button" onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(''); setDone(false) }}
              className="text-xs font-semibold text-white/70 hover:text-white border border-white/15 hover:border-white/30 rounded-lg px-3.5 py-1.5 transition-colors">
              {isSignup ? 'Masuk' : 'Daftar'}
            </button>
          </div>

          {/* Logo (mobile, karena panel kiri disembunyikan) */}
          <div className="lg:hidden mb-6"><Link href="/"><BrandLogo url={logoUrl} size="lg" /></Link></div>

          {done ? (
            <div className="flex-1 flex flex-col justify-center text-center space-y-3 py-8">
              <div className="text-4xl">📧</div>
              <p className="font-black text-lg text-primary">Cek email kamu!</p>
              <p className="text-sm text-white/60 max-w-xs mx-auto leading-relaxed">Link konfirmasi telah dikirim ke <strong className="text-white/85">{email}</strong>. Klik link tersebut lalu kembali untuk login.</p>
              <button onClick={() => { setDone(false); setMode('signin') }} className="text-sm font-semibold text-primary hover:underline mt-2">← Kembali ke Login</button>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-3xl font-black tracking-tight">{isSignup ? 'Buat Akun 👋' : 'Selamat Datang! 👋'}</h1>
                <p className="text-sm text-white/50 mt-1.5">{isSignup ? 'Daftar untuk mulai memakai Datalitiq.' : 'Masuk ke akun kamu untuk lanjut.'}</p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                {isSignup && (
                  <Field label="Nama" icon={User}>
                    <input type="text" placeholder="Nama kamu" required value={name} onChange={e => setName(e.target.value)} className={inputCls} />
                  </Field>
                )}
                <Field label="Email" icon={Mail}>
                  <input type="email" placeholder="kamu@email.com" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Password" icon={Lock}>
                  <input type={showPw ? 'text' : 'password'} placeholder="••••••••" required minLength={6} value={pass} onChange={e => setPass(e.target.value)} className={`${inputCls} pr-10`} />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors" tabIndex={-1}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </Field>
                {isSignup && (
                  <Field label="Konfirmasi Password" icon={Lock}>
                    <input type={showPw ? 'text' : 'password'} placeholder="••••••••" required minLength={6} value={pass2} onChange={e => setPass2(e.target.value)} className={inputCls} />
                  </Field>
                )}
                {isSignup && pass2 && pass !== pass2 && <p className="text-[11px] text-red-400 -mt-1">Password tidak cocok</p>}

                {!isSignup && (
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => setRemember(v => !v)} className="flex items-center gap-2 text-xs text-white/60 hover:text-white/85 transition-colors">
                      <span className={`flex items-center justify-center w-4 h-4 rounded border transition-colors ${remember ? 'bg-primary border-primary' : 'border-white/25'}`}>{remember && <Check size={11} className="text-primary-foreground" />}</span>
                      Ingat saya
                    </button>
                    <button type="button" onClick={forgotPassword} className="text-xs font-medium text-primary hover:underline">Lupa password?</button>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                    <AlertCircle size={14} className="shrink-0" /> {error}
                  </div>
                )}

                <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-lg shadow-primary/20">
                  {busy && <Loader2 size={15} className="animate-spin" />}
                  {isSignup ? 'Daftar' : 'Login'}
                </button>
              </form>

              <div className="flex items-center gap-3 my-6">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] text-white/40 uppercase tracking-widest">atau lanjut dengan</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <button type="button" onClick={loginWithGoogle} disabled={busy}
                className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.06] transition-colors py-3 text-sm font-semibold disabled:opacity-50">
                <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.5 2.5-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.5 5.5C41.5 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
                </svg>
                Masuk dengan Google
              </button>

              <p className="text-center text-xs text-white/45 mt-7">
                {isSignup ? 'Sudah punya akun? ' : 'Belum punya akun? '}
                <button onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError('') }} className="text-primary font-semibold hover:underline">{isSignup ? 'Masuk' : 'Daftar di sini'}</button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded-xl border border-white/10 bg-black/25 pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-primary/45 focus:bg-black/40 transition-colors placeholder:text-white/30'

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
        {children}
      </div>
    </div>
  )
}
