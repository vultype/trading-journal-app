import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyAdmin } from '@/lib/notify-admin'

// Notifikasi admin saat ada pendaftar baru. Dipanggil dari halaman daftar setelah
// signUp sukses. Email TIDAK diambil dari body (bisa dipalsukan) — diverifikasi dari
// token sesi bila ada; kalau signup butuh konfirmasi email (belum ada sesi), pakai
// email dari body tapi ditandai "belum terverifikasi".
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')

    let email = '', name = String(body.name || '').slice(0, 80), verified = false
    if (token && SUPA_URL) {
      const authed = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
      const { data: { user } } = await authed.auth.getUser()
      if (user) { email = user.email ?? ''; verified = true; name = name || (user.user_metadata?.full_name as string) || '' }
    }
    if (!email) {
      const raw = String(body.email || '').trim().slice(0, 120)
      if (!/^\S+@\S+\.\S+$/.test(raw)) return NextResponse.json({ ok: true }) // diamkan, jangan bocorkan
      email = raw
    }

    notifyAdmin('👤 Pendaftar baru di Datalitiq', [
      `Email: ${email}${verified ? '' : ' (belum konfirmasi email)'}`,
      `Nama: ${name || '-'}`,
      `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
    ])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // notifikasi tak boleh menggagalkan pendaftaran
  }
}
