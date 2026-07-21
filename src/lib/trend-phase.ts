// ═══════════════════════════════════════════════════════════════════════════
// R&D SNIPER — deteksi fase tren 3 tahap untuk scalping XAU/USD (khusus admin).
//
//   COILING    → volatilitas menyempit, energi terkumpul. Arah belum diketahui.
//   IGNITION   → "Cari Zona Open Posisi": breakout struktur + akselerasi
//                momentum. Di sinilah sniper entry — SEBELUM ADX konfirmasi.
//   CONFIRMED  → Trending Bullish/Bearish: tren terbentuk (ER + ADX + DI).
//                Untuk MENGELOLA posisi, bukan untuk entry (risiko FOMO).
//
// Prinsip desain:
//  - Deteksi dini pasti menghasilkan false signal — karena itu setiap fase
//    membawa SKOR keyakinan + daftar bukti price action, bukan cuma label.
//    Backtest yang memutuskan layak/tidaknya dipercaya, bukan teorinya.
//  - Basis M5 (scalping), M15 sebagai filter arah. Semua level dari price
//    action nyata: Donchian, swing, ATR, VWAP sesi — bukan angka ajaib.
// ═══════════════════════════════════════════════════════════════════════════
import { atrLast, efficiencyRatio, type Candle } from './terminal-signal'
import { bollinger, macdCalc, type Boll, type Macd } from './indicators'

export type PhaseId = 'idle' | 'coiling' | 'ignition' | 'confirmed'
export type PhaseDir = 'bull' | 'bear' | null

export type TFSlice = {
  candles: Candle[]
  atr: number
  rsi: number
  adx: number
  plusDI: number
  minusDI: number
  ema9: number[]
  ema21: number[]
  vwap: number
  boll: Boll
  macd: Macd
}

export type PhaseState = {
  phase: PhaseId
  dir: PhaseDir
  label: string          // "Coiling" | "Cari Zona Open Posisi" | "Trending Bullish/Bearish" | "Tidak Ada Setup"
  score: number          // 0..100 keyakinan — TAMPILKAN SELALU, jangan sembunyikan
  reasons: string[]      // bukti price action (untuk jurnal backtest)
  zone: { lo: number; hi: number; note: string } | null   // zona aksi konkret
  mature: boolean        // tren sudah jauh — JANGAN dikejar
  matureNote: string | null
  sinceTs: number        // kapan fase ini mulai (utk durasi & expiry ignition)
}

const f1 = (n: number) => n.toFixed(1)

// Donchian channel dari N bar tertutup SEBELUM bar penutup terakhir.
// Dua bar terakhir dikecualikan: bar berjalan (belum final) DAN bar penutup
// yang sedang diuji breakout — bar tak mungkin menembus high yang memuat
// dirinya sendiri (bug klasik lookahead pada deteksi breakout).
function donchian(c: Candle[], n = 20): { hi: number; lo: number } {
  const closed = c.slice(-(n + 2), -2)
  if (!closed.length) return { hi: 0, lo: 0 }
  return { hi: Math.max(...closed.map(x => x.h)), lo: Math.min(...closed.map(x => x.l)) }
}

// Persentil bandwidth Bollinger saat ini terhadap ~40 window terakhir.
// bandwidth di bawah persentil-25 = squeeze "sebenarnya" (relatif terhadap
// dirinya sendiri) — lebih andal daripada ambang absolut.
function bandwidthPctile(closes: number[], windows = 40): number {
  if (closes.length < 20 + windows) return 0.5
  const bws: number[] = []
  for (let i = 0; i < windows; i++) {
    const end = closes.length - i
    bws.push(bollinger(closes.slice(0, end)).bandwidth)
  }
  const cur = bws[0]
  const below = bws.filter(b => b < cur).length
  return below / bws.length
}

// Kemiringan MACD histogram: nilai sekarang vs 3 bar lalu. Akselerasi momentum
// MENDAHULUI kenaikan ADX — ini salah satu kunci deteksi dini.
function macdHistSlope(closes: number[]): number {
  if (closes.length < 40) return 0
  const now = macdCalc(closes).hist
  const prev = macdCalc(closes.slice(0, -3)).hist
  return now - prev
}

// Kontraksi ATR: ATR(7) terbaru vs ATR(14) periode sebelumnya. < 1 = menyempit.
function atrContraction(c: Candle[]): number {
  if (c.length < 40) return 1
  const recent = atrLast(c, 7)
  const base = atrLast(c.slice(0, -7), 14)
  return base > 0 ? recent / base : 1
}

export type PhaseInput = {
  m5: TFSlice
  m15: TFSlice
  price: number
  utcHour: number
  prev?: PhaseState | null
}

export function detectTrendPhase(inp: PhaseInput): PhaseState {
  const { m5, m15, price, utcHour, prev } = inp
  const c5 = m5.candles
  const now = Date.now()
  const mk = (p: Partial<PhaseState>): PhaseState => ({
    phase: 'idle', dir: null, label: 'Tidak Ada Setup', score: 0, reasons: [],
    zone: null, mature: false, matureNote: null, sinceTs: now, ...p,
  })
  if (c5.length < 60 || m15.candles.length < 40) return mk({ reasons: ['data candle belum cukup'] })

  const closes5 = c5.map(x => x.c)
  const atr5 = m5.atr || atrLast(c5)
  const last = c5[c5.length - 2]                     // bar TERTUTUP terakhir
  const lastRange = last ? last.h - last.l : 0
  const er5 = efficiencyRatio(closes5, 14)
  const dch = donchian(c5, 20)
  const bwPct = bandwidthPctile(closes5)
  const contraction = atrContraction(c5)
  const histSlope = macdHistSlope(closes5)
  const e9 = m5.ema9[m5.ema9.length - 1] ?? price
  const e21 = m5.ema21[m5.ema21.length - 1] ?? price
  const e9_15 = m15.ema9[m15.ema9.length - 1] ?? price
  const e21_15 = m15.ema21[m15.ema21.length - 1] ?? price
  const m15DirUp = m15.plusDI >= m15.minusDI
  const activeSession = utcHour >= 7 && utcHour < 17   // London + overlap NY: follow-through terbaik
  const keepSince = (phase: PhaseId, dir: PhaseDir) =>
    prev && prev.phase === phase && prev.dir === dir ? prev.sinceTs : now

  // ── Kematangan tren: jarak dari mean dalam satuan ATR + RSI ekstrem.
  //    Dipakai untuk MENCEGAH entry telat (obat FOMO), apa pun fasenya.
  const distMean = Math.abs(price - e21) / (atr5 || 1)
  const mature = distMean > 2.2 || m5.rsi >= 72 || m5.rsi <= 28
  const pbLo = Math.min(e9, e21), pbHi = Math.max(e9, e21)
  const matureNote = mature
    ? `Harga sudah ${f1(distMean)}×ATR dari EMA21${m5.rsi >= 72 ? ` · RSI ${Math.round(m5.rsi)} jenuh beli` : m5.rsi <= 28 ? ` · RSI ${Math.round(m5.rsi)} jenuh jual` : ''} — JANGAN dikejar. Tunggu pullback ke $${f1(pbLo)}–$${f1(pbHi)}.`
    : null

  // ═══ 3. CONFIRMED — tren terbentuk (paling prioritas bila terpenuhi) ═══
  // Hysteresis: bila sebelumnya sudah confirmed, syarat keluar lebih longgar
  // supaya label tidak kelap-kelip di tengah tren.
  const wasConfirmed = prev?.phase === 'confirmed'
  const erTh = wasConfirmed ? 0.30 : 0.40
  const adxTh = wasConfirmed ? 20 : 23
  const dirUp = m5.plusDI >= m5.minusDI
  const emaAligned = dirUp ? (e9 > e21 && price > m5.vwap) : (e9 < e21 && price < m5.vwap)
  if (er5 >= erTh && m5.adx >= adxTh && emaAligned && (dirUp === m15DirUp)) {
    const dir: PhaseDir = dirUp ? 'bull' : 'bear'
    const score = Math.min(100, Math.round(40 + er5 * 60 + Math.max(0, m5.adx - 23)))
    return mk({
      phase: 'confirmed', dir,
      label: dirUp ? 'Trending Bullish' : 'Trending Bearish',
      score,
      reasons: [
        `ER ${er5.toFixed(2)} — gerakan efisien searah`,
        `ADX ${Math.round(m5.adx)} · ${dirUp ? '+DI' : '-DI'} dominan`,
        `EMA9 ${dirUp ? '>' : '<'} EMA21 · harga ${dirUp ? 'di atas' : 'di bawah'} VWAP sesi`,
        `M15 searah (${m15DirUp ? 'bullish' : 'bearish'})`,
      ],
      zone: mature ? { lo: pbLo, hi: pbHi, note: 'Zona pullback (EMA9–EMA21) — entry HANYA di sini, bukan di harga sekarang' } : { lo: pbLo, hi: pbHi, note: 'Zona pullback sehat bila koreksi' },
      mature, matureNote,
      sinceTs: keepSince('confirmed', dir),
    })
  }

  // ═══ 2. IGNITION — "Cari Zona Open Posisi" (trigger sniper) ═══
  // Trigger: bar tertutup menembus Donchian-20. Skor dari bukti pendukung.
  const brokeUp = last && dch.hi > 0 && last.c > dch.hi
  const brokeDn = last && dch.lo > 0 && last.c < dch.lo
  // Ignition sebelumnya masih hidup? (belum 60 menit, harga belum balik ke tengah range)
  const prevIgnAlive = prev?.phase === 'ignition' && now - prev.sinceTs < 60 * 60_000 &&
    (prev.dir === 'bull' ? price > (dch.hi + dch.lo) / 2 : price < (dch.hi + dch.lo) / 2)

  if (brokeUp || brokeDn || prevIgnAlive) {
    const dir: PhaseDir = brokeUp ? 'bull' : brokeDn ? 'bear' : prev!.dir
    const up = dir === 'bull'
    let score = 35
    const reasons: string[] = [up ? `Breakout: close M5 menembus high 20-bar ($${f1(dch.hi)})` : `Breakdown: close M5 menembus low 20-bar ($${f1(dch.lo)})`]
    if (lastRange >= 1.2 * atr5) { score += 15; reasons.push(`Candle ekspansi ${f1(lastRange / atr5)}×ATR — dorongan nyata, bukan drift`) }
    if (up ? histSlope > 0 : histSlope < 0) { score += 12; reasons.push('MACD histogram akselerasi searah (mendahului ADX)') }
    if (up ? m5.rsi >= 52 : m5.rsi <= 48) { score += 8; reasons.push(`RSI ${Math.round(m5.rsi)} ${up ? 'di atas' : 'di bawah'} 50`) }
    if (up ? e9 > e21 : e9 < e21) { score += 8; reasons.push('EMA9/21 M5 searah') }
    if (up ? price > m5.vwap : price < m5.vwap) { score += 7; reasons.push(`Harga ${up ? 'di atas' : 'di bawah'} VWAP sesi`) }
    if (up === m15DirUp && (up ? e9_15 > e21_15 : e9_15 < e21_15)) { score += 12; reasons.push('M15 searah — bukan lawan arus') }
    if (activeSession) { score += 8; reasons.push('Sesi London/NY — follow-through historis terbaik') }
    if (prev?.phase === 'coiling' || (prev?.phase === 'ignition' && now - prev.sinceTs < 30 * 60_000)) { score += 5; reasons.push('Didahului coiling — energi terkumpul') }
    if (m5.adx >= 15 && m5.adx < 25) { score += 5; reasons.push(`ADX ${Math.round(m5.adx)} baru menanjak dari basis rendah`) }

    if (score >= 55) {
      const edge = up ? dch.hi : dch.lo
      const zLo = up ? Math.min(edge, e9) : Math.min(edge, e9)
      const zHi = up ? Math.max(edge, e9) : Math.max(edge, e9)
      return mk({
        phase: 'ignition', dir,
        label: 'Cari Zona Open Posisi',
        score: Math.min(95, score),   // ignition tak pernah 100 — dini = tak pasti, jujur soal itu
        reasons,
        zone: { lo: zLo, hi: zHi, note: `Zona entry ${up ? 'BUY' : 'SELL'}: retest level breakout ($${f1(edge)}) s/d EMA9. SL di ${up ? 'bawah' : 'atas'} ${up ? `$${f1(dch.hi - atr5)}` : `$${f1(dch.lo + atr5)}`} (1×ATR).` },
        mature, matureNote,
        sinceTs: keepSince('ignition', dir),
      })
    }
  }

  // ═══ 1. COILING — energi terkumpul, siaga breakout ═══
  let cScore = 0
  const cReasons: string[] = []
  if (m5.boll.squeeze || bwPct <= 0.25) { cScore += 30; cReasons.push(`Bollinger squeeze (bandwidth persentil-${Math.round(bwPct * 100)})`) }
  if (contraction < 0.8) { cScore += 25; cReasons.push(`ATR kontraksi ${Math.round((1 - contraction) * 100)}% — range menyempit`) }
  if (er5 < 0.25) { cScore += 20; cReasons.push(`ER ${er5.toFixed(2)} — gerak acak, belum ada arah`) }
  if (m5.adx < 20) { cScore += 15; cReasons.push(`ADX ${Math.round(m5.adx)} rendah — pasar diam sebelum bergerak`) }
  if (cScore >= 50) {
    return mk({
      phase: 'coiling', dir: null,
      label: 'Coiling',
      score: Math.min(90, cScore + (activeSession ? 10 : 0)),
      reasons: [...cReasons, `Siaga: breakout valid bila close M5 di atas $${f1(dch.hi)} atau di bawah $${f1(dch.lo)}`],
      zone: { lo: dch.lo, hi: dch.hi, note: 'Range kompresi (Donchian-20). JANGAN entry di dalam range — tunggu penetrasi.' },
      mature: false, matureNote: null,
      sinceTs: keepSince('coiling', null),
    })
  }

  return mk({ reasons: ['Tidak ada kompresi, breakout, maupun tren — duduk tenang adalah posisi.'] })
}
