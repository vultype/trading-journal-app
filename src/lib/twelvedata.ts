// Twelve Data — sumber harga XAU/USD live (Fase 2 terminal). Key server-side saja.
const BASE = 'https://api.twelvedata.com'
const SYMBOL = 'XAU/USD'

export type TDQuote = {
  price: number; changePct: number; dayHigh: number; dayLow: number
  open: number; previousClose: number
}

export type TDCandle = { o: number; h: number; l: number; c: number; t: number }

function key() {
  const k = process.env.TWELVE_DATA_API_KEY
  if (!k) throw new Error('TWELVE_DATA_API_KEY belum diset')
  return k
}

export async function fetchQuote(): Promise<TDQuote> {
  const res = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(SYMBOL)}&apikey=${key()}`, { cache: 'no-store' })
  const j = await res.json()
  if (j.status === 'error' || j.code) throw new Error(j.message || 'Twelve Data quote error')
  return {
    price: parseFloat(j.close), changePct: parseFloat(j.percent_change),
    dayHigh: parseFloat(j.high), dayLow: parseFloat(j.low),
    open: parseFloat(j.open), previousClose: parseFloat(j.previous_close),
  }
}

const TD_INTERVAL: Record<'M5' | 'M15' | 'H1', string> = { M5: '5min', M15: '15min', H1: '1h' }

export type Pivots = { P: number; R1: number; R2: number; S1: number; S2: number }

// Pivot harian standar dari OHLC hari sebelumnya (candle 1day, ambil bar kemarin)
export async function fetchDailyPivots(): Promise<Pivots | null> {
  const res = await fetch(`${BASE}/time_series?symbol=${encodeURIComponent(SYMBOL)}&interval=1day&outputsize=2&apikey=${key()}`, { cache: 'no-store' })
  const j = await res.json()
  if (j.status === 'error' || j.code) throw new Error(j.message || 'Twelve Data pivots error')
  const v = (j.values ?? []) as { high: string; low: string; close: string }[]
  if (v.length < 2) return null
  const prev = v[1] // v[0] = hari ini (masih terbentuk), v[1] = kemarin (selesai)
  const H = parseFloat(prev.high), L = parseFloat(prev.low), C = parseFloat(prev.close)
  const P = (H + L + C) / 3
  return { P, R1: 2 * P - L, R2: P + (H - L), S1: 2 * P - H, S2: P - (H - L) }
}

export async function fetchCandles(tf: 'M5' | 'M15' | 'H1', outputsize = 150): Promise<TDCandle[]> {
  const interval = TD_INTERVAL[tf]
  const res = await fetch(`${BASE}/time_series?symbol=${encodeURIComponent(SYMBOL)}&interval=${interval}&outputsize=${outputsize}&apikey=${key()}`, { cache: 'no-store' })
  const j = await res.json()
  if (j.status === 'error' || j.code) throw new Error(j.message || 'Twelve Data time_series error')
  const values = (j.values ?? []) as { datetime: string; open: string; high: string; low: string; close: string }[]
  return values
    .map(v => ({ o: parseFloat(v.open), h: parseFloat(v.high), l: parseFloat(v.low), c: parseFloat(v.close), t: new Date(v.datetime.replace(' ', 'T') + 'Z').getTime() }))
    .reverse() // API mengirim terbaru dulu — balik jadi kronologis (lama -> baru)
}
