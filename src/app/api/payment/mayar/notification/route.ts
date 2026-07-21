import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMayarInvoice, mapMayarStatus, isKnownMayarStatus } from '@/lib/mayar'
import { getPaymentConfig } from '@/lib/payment-config'
import { grantTopup } from '@/lib/credits-server'
import { notifyAdmin, notifyTopupPaid } from '@/lib/notify-admin'

// Webhook Mayar.
//
// ⚠️ KEAMANAN — INI BAGIAN PALING PENTING DARI INTEGRASI INI.
// Dokumentasi Mayar tidak menjelaskan cara memverifikasi keaslian webhook (tidak
// ada signature/HMAC yang terdokumentasi). Artinya siapa pun yang tahu URL ini
// bisa mengirim POST palsu berisi "sudah lunas".
//
// Karena itu payload webhook diperlakukan HANYA SEBAGAI PEMICU, tidak pernah
// sebagai bukti. Setelah menerima notifikasi kita memanggil balik API Mayar
// dengan API key kita sendiri untuk menanyakan status invoice yang sebenarnya.
// Tanpa jawaban dari Mayar, langganan TIDAK PERNAH diaktifkan — sehingga webhook
// palsu tidak menghasilkan akses gratis.
//
// Event Mayar (terkonfirmasi dari docs): payment.received, payment.reminder.
// Kita tidak bercabang per-event: apa pun eventnya, status invoice ditanyakan
// ulang ke Mayar, jadi payment.reminder untuk invoice yang belum lunas otomatis
// tidak mengaktifkan apa pun.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function addMonths(d: Date, m: number) { const x = new Date(d); x.setMonth(x.getMonth() + m); return x }

// Ambil nilai bersarang tanpa mengasumsikan bentuk payload — Mayar mengirim
// event yang berbeda-beda dan kita hanya butuh dua hal: id invoice & referensi kita.
function pick(o: unknown, ...paths: string[]): string {
  for (const path of paths) {
    let cur: unknown = o
    for (const key of path.split('.')) {
      if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[key]
      else { cur = undefined; break }
    }
    if (typeof cur === 'string' && cur.trim()) return cur.trim()
  }
  return ''
}

export async function POST(req: Request) {
  try {
    if (!SUPA_URL || !SERVICE_KEY) return NextResponse.json({ error: 'server belum dikonfigurasi' }, { status: 503 })

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const mayarInvoiceId = pick(body, 'data.id', 'id', 'data.paymentLinkId', 'data.invoiceId')
    const ourInvoice = pick(body, 'data.extraData.noCustomer', 'extraData.noCustomer', 'data.noCustomer')
    if (!mayarInvoiceId && !ourInvoice) {
      return NextResponse.json({ error: 'payload tidak memuat id invoice maupun referensi' }, { status: 400 })
    }

    const sb = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })

    // Cari order kita. Prioritas gateway_ref (id Mayar) karena itu yang kita simpan
    // sendiri saat membuat invoice; extraData baru dipakai sebagai cadangan.
    let q = sb.from('payment_orders').select('id, user_id, plan, months, credits, gateway_ref, status').limit(1)
    q = mayarInvoiceId ? q.eq('gateway_ref', mayarInvoiceId) : q.eq('invoice_number', ourInvoice)
    let { data: order } = await q.maybeSingle()
    if (!order && ourInvoice) {
      const r = await sb.from('payment_orders').select('id, user_id, plan, months, credits, gateway_ref, status').eq('invoice_number', ourInvoice).maybeSingle()
      order = r.data
    }
    if (!order) return NextResponse.json({ error: 'order tidak ditemukan' }, { status: 404 })

    // ── Verifikasi ke Mayar (sumber kebenaran) ──
    const cfg = await getPaymentConfig()
    const lookupId = order.gateway_ref || mayarInvoiceId
    if (!cfg.mayar.apiKey || !lookupId) {
      return NextResponse.json({ error: 'tidak bisa memverifikasi ke Mayar — aktivasi ditahan' }, { status: 503 })
    }

    let verified: { status: string } | null = null
    try { verified = await getMayarInvoice(cfg.mayar.apiKey, cfg.mayar.production, lookupId) } catch { verified = null }
    if (!verified) {
      // Gagal menghubungi Mayar → jangan ubah apa pun. Mayar akan mengulang webhook.
      return NextResponse.json({ error: 'verifikasi ke Mayar gagal — status tidak diubah' }, { status: 502 })
    }

    const status = mapMayarStatus(verified.status)
    // Status di luar daftar yang dikenal tidak boleh diam-diam dianggap lunas.
    // Dicatat agar terlihat di log Vercel bila Mayar memakai istilah baru.
    if (!isKnownMayarStatus(verified.status)) {
      console.warn('[mayar] status tidak dikenal:', verified.status, 'invoice', lookupId)
    }
    if (order.status === 'aktif' && status !== 'aktif') {
      // Jangan menurunkan order yang sudah aktif karena webhook susulan.
      return NextResponse.json({ ok: true, skipped: 'order sudah aktif' })
    }

    const { data: updated, error } = await sb.from('payment_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .select('id, user_id, plan, months, credits')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Topup lunas → grant kredit (idempoten via unique index ref_order_id).
    if (updated && updated.plan === 'topup' && status === 'aktif' && updated.credits && updated.credits > 0) {
      const granted = await grantTopup(sb, updated.user_id, updated.credits, updated.id)
      if (granted) {
        const { data: tu } = await sb.auth.admin.getUserById(updated.user_id)
        after(() => notifyTopupPaid(tu?.user?.email ?? updated.user_id, updated.credits!, 'Mayar'))
      }
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

    // Notifikasi admin saat pembayaran BENAR-BENAR lunas (sudah diverifikasi ke Mayar).
    // Transisi ke aktif dari status lain saja — cegah kirim ganda dari webhook susulan.
    if (updated && status === 'aktif' && order.status !== 'aktif') {
      const { data: u } = await sb.auth.admin.getUserById(updated.user_id)
      after(() => notifyAdmin('✅ Pembayaran LUNAS (Mayar)', [
        `User: ${u?.user?.email ?? updated.user_id}`,
        `Paket: ${updated.plan} ${updated.months} bulan`,
        `Akses Pro sudah otomatis aktif.`,
      ]))
    }

    return NextResponse.json({ ok: true, status, mayarStatus: verified.status, verified: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal proses notifikasi Mayar' }, { status: 400 })
  }
}
