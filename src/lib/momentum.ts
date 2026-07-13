// Deteksi "momentum candle" XAU/USD — dipakai oleh /api/terminal/momentum-alert.
// Definisi: body candle besar (>=1.5x ATR rata-rata) DAN momentum score komposit
// baru masuk zona kuat (>=60 / <=-60), searah dengan arah candle. Mengevaluasi
// candle yang SUDAH TERTUTUP (bukan candle yang masih terbentuk) agar sinyal stabil.

import type { TDCandle } from './twelvedata'
import { macdCalc, bollinger, stochastic, marketStructure, momentumScore, rsiCalc, atrCalc, type Candle } from './indicators'

export type MomentumSignal = {
  direction: 'bullish' | 'bearish'
  candleTime: number
  price: number
  bodyRatio: number
  momentum: number
  rsi: number
  macdState: string
  structure: string
}

const BODY_RATIO_MIN = 1.5
const MOMENTUM_MIN = 60

export function detectMomentumCandle(raw: TDCandle[]): MomentumSignal | null {
  // butuh cukup histori untuk MACD(26)+signal(9) & Bollinger(20) & swing structure
  if (raw.length < 45) return null
  const candles: Candle[] = raw.map(c => ({ ...c, v: 1 }))
  const idx = candles.length - 2 // candle terakhir yang sudah pasti tertutup
  if (idx < 40) return null

  const upTo = candles.slice(0, idx + 1)
  const closes = upTo.map(c => c.c)
  const evalCandle = candles[idx]
  const atr = atrCalc(candles.slice(0, idx), 14) // ATR sebelum candle ini, biar tidak bias oleh candle itu sendiri
  if (!atr) return null

  const body = Math.abs(evalCandle.c - evalCandle.o)
  const bodyRatio = body / atr
  if (bodyRatio < BODY_RATIO_MIN) return null

  const rsi = rsiCalc(closes)
  const macd = macdCalc(closes)
  const stoch = stochastic(upTo)
  const boll = bollinger(closes)
  const structure = marketStructure(upTo)
  const momentum = momentumScore(rsi, macd, stoch, boll)

  const candleDir: 'bullish' | 'bearish' = evalCandle.c >= evalCandle.o ? 'bullish' : 'bearish'
  const momentumDir: 'bullish' | 'bearish' = momentum >= 0 ? 'bullish' : 'bearish'
  if (candleDir !== momentumDir) return null
  if (Math.abs(momentum) < MOMENTUM_MIN) return null

  return {
    direction: candleDir, candleTime: evalCandle.t, price: evalCandle.c,
    bodyRatio, momentum, rsi, macdState: macd.state, structure: structure.label,
  }
}
