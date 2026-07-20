import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pkgPrice, planBase, planName, DURATIONS, type PlanId } from '@/lib/pricing'
import { createIpaymuPayment } from '@/lib/ipaymu'
import { getPaymentConfig } from '@/lib/payment-config'

// Buat order + sesi pembayaran iPaymu. Harga DIHITUNG DI SERVER (jangan percaya client).
// User diverifikasi dari access token Supabase (Authorization: Bearer ...).
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(req: Request) {
  try {
    const cfg = await getPaymentConfig()
    if (!cfg.ipaymu.va || !cfg.ipaymu.apiKey) {
      return NextResponse.json({ error: 'Pembayaran iPaymu belum aktif — kredensial belum diatur' }, { status: 503 })
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
      bank: 'iPaymu', account_no: '-', status: 'menunggu_pembayaran', method: 'ipaymu',
    }).select('id, invoice_number').single()
    if (oErr || !order || !order.invoice_number) {
      return NextResponse.json({ error: 'Gagal membuat pesanan: ' + (oErr?.message ?? 'invoice kosong') }, { status: 500 })
    }

    const pubBase = origin && String(origin).startsWith('https') ? String(origin) : 'https://www.datalitiq.com'
    const pay = await createIpaymuPayment({
      va: cfg.ipaymu.va, apiKey: cfg.ipaymu.apiKey, production: cfg.ipaymu.production,
      referenceId: order.invoice_number,
      amount,
      itemName: `Datalitiq ${planName(plan)} ${dur.months} bln`,
      buyerName: (user.user_metadata?.full_name as string) || user.email?.split('@')[0],
      buyerEmail: user.email,
      returnUrl: `${pubBase}/checkout?status=finish&inv=${encodeURIComponent(order.invoice_number)}`,
      cancelUrl: `${pubBase}/checkout?status=cancel`,
      notifyUrl: `${pubBase}/api/payment/ipaymu/notification`,
    })

    return NextResponse.json({ paymentUrl: pay.paymentUrl, orderId: order.id, invoice: order.invoice_number, amount })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal membuat transaksi' }, { status: 502 })
  }
}
