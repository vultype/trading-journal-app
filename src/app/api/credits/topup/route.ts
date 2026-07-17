import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createDokuCheckout, dokuConfigured } from '@/lib/doku'
import { findPackage } from '@/lib/ai-credits'

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

    const { packageId, origin } = await req.json()
    const pkg = findPackage(String(packageId))
    if (!pkg) return NextResponse.json({ error: 'Paket tidak valid' }, { status: 400 })

    // Order topup — invoice_number ter-generate otomatis oleh trigger DB.
    const { data: order, error: oErr } = await sb.from('payment_orders').insert({
      user_id: user.id, plan: 'topup', months: 0,
      base_amount: pkg.price, unique_code: 0, total: pkg.price,
      bank: 'DOKU', account_no: '-', status: 'menunggu_pembayaran', method: 'doku',
      credits: pkg.credits,
    }).select('id, invoice_number').single()
    if (oErr || !order || !order.invoice_number) {
      return NextResponse.json({ error: 'Gagal membuat pesanan: ' + (oErr?.message ?? 'invoice kosong') }, { status: 500 })
    }

    const pubBase = origin && String(origin).startsWith('https') ? String(origin) : 'https://www.datalitiq.com'
    const checkout = await createDokuCheckout({
      invoiceNumber: order.invoice_number,
      amount: pkg.price,
      itemName: `Datalitiq Top Up ${pkg.credits} Kredit AI`,
      customerId: user.id,
      customerName: (user.user_metadata?.full_name as string) || user.email?.split('@')[0],
      customerEmail: user.email,
      callbackUrl: `${pubBase}/account?topup=finish`,
      notificationUrl: `${pubBase}/api/payment/doku/notification`,
    })

    return NextResponse.json({ paymentUrl: checkout.paymentUrl, orderId: order.id, invoice: order.invoice_number, credits: pkg.credits, amount: pkg.price })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal membuat transaksi' }, { status: 502 })
  }
}
