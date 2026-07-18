import { NextResponse } from 'next/server'
import { fetchQuote } from '@/lib/twelvedata'

// Cache in-memory PER SIMBOL biar tidak boros kuota Twelve Data. Default XAU/USD
// (terminal emas — perilaku lama tak berubah); GBP/USD dipakai terminal GBP (admin).
const ALLOWED = new Set(['XAU/USD', 'GBP/USD'])
const cache = new Map<string, { data: Awaited<ReturnType<typeof fetchQuote>>; at: number }>()
const TTL_MS = 5000

export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get('symbol') ?? 'XAU/USD'
  if (!ALLOWED.has(symbol)) return NextResponse.json({ error: 'symbol tidak valid' }, { status: 400 })
  const now = Date.now()
  const hit = cache.get(symbol)
  if (hit && now - hit.at < TTL_MS) return NextResponse.json(hit.data)
  try {
    const data = await fetchQuote(symbol)
    cache.set(symbol, { data, at: now })
    return NextResponse.json(data)
  } catch (err) {
    if (hit) return NextResponse.json(hit.data) // fallback ke cache lama kalau API lagi error
    return NextResponse.json({ error: err instanceof Error ? err.message : 'fetch failed' }, { status: 502 })
  }
}
