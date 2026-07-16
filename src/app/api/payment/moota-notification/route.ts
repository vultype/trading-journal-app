import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Webhook Moota (cek mutasi rekening otomatis) — cocokkan nominal mutasi masuk
// ke pesanan `payment_orders` yang masih menunggu, lalu aktifkan otomatis.
//
// ⚠️ CATATAN PENTING: skema payload di bawah ini disusun dari dokumentasi publik
// Moota (moota.co) karena belum ada akses ke dashboard Moota milikmu. SETELAH
// kamu daftar & hubungkan rekening di Moota, cek menu Webhook di dashboard-nya
// untuk memastikan/menyesuaikan: (1) cara autentikasi (header/token/secret),
// (2) nama field nominal & tipe mutasi (kredit/debit) pada payload asli.
// URL webhook yang didaftarkan ke Moota: https://datalitiq.com/api/payment/moota-notification
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const MOOTA_TOKEN = process.env.MOOTA_WEBHOOK_TOKEN || ''

function isAuthorized(req: Request, body: Record<string, unknown>): boolean {
  if (!MOOTA_TOKEN) return true // belum diset — jangan blokir saat masih tahap uji coba
  const headerToken = req.headers.get('x-moota-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const bodyToken = typeof body.token === 'string' ? body.token : undefined
  return headerToken === MOOTA_TOKEN || bodyToken === MOOTA_TOKEN
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    if (!isAuthorized(req, body)) return NextResponse.json({ error: 'token tidak valid' }, { status: 403 })
    if (!SUPA_URL || !SERVICE_KEY) return NextResponse.json({ error: 'server belum dikonfigurasi' }, { status: 503 })

    // Ambil nominal & tipe mutasi — nama field fleksibel, sesuaikan setelah cek payload asli Moota.
    const rawAmount = body.amount ?? body.mutation_amount ?? body.credit ?? body.nominal
    const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount ?? ''))
    const type = String(body.type ?? body.mutation_type ?? 'CR').toUpperCase()
    const isCredit = type === 'CR' || type === 'CREDIT' || type === 'MASUK'

    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ ok: true, skipped: 'nominal tidak ditemukan di payload' })
    if (!isCredit) return NextResponse.json({ ok: true, skipped: 'bukan mutasi kredit (dana masuk)' })

    const sb = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })
    // Cocokkan ke pesanan manual yang masih menunggu, nominal PERSIS sama (termasuk kode unik 3 digit).
    const { data: order, error: findErr } = await sb.from('payment_orders')
      .select('id').eq('method', 'manual').eq('total', amount)
      .in('status', ['menunggu_pembayaran', 'menunggu_verifikasi'])
      .order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })
    if (!order) return NextResponse.json({ ok: true, skipped: `tidak ada pesanan menunggu dengan nominal ${amount}` })

    const { error: updErr } = await sb.from('payment_orders')
      .update({ status: 'aktif', updated_at: new Date().toISOString() }).eq('id', order.id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, order_id: order.id, status: 'aktif' })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal proses notifikasi Moota' }, { status: 400 })
  }
}
