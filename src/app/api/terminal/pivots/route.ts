import { NextResponse } from 'next/server'
import { fetchDailyPivots } from '@/lib/twelvedata'

// Pivot harian berubah sekali sehari → cache 1 jam.
let cache: { data: Awaited<ReturnType<typeof fetchDailyPivots>>; at: number } | null = null
const TTL_MS = 3600_000

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS && cache.data) return NextResponse.json(cache.data)
  try {
    const data = await fetchDailyPivots()
    if (!data) throw new Error('pivot tidak tersedia')
    cache = { data, at: now }
    return NextResponse.json(data)
  } catch (err) {
    if (cache?.data) return NextResponse.json(cache.data)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'fetch failed' }, { status: 502 })
  }
}
