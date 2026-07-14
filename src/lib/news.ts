// Agregator berita multi-sumber (RSS resmi, gratis) untuk analisa sentimen emas.
// Sumber: Google News (search luas), Federal Reserve (statement resmi), Investing.com
// (komoditas & futures), Forexlive (news desk forex real-time). Dedup + filter relevansi
// + cache bersama supaya semua panel AI & tampilan berita pakai data yang sama.

export type Headline = { text: string; source: string; link: string; time: string; ts: number }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

const FEEDS: { name: string; url: string; filter: boolean; max: number }[] = [
  { name: 'Google', url: 'https://news.google.com/rss/search?q=gold%20price%20OR%20XAUUSD%20OR%20%22federal%20reserve%22%20OR%20%22US%20dollar%22%20OR%20inflation%20when:2d&hl=en-US&gl=US&ceid=US:en', filter: false, max: 8 },
  { name: 'Fed', url: 'https://www.federalreserve.gov/feeds/press_monetary.xml', filter: false, max: 3 },
  { name: 'Investing', url: 'https://www.investing.com/rss/news_11.rss', filter: true, max: 6 },
  { name: 'Forexlive', url: 'https://www.forexlive.com/feed/news', filter: true, max: 6 },
]

// Kata kunci relevan emas/makro untuk menyaring feed yang cakupannya luas (Investing/Forexlive)
const KW = /gold|xau|silver|metal|bullion|\bfed\b|fomc|powell|rate.?cut|rate.?hike|\brates?\b|yield|treasur|dollar|\bdxy\b|inflation|\bcpi\b|\bpce\b|payroll|\bnfp\b|\bjobs\b|unemploy|\becb\b|\bboj\b|safe.?haven|geopolit|tariff|\bwar\b|sanction|crude|oil/i

let cache: { data: Headline[]; at: number } | null = null
const TTL = 5 * 60_000

const decode = (s: string) => s.replace('<![CDATA[', '').replace(']]>', '')
  .replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#821[67];/g, "'").replace(/&#822[01];/g, '"').replace(/\s+/g, ' ').trim()
const pick = (b: string, tag: string) => { const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? decode(m[1]) : '' }
function parseTs(pub: string): number { let t = Date.parse(pub); if (isNaN(t)) t = Date.parse(pub.replace(' ', 'T') + 'Z'); return isNaN(t) ? 0 : t }
function ago(ts: number): string { if (!ts) return ''; const m = Math.floor((Date.now() - ts) / 60000); if (m < 1) return 'baru'; if (m < 60) return `${m}m lalu`; const h = Math.floor(m / 60); if (h < 24) return `${h}j lalu`; return `${Math.floor(h / 24)}h lalu` }

async function fetchFeed(f: (typeof FEEDS)[number]): Promise<Headline[]> {
  try {
    const res = await fetch(f.url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml,application/xml,text/xml' }, cache: 'no-store', signal: AbortSignal.timeout(9000) })
    const xml = await res.text()
    const blocks = xml.split(/<item[\s>]/).slice(1)
    const out: Headline[] = []
    for (const raw of blocks) {
      const b = raw.split('</item>')[0]
      let title = pick(b, 'title'); if (!title) continue
      let source = f.name
      if (f.name === 'Google') { const d = title.lastIndexOf(' - '); if (d > 0) { source = title.slice(d + 3).trim(); title = title.slice(0, d).trim() } }
      if (f.filter && !KW.test(title)) continue
      const link = pick(b, 'link')
      const ts = parseTs(pick(b, 'pubDate'))
      out.push({ text: title, source, link, ts, time: ago(ts) })
      if (out.length >= f.max) break
    }
    return out
  } catch { return [] }
}

// Semua headline gabungan: dedup by judul, urut terbaru dulu, cache 5 menit.
export async function fetchNews(): Promise<Headline[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.data
  const all = (await Promise.all(FEEDS.map(fetchFeed))).flat()
  const seen = new Set<string>(); const uniq: Headline[] = []
  for (const h of all) {
    const k = h.text.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50)
    if (!k || seen.has(k)) continue
    seen.add(k); uniq.push(h)
  }
  uniq.sort((a, b) => b.ts - a.ts)
  if (uniq.length) cache = { data: uniq, at: Date.now() }
  return uniq.length ? uniq : (cache?.data ?? [])
}

// Baris headline untuk prompt AI: "[Sumber] judul" — supaya AI tahu asal berita.
export async function fetchHeadlineLines(n = 18): Promise<string[]> {
  const news = await fetchNews()
  return news.slice(0, n).map(h => `[${h.source}] ${h.text}`)
}
