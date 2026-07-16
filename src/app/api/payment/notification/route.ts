import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyNotificationSignature, mapTransactionStatus } from '@/lib/midtrans'

// Webhook Midtrans (Payment Notification). URL ini didaftarkan di dashboard Midtrans.
// Verifikasi signature → update status payment_orders (aktif = akses langsung terbuka).
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(req: Request) {
  try {
    const n = await req.json()
    const order_id = String(n.order_id ?? '')
    const status_code = String(n.status_code ?? '')
    const gross_amount = String(n.gross_amount ?? '')
    const signature_key = String(n.signature_key ?? '')

    // 1) Verifikasi keaslian notifikasi (wajib — cegah pemalsuan)
    if (!verifyNotificationSignature({ order_id, status_code, gross_amount, signature_key })) {
      return NextResponse.json({ error: 'signature tidak valid' }, { status: 403 })
    }
    if (!SUPA_URL || !SERVICE_KEY) return NextResponse.json({ error: 'server belum dikonfigurasi' }, { status: 503 })

    const status = mapTransactionStatus(String(n.transaction_status ?? ''), n.fraud_status)
    const sb = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })
    const { error } = await sb.from('payment_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', order_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Selalu balas 200 supaya Midtrans tidak retry berulang untuk notifikasi valid
    return NextResponse.json({ ok: true, order_id, status })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal proses notifikasi' }, { status: 400 })
  }
}
