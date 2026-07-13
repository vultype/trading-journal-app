import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Headline emas/dolar/Fed dari Google News RSS (gratis) → Claude olah jadi analisa
// sentimen LENGKAP. On-demand (tombol), cache 10 menit.

const RSS = 'https://news.google.com/rss/search?q=gold%20price%20OR%20XAUUSD%20OR%20%22federal%20reserve%22%20OR%20%22US%20dollar%22%20OR%20inflation%20when:2d&hl=en-US&gl=US&ceid=US:en'

type NewsResult = {
  verdict: 'Bullish' | 'Bearish' | 'Netral'
  score: number
  summary: string
  analysis: string
  drivers: { text: string; impact: 'bull' | 'bear' | 'neutral' }[]
  risks: string[]
  watch: string[]
  timeframe: { short: string; medium: string }
  headlines: { text: string; source: string; sentiment: 'bull' | 'bear' | 'neutral' }[]
  fetchedAt: string
}

let cache: { data: NewsResult; at: number } | null = null
const TTL_MS = 10 * 60_000

function parseHeadlines(xml: string): { text: string; source: string }[] {
  const items = xml.split('<item>').slice(1)
  const out: { text: string; source: string }[] = []
  for (const it of items.slice(0, 14)) {
    const m = it.match(/<title>([\s\S]*?)<\/title>/)
    if (!m) continue
    let title = m[1].replace('<![CDATA[', '').replace(']]>', '').trim()
    const dash = title.lastIndexOf(' - ')
    let source = 'News'
    if (dash > 0) { source = title.slice(dash + 3).trim(); title = title.slice(0, dash).trim() }
    if (title) out.push({ text: title, source })
  }
  return out
}

// Ekstraksi JSON robust: scan brace berimbang, hormati string & escape (buang teks di luar objek)
function extractJson(raw: string): string {
  const start = raw.indexOf('{')
  if (start < 0) throw new Error('tidak ada JSON')
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false }
    else { if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) return raw.slice(start, i + 1) } }
  }
  throw new Error('JSON tidak lengkap')
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return NextResponse.json(cache.data)
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Fitur AI belum aktif — API key Anthropic belum diset' }, { status: 503 })

  try {
    const rss = await fetch(RSS, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
    const headlines = parseHeadlines(await rss.text())
    if (!headlines.length) throw new Error('Tidak ada headline ditemukan')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const list = headlines.map((h, i) => `${i + 1}. [${h.source}] ${h.text}`).join('\n')

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1600,
      system: `Kamu analis pasar emas (XAU/USD) institusional. Analisa kumpulan headline berita finansial dan susun pandangan menyeluruh terhadap ARAH HARGA EMAS.

Korelasi kunci: dolar/yield naik = bearish emas; ekspektasi pemangkasan suku bunga Fed / inflasi mereda / risk-off / ketegangan geopolitik / pelemahan dolar = bullish emas.

Balas HANYA JSON valid (tanpa teks pembuka/penutup, tanpa markdown fence) dengan bentuk persis:
{
 "verdict": "Bullish|Bearish|Netral",
 "score": <integer -100..100>,
 "summary": "<1-2 kalimat inti>",
 "analysis": "<1 paragraf analisa lebih dalam: kaitkan dolar, yield, kebijakan Fed, inflasi, geopolitik>",
 "drivers": [{"text":"<pendorong>","impact":"bull|bear|neutral"}],
 "risks": ["<risiko terhadap pandangan ini>"],
 "watch": ["<data/level/event yang perlu dipantau>"],
 "timeframe": {"short":"Bullish|Bearish|Netral — <alasan singkat>","medium":"Bullish|Bearish|Netral — <alasan singkat>"},
 "headlines": [{"text":"<headline singkat, terjemah ID bila perlu>","source":"<sumber>","sentiment":"bull|bear|neutral"}]
}

drivers 3-4 item, risks 2-3, watch 2-3, headlines 4-5 paling relevan. Bahasa Indonesia. Jangan mengarang fakta di luar headline.`,
      messages: [{ role: 'user', content: `Headline (2 hari terakhir):\n${list}` }],
    })

    const raw = msg.content.find(b => b.type === 'text')?.text ?? '{}'
    const p = JSON.parse(extractJson(raw))
    const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 4) : []
    const data: NewsResult = {
      verdict: p.verdict === 'Bullish' || p.verdict === 'Bearish' ? p.verdict : 'Netral',
      score: Math.max(-100, Math.min(100, Math.round(p.score ?? 0))),
      summary: String(p.summary ?? ''),
      analysis: String(p.analysis ?? ''),
      drivers: Array.isArray(p.drivers) ? p.drivers.slice(0, 4).map((d: { text?: string; impact?: string }) => ({ text: String(d.text ?? ''), impact: (['bull', 'bear', 'neutral'].includes(d.impact ?? '') ? d.impact : 'neutral') as 'bull' | 'bear' | 'neutral' })) : [],
      risks: arr(p.risks).slice(0, 3),
      watch: arr(p.watch).slice(0, 3),
      timeframe: { short: String(p.timeframe?.short ?? ''), medium: String(p.timeframe?.medium ?? '') },
      headlines: Array.isArray(p.headlines) ? p.headlines.slice(0, 5).map((h: { text?: string; source?: string; sentiment?: string }) => ({ text: String(h.text ?? ''), source: String(h.source ?? 'News'), sentiment: (['bull', 'bear', 'neutral'].includes(h.sentiment ?? '') ? h.sentiment : 'neutral') as 'bull' | 'bear' | 'neutral' })) : [],
      fetchedAt: new Date().toISOString(),
    }
    cache = { data, at: now }
    return NextResponse.json(data)
  } catch (err) {
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal analisa' }, { status: 502 })
  }
}
