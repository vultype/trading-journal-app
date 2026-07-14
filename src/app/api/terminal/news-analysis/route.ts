import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Analisa dampak berita/rilis data ke XAU/USD — output TERSTRUKTUR (JSON) untuk
// ditampilkan interaktif: bias %, rekomendasi pre-news, skenario, sentimen berita
// (headline mendukung vs menentang), ringkasan makro & teknikal. Menggabungkan
// snapshot terminal lengkap + komponen rilis + headline berita real.

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

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Fitur AI belum aktif — ANTHROPIC_API_KEY belum diset' }, { status: 503 })
  try {
    const { snapshot, event, rows, notes } = await req.json()
    if (!snapshot || typeof snapshot !== 'object') return NextResponse.json({ error: 'snapshot kosong' }, { status: 400 })
    if (!event || !String(event).trim()) return NextResponse.json({ error: 'nama event kosong' }, { status: 400 })

    const news = await headlines()
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    type Row = { label?: string; forecast?: string; previous?: string; actual?: string }
    const validRows: Row[] = Array.isArray(rows) ? rows.filter((r: Row) => r && (r.label || r.forecast || r.previous || r.actual)) : []
    const rowsText = validRows.length
      ? validRows.map((r: Row) => `  • ${r.label || '(komponen)'}: forecast ${r.forecast || '-'}, previous ${r.previous || '-'}, aktual ${r.actual || '-'}`).join('\n')
      : '  • (tidak ada rincian komponen)'

    const dataBlock = `SNAPSHOT TERMINAL XAU/USD (real-time):
${JSON.stringify(snapshot, null, 1)}

EVENT/RILIS YANG DIANALISA: ${event}
Komponen data:
${rowsText}
Catatan trader: ${notes || '-'}

HEADLINE BERITA (2 hari terakhir):
${news.length ? news.map((h, i) => `${i + 1}. ${h}`).join('\n') : '(tidak ada headline)'}`

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 3000,
      system: `Kamu kepala analis (Head of Research) XAU/USD di trading desk. Tugasmu: analisa DAMPAK sebuah rilis data ekonomi ke harga emas, dengan MENGGABUNGKAN semua parameter: snapshot teknikal & makro real-time, komponen rilis (bisa banyak: MoM/YoY/Core), dan headline berita.

Prinsip:
- Trader akan MENGAMBIL POSISI SEBELUM rilis, jadi beri rekomendasi arah (LONG/SHORT/TUNGGU) yang tegas untuk pre-news, TAPI selalu sertakan peringatan risiko masuk sebelum berita (whipsaw, spread melebar, gap).
- Prioritas komponen: Core (inti) > headline; YoY = acuan struktural Fed; MoM = momentum/kejutan yang menggerakkan harga saat rilis. Untuk NFP: angka NFP & Average Hourly Earnings paling berdampak. Kalau komponen bertentangan, tentukan mana yang menang.
- Inflasi/data panas (di atas ekspektasi) → dolar & yield naik → BEARISH emas. Data dingin → BULLISH emas. Risk-off → bullish emas.
- Klasifikasikan headline: mana yang MENDUKUNG emas naik vs MENEKAN emas.
- Rujuk angka nyata dari snapshot (harga, VWAP, pivot, RSI, ADX, yield, dolar, real yield, dsb). Jangan mengarang angka.
- Bahasa Indonesia, ringkas, mudah dipahami pemula.

Balas HANYA JSON valid (tanpa teks/markdown fence), bentuk persis:
{
 "biasArah":"Bullish|Bearish|Netral",
 "biasBullishPersen":<0-100, porsi bullish; sisanya bearish>,
 "confidence":<0-100>,
 "headline":"<1 kalimat kesimpulan tegas>",
 "ringkasan":"<2-3 kalimat eksekutif gabungan semua faktor>",
 "rekomendasiPreNews":{"aksi":"LONG|SHORT|TUNGGU","alasan":"<kenapa, tegas>","entry":"<zona/kondisi entry sebelum rilis>","sl":"<level/logika stop>","tp":"<target>","peringatan":"<risiko masuk sebelum berita>"},
 "prioritasKomponen":[{"komponen":"<nama komponen rilis>","bobot":"Tinggi|Sedang|Rendah","arah":"bullish|bearish|netral","catatan":"<1 frasa>"}],
 "skenario":[{"nama":"<mis. Data Panas / Dingin / Sesuai>","kondisi":"<syarat>","arahEmas":"bullish|bearish|netral","probabilitas":<0-100>,"reaksi":"<reaksi emas>","level":"<level target/kunci>"}],
 "sentimenBerita":{"skor":<-100..100>,"ringkasan":"<1-2 kalimat>","mendukung":["<headline/faktor yang MENDUKUNG emas naik>"],"menentang":["<headline/faktor yang MENEKAN emas>"]},
 "makro":[{"nama":"<mis. Dolar (DXY)>","nilai":"<angka/kondisi>","arah":"bullish|bearish|netral","catatan":"<dampak ke emas>"}],
 "teknikal":[{"nama":"<mis. Tren H1>","nilai":"<kondisi/angka>","arah":"bullish|bearish|netral","catatan":"<makna>"}],
 "levelKunci":{"resistance":["<level>"],"support":["<level>"]},
 "risiko":["<risiko utama>"]
}

prioritasKomponen 2-4 item. skenario TEPAT 3 (panas/dingin/sesuai), probabilitas total ~100. sentimenBerita.mendukung & menentang masing-masing 1-4. makro 3-5 item, teknikal 3-5 item. risiko 2-3. arah untuk emas dari sudut pandang: bullish=emas naik. Semua berbasis data yang diberikan.`,
      messages: [{ role: 'user', content: dataBlock }],
    })

    const raw = msg.content.find(b => b.type === 'text')?.text ?? '{}'
    const p = JSON.parse(extractJson(raw))
    const item = (x: { nama?: string; nilai?: string; arah?: string; catatan?: string }) => ({ nama: String(x.nama ?? ''), nilai: String(x.nilai ?? ''), arah: dir3(x.arah), catatan: String(x.catatan ?? '') })

    const result = {
      event: String(event),
      biasArah: ['Bullish', 'Bearish'].includes(p.biasArah) ? p.biasArah : 'Netral',
      biasBullishPersen: clampPct(p.biasBullishPersen),
      confidence: clampPct(p.confidence),
      headline: String(p.headline ?? ''),
      ringkasan: String(p.ringkasan ?? ''),
      rekomendasiPreNews: {
        aksi: ['LONG', 'SHORT', 'TUNGGU'].includes(p.rekomendasiPreNews?.aksi) ? p.rekomendasiPreNews.aksi : 'TUNGGU',
        alasan: String(p.rekomendasiPreNews?.alasan ?? ''),
        entry: String(p.rekomendasiPreNews?.entry ?? ''),
        sl: String(p.rekomendasiPreNews?.sl ?? ''),
        tp: String(p.rekomendasiPreNews?.tp ?? ''),
        peringatan: String(p.rekomendasiPreNews?.peringatan ?? ''),
      },
      prioritasKomponen: Array.isArray(p.prioritasKomponen) ? p.prioritasKomponen.slice(0, 4).map((c: { komponen?: string; bobot?: string; arah?: string; catatan?: string }) => ({ komponen: String(c.komponen ?? ''), bobot: ['Tinggi', 'Sedang', 'Rendah'].includes(c.bobot ?? '') ? c.bobot : 'Sedang', arah: dir3(c.arah), catatan: String(c.catatan ?? '') })) : [],
      skenario: Array.isArray(p.skenario) ? p.skenario.slice(0, 3).map((s: { nama?: string; kondisi?: string; arahEmas?: string; probabilitas?: number; reaksi?: string; level?: string }) => ({ nama: String(s.nama ?? ''), kondisi: String(s.kondisi ?? ''), arahEmas: dir3(s.arahEmas), probabilitas: clampPct(s.probabilitas), reaksi: String(s.reaksi ?? ''), level: String(s.level ?? '') })) : [],
      sentimenBerita: {
        skor: Math.max(-100, Math.min(100, Math.round(Number(p.sentimenBerita?.skor) || 0))),
        ringkasan: String(p.sentimenBerita?.ringkasan ?? ''),
        mendukung: strArr(p.sentimenBerita?.mendukung, 4),
        menentang: strArr(p.sentimenBerita?.menentang, 4),
      },
      makro: Array.isArray(p.makro) ? p.makro.slice(0, 5).map(item) : [],
      teknikal: Array.isArray(p.teknikal) ? p.teknikal.slice(0, 5).map(item) : [],
      levelKunci: { resistance: strArr(p.levelKunci?.resistance, 4), support: strArr(p.levelKunci?.support, 4) },
      risiko: strArr(p.risiko, 3),
      fetchedAt: new Date().toISOString(),
    }
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal menganalisa' }, { status: 502 })
  }
}
