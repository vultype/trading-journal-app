import { NextResponse } from 'next/server'

// Kalender ekonomi REAL (mingguan) dari feed publik ForexFactory — event USD
// berdampak tinggi (CPI/NFP/FOMC/PPI dll). Dipakai untuk News Guard: jangan
// entry/alert di sekitar rilis besar. Cache 30 menit (jadwal jarang berubah).
const FEED = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'

export type CalEvent = { title: string; time: number; impact: 'High' | 'Medium'; forecast: string; previous: string }
let cache: { data: CalEvent[]; at: number } | null = null
const TTL = 30 * 60_000

async function fetchEvents(): Promise<CalEvent[]> {
  const res = await fetch(FEED, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0 (DatalitiqTerminal)' } })
  if (!res.ok) throw new Error(`kalender HTTP ${res.status}`)
  const j = (await res.json()) as { title?: string; country?: string; date?: string; impact?: string; forecast?: string; previous?: string }[]
  return j
    .filter(e => e.country === 'USD' && (e.impact === 'High' || e.impact === 'Medium') && e.date && e.title)
    .map(e => ({ title: e.title!, time: new Date(e.date!).getTime(), impact: (e.impact === 'High' ? 'High' : 'Medium') as 'High' | 'Medium', forecast: e.forecast ?? '', previous: e.previous ?? '' }))
    .filter(e => Number.isFinite(e.time))
    .sort((a, b) => a.time - b.time)
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < TTL) return NextResponse.json(cache.data)
  try {
    const data = await fetchEvents()
    cache = { data, at: now }
    return NextResponse.json(data)
  } catch (err) {
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal ambil kalender' }, { status: 502 })
  }
}
