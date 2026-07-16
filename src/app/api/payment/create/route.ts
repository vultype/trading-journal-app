import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pkgPrice, planBase, planName, DURATIONS, type PlanId } from '@/lib/pricing'
import { createSnapTransaction, midtransConfigured } from '@/lib/midtrans'

// Buat order + transaksi Snap Midtrans. Harga DIHITUNG DI SERVER (jangan percaya client).
// User diverifikasi dari access token Supabase (Authorization: Bearer ...).
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(req: Request) {
  if (!midtransConfigured()) return NextResponse.json({ error: 'Pembayaran belum aktif — MIDTRANS key belum diset' }, { status: 503 })
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

    // Verifikasi user via token-nya sendiri
    const sb = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user }, error: uErr } = await sb.auth.getUser()
    if (uErr || !user) return NextResponse.json({ error: 'Sesi tidak valid, login ulang' }, { status: 401 })

    const { plan: planRaw, months: monthsRaw, origin } = await req.json()
    const plan = (['standar', 'pro', 'terminal'].includes(planRaw) ? planRaw : 'terminal') as PlanId
    const dur = DURATIONS.find(d => d.months === Number(monthsRaw)) ?? DURATIONS[0]
    const amount = pkgPrice(planBase(plan), dur.months, dur.off) // harga bersih dari server

    // Buat order (RLS: user boleh insert row miliknya sendiri)
    const { data: order, error: oErr } = await sb.from('payment_orders').insert({
      user_id: user.id, plan, months: dur.months,
      base_amount: amount, unique_code: 0, total: amount,
      bank: 'Midtrans', account_no: '-', status: 'menunggu_pembayaran',
    }).select('id').single()
    if (oErr || !order) return NextResponse.json({ error: 'Gagal membuat pesanan: ' + (oErr?.message ?? '') }, { status: 500 })

    const finishUrl = origin ? `${origin}/checkout?status=finish` : undefined
    const snap = await createSnapTransaction({
      orderId: order.id,
      grossAmount: amount,
      itemName: `Datalitiq ${planName(plan)} ${dur.months} bln`,
      customerEmail: user.email,
      customerName: (user.user_metadata?.full_name as string) || user.email?.split('@')[0],
      finishUrl,
    })

    return NextResponse.json({ token: snap.token, redirectUrl: snap.redirect_url, orderId: order.id, amount })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal membuat transaksi' }, { status: 502 })
  }
}
