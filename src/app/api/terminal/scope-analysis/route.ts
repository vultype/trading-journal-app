import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Analisa AI terstruktur per-menu (makro / sentimen) yang FOKUS ke DAMPAK ke XAU/USD.
// Output JSON untuk ditampilkan interaktif: bias % bullish/bearish emas, tiap faktor +
// arah dampaknya ke emas, dan (khusus sentimen) sentimen berita mendukung/menentang.

const RSS = 'https://news.google.com/rss/search?q=gold%20price%20OR%20XAUUSD%20OR%20%22federal%20reserve%22%20OR%20%22US%20dollar%22%20OR%20inflation%20when:2d&hl=en-US&gl=US&ceid=US:en'

function extractJson(raw: string): string {
  const start = raw.indexOf('{'); if (start < 0) throw new Error('tidak ada JSON')
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false }
    else { if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) return raw.slice(start, i + 1) } }
  }
  throw new Error('JSON tidak lengkap')
}
async function headlines(): Promise<string[]> {
  try {
    const xml = await (await fetch(RSS, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })).text()
    const items = xml.split('<item>').slice(1, 13)
    return items.map(it => { const m = it.match(/<title>([\s\S]*?)<\/title>/); if (!m) return ''; return m[1].replace('<![CDATA[', '').replace(']]>', '').trim() }).filter(Boolean)
  } catch { return [] }
}
const dir3 = (v: unknown) => (['bullish', 'bearish', 'netral'].includes(String(v)) ? v : 'netral') as 'bullish' | 'bearish' | 'netral'
const strArr = (v: unknown, n = 5): string[] => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, n) : []
const clampPct = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)))

const FOCUS: Record<string, string> = {
  makro: `FOKUS: DAMPAK MAKRO ke XAU/USD. Untuk tiap faktor makro (Dolar/DXY, yield 10Y & 2Y, kurva 2s10s, real yield, inflasi CPI/Core CPI/Core PCE/breakeven, Fed Funds & arah kebijakan, pengangguran) — tentukan arah dampaknya KE EMAS. Kaidah: dolar/yield naik = bearish emas; inflasi naik / ekspektasi Fed pangkas bunga / real yield turun = bullish emas.`,
  sentimen: `FOKUS: DAMPAK SENTIMEN & POSISI ke XAU/USD. Untuk tiap faktor (risk-on/off dari VIX, S&P500, Nasdaq, BTC; COT institusi/funds vs retail; rasio emas/perak; headline berita) — tentukan arah dampaknya KE EMAS. Kaidah: risk-off/takut (VIX naik, saham turun) = bullish emas; risk-on = bearish emas. Retail sering kontrarian. WAJIB isi sentimenBerita: klasifikasikan headline mana yang MENDUKUNG emas naik vs MENEKAN emas.`,
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Fitur AI belum aktif — ANTHROPIC_API_KEY belum diset' }, { status: 503 })
  try {
    const { scope, snapshot } = await req.json()
    if (!snapshot || typeof snapshot !== 'object') return NextResponse.json({ error: 'snapshot kosong' }, { status: 400 })
    const focus = FOCUS[scope] ?? FOCUS.makro
    const news = scope === 'sentimen' ? await headlines() : []
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    let dataBlock = `SNAPSHOT TERMINAL XAU/USD (real-time):\n${JSON.stringify(snapshot, null, 1)}`
    if (news.length) dataBlock += `\n\nHEADLINE BERITA (2 hari):\n${news.map((h, i) => `${i + 1}. ${h}`).join('\n')}`

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2400,
      system: `Kamu kepala analis XAU/USD. ${focus}

Prinsip: rujuk angka nyata dari snapshot; setiap faktor jelaskan arah dampaknya KE EMAS (bullish=emas naik). Bedakan data vs asumsi. Bahasa Indonesia, mudah dipahami pemula. Fokus utama: DAMPAK BERSIH ke XAU/USD.

Balas HANYA JSON valid (tanpa teks/fence), bentuk persis:
{
 "biasArah":"Bullish|Bearish|Netral",
 "biasBullishPersen":<0-100 porsi bullish emas; sisanya bearish>,
 "confidence":<0-100>,
 "headline":"<1 kalimat: dampak bersih ke XAU/USD, tegas>",
 "dampakXauusd":"<2-3 kalimat: kenapa net-nya bullish/bearish untuk emas, gabungan semua faktor>",
 "faktor":[{"nama":"<parameter>","nilai":"<angka/kondisi dari snapshot>","arah":"bullish|bearish|netral","bobot":"Tinggi|Sedang|Rendah","catatan":"<dampak ringkas ke emas>"}],
 "sentimenBerita":{"skor":<-100..100>,"ringkasan":"<1-2 kalimat>","mendukung":["<headline/faktor yang MENDUKUNG emas naik>"],"menentang":["<headline/faktor yang MENEKAN emas>"]},
 "kesimpulan":"<kesimpulan + 1 aksi konkret>",
 "watch":["<yang perlu dipantau>"],
 "risiko":["<risiko utama>"]
}

faktor 4-6 item (arah = dampak ke EMAS). ${scope === 'sentimen' ? 'sentimenBerita WAJIB diisi (mendukung & menentang 1-4 item).' : 'sentimenBerita boleh dikosongkan (mendukung/menentang array kosong) untuk scope makro.'} watch 2-3, risiko 2-3. Semua berbasis data yang diberikan, jangan mengarang angka.`,
      messages: [{ role: 'user', content: dataBlock }],
    })

    const raw = msg.content.find(b => b.type === 'text')?.text ?? '{}'
    const p = JSON.parse(extractJson(raw))
    const result = {
      scope: scope === 'sentimen' ? 'sentimen' : 'makro',
      biasArah: ['Bullish', 'Bearish'].includes(p.biasArah) ? p.biasArah : 'Netral',
      biasBullishPersen: clampPct(p.biasBullishPersen),
      confidence: clampPct(p.confidence),
      headline: String(p.headline ?? ''),
      dampakXauusd: String(p.dampakXauusd ?? ''),
      faktor: Array.isArray(p.faktor) ? p.faktor.slice(0, 6).map((f: { nama?: string; nilai?: string; arah?: string; bobot?: string; catatan?: string }) => ({ nama: String(f.nama ?? ''), nilai: String(f.nilai ?? ''), arah: dir3(f.arah), bobot: ['Tinggi', 'Sedang', 'Rendah'].includes(f.bobot ?? '') ? f.bobot : 'Sedang', catatan: String(f.catatan ?? '') })) : [],
      sentimenBerita: {
        skor: Math.max(-100, Math.min(100, Math.round(Number(p.sentimenBerita?.skor) || 0))),
        ringkasan: String(p.sentimenBerita?.ringkasan ?? ''),
        mendukung: strArr(p.sentimenBerita?.mendukung, 4),
        menentang: strArr(p.sentimenBerita?.menentang, 4),
      },
      kesimpulan: String(p.kesimpulan ?? ''),
      watch: strArr(p.watch, 3),
      risiko: strArr(p.risiko, 3),
      fetchedAt: new Date().toISOString(),
    }
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal menganalisa' }, { status: 502 })
  }
}
