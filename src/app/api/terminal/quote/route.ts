import { NextResponse } from 'next/server'
import { fetchQuote } from '@/lib/twelvedata'

// Cache in-memory server-side biar tidak boros kuota (800 credit/hari, 8 req/menit di Twelve Data free tier)
let cache: { data: Awaited<ReturnType<typeof fetchQuote>>; at: number } | null = null
const TTL_MS = 5000

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return NextResponse.json(cache.data)
  try {
    const data = await fetchQuote()
    cache = { data, at: now }
    return NextResponse.json(data)
  } catch (err) {
    if (cache) return NextResponse.json(cache.data) // fallback ke cache lama kalau API lagi error
    return NextResponse.json({ error: err instanceof Error ? err.message : 'fetch failed' }, { status: 502 })
  }
}
