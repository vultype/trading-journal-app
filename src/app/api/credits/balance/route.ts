import { NextResponse } from 'next/server'
import { getUserFromReq, getBalanceSummary, creditsConfigured } from '@/lib/credits-server'
import { CREDIT_COST, MONTHLY_ALLOWANCE, TOPUP_PACKAGES } from '@/lib/ai-credits'

// Saldo kredit AI user (allowance siklus berjalan + topup permanen) + tabel biaya & paket.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!creditsConfigured()) {
    return NextResponse.json({ configured: false, error: 'Sistem kredit belum dikonfigurasi' }, { status: 503 })
  }
  const user = await getUserFromReq(req)
  if (!user) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  try {
    const summary = await getBalanceSummary(user.id, user.isAdmin)
    return NextResponse.json({
      configured: true,
      ...summary,
      cost: CREDIT_COST,
      monthlyAllowance: MONTHLY_ALLOWANCE,
      packages: TOPUP_PACKAGES,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal memuat saldo' }, { status: 500 })
  }
}
