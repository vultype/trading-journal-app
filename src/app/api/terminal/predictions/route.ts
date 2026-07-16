import { NextResponse } from 'next/server'
import { getRecentPredictions } from '@/lib/alert-state'

// 10 kesimpulan terakhir + hasil evaluasinya (dari kalibrasi cron) — untuk panel riwayat.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await getRecentPredictions(10)
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json([])
  }
}
