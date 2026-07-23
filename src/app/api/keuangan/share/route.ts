import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { ADMIN_EMAIL } from '@/lib/notify-admin'
import { maskPayload, isKnownShareVersion, type SharePayload } from '@/lib/finance-share'

// Tautan berbagi ringkasan keuangan (ADMIN-ONLY untuk membuat; publik untuk
// membaca lewat halaman /s/[slug]).
//
//   POST   { payload, title, masked, ttlDays }  → { slug, url }
//   GET                                          → daftar tautan milik sendiri
//   DELETE ?id=…                                 → cabut tautan
//
// Penyamaran nominal dijalankan ULANG di server sebelum disimpan. Klien memang
// sudah menyamarkannya, tapi payload datang dari klien — kalau server percaya
// begitu saja, satu request yang dirakit tangan bisa menyimpan snapshot bernominal
// lengkap sambil ditandai "masked", dan halaman publik akan menampilkannya.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://datalitiq.com').replace(/\/$/, '')

const B62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
// 10 karakter base62 ≈ 8×10^17 kemungkinan. Slug harus tidak bisa ditebak:
// inilah satu-satunya rahasia yang menjaga halaman publiknya.
const newSlug = () => Array.from(randomBytes(10)).map(b => B62[b % 62]).join('')

async function authUser(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token || !SUPA_URL) return null
  const authed = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: { user } } = await authed.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

const svc = () => createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })

export async function POST(req: Request) {
  const user = await authUser(req)
  if (!user) return NextResponse.json({ error: 'Akses ditolak — khusus admin.' }, { status: 403 })
  if (!SERVICE) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum diset.' }, { status: 500 })

  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const raw = b.payload as SharePayload | undefined
  if (!raw || !isKnownShareVersion(raw.v)) {
    return NextResponse.json({ error: 'Data ringkasan tidak dikenal. Muat ulang halaman lalu coba lagi.' }, { status: 400 })
  }

  const masked = b.masked !== false
  const title = String(b.title || 'Ringkasan Keuangan').slice(0, 80)
  const ttl = Number(b.ttlDays)
  // 0 / tidak valid → tanpa batas waktu. Selain itu dibatasi 365 hari: tautan
  // yang hidup selamanya biasanya bukan yang diinginkan, hanya yang terlupakan.
  const expires = ttl > 0 ? new Date(Date.now() + Math.min(365, ttl) * 86_400_000).toISOString() : null

  const payload = maskPayload({ ...raw, masked, note: typeof b.note === 'string' ? b.note.slice(0, 240) : undefined })

  const slug = newSlug()
  const { error } = await svc().from('fin_shares').insert({
    user_id: user.id, slug, title, payload, masked, expires_at: expires,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ slug, url: `${SITE}/s/${slug}` })
}

export async function GET(req: Request) {
  const user = await authUser(req)
  if (!user) return NextResponse.json({ error: 'Akses ditolak — khusus admin.' }, { status: 403 })
  if (!SERVICE) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum diset.' }, { status: 500 })

  // payload sengaja tidak ikut diambil — daftarnya bisa panjang dan isinya tidak
  // dipakai di UI manajemen.
  const { data, error } = await svc().from('fin_shares')
    .select('id,slug,title,masked,expires_at,revoked,views,created_at')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shares: data ?? [], site: SITE })
}

export async function DELETE(req: Request) {
  const user = await authUser(req)
  if (!user) return NextResponse.json({ error: 'Akses ditolak — khusus admin.' }, { status: 403 })
  if (!SERVICE) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum diset.' }, { status: 500 })

  const id = new URL(req.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'id wajib diisi.' }, { status: 400 })
  // Dihapus, bukan sekadar ditandai revoked: menyimpan snapshot yang sudah
  // dicabut tidak ada gunanya, dan datanya sensitif.
  const { error } = await svc().from('fin_shares').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
