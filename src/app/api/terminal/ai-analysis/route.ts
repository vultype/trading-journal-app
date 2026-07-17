import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { fetchHeadlineLines } from '@/lib/news'
import { getAccuracy, getLastAiAnalysis, setLastAiAnalysis } from '@/lib/alert-state'
import { beginAiCharge } from '@/lib/credits-server'

// Analisa AI MENYELURUH: gabungkan seluruh data terminal (teknikal, makro, COT, BTC)
// + headline berita multi-sumber → Datalitiq AI susun analisa lengkap. On-demand (POST).
// Upgrade akurasi: candle mentah (price action), kalender ekonomi (news guard),
// track-record kalibrasi, post-mortem analisa sebelumnya, rubric conviction,
// ringkasan berita (model kecil), dan extended thinking.

// ── Kalender ekonomi (USD High) — cache modul 30 menit ──
type CalEv = { title: string; time: number }
let calCache: { data: CalEv[]; at: number } | null = null
async function upcomingUsdHigh(now: number): Promise<CalEv[]> {
  try {
    if (!calCache || now - calCache.at > 30 * 60_000) {
      const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0 (DatalitiqTerminal)' } })
      if (!res.ok) return calCache?.data ?? []
      const j = (await res.json()) as { title?: string; country?: string; date?: string; impact?: string }[]
      calCache = {
        at: now,
        data: j.filter(e => e.country === 'USD' && e.impact === 'High' && e.date && e.title)
          .map(e => ({ title: e.title!, time: new Date(e.date!).getTime() }))
          .filter(e => Number.isFinite(e.time)).sort((a, b) => a.time - b.time),
      }
    }
    return calCache.data.filter(e => e.time > now - 60 * 60_000).slice(0, 3)
  } catch { return [] }
}

// ── Ringkasan berita via model kecil (murah) — cache modul 10 menit ──
let newsSumCache: { text: string; at: number } | null = null
async function summarizeNews(anthropic: Anthropic, lines: string[], now: number): Promise<string> {
  if (!lines.length) return '(tidak ada headline)'
  if (newsSumCache && now - newsSumCache.at < 10 * 60_000) return newsSumCache.text
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: 'Ringkas headline pasar berikut jadi MAKS 5 poin tema terpenting untuk trader XAU/USD (emas). Tiap poin 1 kalimat + tandai arah dampaknya ke emas: [bullish]/[bearish]/[netral]. Bahasa Indonesia. Hanya poin-poin, tanpa pembuka.',
      messages: [{ role: 'user', content: lines.map((h, i) => `${i + 1}. ${h}`).join('\n') }],
    })
    const text = msg.content.find(b => b.type === 'text')?.text?.trim()
    if (text) { newsSumCache = { text, at: now }; return text }
  } catch { /* fallback ke headline mentah */ }
  return lines.slice(0, 12).map((h, i) => `${i + 1}. ${h}`).join('\n')
}

// Format waktu relatif untuk kalender (menit/jam ke depan)
const relMin = (ms: number) => { const m = Math.round(ms / 60_000); return m < 0 ? `${-m} mnt lalu` : m < 90 ? `${m} mnt lagi` : `${Math.round(m / 60)} jam lagi` }

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
  // Gate kredit: cek saldo dulu; debit hanya setelah analisa sukses.
  const gate = await beginAiCharge(req, 'analysis')
  if (!gate.ok) return gate.response
  try {
    const snap = await req.json()
    const userPrompt = typeof snap.userPrompt === 'string' ? snap.userPrompt.trim() : ''
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const nowMs = Date.now()
    const [news, calendar, accuracy, lastAi] = await Promise.all([
      fetchHeadlineLines(), upcomingUsdHigh(nowMs), getAccuracy(30), getLastAiAnalysis(),
    ])
    const newsSummary = await summarizeNews(anthropic, news, nowMs)

    // Kalender: rilis USD berdampak tinggi terdekat
    const calLine = calendar.length
      ? calendar.map(e => `${e.title} (${relMin(e.time - nowMs)})`).join('; ')
      : 'tidak ada rilis USD berdampak tinggi dalam waktu dekat'
    // Track record kalibrasi (agregat — aman dari feedback loop)
    const accLine = accuracy && accuracy.total >= 10
      ? `${accuracy.pct}% arah benar dari ${accuracy.total} kesimpulan (30 hari, horizon 2 jam)${accuracy.byRegime.length ? ' — per kondisi: ' + accuracy.byRegime.map(r => `${r.regime} ${r.pct}% (${r.total}x)`).join(', ') : ''}`
      : 'belum cukup data (kalibrasi masih berjalan)'
    // Post-mortem analisa sebelumnya
    const pmLine = lastAi && snap.price
      ? `${Math.round((nowMs - lastAi.at) / 60_000)} menit lalu kamu menyimpulkan ${lastAi.verdict} ${lastAi.confidence}% (${lastAi.keputusan}) di harga ${lastAi.price}; harga sekarang ${snap.price} (${(snap.price - lastAi.price) >= 0 ? '+' : ''}${(snap.price - lastAi.price).toFixed(2)} poin). Evaluasi singkat apakah pandangan itu terbukti/meleset dan apa artinya untuk analisa sekarang.`
      : 'belum ada analisa sebelumnya'

    const dataBlock = `DATA TERMINAL XAU/USD (real-time):
- Harga: ${snap.price} (${snap.changePct >= 0 ? '+' : ''}${snap.changePct}%), sesi ${snap.session}, volatilitas ${snap.volatility}
- Signal gabungan: ${snap.signal?.label} (skor ${snap.signal?.overall}, confidence ${snap.signal?.confidence}%) | pilar Makro ${snap.signal?.macro} Teknikal ${snap.signal?.tech} Sentimen ${snap.signal?.senti}
- Regime pasar: ${snap.regime} (ADX ${snap.adx}, arah ${snap.adxTrend}) | Momentum komposit ${snap.momentum} | Bollinger squeeze: ${snap.bbSqueeze ? 'ya' : 'tidak'} | Sentimen risiko: ${snap.riskSentiment}
- Teknikal per timeframe (bias/RSI/MACD/Stoch%K/struktur/sinyal-reversal): M5 ${snap.tf?.M5?.bias}/${snap.tf?.M5?.rsi}/${snap.tf?.M5?.macd}/${snap.tf?.M5?.stoch}/${snap.tf?.M5?.struktur}/${snap.tf?.M5?.reversal ?? 'tidak ada'}, M15 ${snap.tf?.M15?.bias}/${snap.tf?.M15?.rsi}/${snap.tf?.M15?.macd}/${snap.tf?.M15?.stoch}/${snap.tf?.M15?.struktur}/${snap.tf?.M15?.reversal ?? 'tidak ada'}, H1 ${snap.tf?.H1?.bias}/${snap.tf?.H1?.rsi}/${snap.tf?.H1?.macd}/${snap.tf?.H1?.stoch}/${snap.tf?.H1?.struktur}/${snap.tf?.H1?.reversal ?? 'tidak ada'}; ADX ${snap.adx} (${snap.trendDir}); ATR M15 ${snap.atrM15}; VWAP M15 ${snap.vwapM15}
- Bias timeframe BESAR (filter arah, jangan lawan tren ini): H4 ${snap.biasTFbesar?.H4 ? `${snap.biasTFbesar.H4.bias}/RSI${snap.biasTFbesar.H4.rsi}/${snap.biasTFbesar.H4.struktur}` : 'belum tersedia'}, Daily ${snap.biasTFbesar?.D1 ? `${snap.biasTFbesar.D1.bias}/RSI${snap.biasTFbesar.D1.rsi}/${snap.biasTFbesar.D1.struktur}` : 'belum tersedia'}
- Pivot: P ${snap.pivots?.P}, R1 ${snap.pivots?.R1}, R2 ${snap.pivots?.R2}, S1 ${snap.pivots?.S1}, S2 ${snap.pivots?.S2}
- Makro (FRED, HARIAN/lambat): Indeks Dolar ${snap.macro?.dollar?.value} (prior ${snap.macro?.dollar?.prior}), US10Y ${snap.macro?.us10y?.value}%, US2Y ${snap.macro?.us02y?.value}%, Yield Curve 2s10s ${snap.yieldCurve2s10}%, Real Yield ${snap.macro?.realyield?.value}%, Ekspektasi Inflasi(breakeven) ${snap.macro?.breakeven?.value}%, CPI ${snap.macro?.cpi?.value}%, Core CPI ${snap.macro?.corecpi?.value}%, Core PCE ${snap.macro?.corepce?.value}%, Fed Funds ${snap.macro?.fedfunds?.value}%, Pengangguran ${snap.macro?.unrate?.value}%, NFP(perubahan bulanan) ${snap.macro?.nfp?.value}K (prior ${snap.macro?.nfp?.prior}K), Pertumbuhan Upah(YoY) ${snap.macro?.wagegrowth?.value}%
- Makro PER-CANDLE (proxy intraday, sebanding TF teknikal — dampak KE EMAS −100..+100, + = dukung emas): ${snap.macroCandle ? `Dolar(UUP,dibalik) M5 ${snap.macroCandle.M5.dolar} / M15 ${snap.macroCandle.M15.dolar} / H1 ${snap.macroCandle.H1.dolar}; Yield(IEF,10Y) M5 ${snap.macroCandle.M5.yield} / M15 ${snap.macroCandle.M15.yield} / H1 ${snap.macroCandle.H1.yield}${snap.macroCandle.blend ? `; blend Dolar ${snap.macroCandle.blend.dolar} Yield ${snap.macroCandle.blend.yield}` : ''}${snap.macroCandle.conflict ? ' — ⚠️ KONFLIK: dolar & yield per-candle BERLAWANAN arah (tarik-menarik makro → berpotensi RANGING)' : ''}` : 'belum tersedia'}
- COT (${snap.cot?.date}): Funds/institusi net ${snap.cot?.funds?.net} (Δ${snap.cot?.funds?.deltaNet}), Commercials net ${snap.cot?.commercials?.net}, Retail net ${snap.cot?.retail?.net} (Δ${snap.cot?.retail?.deltaNet})
- Rasio Emas/Perak (XAU/XAG): ${snap.goldSilverRatio}
- Bitcoin: ${snap.btc?.price} (${snap.btc?.changePct}%)
- Aset risiko real-time (Twelve Data): S&P 500 ${snap.riskAssets?.spy}%, Nasdaq 100 ${snap.riskAssets?.qqq}%, VIX (proxy ETF) ${snap.riskAssets?.vix}%, Dolar real-time (proxy UUP) ${snap.riskAssets?.dollarRealtime}%
- KALENDER EKONOMI (rilis USD berdampak tinggi terdekat): ${calLine}
- TRACK RECORD kesimpulan terminal (kalibrasi nyata): ${accLine}
- POST-MORTEM analisa AI sebelumnya: ${pmLine}
CANDLE MENTAH (price action; format O/H/L/C per bar, urut lama→baru, bar TERTUTUP):
M5 (30 bar terakhir): ${Array.isArray(snap.candlesM5) ? snap.candlesM5.join(' ') : 'tidak tersedia'}
M15 (20 bar terakhir): ${Array.isArray(snap.candlesM15) ? snap.candlesM15.join(' ') : 'tidak tersedia'}
RINGKASAN BERITA (2 hari, sudah diringkas):
${newsSummary}${userPrompt ? `\n\nKONTEKS/PERMINTAAN DARI TRADER (WAJIB dipertimbangkan & disesuaikan dalam analisa & keputusan): "${userPrompt}"` : ''}`

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 7000,
      // Extended thinking (adaptive): penalaran multi-langkah (cek konflik antar-pilar, self-check) sebelum JSON final
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system: `Kamu kepala analis (Head of Research) SCALPING XAU/USD di sebuah trading desk. Fokus utamamu SCALPING: analisa dan keputusan bertumpu pada timeframe kecil M5, M15, dan H1 (intraday). Susun ANALISA MENYELURUH yang menggabungkan TEKNIKAL (utamakan M5/M15/H1), MAKRO, dan SENTIMEN dari data terminal yang diberikan.

FOKUS SCALPING (penting): bobot terbesar ada di M5, M15, dan H1 — di sinilah entry/exit scalping terjadi. Bicarakan struktur & momentum M5/M15/H1 secara konkret (RSI, MACD, Stoch, VWAP, pivot, price action candle). H4/Daily dipakai sebagai KONTEKS arah besar saja (angin latar), BUKAN veto: kalau setup scalping M5/M15/H1 bagus tapi berlawanan H4/Daily, tetap boleh diambil sebagai scalp lawan-arah jangka pendek — cukup sebutkan itu sebagai risiko dan pakai target lebih rapat. Level & target scalping harus realistis untuk intraday (jarak poin wajar untuk XAU).

BERIKAN 1 ARAH YANG JELAS (WAJIB): trader butuh SATU kesimpulan arah. verdict HARUS "Bullish" atau "Bearish" (condong ke arah bukti terkuat dari M5/M15/H1 + makro/sentimen) — pakai "Netral" HANYA bila bukti benar-benar seimbang 50:50. Jangan berlindung di "netral/tunggu" hanya karena ragu; nyatakan arah bias yang paling mungkin beserta alasannya.

Prinsip: dolar/yield naik = bearish emas; inflasi mereda / ekspektasi pemangkasan Fed / risk-off / geopolitik / dolar melemah = bullish emas. COT: institusi (funds) & commercials adalah smart money, retail sering kontrarian. Regime "Tren Melemah"/momentum pudar (ADX menurun) = waspada potensi reversal. Kalau ada sinyal reversal (2+ dari 4: EMA cross/DI cross/MACD cross/struktur berubah) di satu atau lebih timeframe, WAJIB sebutkan itu secara eksplisit.

MAKRO PER-CANDLE (penting untuk scalping): utamakan baris "Makro PER-CANDLE" (proxy dolar UUP & yield IEF, sudah dinyatakan sbg dampak KE EMAS −100..+100 per M5/M15/H1) untuk menilai apakah makro sedang MENDUKUNG atau MELAWAN arah teknikal SAAT INI — ini sebanding horizon waktunya dengan chart. Baris "Makro (FRED, HARIAN)" hanya konteks lambat/latar, jangan jadikan penentu utama untuk keputusan scalping intraday. Jika ada tanda ⚠️ KONFLIK (dolar & yield per-candle berlawanan arah): perlakukan sbagai sinyal RANGING/tarik-menarik — turunkan conviction, waspadai whipsaw & false break, prioritaskan main pantulan range / target lebih rapat, dan SEBUTKAN kondisi tarik-menarik makro ini secara eksplisit di macro & risks.

PRICE ACTION: baca CANDLE MENTAH yang diberikan (O/H/L/C), terutama M5 & M15 — perhatikan rejection wick, engulfing, momentum candle, dan level yang berulang ditolak/ditembus. Gunakan sebagai konfirmasi/penolakan atas sinyal indikator, dan rujuk pola konkret yang kamu lihat (mis. "3 candle M5 terakhir rejection di 4060").

BERITA/NEWS — JANGAN DILARANG: cek KALENDER EKONOMI. Jika ada rilis USD berdampak tinggi dekat, JANGAN otomatis menyuruh TUNGGU dan JANGAN melarang trading. Tetap beri 1 arah bias yang jelas. Sampaikan sebagai KONTEKS RISIKO: sebutkan event & waktunya, jelaskan potensi volatilitas/spike, dan tawarkan cara main-nya (mis. scalp dengan SL lebih rapat / lot lebih kecil, atau tunggu spike lalu ikut arah breakout). Trader yang memutuskan — bukan kamu yang melarang.

KALIBRASI: gunakan TRACK RECORD sebagai dasar conviction — bila akurasi historis pada kondisi regime sekarang rendah, jangan beri conviction Tinggi. Gunakan POST-MORTEM untuk koreksi diri secara eksplisit di executive (1 kalimat: pandangan lalu terbukti/meleset dan implikasinya).

RUBRIC CONVICTION (wajib dipatuhi):
- "Tinggi": M5/M15/H1 searah + didukung makro/sentimen + tidak ada sinyal reversal berlawanan yang kuat.
- "Sedang": mayoritas searah tapi ada 1-2 konflik (mis. lawan H4/Daily, atau ada rilis berita dekat).
- "Rendah": pilar bertentangan / regime Ranging tanpa arah jelas. Conviction Rendah tetap boleh memberi arah bias — keputusan boleh TUNGGU untuk TIMING entry, tapi verdict tetap menyebut 1 arah.

SELF-CHECK sebelum jawab (kerjakan dalam penalaranmu): (1) apa arah bias terkuat dari M5/M15/H1? (2) konsisten dengan regime? (3) kalau ada rilis berita dekat, sudahkah kutawarkan cara main-nya (bukan sekadar melarang)? (4) R:R dari entry/sl/tp masuk akal untuk scalping (≥ 1:1.3)? (5) angka level konsisten dengan harga sekarang & pivot? Jika ada yang gagal, revisi sebelum menulis JSON.

ANGKA WAJIB: entry/sl/tp di plan & chartLevels HARUS angka harga konkret (bukan "di area support"); di plan sebutkan juga jarak dalam poin dan rasio R:R terhitung (mis. "SL 4051.2 (-8.3 poin), TP 4074.5 (+15 poin), R:R 1:1.8").

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
    // Simpan untuk post-mortem analisa berikutnya (gagal-diam bila Supabase tak dikonfigurasi)
    if (typeof snap.price === 'number') {
      await setLastAiAnalysis({ verdict: result.verdict, confidence: result.confidence, keputusan: result.keputusan, price: snap.price, at: nowMs })
    }
    await gate.commit().catch(() => {}) // debit best-effort (analisa sudah sukses)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal analisa' }, { status: 502 })
  }
}
