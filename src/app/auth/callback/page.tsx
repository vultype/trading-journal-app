'use client'

// Callback OAuth (Google) — Supabase redirect ke sini dengan ?code=..., kita tukar
// jadi session lalu lempar ke halaman tujuan (?next=, default /dashboard).
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Loader2, AlertCircle } from 'lucide-react'

function nextTarget(raw: string | null) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard'
}

function CallbackInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const code = params.get('code')
    const next = nextTarget(params.get('next'))
    if (!code) { setError('Kode otorisasi tidak ditemukan. Coba login ulang.'); return }
    createClient().auth.exchangeCodeForSession(code).then(({ error: err }) => {
      if (err) { setError(err.message); return }
      router.replace(next)
    })
  }, [params, router])

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center space-y-3">
          <AlertCircle size={24} className="mx-auto text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
          <a href="/login" className="inline-block text-sm text-primary hover:underline font-medium">Kembali ke Login</a>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 size={22} className="animate-spin text-primary" />
        <p className="text-sm">Menyelesaikan login…</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 size={22} className="animate-spin text-primary" /></div>}>
      <CallbackInner />
    </Suspense>
  )
}
