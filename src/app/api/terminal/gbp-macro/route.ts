import { NextResponse } from 'next/server'
import { fetchSeriesList, type FredSeries } from '@/lib/fred'

// Makro sisi INGGRIS untuk terminal GBP/USD (modul terpisah — pipeline makro emas
// tak disentuh; sisi AS diambil client dari /api/terminal/macro yg sudah ber-cache).
// corr = korelasi umum ke GBP/USD: yield/rate/CPI UK naik → hawkish BoE → GBP menguat.
const UK_SERIES: FredSeries[] = [
  { key: 'uk10y', id: 'IRLTLT01GBM156N', name: 'UK 10Y Gilt', sub: 'Yield obligasi 10 thn UK', dec: 2, unit: '%', corr: 1 },
  { key: 'sonia', id: 'IUDSOIA', name: 'SONIA (BoE)', sub: 'Suku bunga overnight UK', dec: 2, unit: '%', corr: 1 },
  { key: 'ukcpi', id: 'GBRCPIALLMINMEI', units: 'pc1', name: 'UK CPI (YoY)', sub: 'Inflasi Inggris', dec: 1, unit: '%', corr: 1 },
  { key: 'ukunrate', id: 'LRHUTTTTGBM156S', name: 'UK Unemployment', sub: 'Pengangguran Inggris', dec: 1, unit: '%', corr: -1 },
]

let cache: { data: unknown; at: number } | null = null
const TTL_MS = 3600_000 // rilis bulanan/harian → cache 1 jam cukup

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return NextResponse.json(cache.data)
  try {
    const data = await fetchSeriesList(UK_SERIES)
    if (!data.length) throw new Error('FRED UK kosong')
    cache = { data, at: now }
    return NextResponse.json(data)
  } catch (err) {
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'fetch failed' }, { status: 502 })
  }
}
