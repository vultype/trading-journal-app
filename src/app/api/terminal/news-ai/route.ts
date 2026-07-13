import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Ambil headline emas/dolar/Fed dari Google News RSS (gratis, tanpa key),
// lalu Claude olah jadi sentimen naratif. On-demand (klik tombol), di-cache 10 menit.

const RSS = 'https://news.google.com/rss/search?q=gold%20price%20OR%20XAUUSD%20OR%20%22federal%20reserve%22%20OR%20%22US%20dollar%22%20OR%20inflation%20when:2d&hl=en-US&gl=US&ceid=US:en'

type NewsResult = {
  verdict: 'Bullish' | 'Bearish' | 'Netral'
  score: number
  narrative: string
  drivers: string[]
  headlines: { text: string; source: string; sentiment: 'bull' | 'bear' | 'neutral' }[]
  fetchedAt: string
}

let cache: { data: NewsResult; at: number } | null = null
const TTL_MS = 10 * 60_000

function parseHeadlines(xml: string): { text: string; source: string }[] {
  const items = xml.split('<item>').slice(1)
  const out: { text: string; source: string }[] = []
  for (const it of items.slice(0, 12)) {
    const m = it.match(/<title>([\s\S]*?)<\/title>/)
    if (!m) continue
    let title = m[1].replace('<![CDATA[', '').replace(']]>', '').trim()
    // Format Google News: "Headline - Source"
    const dash = title.lastIndexOf(' - ')
    let source = 'News'
    if (dash > 0) { source = title.slice(dash + 3).trim(); title = title.slice(0, dash).trim() }
    if (title) out.push({ text: title, source })
  }
  return out
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return NextResponse.json(cache.data)

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Fitur AI belum aktif — API key Anthropic belum diset' }, { status: 503 })
  }

  try {
    const rss = await fetch(RSS, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
    const xml = await rss.text()
    const headlines = parseHeadlines(xml)
    if (!headlines.length) throw new Error('Tidak ada headline ditemukan')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const list = headlines.map((h, i) => `${i + 1}. [${h.source}] ${h.text}`).join('\n')

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 900,
      system: `Kamu analis pasar emas (XAU/USD) senior. Analisa sentimen dari kumpulan headline berita finansial terhadap ARAH HARGA EMAS.

Ingat korelasi kunci: dolar/yield naik = bearish emas; ekspektasi pemangkasan suku bunga Fed / inflasi turun / risk-off / ketegangan geopolitik = bullish emas.

Balas HANYA dengan JSON valid (tanpa teks lain, tanpa markdown fence) dengan bentuk persis:
{"verdict":"Bullish|Bearish|Netral","score":<integer -100..100>,"narrative":"<2-3 kalimat bahasa Indonesia, ringkas, sebutkan pendorong utama>","drivers":["<pendorong 1>","<pendorong 2>","<pendorong 3>"],"headlines":[{"text":"<headline singkat>","source":"<sumber>","sentiment":"bull|bear|neutral"}]}

Untuk "headlines", pilih 4-5 headline paling relevan (terjemahkan singkat ke Indonesia bila perlu, jaga tetap ringkas). Jangan mengarang fakta di luar headline yang diberikan.`,
      messages: [{ role: 'user', content: `Headline (2 hari terakhir):\n${list}` }],
    })

    const raw = msg.content.find(b => b.type === 'text')?.text ?? '{}'
    const jsonStr = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
    const parsed = JSON.parse(jsonStr)
    const data: NewsResult = {
      verdict: parsed.verdict ?? 'Netral',
      score: Math.max(-100, Math.min(100, Math.round(parsed.score ?? 0))),
      narrative: parsed.narrative ?? '',
      drivers: Array.isArray(parsed.drivers) ? parsed.drivers.slice(0, 4) : [],
      headlines: Array.isArray(parsed.headlines) ? parsed.headlines.slice(0, 5) : [],
      fetchedAt: new Date().toISOString(),
    }
    cache = { data, at: now }
    return NextResponse.json(data)
  } catch (err) {
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal analisa' }, { status: 502 })
  }
}
