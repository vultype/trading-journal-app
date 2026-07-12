'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { TrendingUp, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router   = useRouter()
  const [email,  setEmail]  = useState('')
  const [pass,   setPass]   = useState('')
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
    if (typeof window === 'undefined') return '/dashboard'
    const n = new URLSearchParams(window.location.search).get('next')
    return n && n.startsWith('/') && !n.startsWith('//') ? n : '/dashboard'
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')

    try {
      const sb = createClient()

      if (mode === 'signup') {
        const { data, error: err } = await sb.auth.signUp({ email, password: pass })
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

            <form onSubmit={submit} className="space-y-4">
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
