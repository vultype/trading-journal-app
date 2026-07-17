import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createDokuCheckout, dokuConfigured } from '@/lib/doku'
import { findPackage, RP_PER_CREDIT, CUSTOM_TOPUP_MIN, CUSTOM_TOPUP_MAX } from '@/lib/ai-credits'

// Buat order TOPUP kredit AI + sesi DOKU Checkout. Harga & jumlah kredit DITENTUKAN
// SERVER dari paket (jangan percaya client). Order disimpan di payment_orders dgn
// plan='topup' & kolom credits; webhook DOKU akan grant kredit saat lunas.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(req: Request) {
  if (!dokuConfigured()) return NextResponse.json({ error: 'Pembayaran online belum aktif — DOKU key belum diset' }, { status: 503 })
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

    const sb = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user }, error: uErr } = await sb.auth.getUser()
    if (uErr || !user) return NextResponse.json({ error: 'Sesi tidak valid, login ulang' }, { status: 401 })

    const { packageId, credits: customCredits, origin } = await req.json()

    // Sumber jumlah kredit: paket tetap ATAU jumlah custom yang diisi user.
    let credits: number, price: number
    const pkg = packageId ? findPackage(String(packageId)) : null
    if (pkg) {
      credits = pkg.credits; price = pkg.price
    } else {
      credits = Math.trunc(Number(customCredits))
      if (!Number.isFinite(credits) || credits < CUSTOM_TOPUP_MIN || credits > CUSTOM_TOPUP_MAX) {
        return NextResponse.json({ error: `Jumlah kredit harus antara ${CUSTOM_TOPUP_MIN} dan ${CUSTOM_TOPUP_MAX}` }, { status: 400 })
      }
      price = credits * RP_PER_CREDIT
    }

    // Order topup — invoice_number ter-generate otomatis oleh trigger DB.
    const { data: order, error: oErr } = await sb.from('payment_orders').insert({
      user_id: user.id, plan: 'topup', months: 0,
      base_amount: price, unique_code: 0, total: price,
      bank: 'DOKU', account_no: '-', status: 'menunggu_pembayaran', method: 'doku',
      credits,
    }).select('id, invoice_number').single()
    if (oErr || !order || !order.invoice_number) {
      return NextResponse.json({ error: 'Gagal membuat pesanan: ' + (oErr?.message ?? 'invoice kosong') }, { status: 500 })
    }

    const pubBase = origin && String(origin).startsWith('https') ? String(origin) : 'https://www.datalitiq.com'
    const checkout = await createDokuCheckout({
      invoiceNumber: order.invoice_number,
      amount: price,
      itemName: `Datalitiq Top Up ${credits} Kredit AI`,
      customerId: user.id,
      customerName: (user.user_metadata?.full_name as string) || user.email?.split('@')[0],
      customerEmail: user.email,
      callbackUrl: `${pubBase}/account?topup=finish`,
      notificationUrl: `${pubBase}/api/payment/doku/notification`,
    })

    return NextResponse.json({ paymentUrl: checkout.paymentUrl, orderId: order.id, invoice: order.invoice_number, credits, amount: price })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal membuat transaksi' }, { status: 502 })
  }
}
