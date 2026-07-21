import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyDokuNotification, mapDokuStatus } from '@/lib/doku'
import { grantTopup } from '@/lib/credits-server'
import { notifyTopupPaid } from '@/lib/notify-admin'

// Webhook DOKU (HTTP Notification). URL ini di-set via override_notification_url saat
// membuat transaksi. Verifikasi signature → update status payment_orders by invoice_number.
export const dynamic = 'force-dynamic'

const NOTIF_TARGET = '/api/payment/doku/notification'
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function addMonths(d: Date, m: number) { const x = new Date(d); x.setMonth(x.getMonth() + m); return x }

export async function POST(req: Request) {
  try {
    // WAJIB: baca body mentah (digest dihitung dari byte asli, bukan hasil re-serialize)
    const rawBody = await req.text()
    const clientId = req.headers.get('client-id') || ''
    const requestId = req.headers.get('request-id') || ''
    const timestamp = req.headers.get('request-timestamp') || ''
    const signature = req.headers.get('signature') || ''

    // 1) Verifikasi keaslian notifikasi (cegah pemalsuan)
    if (!(await verifyDokuNotification({ clientId, requestId, timestamp, requestTarget: NOTIF_TARGET, rawBody, signature }))) {
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
      .select('id, user_id, plan, months, credits')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Order TOPUP yang lunas → grant kredit ke saldo topup (permanen). Idempoten:
    // unique index (ref_order_id where reason='topup') menahan grant ganda dari notifikasi berulang.
    if (updated && updated.plan === 'topup' && status === 'aktif' && updated.credits && updated.credits > 0) {
      const granted = await grantTopup(sb, updated.user_id, updated.credits, updated.id)
      if (granted) {
        const { data: tu } = await sb.auth.admin.getUserById(updated.user_id)
        after(() => notifyTopupPaid(tu?.user?.email ?? updated.user_id, updated.credits!, 'DOKU'))
      }
    }

    // Order TERMINAL yang lunas → set expires_at yang MENUMPUK di atas sisa langganan
    // aktif yang belum kadaluarsa (perpanjangan dini tidak menghanguskan sisa hari).
    if (updated && updated.plan === 'terminal' && status === 'aktif') {
      const { data: others } = await sb.from('payment_orders')
        .select('expires_at, updated_at, created_at, months')
        .eq('user_id', updated.user_id).eq('plan', 'terminal').eq('status', 'aktif')
        .neq('id', updated.id)
      let baseMs = Date.now()
      for (const o of (others || []) as { expires_at: string | null; updated_at: string | null; created_at: string; months: number | null }[]) {
        const exp = o.expires_at ? new Date(o.expires_at).getTime()
          : addMonths(new Date(o.updated_at || o.created_at), o.months || 1).getTime()
        if (exp > baseMs) baseMs = exp
      }
      const expiresAt = addMonths(new Date(baseMs), updated.months || 1).toISOString()
      await sb.from('payment_orders').update({ expires_at: expiresAt }).eq('id', updated.id)
    }

    return NextResponse.json({ ok: true, invoice, status })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal proses notifikasi DOKU' }, { status: 400 })
  }
}
