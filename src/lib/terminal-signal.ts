// ─────────────────────────────────────────────────────────────────────────
// SINYAL TERMINAL XAU/USD — SATU SUMBER KEBENARAN.
// Semua rumus indikator, regime, confidence & risk-on dipakai BERSAMA oleh
// dashboard (TradingTerminal.tsx) dan cron notifikasi Telegram (cron-alert),
// supaya angka yang muncul di dashboard = angka di notifikasi (tidak drift).
// 100% data real, tanpa angka karangan.
// ─────────────────────────────────────────────────────────────────────────
import { macdCalc, bollinger, stochastic, marketStructure, momentumScore, type Macd, type Boll, type Stoch, type Structure } from '@/lib/indicators'
import type { MacroPoint } from '@/lib/fred'

export type TF = 'M5' | 'M15' | 'H1'
export const TFS: TF[] = ['M5', 'M15', 'H1']
export type Dir = 'BULLISH' | 'BEARISH' | 'NETRAL'
export type Candle = { o: number; h: number; l: number; c: number; t: number; v: number }
export type Bias = { label: Dir; score: number }
export type ReversalDir = 'bullish' | 'bearish' | 'netral'
export type Reversal = { arah: ReversalDir; skor: number; sinyal: string[] }
export type TFData = { candles: Candle[]; ema9: number[]; ema21: number[]; vwapArr: number[]; rsi: number; atr: number; vwap: number; adx: number; adxTrend: 'naik' | 'turun' | 'stabil'; plusDI: number; minusDI: number; bias: Bias; macd: Macd; boll: Boll; stoch: Stoch; structure: Structure; momentum: number; reversal: Reversal }
export type CrossQuote = { price: number; changePct: number } | null

export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))

// ─────────────────────────── indikator ───────────────────────────
export function emaArr(vals: number[], period: number): number[] {
  const k = 2 / (period + 1); const out: number[] = []; let prev = vals[0] ?? 0
  vals.forEach((v, i) => { prev = i ? v * k + prev * (1 - k) : v; out.push(prev) }); return out
}
// RSI Wilder (smoothing) — cocok dengan RSI di TradingView. Full-series smoothing.
export function rsiLast(vals: number[], period = 14): number {
  if (vals.length < period + 1) return 50
  let gain = 0, loss = 0
  for (let i = 1; i <= period; i++) { const d = vals[i] - vals[i - 1]; if (d >= 0) gain += d; else loss -= d }
  let avgGain = gain / period, avgLoss = loss / period
  for (let i = period + 1; i < vals.length; i++) {
    const d = vals[i] - vals[i - 1]
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period
  }
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss; return 100 - 100 / (1 + rs)
}
// ATR Wilder (smoothing) — cocok dengan ATR di TradingView.
export function atrLast(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) { const c = candles[i], p = candles[i - 1]; trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c))) }
  if (trs.length < period) return trs.reduce((a, b) => a + b, 0) / trs.length
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period
  return atr
}
// ADX (Wilder) — kekuatan tren + arah (+DI/-DI)
export function adxCalc(candles: Candle[], period = 14): { adx: number; plusDI: number; minusDI: number } {
  if (candles.length < period * 2 + 1) return { adx: 0, plusDI: 0, minusDI: 0 }
  const tr: number[] = [], pDM: number[] = [], mDM: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const { h, l } = candles[i], ph = candles[i - 1].h, pl = candles[i - 1].l, pc = candles[i - 1].c
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
    const up = h - ph, down = pl - l
    pDM.push(up > down && up > 0 ? up : 0); mDM.push(down > up && down > 0 ? down : 0)
  }
  const wilder = (a: number[]) => { let sum = a.slice(0, period).reduce((x, y) => x + y, 0); const out = [sum]; for (let i = period; i < a.length; i++) { sum = sum - sum / period + a[i]; out.push(sum) } return out }
  const trS = wilder(tr), pS = wilder(pDM), mS = wilder(mDM)
  const dx: number[] = []
  for (let i = 0; i < trS.length; i++) { const pdi = trS[i] ? 100 * pS[i] / trS[i] : 0, mdi = trS[i] ? 100 * mS[i] / trS[i] : 0; const s = pdi + mdi; dx.push(s ? 100 * Math.abs(pdi - mdi) / s : 0) }
  if (dx.length < period) return { adx: 0, plusDI: 0, minusDI: 0 }
  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < dx.length; i++) adx = (adx * (period - 1) + dx[i]) / period
  const lastTR = trS[trS.length - 1]
  return { adx, plusDI: lastTR ? 100 * pS[pS.length - 1] / lastTR : 0, minusDI: lastTR ? 100 * mS[mS.length - 1] / lastTR : 0 }
}
// Deteksi pembalikan arah — gabungan 4 sinyal nyata yang baru saja "cross":
// EMA9/21, +DI/-DI, MACD histogram tembus nol, dan perubahan struktur pasar (HH/HL).
// skor = berapa banyak sinyal yang sepakat (0-4) dalam arah yang sama.
export function detectReversal(candles: Candle[]): Reversal {
  const n = candles.length
  if (n < 40) return { arah: 'netral', skor: 0, sinyal: [] }
  // LOOKBACK: bandingkan kondisi sekarang vs beberapa candle lalu (bukan cuma 1 candle
  // terakhir) — supaya sinyal cross tidak "basi" dalam 1 tick kalau pas polling meleset.
  const LOOKBACK = 3
  const closes = candles.map(c => c.c)
  const ema9 = emaArr(closes, 9), ema21 = emaArr(closes, 21)
  const sinyal: string[] = []; let bull = 0, bear = 0

  if (ema9[n - 1] > ema21[n - 1] && ema9[n - 1 - LOOKBACK] <= ema21[n - 1 - LOOKBACK]) { bull++; sinyal.push('EMA9 cross naik EMA21') }
  if (ema9[n - 1] < ema21[n - 1] && ema9[n - 1 - LOOKBACK] >= ema21[n - 1 - LOOKBACK]) { bear++; sinyal.push('EMA9 cross turun EMA21') }

  const di0 = adxCalc(candles), di1 = adxCalc(candles.slice(0, -LOOKBACK))
  if (di0.plusDI > di0.minusDI && di1.plusDI <= di1.minusDI) { bull++; sinyal.push('+DI cross di atas -DI') }
  if (di0.minusDI > di0.plusDI && di1.minusDI <= di1.plusDI) { bear++; sinyal.push('-DI cross di atas +DI') }

  const macd0 = macdCalc(closes), macd1 = macdCalc(closes.slice(0, -LOOKBACK))
  if (macd0.hist > 0 && macd1.hist <= 0) { bull++; sinyal.push('MACD histogram tembus ke positif') }
  if (macd0.hist < 0 && macd1.hist >= 0) { bear++; sinyal.push('MACD histogram tembus ke negatif') }

  const struct0 = marketStructure(candles), struct1 = marketStructure(candles.slice(0, -3))
  if (struct0.label === 'Uptrend' && struct1.label !== 'Uptrend') { bull++; sinyal.push('Struktur berubah jadi Uptrend (HH/HL)') }
  if (struct0.label === 'Downtrend' && struct1.label !== 'Downtrend') { bear++; sinyal.push('Struktur berubah jadi Downtrend (LH/LL)') }

  const arah: ReversalDir = bull > bear ? 'bullish' : bear > bull ? 'bearish' : 'netral'
  return { arah, skor: Math.max(bull, bear), sinyal }
}
// VWAP sesi ter-anchor: rata-rata typical-price sejak awal HARI trading (00:00 UTC),
// bukan jendela 150 bar sembarang. Volume tak tersedia utk spot gold → bobot per bar = 1
// (secara efektif TWAP sesi). Fallback ke seluruh bar bila candle sesi terlalu sedikit.
function sessionVwap(candles: Candle[]): { arr: number[]; last: number } {
  const dayMs = 86_400_000
  const lastT = candles[candles.length - 1]?.t ?? Date.now()
  const anchor = Math.floor(lastT / dayMs) * dayMs // 00:00 UTC hari candle terakhir
  let startIdx = candles.findIndex(c => c.t >= anchor)
  if (startIdx < 0 || candles.length - startIdx < 5) startIdx = 0 // sesi terlalu pendek → pakai semua
  const arr: number[] = []; let sum = 0, n = 0
  for (let i = 0; i < candles.length; i++) {
    if (i >= startIdx) { sum += (candles[i].h + candles[i].l + candles[i].c) / 3; n++ }
    arr.push(n ? sum / n : candles[i].c)
  }
  return { arr, last: arr[arr.length - 1] }
}
export function computeTF(candles: Candle[]): TFData {
  // #1 Repaint: buang candle TERAKHIR yang masih terbentuk — semua indikator hitung dari bar TERTUTUP.
  const c = candles.length > 30 ? candles.slice(0, -1) : candles
  const closes = c.map(x => x.c)
  const ema9 = emaArr(closes, 9), ema21 = emaArr(closes, 21), rsi = rsiLast(closes), atr = atrLast(c)
  const { adx, plusDI, minusDI } = adxCalc(c)
  const adxPrev = c.length > 18 ? adxCalc(c.slice(0, -4)).adx : adx
  const adxTrend: TFData['adxTrend'] = adx > adxPrev + 0.5 ? 'naik' : adx < adxPrev - 0.5 ? 'turun' : 'stabil'
  const { arr: vwapArr, last: vwap } = sessionVwap(c)
  const price = closes[closes.length - 1]
  let score = 0
  if (ema9[ema9.length - 1] > ema21[ema21.length - 1]) score += 1; else score -= 1
  if (price > vwap) score += 1; else score -= 1
  if (rsi > 55) score += 1; else if (rsi < 45) score -= 1
  const bias: Bias = score >= 2 ? { label: 'BULLISH', score } : score <= -2 ? { label: 'BEARISH', score } : { label: 'NETRAL', score }
  const macd = macdCalc(closes), boll = bollinger(closes), stoch = stochastic(c), structure = marketStructure(c)
  const momentum = momentumScore(rsi, macd, stoch, boll)
  const reversal = detectReversal(c)
  return { candles: c, ema9, ema21, vwapArr, rsi, atr, vwap, adx, adxTrend, plusDI, minusDI, bias, macd, boll, stoch, structure, momentum, reversal }
}
export const adxLabel = (adx: number) => adx < 20 ? 'Lemah' : adx < 25 ? 'Mulai' : adx < 40 ? 'Kuat' : 'Sangat Kuat'

// ─────────────────────────── sentimen risiko & skor gabungan ───────────────────────────
// Bursa saham AS (SPY/QQQ/VIXY) hanya hidup Sen-Jum 13:30-20:00 UTC. Di luar itu
// datanya beku di penutupan → jangan dianggap sinyal segar.
export function usMarketOpen(now = Date.now()): boolean {
  const d = new Date(now), day = d.getUTCDay(), min = d.getUTCHours() * 60 + d.getUTCMinutes()
  if (day === 0 || day === 6) return false
  return min >= 810 && min <= 1200 // 13:30–20:00 UTC (sesi reguler NYSE)
}
// Sentimen risiko (risk-on/off) dari SPY/QQQ/VIXY/BTC. -1 (risk-off) .. +1 (risk-on).
// Saat bursa AS tutup, SPY/QQQ/VIXY beku → bobotnya diperkecil, andalkan BTC (24/7).
export function riskOnScore(cross: { spy: CrossQuote; qqq: CrossQuote; vixy: CrossQuote; btc: CrossQuote }, usOpen = true): number {
  const eqW = usOpen ? 1 : 0.25 // bobot ekuitas AS saat bursa tutup dikecilkan
  let s = 0, n = 0
  if (cross.spy) { s += clamp(cross.spy.changePct / 1.5, -1, 1) * eqW; n += eqW }
  if (cross.qqq) { s += clamp(cross.qqq.changePct / 1.8, -1, 1) * eqW; n += eqW }
  if (cross.vixy) { s += clamp(-cross.vixy.changePct / 4, -1, 1) * eqW; n += eqW }
  if (cross.btc) { s += clamp(cross.btc.changePct / 4, -1, 1) * 0.5; n += 0.5 }
  return n ? s / n : 0
}
// dollarLive = %change UUP (proxy dolar) real-time. Bila ada, arah dolar intraday
// pakai UUP (bergerak live), FRED cuma untuk yield/real-yield yang lebih lambat.
// fastMacro = dampak-ke-emas per-candle dari proxy UUP (dolar) & IEF (yield 10Y,
// harga terbalik dgn yield), masing² -100..100, dihitung dari M5/M15/H1 (opsional
// — dashboard mengisinya, cron-alert yang belum punya candle proxy ini tetap
// jalan dgn fallback FRED harian di bawah).
export function scores(tf: Record<TF, TFData>, macro: Record<string, MacroPoint> | null, newsScore: number | null, riskOn: number, dollarLive?: number | null, fastMacro?: { dollarImpact: number; yieldImpact: number } | null) {
  const tech = clamp((tf.M5.bias.score + tf.M15.bias.score + tf.H1.bias.score) / 9, -1, 1) * 100
  const dir = (k: string) => { const p = macro?.[k]; return p ? Math.sign(p.value - p.prior) : 0 }
  const dollarDir = dollarLive != null && Math.abs(dollarLive) > 0.02 ? Math.sign(dollarLive) : dir('dollar')
  // Real yield (TIPS) tak punya proxy candle yang baik → tetap dari FRED sbg konteks lebih lambat,
  // walau fastMacro (dolar+yield nominal per-candle) tersedia.
  const macroScore = fastMacro
    ? clamp(fastMacro.dollarImpact * 0.45 + fastMacro.yieldImpact * 0.35 + dir('realyield') * 100 * 0.20, -100, 100)
    : clamp(-(dollarDir * 0.4 + dir('us10y') * 0.35 + dir('realyield') * 0.25), -1, 1) * 100
  const senti = newsScore != null ? clamp(newsScore / 100 * 0.7 + riskOn * 0.3, -1, 1) * 100 : riskOn * 100
  const overall = macroScore * 0.3 + tech * 0.45 + senti * 0.25
  const label: Dir = overall > 20 ? 'BULLISH' : overall < -20 ? 'BEARISH' : 'NETRAL'
  const sgn = (x: number) => Math.sign(Math.round(x))
  const agree = new Set([sgn(macroScore), sgn(tech), sgn(senti)]).size === 1 ? 3 : (sgn(macroScore) === sgn(tech) || sgn(tech) === sgn(senti) || sgn(macroScore) === sgn(senti)) ? 2 : 1
  const mag = (Math.abs(macroScore) + Math.abs(tech) + Math.abs(senti)) / 3
  const confidence = Math.round(clamp((agree / 3) * 0.6 + (mag / 100) * 0.4, 0, 1) * 100)
  return { macro: macroScore, tech, senti, overall, label, confidence }
}
// ─────────────────────────── makro per-candle: DXY (UUP) & Yield (IEF, terbalik) ───────────────────────────
// Dampak-ke-emas per timeframe, dari bias.score TFData (rentang kira-kira -3..+3 → diskalakan -100..100).
// UUP naik = dolar menguat → BEARISH emas (dibalik). IEF naik = harga obligasi naik = yield turun → BULLISH emas (searah).
const tfImpact = (d: TFData, invert: boolean) => clamp(d.bias.score / 3, -1, 1) * 100 * (invert ? -1 : 1)
export type MacroCandleTF = { dollarImpact: number; yieldImpact: number }
export function macroCandleImpact(uup: TFData, ief: TFData): MacroCandleTF {
  const dollarImpact = tfImpact(uup, true)
  const yieldImpact = tfImpact(ief, false)
  return { dollarImpact, yieldImpact }
}
// Rata-rata M5/M15/H1 → dipakai sebagai fastMacro di scores() (konsisten dgn cara `tech` dirata-ratakan).
export function macroCandleBlend(uup: Record<TF, TFData>, ief: Record<TF, TFData>): { dollarImpact: number; yieldImpact: number } {
  const avg = (k: 'dollarImpact' | 'yieldImpact') => TFS.reduce((s, t) => s + macroCandleImpact(uup[t], ief[t])[k], 0) / TFS.length
  return { dollarImpact: avg('dollarImpact'), yieldImpact: avg('yieldImpact') }
}
export function confluence(tf: Record<TF, TFData>) {
  const labels = TFS.map(t => tf[t].bias.label)
  const bulls = labels.filter(l => l === 'BULLISH').length, bears = labels.filter(l => l === 'BEARISH').length
  let label: Dir = 'NETRAL', strength: 'campur' | 'sedang' | 'kuat' = 'campur'
  if (bulls === 3) { label = 'BULLISH'; strength = 'kuat' } else if (bears === 3) { label = 'BEARISH'; strength = 'kuat' }
  else if (bulls === 2 && bears === 0) { label = 'BULLISH'; strength = 'sedang' } else if (bears === 2 && bulls === 0) { label = 'BEARISH'; strength = 'sedang' }
  return { label, strength, bulls, bears }
}

// ─────────────────────────── regime pasar (3 kondisi) ───────────────────────────
// Semua berbasis M15: bbSqueeze (Bollinger menyempit), level ADX, arah slope ADX, arah DI.
// Hanya 3 kondisi: Ranging (sideways), Trending (tren kuat & searah, dgn arah
// Bullish/Bearish), dan Sedang Konfirmasi Arah (tren belum matang / momentum berubah).
// `phase` = kondisi (stabil, dipakai logika/notifikasi), `label` = teks tampilan.
export type RegimePhase = 'ranging' | 'konfirmasi' | 'trending'
export type RegimeDir = 'bullish' | 'bearish' | 'netral'
export type Regime = { label: string; phase: RegimePhase; dir: RegimeDir; c: string; desc: string }
export function regimeOf(p: { bbSqueeze: boolean; adx: number; adxTrend: 'naik' | 'turun' | 'stabil'; trendUp: boolean }): Regime {
  const { bbSqueeze, adx, adxTrend, trendUp } = p
  const dir: RegimeDir = trendUp ? 'bullish' : 'bearish'
  const Dir = trendUp ? 'Bullish' : 'Bearish'
  // Ranging: squeeze atau ADX lemah → tanpa arah
  if (bbSqueeze || adx < 18)
    return { label: 'Ranging', phase: 'ranging', dir: 'netral', c: 'text-amber-400', desc: bbSqueeze ? 'volatilitas menyempit, tanpa arah jelas' : 'sideways / tren lemah' }
  // Trending: ADX kuat & MASIH menguat (arah terkonfirmasi)
  if (adx >= 25 && adxTrend !== 'turun')
    return { label: `Trending ${Dir}`, phase: 'trending', dir, c: trendUp ? 'text-emerald-400' : 'text-red-400', desc: trendUp ? 'tren naik kuat — ikuti arah beli' : 'tren turun kuat — ikuti arah jual' }
  // Sisanya (ADX 18-25 sedang terbentuk, atau ADX turun/momentum pudar) → arah belum pasti
  return { label: 'Sedang Konfirmasi Arah', phase: 'konfirmasi', dir: 'netral', c: 'text-sky-400', desc: `cenderung ${trendUp ? 'naik' : 'turun'}, tapi ${adxTrend === 'turun' ? 'momentum mulai pudar' : 'tren belum matang'} — tunggu konfirmasi` }
}
