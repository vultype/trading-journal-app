import { NextResponse } from 'next/server'

// Headline berita emas/dolar/Fed dari Google News RSS (gratis). Tampilan mentah (tanpa AI).
const RSS = 'https://news.google.com/rss/search?q=gold%20price%20OR%20XAUUSD%20OR%20%22federal%20reserve%22%20OR%20%22US%20dollar%22%20when:2d&hl=en-US&gl=US&ceid=US:en'

type Item = { text: string; source: string; time: string; link: string }
let cache: { data: Item[]; at: number } | null = null
const TTL_MS = 10 * 60_000

function ago(pubDate: string): string {
  const t = new Date(pubDate).getTime()
  if (isNaN(t)) return ''
  const m = Math.floor((Date.now() - t) / 60000)
  if (m < 60) return `${m}m lalu`
  const h = Math.floor(m / 60); if (h < 24) return `${h}j lalu`
  return `${Math.floor(h / 24)}h lalu`
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return NextResponse.json(cache.data)
  try {
    const xml = await (await fetch(RSS, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })).text()
    const items = xml.split('<item>').slice(1, 13)
    const data: Item[] = []
    for (const it of items) {
      const tm = it.match(/<title>([\s\S]*?)<\/title>/); if (!tm) continue
      let title = tm[1].replace('<![CDATA[', '').replace(']]>', '').trim()
      const dash = title.lastIndexOf(' - '); let source = 'News'
      if (dash > 0) { source = title.slice(dash + 3).trim(); title = title.slice(0, dash).trim() }
      const pub = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? ''
      const link = it.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? ''
      if (title) data.push({ text: title, source, time: ago(pub), link })
    }
    if (!data.length) throw new Error('kosong')
    cache = { data, at: now }
    return NextResponse.json(data)
  } catch (err) {
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'fetch failed' }, { status: 502 })
  }
}
