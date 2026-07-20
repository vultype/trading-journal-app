import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mapIpaymuStatus } from '@/lib/ipaymu'
import { getPaymentConfig } from '@/lib/payment-config'
import { grantTopup } from '@/lib/credits-server'

// Webhook iPaymu (notifyUrl). iPaymu mengirim form-urlencoded / JSON berisi
// reference_id (= invoice_number kita), status, status_code, trx_id.
//
// ⚠️ CATATAN KEAMANAN: iPaymu tidak mengirim signature pada notifikasi seperti DOKU,
// jadi kita TIDAK percaya status dari payload. Setelah menerima notifikasi, status
// diverifikasi ulang lewat API iPaymu (/transaction) memakai kredensial kita sendiri —
// sehingga notifikasi palsu tak bisa mengaktifkan langganan.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function addMonths(d: Date, m: number) { const x = new Date(d); x.setMonth(x.getMonth() + m); return x }

// Verifikasi status transaksi langsung ke iPaymu (sumber kebenaran).
async function verifyTrx(trxId: string): Promise<{ status: string; statusCode?: string | number } | null> {
  try {
    const cfg = await getPaymentConfig()
    if (!cfg.ipaymu.va || !cfg.ipaymu.apiKey || !trxId) return null
    const { ipaymuBase, ipaymuSignature, ipaymuPayload, ipaymuTimestamp } = await import('@/lib/ipaymu')
    const payload = ipaymuPayload({ transactionId: trxId })
    const signature = ipaymuSignature('POST', cfg.ipaymu.va, cfg.ipaymu.apiKey, payload)
    const res = await fetch(`${ipaymuBase(cfg.ipaymu.production)}/transaction`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', va: cfg.ipaymu.va, signature, timestamp: ipaymuTimestamp() },
      body: payload, cache: 'no-store',   // string sama persis dengan yang di-hash
    })
    const j = await res.json().catch(() => ({}))
    const data = j?.Data ?? j?.data
    if (!data) return null
    return { status: String(data.Status ?? data.status ?? ''), statusCode: data.StatusCode ?? data.status_code }
  } catch { return null }
}

export async function POST(req: Request) {
  try {
    if (!SUPA_URL || !SERVICE_KEY) return NextResponse.json({ error: 'server belum dikonfigurasi' }, { status: 503 })

    // Body bisa JSON atau form-urlencoded — tangani keduanya.
    const ctype = req.headers.get('content-type') || ''
    let n: Record<string, unknown> = {}
    if (ctype.includes('application/json')) n = await req.json().catch(() => ({}))
    else { const f = await req.formData().catch(() => null); if (f) n = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)])) }

    const invoice = String(n.reference_id ?? n.referenceId ?? '')
    const trxId = String(n.trx_id ?? n.transactionId ?? n.sid ?? '')
    if (!invoice) return NextResponse.json({ error: 'reference_id tidak ada di notifikasi' }, { status: 400 })

    // Verifikasi ke iPaymu; kalau gagal verifikasi, JANGAN aktifkan — pakai status payload
    // hanya untuk menandai pending/batal (tak pernah 'aktif' tanpa verifikasi).
    const verified = await verifyTrx(trxId)
    let status = verified
      ? mapIpaymuStatus(verified.status, verified.statusCode)
      : mapIpaymuStatus(String(n.status ?? ''), n.status_code as string | number | undefined)
    if (!verified && status === 'aktif') status = 'menunggu_pembayaran' // gagal verifikasi → tahan aktivasi

    const sb = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })
    const { data: updated, error } = await sb.from('payment_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('invoice_number', invoice)
      .select('id, user_id, plan, months, credits')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Topup lunas → grant kredit (idempoten via unique index ref_order_id).
    if (updated && updated.plan === 'topup' && status === 'aktif' && updated.credits && updated.credits > 0) {
      await grantTopup(sb, updated.user_id, updated.credits, updated.id)
    }

    // Terminal lunas → expires_at menumpuk di atas sisa langganan aktif.
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
      await sb.from('payment_orders').update({ expires_at: addMonths(new Date(baseMs), updated.months || 1).toISOString() }).eq('id', updated.id)
    }

    return NextResponse.json({ ok: true, invoice, status, verified: !!verified })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal proses notifikasi iPaymu' }, { status: 400 })
  }
}
