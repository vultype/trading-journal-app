import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Beri akses Pro manual (admin) — insert payment_orders 'aktif' memakai SERVICE ROLE
// (bypass RLS), jadi bekerja meski policy is_admin() belum di-setup. Pemanggil WAJIB
// terverifikasi sebagai admin (token sesi → email == ADMIN_EMAIL).
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ADMIN_EMAIL = 'vultype@gmail.com'

export async function POST(req: Request) {
  try {
    if (!SUPA_URL || !SERVICE) return NextResponse.json({ error: 'Server belum dikonfigurasi (SERVICE_ROLE_KEY).' }, { status: 503 })

    // 1) Verifikasi pemanggil = admin, dari token sesi.
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 })
    const authed = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user } } = await authed.auth.getUser()
    if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Akses ditolak — khusus admin.' }, { status: 403 })

    // 2) Input.
    const body = await req.json().catch(() => ({}))
    let userId = String(body.userId || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const months = Math.max(1, Math.floor(Number(body.months) || 1))
    const days = Math.max(1, Math.floor(Number(body.days) || 0))
    const svc = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })

    // Bila userId tak dikirim, cari via email (service role: auth admin).
    if (!userId && email) {
      for (let page = 1; page <= 40 && !userId; page++) {
        const { data } = await svc.auth.admin.listUsers({ page, perPage: 200 })
        const found = data?.users.find(u => (u.email || '').toLowerCase() === email)
        if (found) userId = found.id
        if (!data || data.users.length < 200) break
      }
    }
    if (!userId) return NextResponse.json({ error: 'User tidak ditemukan. Pastikan email sudah terdaftar.' }, { status: 404 })

    const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : new Date(Date.now() + (days || months * 30) * 86_400_000).toISOString()

    // 3) Insert order aktif (service role → bypass RLS).
    const { error } = await svc.from('payment_orders').insert({
      user_id: userId, plan: 'terminal', months, base_amount: 0, unique_code: 0, total: 0,
      status: 'aktif', method: 'admin_grant', expires_at: expiresAt,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, userId, expiresAt })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Terjadi kesalahan' }, { status: 500 })
  }
}
