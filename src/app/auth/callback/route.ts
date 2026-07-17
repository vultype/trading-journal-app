import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Callback OAuth (Google) — SERVER-side exchange (pola resmi @supabase/ssr).
// Supabase redirect ke sini dgn ?code=…; kita tukar jadi session di server dgn
// membaca "code verifier" dari COOKIE (yang ditulis createBrowserClient saat
// signInWithOAuth). Client-side exchange gagal PKCE karena itu → pindah ke sini.
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lmoduthkogsystlnljlb.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function safeNext(raw: string | null) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/hub'
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  // Redirect ke origin PUBLIK yang benar (di belakang proxy Vercel, request.url =
  // host internal). Utamakan x-forwarded-host agar tetap di domain yang dipakai user.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocal = process.env.NODE_ENV === 'development'
  const base = isLocal ? origin : forwardedHost ? `https://${forwardedHost}` : origin

  if (!code) return NextResponse.redirect(`${base}/login?error=missing_code`)

  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${base}/login?error=${encodeURIComponent(error.message)}`)
  }
  return NextResponse.redirect(`${base}${next}`)
}
