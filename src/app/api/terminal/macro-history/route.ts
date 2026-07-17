import { NextResponse } from 'next/server'
import { fetchSeriesHistory } from '@/lib/fred'

// History panjang 1 series FRED (utk halaman detail per-indikator, mis. /terminal/data/dxy).
// Data harian/bulanan → cache 6 jam, sama seperti /api/terminal/macro.
const cache = new Map<string, { data: Awaited<ReturnType<typeof fetchSeriesHistory>>; at: number }>()
const TTL_MS = 6 * 3600_000
const ALLOWED_LIMIT = 250 // batas wajar, cegah query berlebihan

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key') || ''
  const limit = Math.min(ALLOWED_LIMIT, Math.max(2, parseInt(searchParams.get('limit') || '90', 10) || 90))
  if (!key) return NextResponse.json({ error: 'parameter "key" wajib diisi' }, { status: 400 })

  const cacheKey = `${key}:${limit}`
  const now = Date.now()
  const hit = cache.get(cacheKey)
  if (hit && now - hit.at < TTL_MS) return NextResponse.json(hit.data)
  try {
    const data = await fetchSeriesHistory(key, limit)
    if (!data.length) throw new Error('FRED tidak mengembalikan data')
    cache.set(cacheKey, { data, at: now })
    return NextResponse.json(data)
  } catch (err) {
    if (hit) return NextResponse.json(hit.data)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'fetch failed' }, { status: 502 })
  }
}
