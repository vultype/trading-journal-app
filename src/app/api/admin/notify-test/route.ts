import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyAdmin, ADMIN_EMAIL } from '@/lib/notify-admin'

// Diagnosa notifikasi admin (ADMIN-ONLY):
//  GET  → status konfigurasi saja (tanpa mengirim apa pun)
//  POST → kirim notifikasi UJI + laporkan hasil/erornya secara detail
// Hanya mengembalikan BOOLEAN keberadaan env & pesan error provider — tidak pernah
// mengembalikan nilai API key.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function requireAdmin(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token || !SUPA_URL) return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 })
  const authed = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: { user } } = await authed.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Akses ditolak — khusus admin.' }, { status: 403 })
  return null
}

function configStatus() {
  const from = process.env.RESEND_FROM || 'Datalitiq <onboarding@resend.dev>'
  const usingDefaultFrom = !process.env.RESEND_FROM
  return {
    target: ADMIN_EMAIL,
    resendKey: !!process.env.RESEND_API_KEY,
    resendFrom: from,
    usingDefaultFrom,
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  }
}

export async function GET(req: Request) {
  const deny = await requireAdmin(req); if (deny) return deny
  return NextResponse.json({ config: configStatus() })
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)

export async function POST(req: Request) {
  const deny = await requireAdmin(req); if (deny) return deny
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const to = typeof body.to === 'string' ? body.to.trim() : ''
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : ''
  // Kirim ke alamat lain hanya bila formatnya valid — Resend menolak alamat ngawur
  // dengan error yang membingungkan, lebih baik dicegat di sini.
  if (to && !isEmail(to)) return NextResponse.json({ error: 'Format email tujuan tidak valid.' }, { status: 400 })

  const target = to || ADMIN_EMAIL
  const result = await notifyAdmin('🔔 Tes notifikasi Datalitiq', [
    `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
    `Tujuan: ${target}`,
    `Sumber: form uji di Admin → Dev Tools`,
    ...(note ? [`Catatan: ${note}`] : []),
    `Status: jika Anda menerima pesan ini, pengiriman email berfungsi`,
  ], { to: target, skipTelegram: true })
  return NextResponse.json({ config: configStatus(), result, sentTo: target })
}
