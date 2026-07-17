'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { TrendingUp, Lock, Mail, AlertCircle, Loader2, User } from 'lucide-react'

// Origin kanonik untuk redirect OAuth/konfirmasi email. Pakai NEXT_PUBLIC_SITE_URL
// (mis. https://www.datalitiq.com) bila diset agar TIDAK mendarat di domain Vercel
// walau user mengakses lewat URL Vercel. Fallback ke origin browser (dev/lokal).
function siteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL
  if (env) return env.replace(/\/$/, '')
  return typeof window !== 'undefined' ? window.location.origin : ''
}

export default function LoginPage() {
  const router   = useRouter()
  const [name,   setName]   = useState('')
  const [email,  setEmail]  = useState('')
  const [pass,   setPass]   = useState('')
  const [pass2,  setPass2]  = useState('')
  const [mode,   setMode]   = useState<'signin' | 'signup'>('signin')
  const [error,  setError]  = useState('')
  const [busy,   setBusy]   = useState(false)
  const [done,   setDone]   = useState(false)  // after signup confirmation
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    createClient().from('app_config').select('logo_url').eq('id', 1).maybeSingle()
      .then(({ data }) => setLogoUrl((data?.logo_url as string | null) ?? null))
  }, [])

  // Tujuan redirect setelah login (mis. dari tombol checkout di homepage).
  // Hanya izinkan path relatif (diawali '/') untuk mencegah open-redirect.
  function nextTarget() {
    if (typeof window === 'undefined') return '/hub'
    const n = new URLSearchParams(window.location.search).get('next')
    return n && n.startsWith('/') && !n.startsWith('//') ? n : '/hub'
  }

  async function loginWithGoogle() {
    setError(''); setBusy(true)
    const sb = createClient()
    const { error: err } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${siteOrigin()}/auth/callback?next=${encodeURIComponent(nextTarget())}` },
    })
    if (err) { setError(err.message); setBusy(false) }
    // sukses -> browser redirect ke Google, tidak ada lagi yang perlu dilakukan di sini
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
        if (data.session) {
          router.replace(nextTarget())
          return
        }
        setDone(true); setBusy(false)
        return
      }

      const { error: err } = await sb.auth.signInWithPassword({ email, password: pass })
      if (err) { setError('Email atau password salah.'); setBusy(false); return }
      router.replace(nextTarget())
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.'
      setError(msg)
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          {logoUrl ? (
            <div className="flex justify-center mb-2"><BrandLogo url={logoUrl} size="lg" /></div>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
                <TrendingUp size={28} className="text-primary"/>
              </div>
              <h1 className="text-3xl font-black tracking-tight">Datalitiq</h1>
            </>
          )}
          <p className="text-sm text-muted-foreground">Trading journal & analytics untuk trader serius</p>
        </div>

        {done ? (
          /* Signup confirmation */
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-3">
            <div className="text-3xl">📧</div>
            <p className="font-semibold text-emerald-400">Cek email kamu!</p>
            <p className="text-sm text-muted-foreground">
              Link konfirmasi telah dikirim ke <strong>{email}</strong>.
              Klik link tersebut lalu kembali ke halaman ini untuk login.
            </p>
            <Button variant="outline" size="sm" onClick={() => { setDone(false); setMode('signin') }}>
              Kembali ke Login
            </Button>
          </div>
        ) : (
          /* Form */
          <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-5">
            <h2 className="font-semibold text-sm text-center text-muted-foreground uppercase tracking-widest">
              {mode === 'signin' ? 'Masuk ke Akun' : 'Buat Akun Baru'}
            </h2>

            <button type="button" onClick={loginWithGoogle} disabled={busy}
              className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-border/60 bg-background hover:bg-muted/50 transition-colors py-2.5 text-sm font-medium disabled:opacity-50">
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.5 2.5-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.5 5.5C41.5 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
              </svg>
              Masuk dengan Google
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border/60" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">atau</span>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Nama</Label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                    <Input
                      type="text" placeholder="Nama kamu" required
                      value={name} onChange={e => setName(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                  <Input
                    type="email" placeholder="kamu@email.com" required
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Password</Label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                  <Input
                    type="password" placeholder="••••••••" required minLength={6}
                    value={pass} onChange={e => setPass(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {mode === 'signup' && (
                  <p className="text-[10px] text-muted-foreground">Minimal 6 karakter</p>
                )}
              </div>

              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Konfirmasi Password</Label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                    <Input
                      type="password" placeholder="••••••••" required minLength={6}
                      value={pass2} onChange={e => setPass2(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {pass2 && pass !== pass2 && (
                    <p className="text-[10px] text-red-400">Password tidak cocok</p>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle size={13} className="shrink-0"/>
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full gap-2" disabled={busy}>
                {busy && <Loader2 size={14} className="animate-spin"/>}
                {mode === 'signin' ? 'Masuk' : 'Daftar'}
              </Button>
            </form>

            <div className="text-center text-xs text-muted-foreground">
              {mode === 'signin' ? (
                <>Belum punya akun?{' '}
                  <button className="text-primary hover:underline font-medium" onClick={() => { setMode('signup'); setError('') }}>
                    Daftar di sini
                  </button>
                </>
              ) : (
                <>Sudah punya akun?{' '}
                  <button className="text-primary hover:underline font-medium" onClick={() => { setMode('signin'); setError('') }}>
                    Masuk
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground">
          Data disimpan aman di Supabase · Hanya kamu yang bisa akses
        </p>
      </div>
    </div>
  )
}
