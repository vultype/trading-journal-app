import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Analisa AI terminal per-menu (teknikal / makro / sentimen) + analisa dampak berita.
// Client kirim snapshot terminal lengkap + scope + prompt opsional. Balas Markdown.
// Untuk scope 'news', server juga menarik headline berita real (Google News RSS).

const RSS = 'https://news.google.com/rss/search?q=gold%20price%20OR%20XAUUSD%20OR%20%22federal%20reserve%22%20OR%20%22US%20dollar%22%20OR%20inflation%20when:2d&hl=en-US&gl=US&ceid=US:en'

async function headlines(): Promise<string[]> {
  try {
    const xml = await (await fetch(RSS, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })).text()
    const items = xml.split('<item>').slice(1, 11)
    return items.map(it => { const m = it.match(/<title>([\s\S]*?)<\/title>/); if (!m) return ''; return m[1].replace('<![CDATA[', '').replace(']]>', '').trim() }).filter(Boolean)
  } catch { return [] }
}

const FOCUS: Record<string, string> = {
  teknikal: `FOKUS: ANALISA TEKNIKAL murni. Bahas price action, EMA9/EMA21 & VWAP, RSI/MACD/Stochastic/Bollinger (%B & squeeze), ADX & arah tren (+DI/-DI), struktur pasar (HH/HL), konfluensi antar timeframe (M5/M15/H1), serta pivot & level kunci. Simpulkan bias arah + zona entry, stop, dan target yang logis dari level yang ada. Abaikan makro kecuali relevan.`,
  makro: `FOKUS: ANALISA MAKRO/FUNDAMENTAL. Bahas dolar (DXY), yield 2Y/10Y & kurva 2s10s (inversi/normal), real yield, inflasi (CPI, Core CPI, Core PCE, ekspektasi/breakeven), Fed Funds & arah kebijakan Fed, pengangguran. Jelaskan implikasi masing-masing ke EMAS (dolar/yield naik = tekan emas; inflasi naik/ekspektasi pangkas bunga = dukung emas). Simpulkan bias makro.`,
  sentimen: `FOKUS: ANALISA SENTIMEN & POSITIONING. Bahas risk-on/off (VIX, S&P500, Nasdaq, BTC), COT (institusi/funds vs retail — retail sering kontrarian), rasio emas/perak, dan headline berita terkini. Nilai apakah aliran sentimen sedang mendukung atau menekan emas, dan waspadai titik ekstrem.`,
  news: `FOKUS: ANALISA DAMPAK BERITA/RILIS DATA ke XAU/USD. Sebuah rilis (mis. CPI) bisa punya BEBERAPA KOMPONEN sekaligus (mis. CPI YoY, Core CPI YoY, CPI MoM, Core CPI MoM) — masing-masing dengan forecast & previous. Tugasmu:
(1) PRIORITAS KOMPONEN: jelaskan komponen mana yang PALING dipantau pasar/Fed untuk emas dan kenapa (kaidah umum: Core (inti, ex food & energy) > headline; YoY = tren struktural yang jadi acuan kebijakan Fed; MoM = momentum/kejutan terbaru yang sering menggerakkan harga saat rilis. Untuk NFP: angka NFP & Average Hourly Earnings paling berdampak). Beri urutan bobotnya.
(2) BIAS ARAH kemungkinan (Bullish/Bearish/Tergantung) + alasan, mempertimbangkan SEMUA komponen. Kalau antar komponen bertentangan (mis. MoM panas tapi YoY dingin), jelaskan mana yang menang & kenapa.
(3) SKENARIO reaksi emas: data DI ATAS ekspektasi vs DI BAWAH ekspektasi (inflasi panas = dolar/yield naik = bearish emas; inflasi dingin = bullish emas). Kalau ada kolom Aktual terisi, analisa reaksi berdasarkan aktual vs forecast.
(4) LEVEL kunci saat rilis. (5) REKOMENDASI: entry sebelum/sesudah rilis atau tunggu. GABUNGKAN dengan kondisi makro/teknikal/sentimen terkini dari snapshot & headline berita.`,
}

const SYSTEM = `Kamu kepala analis (Head of Research) XAU/USD di sebuah trading desk. Kamu diberi SNAPSHOT DATA TERMINAL real-time (harga, teknikal multi-timeframe, makro FRED, sentimen/lintas-aset, COT). Jawaban harus tajam, berbasis angka dari snapshot, jujur soal ketidakpastian, dan actionable.

Aturan:
- Rujuk angka spesifik dari snapshot (harga, RSI, ADX, yield, dolar, dll). Jangan mengarang angka yang tidak ada.
- Bahasa Indonesia, format Markdown ('## ' judul bagian, '- ' poin, '**tebal**' untuk penekanan). Padat, langsung ke inti.
- Selalu bedakan: apa yang data tunjukkan vs asumsi. Kalau data kurang, katakan.
- Tutup dengan kesimpulan arah (Bullish/Bearish/Netral) + 1-2 aksi konkret.
- Ini alat bantu analisa, bukan nasihat keuangan.`

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Fitur AI belum aktif — ANTHROPIC_API_KEY belum diset' }, { status: 503 })
  try {
    const { scope, snapshot, extra, prompt, mode } = await req.json()
    if (!snapshot || typeof snapshot !== 'object') return NextResponse.json({ error: 'snapshot kosong' }, { status: 400 })
    const focus = FOCUS[scope] ?? FOCUS.teknikal

    const news = scope === 'news' ? await headlines() : []
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    let dataBlock = `SNAPSHOT TERMINAL XAU/USD (real-time):\n${JSON.stringify(snapshot, null, 1)}`
    if (scope === 'news') {
      const ev = extra ?? {}
      type Row = { label?: string; forecast?: string; previous?: string; actual?: string }
      const rows: Row[] = Array.isArray(ev.rows) ? ev.rows.filter((r: Row) => r && (r.label || r.forecast || r.previous || r.actual)) : []
      const rowsText = rows.length
        ? rows.map((r: Row) => `  • ${r.label || '(komponen)'}: forecast ${r.forecast || '-'}, previous ${r.previous || '-'}, aktual ${r.actual || '-'}`).join('\n')
        : '  • (tidak ada rincian komponen)'
      dataBlock += `\n\nEVENT/RILIS YANG DIANALISA:\n- Nama: ${ev.event || '(tidak disebut)'}\n- Komponen data:\n${rowsText}\n- Catatan: ${ev.notes || '-'}`
      if (news.length) dataBlock += `\n\nHEADLINE BERITA (2 hari):\n${news.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    }

    const isCustom = mode === 'custom' && typeof prompt === 'string' && prompt.trim().length > 0
    const instruction = isCustom
      ? `${focus}\n\nPERTANYAAN TRADER: "${prompt.trim()}"\nJawab spesifik berdasarkan data di atas.`
      : `${focus}\n\nBuat analisa fokus sesuai scope di atas, ringkas & terstruktur.`

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2200,
      system: SYSTEM,
      messages: [{ role: 'user', content: `${dataBlock}\n\n${instruction}` }],
    })

    const text = msg.content.find(b => b.type === 'text')?.text ?? ''
    if (!text.trim()) throw new Error('AI tidak mengembalikan jawaban')
    return NextResponse.json({ text, scope, mode: isCustom ? 'custom' : 'auto', at: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal menganalisa' }, { status: 502 })
  }
}
