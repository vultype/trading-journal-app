import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pkgPrice, planBase, planName, DURATIONS, genUniqueCode, BANK, type PlanId } from '@/lib/pricing'
import { notifyAdmin } from '@/lib/notify-admin'

// Buat order pembayaran MANUAL (transfer bank). Harga + kode unik DIHITUNG DI SERVER.
// total = harga paket + kode unik 3 digit → memudahkan admin mencocokkan mutasi rekening.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(req: Request) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

    const sb = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user }, error: uErr } = await sb.auth.getUser()
    if (uErr || !user) return NextResponse.json({ error: 'Sesi tidak valid, login ulang' }, { status: 401 })

    const { plan: planRaw, months: monthsRaw } = await req.json()
    // Jurnal Tools = bonus Pro, tidak dijual → hanya paket 'terminal' yang boleh checkout.
    if (planRaw && planRaw !== 'terminal') {
      return NextResponse.json({ error: 'Paket ini tidak dijual terpisah — Jurnal Tools adalah bonus langganan Pro.' }, { status: 400 })
    }
    const plan: PlanId = 'terminal'
    const dur = DURATIONS.find(d => d.months === Number(monthsRaw)) ?? DURATIONS[0]
    const base = pkgPrice(planBase(plan), dur.months, dur.off)
    const uniqueCode = genUniqueCode()
    const total = base + uniqueCode

    const { data: order, error: oErr } = await sb.from('payment_orders').insert({
      user_id: user.id, plan, months: dur.months,
      base_amount: base, unique_code: uniqueCode, total,
      bank: BANK.name, account_no: BANK.number,
      status: 'menunggu_pembayaran', method: 'manual',
    }).select('id, invoice_number, total, unique_code, base_amount').single()
    if (oErr || !order) return NextResponse.json({ error: 'Gagal membuat pesanan: ' + (oErr?.message ?? '-') }, { status: 500 })

    // Notifikasi admin — dijalankan lewat after() supaya SELESAI setelah respons
    // terkirim. Tanpa ini (fire-and-forget tanpa await), serverless membekukan
    // fungsi begitu respons dikirim dan fetch ke Resend tak pernah rampung —
    // itu sebab notifikasi tidak terkirim selama ini.
    after(() => notifyAdmin('🧾 Checkout baru (transfer manual)', [
      `Invoice: ${order.invoice_number ?? '-'}`,
      `User: ${user.email ?? user.id}`,
      `Paket: ${planName(plan)} ${dur.months} bulan`,
      `Total transfer: Rp${Number(order.total).toLocaleString('id-ID')} (kode unik ${order.unique_code})`,
      `Status: menunggu transfer`,
    ]))

    return NextResponse.json({
      orderId: order.id, invoice: order.invoice_number,
      baseAmount: order.base_amount, uniqueCode: order.unique_code, total: order.total,
      bank: BANK,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal membuat pesanan' }, { status: 500 })
  }
}
