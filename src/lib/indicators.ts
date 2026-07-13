// Indikator teknikal turunan — dihitung lokal dari candle Twelve Data (100% real).
// Dipakai untuk memperkaya insight di terminal (MACD, Bollinger, Stochastic, struktur).

export type Candle = { o: number; h: number; l: number; c: number; t: number; v?: number }

function ema(vals: number[], period: number): number[] {
  const k = 2 / (period + 1); const out: number[] = []; let prev = vals[0] ?? 0
  vals.forEach((v, i) => { prev = i ? v * k + prev * (1 - k) : v; out.push(prev) })
  return out
}

// RSI (14) — nilai terakhir
export function rsiCalc(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gain = 0, loss = 0
  for (let i = closes.length - period; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) gain += d; else loss -= d }
  const rs = loss === 0 ? 100 : gain / loss
  return 100 - 100 / (1 + rs)
}

// ATR (14) — rata-rata true range, dipakai untuk mengukur "ukuran" candle relatif volatilitas
export function atrCalc(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) { const c = candles[i], p = candles[i - 1]; trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c))) }
  const s = trs.slice(-period)
  return s.reduce((a, b) => a + b, 0) / s.length
}

// MACD (12,26,9) — nilai terakhir + status
export type Macd = { macd: number; signal: number; hist: number; state: 'bullish' | 'bearish' | 'netral' }
export function macdCalc(closes: number[], fast = 12, slow = 26, sig = 9): Macd {
  if (closes.length < slow + sig) return { macd: 0, signal: 0, hist: 0, state: 'netral' }
  const ef = ema(closes, fast), es = ema(closes, slow)
  const macdLine = closes.map((_, i) => ef[i] - es[i])
  const signalLine = ema(macdLine, sig)
  const m = macdLine[macdLine.length - 1], s = signalLine[signalLine.length - 1], h = m - s
  const state = h > 0 && m > 0 ? 'bullish' : h < 0 && m < 0 ? 'bearish' : h > 0 ? 'bullish' : 'bearish'
  return { macd: m, signal: s, hist: h, state: Math.abs(h) < 1e-6 ? 'netral' : state }
}

// Bollinger Bands (20,2) — %B & lebar pita (deteksi squeeze)
export type Boll = { upper: number; mid: number; lower: number; pctB: number; bandwidth: number; squeeze: boolean }
export function bollinger(closes: number[], period = 20, mult = 2): Boll {
  if (closes.length < period) return { upper: 0, mid: 0, lower: 0, pctB: 0.5, bandwidth: 0, squeeze: false }
  const slice = closes.slice(-period)
  const mid = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((a, b) => a + (b - mid) ** 2, 0) / period
  const sd = Math.sqrt(variance)
  const upper = mid + mult * sd, lower = mid - mult * sd
  const price = closes[closes.length - 1]
  const pctB = upper === lower ? 0.5 : (price - lower) / (upper - lower)
  const bandwidth = mid ? ((upper - lower) / mid) * 100 : 0
  // squeeze bila bandwidth di 25% terbawah dari 40 bar terakhir
  const bwHist: number[] = []
  for (let i = Math.max(period, closes.length - 40); i <= closes.length; i++) {
    const sl = closes.slice(i - period, i); if (sl.length < period) continue
    const m = sl.reduce((a, b) => a + b, 0) / period
    const v = sl.reduce((a, b) => a + (b - m) ** 2, 0) / period
    bwHist.push(m ? (2 * mult * Math.sqrt(v) / m) * 100 : 0)
  }
  const sorted = [...bwHist].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? bandwidth
  return { upper, mid, lower, pctB, bandwidth, squeeze: bandwidth <= q1 }
}

// Stochastic (14,3,3) — %K & %D
export type Stoch = { k: number; d: number; state: 'jenuh beli' | 'jenuh jual' | 'normal' }
export function stochastic(candles: Candle[], period = 14, smoothK = 3, smoothD = 3): Stoch {
  if (candles.length < period + smoothK + smoothD) return { k: 50, d: 50, state: 'normal' }
  const rawK: number[] = []
  for (let i = period - 1; i < candles.length; i++) {
    const win = candles.slice(i - period + 1, i + 1)
    const hh = Math.max(...win.map(c => c.h)), ll = Math.min(...win.map(c => c.l))
    rawK.push(hh === ll ? 50 : ((candles[i].c - ll) / (hh - ll)) * 100)
  }
  const sma = (arr: number[], p: number) => arr.map((_, i) => i < p - 1 ? arr[i] : arr.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p)
  const kArr = sma(rawK, smoothK), dArr = sma(kArr, smoothD)
  const k = kArr[kArr.length - 1], d = dArr[dArr.length - 1]
  return { k, d, state: k > 80 ? 'jenuh beli' : k < 20 ? 'jenuh jual' : 'normal' }
}

// Struktur pasar dari swing high/low (HH/HL = uptrend, LH/LL = downtrend)
export type Structure = { label: 'Uptrend' | 'Downtrend' | 'Sideways'; detail: string }
export function marketStructure(candles: Candle[], left = 3, right = 3): Structure {
  if (candles.length < left + right + 6) return { label: 'Sideways', detail: 'data kurang' }
  const highs: number[] = [], lows: number[] = []
  for (let i = left; i < candles.length - right; i++) {
    const win = candles.slice(i - left, i + right + 1)
    if (candles[i].h === Math.max(...win.map(c => c.h))) highs.push(candles[i].h)
    if (candles[i].l === Math.min(...win.map(c => c.l))) lows.push(candles[i].l)
  }
  const h = highs.slice(-2), l = lows.slice(-2)
  if (h.length < 2 || l.length < 2) return { label: 'Sideways', detail: 'swing belum jelas' }
  const hh = h[1] > h[0], hl = l[1] > l[0]
  if (hh && hl) return { label: 'Uptrend', detail: 'higher high & higher low' }
  if (!hh && !hl) return { label: 'Downtrend', detail: 'lower high & lower low' }
  return { label: 'Sideways', detail: 'swing campur / konsolidasi' }
}

// Skor momentum komposit -100..100 (gabungan RSI, MACD, Stoch, %B)
export function momentumScore(rsi: number, macd: Macd, stoch: Stoch, boll: Boll): number {
  let s = 0
  s += (rsi - 50) * 1.2
  s += macd.state === 'bullish' ? 30 : macd.state === 'bearish' ? -30 : 0
  s += (stoch.k - 50) * 0.4
  s += (boll.pctB - 0.5) * 40
  return Math.max(-100, Math.min(100, s))
}
