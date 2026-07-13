import { NextResponse } from 'next/server'
import { fetchMacro } from '@/lib/fred'

// Data makro FRED = harian/bulanan → cache lama (6 jam) sudah cukup.
let cache: { data: Awaited<ReturnType<typeof fetchMacro>>; at: number } | null = null
const TTL_MS = 6 * 3600_000

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return NextResponse.json(cache.data)
  try {
    const data = await fetchMacro()
    if (!data.length) throw new Error('FRED tidak mengembalikan data')
    cache = { data, at: now }
    return NextResponse.json(data)
  } catch (err) {
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'fetch failed' }, { status: 502 })
  }
}
