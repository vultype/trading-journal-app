import { NextResponse } from 'next/server'
import { fetchCandles } from '@/lib/twelvedata'

type TF = 'M5' | 'M15' | 'H1'
const VALID: TF[] = ['M5', 'M15', 'H1']
const cache = new Map<TF, { data: Awaited<ReturnType<typeof fetchCandles>>; at: number }>()
const TTL_MS = 45_000

export async function GET(req: Request) {
  const tf = (new URL(req.url).searchParams.get('tf') ?? 'M5') as TF
  if (!VALID.includes(tf)) return NextResponse.json({ error: 'tf tidak valid' }, { status: 400 })

  const now = Date.now()
  const hit = cache.get(tf)
  if (hit && now - hit.at < TTL_MS) return NextResponse.json(hit.data)
  try {
    const data = await fetchCandles(tf)
    cache.set(tf, { data, at: now })
    return NextResponse.json(data)
  } catch (err) {
    if (hit) return NextResponse.json(hit.data)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'fetch failed' }, { status: 502 })
  }
}
