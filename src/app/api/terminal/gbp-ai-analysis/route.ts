import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// Analisa AI GBP/USD — modul terminal GBP (KHUSUS ADMIN, tanpa potong kredit).
// Kerangka CURRENCY-PAIR: duel Fed vs BoE (selisih yield AS−UK), dolar broad,
// risk appetite (GBP mata uang risiko — kebalikan emas), COT British Pound.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const ADMIN_EMAIL = 'vultype@gmail.com'

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
    // Gate ADMIN (modul eksperimen — bukan jalur kredit user).
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!token || !SUPA_URL) return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 })
    const authed = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user } } = await authed.auth.getUser()
    if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Khusus admin.' }, { status: 403 })

    const snap = await req.json()
    const userPrompt = typeof snap.userPrompt === 'string' ? snap.userPrompt.trim() : ''
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const dataBlock = `DATA TERMINAL GBP/USD (real-time):
- Harga: ${snap.price} (${snap.changePct >= 0 ? '+' : ''}${snap.changePct}%), sesi ${snap.session}
- Signal gabungan: ${snap.signal?.label} (skor ${snap.signal?.overall}, confidence ${snap.signal?.confidence}%) | pilar Makro(AS vs UK) ${snap.signal?.macro} Teknikal ${snap.signal?.tech} Sentimen ${snap.signal?.senti}
- Regime pasar (M15): ${snap.regime} | ADX ${snap.adx}
- Teknikal per timeframe (bias/RSI/MACD-hist/struktur): M5 ${snap.tf?.M5}, M15 ${snap.tf?.M15}, H1 ${snap.tf?.H1}; H4 ${snap.tf?.H4 ?? 'n/a'}, Daily ${snap.tf?.D1 ?? 'n/a'}
- MAKRO SISI AS: Indeks Dolar ${snap.us?.dollar} (prior ${snap.us?.dollarPrior}), US10Y ${snap.us?.us10y}%, US2Y ${snap.us?.us02y}%, CPI ${snap.us?.cpi}%, Fed Funds ${snap.us?.fedfunds}%, NFP ${snap.us?.nfp}K
- MAKRO SISI INGGRIS: UK10Y Gilt ${snap.uk?.uk10y}% (prior ${snap.uk?.uk10yPrior}), SONIA(BoE) ${snap.uk?.sonia}%, UK CPI ${snap.uk?.ukcpi}%, UK Unemployment ${snap.uk?.ukunrate}%
- SELISIH YIELD 10Y (AS − UK): ${snap.rateDiff}% — melebar ke AS = tekan GBP, menyempit/negatif = dukung GBP
- Sentimen risiko: ${snap.riskSentiment} (skor ${snap.riskOn}) | S&P ${snap.riskAssets?.spy}%, Nasdaq ${snap.riskAssets?.qqq}%, VIX(proxy) ${snap.riskAssets?.vix}%, Dolar live(UUP) ${snap.riskAssets?.uup}%
- COT British Pound (${snap.cot?.date}): Funds net ${snap.cot?.fundsNet} (Δ${snap.cot?.fundsDelta}), Commercials net ${snap.cot?.commNet}, Retail net ${snap.cot?.retailNet}
CANDLE MENTAH (O/H/L/C per bar, lama→baru, bar tertutup):
M5 (30 bar): ${Array.isArray(snap.candlesM5) ? snap.candlesM5.join(' ') : 'tidak tersedia'}
M15 (20 bar): ${Array.isArray(snap.candlesM15) ? snap.candlesM15.join(' ') : 'tidak tersedia'}${userPrompt ? `\n\nKONTEKS/PERMINTAAN DARI TRADER (WAJIB dipertimbangkan): "${userPrompt}"` : ''}`

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 6000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system: `Kamu kepala analis (Head of Research) SCALPING GBP/USD (cable) di sebuah trading desk. Fokus SCALPING: bobot terbesar M5/M15/H1; H4/Daily hanya konteks arah besar (bukan veto). Susun analisa menyeluruh dari data terminal yang diberikan.

KERANGKA CURRENCY-PAIR (bukan safe-haven): GBP/USD adalah duel dua ekonomi.
- Dolar broad & yield AS naik → GBP/USD tertekan. Yield gilt UK / SONIA / CPI Inggris naik → BoE hawkish → GBP/USD terdorong.
- SELISIH YIELD 10Y (AS−UK) adalah jangkar struktural: melebar ke AS = bearish cable, menyempit = bullish.
- GBP adalah MATA UANG RISIKO: risk-on (saham naik, VIX turun) → dukung GBP; risk-off → dana lari ke USD → tekan GBP. (INI KEBALIKAN emas.)
- COT: Funds net long sterling = institusi bullish GBP; net short = bearish. Retail sering kontrarian.
- 1 pip = 0.0001. Level & target harus realistis untuk scalping cable (SL/TP puluhan pips, bukan ratusan poin).

BERIKAN 1 ARAH JELAS (WAJIB): verdict HARUS "Bullish" atau "Bearish" (condong ke bukti terkuat M5/M15/H1 + makro/sentimen) — "Netral" hanya bila benar-benar 50:50. Keputusan TUNGGU boleh untuk timing, tapi verdict tetap satu arah.

RUBRIC CONVICTION: "Tinggi" = M5/M15/H1 searah + makro/sentimen mendukung; "Sedang" = mayoritas searah dgn 1-2 konflik; "Rendah" = pilar bertentangan / ranging.

SELF-CHECK sebelum jawab: (1) arah terkuat M5/M15/H1? (2) konsisten dgn regime & selisih yield? (3) R:R ≥ 1:1.3? (4) angka level konsisten dgn harga sekarang (5 desimal)? Revisi bila gagal.

ANGKA WAJIB: entry/sl/tp angka konkret 5 desimal; sebutkan jarak pips & R:R terhitung di plan.

Balas HANYA JSON valid (tanpa markdown), bentuk persis:
{
 "verdict":"Bullish|Bearish|Netral",
 "confidence":<0..100>,
 "keputusan":"BELI|JUAL|TUNGGU",
 "keputusanAlasan":"<1-2 kalimat tegas>",
 "conviction":"Tinggi|Sedang|Rendah",
 "headline":"<1 kalimat kesimpulan utama>",
 "executive":"<2-3 kalimat gabungan semua faktor>",
 "confluence":[{"faktor":"<Konfluensi TF | Dolar & Yield AS | BoE & Data UK | Selisih Yield | Risk Appetite | COT GBP>","arah":"bullish|bearish|netral","catatan":"<1 frasa>"}],
 "technical":"<analisa teknikal M5/M15/H1: struktur, momentum, level>",
 "macro":"<analisa makro: Fed vs BoE, selisih yield, dolar — implikasi ke cable>",
 "sentiment":"<risk appetite + COT GBP + dolar live>",
 "levelKunci":{"support":"<level support terdekat>","resistance":"<level resistance terdekat>"},
 "plan":{"bias":"Bullish|Bearish|Netral","entry":"<zona/kondisi entry>","sl":"<level+pips>","tp":"<target+pips>","invalidation":"<pembatal skenario>"},
 "scenarios":[{"kondisi":"<jika ...>","aksi":"<maka ...>"}],
 "risks":["<risiko utama>"],
 "watch":["<data/event/level dipantau>"]
}
confluence 4-6 item, scenarios 2, risks 2-3, watch 2-3. Bahasa Indonesia, tegas, berbasis data — jangan mengarang angka.`,
      messages: [{ role: 'user', content: dataBlock }],
    })

    const raw = msg.content.find(b => b.type === 'text')?.text ?? '{}'
    const p = JSON.parse(extractJson(raw))
    const result = {
      verdict: p.verdict === 'Bullish' || p.verdict === 'Bearish' ? p.verdict : 'Netral',
      confidence: Math.max(0, Math.min(100, Math.round(p.confidence ?? 50))),
      keputusan: ['BELI', 'JUAL', 'TUNGGU'].includes(p.keputusan) ? p.keputusan : 'TUNGGU',
      keputusanAlasan: String(p.keputusanAlasan ?? ''),
      conviction: ['Tinggi', 'Sedang', 'Rendah'].includes(p.conviction) ? p.conviction : 'Sedang',
      headline: String(p.headline ?? ''), executive: String(p.executive ?? ''),
      confluence: Array.isArray(p.confluence) ? p.confluence.slice(0, 6).map((c: { faktor?: string; arah?: string; catatan?: string }) => ({ faktor: String(c.faktor ?? ''), arah: (['bullish', 'bearish', 'netral'].includes(c.arah ?? '') ? c.arah : 'netral') as 'bullish' | 'bearish' | 'netral', catatan: String(c.catatan ?? '') })) : [],
      technical: String(p.technical ?? ''), macro: String(p.macro ?? ''), sentiment: String(p.sentiment ?? ''),
      levelKunci: { support: String(p.levelKunci?.support ?? ''), resistance: String(p.levelKunci?.resistance ?? '') },
      plan: { bias: String(p.plan?.bias ?? '—'), entry: String(p.plan?.entry ?? ''), sl: String(p.plan?.sl ?? ''), tp: String(p.plan?.tp ?? ''), invalidation: String(p.plan?.invalidation ?? '') },
      scenarios: Array.isArray(p.scenarios) ? p.scenarios.slice(0, 3).map((s: { kondisi?: string; aksi?: string }) => ({ kondisi: String(s.kondisi ?? ''), aksi: String(s.aksi ?? '') })) : [],
      risks: arr(p.risks, 3), watch: arr(p.watch, 3),
      fetchedAt: new Date().toISOString(),
    }
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal analisa' }, { status: 502 })
  }
}
