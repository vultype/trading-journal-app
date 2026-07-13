import { NextResponse } from 'next/server'

// Cross-asset live dari Twelve Data. Free tier (8 kredit/menit) TIDAK menyediakan
// indeks (S&P/Nasdaq/VIX) & yield (US10Y) — itu perlu paket berbayar. Yang tersedia
// & terkonfirmasi jalan: BTC/USD (crypto). Symbol lain menyusul kalau upgrade.
const SYMBOLS = 'BTC/USD'
const BASE = 'https://api.twelvedata.com'

type Cross = Record<string, { price: number; changePct: number } | null>
let cache: { data: Cross; at: number } | null = null
const TTL_MS = 150_000 // 2.5 menit — hemat kuota

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return NextResponse.json(cache.data)
  try {
    const key = process.env.TWELVE_DATA_API_KEY
    if (!key) throw new Error('TWELVE_DATA_API_KEY belum diset')
    const res = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(SYMBOLS)}&apikey=${key}`, { cache: 'no-store' })
    const j = await res.json()
    if (j.status === 'error' || j.code) throw new Error(j.message || 'Twelve Data error')
    // Single-symbol -> objek quote langsung; multi-symbol -> keyed by symbol
    const one = j.close ? { 'BTC/USD': j } : j
    const data: Cross = {}
    for (const [sym, q] of Object.entries(one)) {
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
