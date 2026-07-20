import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pkgPrice, planBase, planName, DURATIONS, type PlanId } from '@/lib/pricing'
import { createMayarInvoice } from '@/lib/mayar'
import { getPaymentConfig } from '@/lib/payment-config'

// Buat order + invoice Mayar. Harga DIHITUNG DI SERVER (jangan percaya client).
// User diverifikasi dari access token Supabase (Authorization: Bearer ...).
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(req: Request) {
  try {
    const cfg = await getPaymentConfig()
    if (!cfg.mayar.apiKey) {
      return NextResponse.json({ error: 'Pembayaran Mayar belum aktif — API key belum diatur' }, { status: 503 })
    }

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

    const sb = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user }, error: uErr } = await sb.auth.getUser()
    if (uErr || !user) return NextResponse.json({ error: 'Sesi tidak valid, login ulang' }, { status: 401 })

    const { plan: planRaw, months: monthsRaw, origin } = await req.json()
    const plan = (['standar', 'pro', 'terminal'].includes(planRaw) ? planRaw : 'terminal') as PlanId
    const dur = DURATIONS.find(d => d.months === Number(monthsRaw)) ?? DURATIONS[0]
    const amount = pkgPrice(planBase(plan), dur.months, dur.off) // harga bersih dari server

    const { data: order, error: oErr } = await sb.from('payment_orders').insert({
      user_id: user.id, plan, months: dur.months,
      base_amount: amount, unique_code: 0, total: amount,
      bank: 'Mayar', account_no: '-', status: 'menunggu_pembayaran', method: 'mayar',
    }).select('id, invoice_number').single()
    if (oErr || !order || !order.invoice_number) {
      return NextResponse.json({ error: 'Gagal membuat pesanan: ' + (oErr?.message ?? 'invoice kosong') }, { status: 500 })
    }

    const pubBase = origin && String(origin).startsWith('https') ? String(origin) : 'https://www.datalitiq.com'
    const pay = await createMayarInvoice({
      apiKey: cfg.mayar.apiKey, production: cfg.mayar.production,
      amount,
      itemName: `Datalitiq ${planName(plan)} ${dur.months} bulan`,
      description: `Langganan Datalitiq ${planName(plan)} — ${dur.months} bulan`,
      buyerName: (user.user_metadata?.full_name as string) || user.email?.split('@')[0],
      buyerEmail: user.email,
      referenceId: order.invoice_number,
      redirectUrl: `${pubBase}/checkout?status=finish&inv=${encodeURIComponent(order.invoice_number)}`,
    })

    // Simpan id invoice Mayar — dipakai webhook untuk memverifikasi status ke sumbernya.
    await sb.from('payment_orders').update({ gateway_ref: pay.invoiceId }).eq('id', order.id)

    // Catatan: TIDAK ada notifikasi admin di sini. Untuk pembayaran online, admin
    // hanya perlu tahu saat pembayaran BENAR-BENAR lunas — notifikasi itu dikirim
    // dari route webhook (mayar/notification) setelah status diverifikasi ke Mayar.
    return NextResponse.json({ paymentUrl: pay.paymentUrl, orderId: order.id, invoice: order.invoice_number, amount })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal membuat transaksi' }, { status: 502 })
  }
}
