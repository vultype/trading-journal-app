import { NextResponse } from 'next/server'
import { getAccuracy } from '@/lib/alert-state'

// Akurasi kesimpulan terminal (kalibrasi ke depan) — aggregat saja, tanpa data sensitif.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const days = Math.max(1, Math.min(365, Number(new URL(req.url).searchParams.get('days') || 30)))
  try {
    const acc = await getAccuracy(days)
    if (!acc) return NextResponse.json({ total: 0, correct: 0, pct: null, window: days, ready: false })
    return NextResponse.json({ ...acc, ready: true })
  } catch {
    return NextResponse.json({ total: 0, correct: 0, pct: null, window: days, ready: false })
  }
}
