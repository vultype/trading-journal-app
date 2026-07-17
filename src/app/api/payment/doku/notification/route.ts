import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyDokuNotification, mapDokuStatus } from '@/lib/doku'
import { grantTopup } from '@/lib/credits-server'

// Webhook DOKU (HTTP Notification). URL ini di-set via override_notification_url saat
// membuat transaksi. Verifikasi signature → update status payment_orders by invoice_number.
export const dynamic = 'force-dynamic'

const NOTIF_TARGET = '/api/payment/doku/notification'
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(req: Request) {
  try {
    // WAJIB: baca body mentah (digest dihitung dari byte asli, bukan hasil re-serialize)
    const rawBody = await req.text()
    const clientId = req.headers.get('client-id') || ''
    const requestId = req.headers.get('request-id') || ''
    const timestamp = req.headers.get('request-timestamp') || ''
    const signature = req.headers.get('signature') || ''

    // 1) Verifikasi keaslian notifikasi (cegah pemalsuan)
    if (!verifyDokuNotification({ clientId, requestId, timestamp, requestTarget: NOTIF_TARGET, rawBody, signature })) {
      return NextResponse.json({ error: 'signature tidak valid' }, { status: 403 })
    }
    if (!SUPA_URL || !SERVICE_KEY) return NextResponse.json({ error: 'server belum dikonfigurasi' }, { status: 503 })

    const n = JSON.parse(rawBody || '{}')
    const invoice = String(n?.order?.invoice_number ?? '')
    const txStatus = String(n?.transaction?.status ?? n?.status ?? '')
    if (!invoice) return NextResponse.json({ error: 'invoice_number tidak ada di notifikasi' }, { status: 400 })

    const status = mapDokuStatus(txStatus)
    const sb = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })
    const { data: updated, error } = await sb.from('payment_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('invoice_number', invoice)
      .select('id, user_id, plan, credits')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Order TOPUP yang lunas → grant kredit ke saldo topup (permanen). Idempoten:
    // unique index (ref_order_id where reason='topup') menahan grant ganda dari notifikasi berulang.
    if (updated && updated.plan === 'topup' && status === 'aktif' && updated.credits && updated.credits > 0) {
      await grantTopup(sb, updated.user_id, updated.credits, updated.id)
    }

    return NextResponse.json({ ok: true, invoice, status })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal proses notifikasi DOKU' }, { status: 400 })
  }
}
