import { NextResponse } from 'next/server'
import { fetchCandles, type TF } from '@/lib/twelvedata'

const VALID: TF[] = ['M5', 'M15', 'H1', 'H4', 'D1']
const cache = new Map<TF, { data: Awaited<ReturnType<typeof fetchCandles>>; at: number }>()
// TF besar (H4/D1) berubah lambat → cache lebih lama biar hemat kredit.
const ttl = (tf: TF) => (tf === 'D1' ? 30 * 60_000 : tf === 'H4' ? 10 * 60_000 : 45_000)

export async function GET(req: Request) {
  const tf = (new URL(req.url).searchParams.get('tf') ?? 'M5') as TF
  if (!VALID.includes(tf)) return NextResponse.json({ error: 'tf tidak valid' }, { status: 400 })

  const now = Date.now()
  const hit = cache.get(tf)
  if (hit && now - hit.at < ttl(tf)) return NextResponse.json(hit.data)
  try {
    const data = await fetchCandles(tf)
    cache.set(tf, { data, at: now })
    return NextResponse.json(data)
  } catch (err) {
    if (hit) return NextResponse.json(hit.data)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'fetch failed' }, { status: 502 })
  }
}
