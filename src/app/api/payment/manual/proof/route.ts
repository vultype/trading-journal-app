import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyAdmin } from '@/lib/notify-admin'

// Lampirkan bukti transfer ke order manual → status 'menunggu_verifikasi'.
// RLS sengaja TIDAK memberi user hak UPDATE payment_orders (cegah aktivasi mandiri),
// jadi update dilakukan SERVER dengan service_role SETELAH memastikan order itu
// benar-benar milik pemanggil dan statusnya masih menunggu.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(req: Request) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token || !SUPA_URL) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    const authed = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sesi tidak valid, login ulang' }, { status: 401 })
    if (!SERVICE) return NextResponse.json({ error: 'Server belum dikonfigurasi (SERVICE_ROLE_KEY).' }, { status: 503 })

    const { orderId, proofUrl } = await req.json()
    if (!orderId || typeof proofUrl !== 'string' || !/^https?:\/\//i.test(proofUrl)) {
      return NextResponse.json({ error: 'Data bukti transfer tidak valid' }, { status: 400 })
    }

    const svc = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })
    const { data: order } = await svc.from('payment_orders')
      .select('id, user_id, status, invoice_number, total, unique_code, months')
      .eq('id', orderId).maybeSingle()
    if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
    if (order.user_id !== user.id) return NextResponse.json({ error: 'Bukan pesanan Anda' }, { status: 403 })
    if (!['menunggu_pembayaran', 'menunggu_verifikasi'].includes(order.status)) {
      return NextResponse.json({ error: `Pesanan sudah berstatus "${order.status}"` }, { status: 409 })
    }

    const { error } = await svc.from('payment_orders')
      .update({ proof_url: proofUrl, status: 'menunggu_verifikasi', updated_at: new Date().toISOString() })
      .eq('id', orderId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    notifyAdmin('📎 Bukti transfer diunggah — perlu verifikasi', [
      `Invoice: ${order.invoice_number ?? '-'}`,
      `User: ${user.email ?? user.id}`,
      `Total: Rp${Number(order.total).toLocaleString('id-ID')} (kode unik ${order.unique_code})`,
      `Durasi: ${order.months} bulan`,
      `Bukti: ${proofUrl}`,
      `Tindakan: buka Admin → Pengguna & Langganan → Verifikasi Pembayaran`,
    ])

    return NextResponse.json({ ok: true, status: 'menunggu_verifikasi' })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal mengunggah bukti' }, { status: 500 })
  }
}
