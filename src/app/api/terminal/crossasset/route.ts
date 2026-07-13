import { NextResponse } from 'next/server'

// Cross-asset live dari Twelve Data (paket Grow, 55 kredit/menit).
// Indeks kas mentah (VIX/SPX/IXIC) & DXY resmi tidak tersedia tanpa add-on "Indices" —
// dipakai proxy ETF/forex yang sangat likuid & korelasinya erat ke instrumen aslinya:
//   SPY  = S&P 500 ETF      QQQ  = Nasdaq 100 ETF
//   VIXY = VIX futures ETF  UUP  = US Dollar Index ETF (bullish fund)
const SYMBOLS = 'BTC/USD,SPY,QQQ,VIXY,UUP'
const BASE = 'https://api.twelvedata.com'

type Cross = Record<string, { price: number; changePct: number } | null>
let cache: { data: Cross; at: number } | null = null
const TTL_MS = 45_000 // paket Grow lebih longgar — cache lebih pendek, data lebih segar

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return NextResponse.json(cache.data)
  try {
    const key = process.env.TWELVE_DATA_API_KEY
    if (!key) throw new Error('TWELVE_DATA_API_KEY belum diset')
    const res = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(SYMBOLS)}&apikey=${key}`, { cache: 'no-store' })
    const j = await res.json()
    if (j.status === 'error' || j.code) throw new Error(j.message || 'Twelve Data error')
    const data: Cross = {}
    for (const [sym, q] of Object.entries(j)) {
      const quote = q as { close?: string; percent_change?: string }
      data[sym] = quote?.close ? { price: parseFloat(quote.close), changePct: parseFloat(quote.percent_change ?? '0') } : null
    }
    cache = { data, at: now }
    return NextResponse.json(data)
  } catch (err) {
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'fetch failed' }, { status: 502 })
  }
}
