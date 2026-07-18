import { NextResponse } from 'next/server'
import { fetchCandles, type TF } from '@/lib/twelvedata'

const VALID: TF[] = ['M5', 'M15', 'H1', 'H4', 'D1']
// Simbol yang boleh diminta lewat query ?symbol= — whitelist supaya endpoint tak
// disalahgunakan untuk fetch simbol sembarang. XAU/USD = chart harga utama;
// UUP/IEF = proxy candle DXY & yield 10Y untuk pilar Makro per-timeframe.
// VIXY/SPY/QQQ/BTC/USD/XAG/USD = halaman detail market (/terminal/data/market/*),
// simbol yang sama persis sudah dipakai live-quote di /api/terminal/crossasset.
const ALLOWED_SYMBOLS = new Set(['XAU/USD', 'GBP/USD', 'UUP', 'IEF', 'VIXY', 'SPY', 'QQQ', 'BTC/USD', 'XAG/USD'])
const cache = new Map<string, { data: Awaited<ReturnType<typeof fetchCandles>>; at: number }>()
// TF besar (H4/D1) berubah lambat → cache lebih lama biar hemat kredit.
const ttl = (tf: TF) => (tf === 'D1' ? 30 * 60_000 : tf === 'H4' ? 10 * 60_000 : 45_000)

export async function GET(req: Request) {
  const url = new URL(req.url)
  const tf = (url.searchParams.get('tf') ?? 'M5') as TF
  const symbol = url.searchParams.get('symbol') ?? 'XAU/USD'
  if (!VALID.includes(tf)) return NextResponse.json({ error: 'tf tidak valid' }, { status: 400 })
  if (!ALLOWED_SYMBOLS.has(symbol)) return NextResponse.json({ error: 'symbol tidak valid' }, { status: 400 })

  const cacheKey = `${symbol}:${tf}`
  const now = Date.now()
  const hit = cache.get(cacheKey)
  if (hit && now - hit.at < ttl(tf)) return NextResponse.json(hit.data)
  try {
    const data = await fetchCandles(tf, symbol)
    cache.set(cacheKey, { data, at: now })
    return NextResponse.json(data)
  } catch (err) {
    if (hit) return NextResponse.json(hit.data)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'fetch failed' }, { status: 502 })
  }
}
