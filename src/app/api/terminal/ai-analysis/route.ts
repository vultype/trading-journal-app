import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { fetchHeadlineLines } from '@/lib/news'

// Analisa AI MENYELURUH: gabungkan seluruh data terminal (teknikal, makro, COT, BTC)
// + headline berita multi-sumber → Claude susun analisa lengkap. On-demand (POST).

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

const arr = (v: unknown, n = 4): string[] => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, n) : []

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Fitur AI belum aktif — API key Anthropic belum diset' }, { status: 503 })
  try {
    const snap = await req.json()
    const userPrompt = typeof snap.userPrompt === 'string' ? snap.userPrompt.trim() : ''
    const news = await fetchHeadlineLines()
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const dataBlock = `DATA TERMINAL XAU/USD (real-time):
- Harga: ${snap.price} (${snap.changePct >= 0 ? '+' : ''}${snap.changePct}%), sesi ${snap.session}, volatilitas ${snap.volatility}
- Signal gabungan: ${snap.signal?.label} (skor ${snap.signal?.overall}, confidence ${snap.signal?.confidence}%) | pilar Makro ${snap.signal?.macro} Teknikal ${snap.signal?.tech} Sentimen ${snap.signal?.senti}
- Regime pasar: ${snap.regime} | Momentum komposit ${snap.momentum} | Bollinger squeeze: ${snap.bbSqueeze ? 'ya' : 'tidak'} | Sentimen risiko: ${snap.riskSentiment}
- Teknikal per timeframe (bias/RSI/MACD/Stoch%K/struktur): M5 ${snap.tf?.M5?.bias}/${snap.tf?.M5?.rsi}/${snap.tf?.M5?.macd}/${snap.tf?.M5?.stoch}/${snap.tf?.M5?.struktur}, M15 ${snap.tf?.M15?.bias}/${snap.tf?.M15?.rsi}/${snap.tf?.M15?.macd}/${snap.tf?.M15?.stoch}/${snap.tf?.M15?.struktur}, H1 ${snap.tf?.H1?.bias}/${snap.tf?.H1?.rsi}/${snap.tf?.H1?.macd}/${snap.tf?.H1?.stoch}/${snap.tf?.H1?.struktur}; ADX ${snap.adx} (${snap.trendDir}); ATR M15 ${snap.atrM15}; VWAP M15 ${snap.vwapM15}
- Bias timeframe BESAR (filter arah, jangan lawan tren ini): H4 ${snap.biasTFbesar?.H4 ? `${snap.biasTFbesar.H4.bias}/RSI${snap.biasTFbesar.H4.rsi}/${snap.biasTFbesar.H4.struktur}` : 'belum tersedia'}, Daily ${snap.biasTFbesar?.D1 ? `${snap.biasTFbesar.D1.bias}/RSI${snap.biasTFbesar.D1.rsi}/${snap.biasTFbesar.D1.struktur}` : 'belum tersedia'}
- Pivot: P ${snap.pivots?.P}, R1 ${snap.pivots?.R1}, R2 ${snap.pivots?.R2}, S1 ${snap.pivots?.S1}, S2 ${snap.pivots?.S2}
- Makro (FRED): Indeks Dolar ${snap.macro?.dollar?.value} (prior ${snap.macro?.dollar?.prior}), US10Y ${snap.macro?.us10y?.value}%, US2Y ${snap.macro?.us02y?.value}%, Yield Curve 2s10s ${snap.yieldCurve2s10}%, Real Yield ${snap.macro?.realyield?.value}%, Ekspektasi Inflasi(breakeven) ${snap.macro?.breakeven?.value}%, CPI ${snap.macro?.cpi?.value}%, Core CPI ${snap.macro?.corecpi?.value}%, Core PCE ${snap.macro?.corepce?.value}%, Fed Funds ${snap.macro?.fedfunds?.value}%, Pengangguran ${snap.macro?.unrate?.value}%, NFP(perubahan bulanan) ${snap.macro?.nfp?.value}K (prior ${snap.macro?.nfp?.prior}K), Pertumbuhan Upah(YoY) ${snap.macro?.wagegrowth?.value}%
- COT (${snap.cot?.date}): Funds/institusi net ${snap.cot?.funds?.net} (Δ${snap.cot?.funds?.deltaNet}), Commercials net ${snap.cot?.commercials?.net}, Retail net ${snap.cot?.retail?.net} (Δ${snap.cot?.retail?.deltaNet})
- Rasio Emas/Perak (XAU/XAG): ${snap.goldSilverRatio}
- Bitcoin: ${snap.btc?.price} (${snap.btc?.changePct}%)
- Aset risiko real-time (Twelve Data): S&P 500 ${snap.riskAssets?.spy}%, Nasdaq 100 ${snap.riskAssets?.qqq}%, VIX (proxy ETF) ${snap.riskAssets?.vix}%, Dolar real-time (proxy UUP) ${snap.riskAssets?.dollarRealtime}%
HEADLINE BERITA (2 hari):
${news.map((h, i) => `${i + 1}. ${h}`).join('\n')}${userPrompt ? `\n\nKONTEKS/PERMINTAAN DARI TRADER (WAJIB dipertimbangkan & disesuaikan dalam analisa & keputusan): "${userPrompt}"` : ''}`

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2600,
      system: `Kamu kepala analis (Head of Research) XAU/USD di sebuah trading desk. Susun ANALISA MENYELURUH yang menggabungkan TEKNIKAL, MAKRO, dan SENTIMEN dari data terminal yang diberikan.

Prinsip: dolar/yield naik = bearish emas; inflasi mereda / ekspektasi pemangkasan Fed / risk-off / geopolitik / dolar melemah = bullish emas. COT: institusi (funds) & commercials adalah smart money, retail sering kontrarian. Bias timeframe BESAR (H4/Daily) adalah FILTER arah: kalau keputusan (BELI/JUAL) berlawanan dengan bias H4/Daily, turunkan conviction dan sebutkan risikonya secara eksplisit di keputusanAlasan atau risks — jangan diam-diam mengabaikannya.

Tugasmu: bantu trader mengambil KEPUTUSAN terbaik. Tegas, berbasis data, dan jelaskan "kenapa".

Balas HANYA JSON valid (tanpa teks/markdown fence), bentuk persis:
{
 "verdict":"Bullish|Bearish|Netral",
 "confidence":<0..100>,
 "keputusan":"BELI|JUAL|TUNGGU",
 "keputusanAlasan":"<1-2 kalimat kenapa keputusan itu, tegas>",
 "conviction":"Tinggi|Sedang|Rendah",
 "headline":"<1 kalimat kesimpulan utama yang tegas>",
 "executive":"<ringkasan eksekutif 2-3 kalimat menggabungkan semua faktor>",
 "confluence":[{"faktor":"<Konfluensi TF | Dolar & Yield | Inflasi/Fed | COT | VIX/Risk | Berita>","arah":"bullish|bearish|netral","catatan":"<1 frasa singkat>"}],
 "technical":"<analisa teknikal: konfluensi TF, RSI, ADX/kekuatan tren, posisi vs VWAP, level pivot penting>",
 "macro":"<analisa makro: dolar, yield, inflasi, arah kebijakan Fed & implikasinya ke emas>",
 "sentiment":"<analisa sentimen: berita terkini + posisi COT (retail vs institusi) + VIX/saham + BTC>",
 "levelKunci":{"support":"<level/zona support terdekat>","resistance":"<level/zona resistance terdekat>"},
 "chartLevels":{"entry":<angka harga entry, atau null>,"sl":<angka harga SL, atau null>,"tp":<angka harga TP, atau null>,"support":<angka harga support terdekat, atau null>,"resistance":<angka harga resistance terdekat, atau null>},
 "plan":{"bias":"Bullish|Bearish|Netral","entry":"<zona/kondisi entry>","sl":"<level/logika SL>","tp":"<target TP>","invalidation":"<kondisi yang membatalkan skenario>"},
 "scenarios":[{"kondisi":"<jika ...>","aksi":"<maka ...>"}],
 "risks":["<risiko utama>"],
 "watch":["<data/event/level yang dipantau>"]
}

confluence 4-6 item (mencakup teknikal, makro, sentimen). scenarios 2, risks 2-3, watch 2-3. Bahasa Indonesia, tegas, informatif, mudah dibaca & membantu keputusan. Berbasis data yang diberikan — jangan mengarang angka. Jika ada KONTEKS/PERMINTAAN DARI TRADER, sesuaikan fokus, gaya (mis. scalping), timeframe, dan rekomendasi dengan permintaan itu tanpa mengabaikan data lain.

PENTING untuk chartLevels: isi dengan ANGKA harga bersih (bukan teks/range), konsisten dengan harga saat ini & pivot yang diberikan, agar bisa digambar sebagai garis di chart. Jika keputusan TUNGGU dan belum ada rencana entry, set entry/sl/tp ke null tapi tetap isi support & resistance dari level terdekat.`,
      messages: [{ role: 'user', content: dataBlock }],
    })

    const raw = msg.content.find(b => b.type === 'text')?.text ?? '{}'
    const p = JSON.parse(extractJson(raw))
    const dec = ['BELI', 'JUAL', 'TUNGGU'].includes(p.keputusan) ? p.keputusan : 'TUNGGU'
    const conv = ['Tinggi', 'Sedang', 'Rendah'].includes(p.conviction) ? p.conviction : 'Sedang'
    const result = {
      verdict: p.verdict === 'Bullish' || p.verdict === 'Bearish' ? p.verdict : 'Netral',
      confidence: Math.max(0, Math.min(100, Math.round(p.confidence ?? 50))),
      keputusan: dec, keputusanAlasan: String(p.keputusanAlasan ?? ''), conviction: conv,
      headline: String(p.headline ?? ''),
      executive: String(p.executive ?? ''),
      confluence: Array.isArray(p.confluence) ? p.confluence.slice(0, 6).map((c: { faktor?: string; arah?: string; catatan?: string }) => ({ faktor: String(c.faktor ?? ''), arah: (['bullish', 'bearish', 'netral'].includes(c.arah ?? '') ? c.arah : 'netral') as 'bullish' | 'bearish' | 'netral', catatan: String(c.catatan ?? '') })) : [],
      technical: String(p.technical ?? ''),
      macro: String(p.macro ?? ''),
      sentiment: String(p.sentiment ?? ''),
      levelKunci: { support: String(p.levelKunci?.support ?? ''), resistance: String(p.levelKunci?.resistance ?? '') },
      chartLevels: (() => { const num = (x: unknown) => { const n = typeof x === 'number' ? x : parseFloat(String(x)); return Number.isFinite(n) && n > 0 ? n : null }; const cl = p.chartLevels ?? {}; return { entry: num(cl.entry), sl: num(cl.sl), tp: num(cl.tp), support: num(cl.support), resistance: num(cl.resistance) } })(),
      plan: { bias: String(p.plan?.bias ?? '—'), entry: String(p.plan?.entry ?? ''), sl: String(p.plan?.sl ?? ''), tp: String(p.plan?.tp ?? ''), invalidation: String(p.plan?.invalidation ?? '') },
      scenarios: Array.isArray(p.scenarios) ? p.scenarios.slice(0, 3).map((s: { kondisi?: string; aksi?: string }) => ({ kondisi: String(s.kondisi ?? ''), aksi: String(s.aksi ?? '') })) : [],
      risks: arr(p.risks, 3),
      watch: arr(p.watch, 3),
      fetchedAt: new Date().toISOString(),
    }
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal analisa' }, { status: 502 })
  }
}
