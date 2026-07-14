// FRED (Federal Reserve, St. Louis) — data makro real. Key server-side saja.
// Data harian/bulanan (rilis), bukan tick intraday — cocok untuk konteks makro.
const BASE = 'https://api.stlouisfed.org/fred/series/observations'

export type FredSeries = {
  key: string; id: string; name: string; sub: string
  dec: number; unit: string; corr: number; units?: string
}

// corr = korelasi ke EMAS (dolar/yield naik = bearish emas = -1)
export const FRED_SERIES: FredSeries[] = [
  { key: 'dollar', id: 'DTWEXBGS', name: 'Indeks Dolar', sub: 'Broad USD Index (Fed)', dec: 2, unit: '', corr: -1 },
  { key: 'us10y', id: 'DGS10', name: 'US10Y', sub: 'Yield Treasury 10 Thn', dec: 2, unit: '%', corr: -1 },
  { key: 'us02y', id: 'DGS2', name: 'US02Y', sub: 'Yield Treasury 2 Thn', dec: 2, unit: '%', corr: -1 },
  { key: 'realyield', id: 'DFII10', name: 'Real Yield 10Y', sub: 'TIPS — turun = bullish emas', dec: 2, unit: '%', corr: -1 },
  { key: 'breakeven', id: 'T10YIE', name: 'Ekspektasi Inflasi 10Y', sub: 'Breakeven — naik = bullish emas', dec: 2, unit: '%', corr: 1 },
  { key: 'cpi', id: 'CPIAUCSL', units: 'pc1', name: 'CPI (YoY)', sub: 'Inflasi headline AS', dec: 1, unit: '%', corr: -1 },
  { key: 'corecpi', id: 'CPILFESL', units: 'pc1', name: 'Core CPI (YoY)', sub: 'Inflasi inti (ex food & energy)', dec: 1, unit: '%', corr: -1 },
  { key: 'corepce', id: 'PCEPILFE', units: 'pc1', name: 'Core PCE (YoY)', sub: 'Gauge favorit The Fed', dec: 1, unit: '%', corr: -1 },
  { key: 'fedfunds', id: 'FEDFUNDS', name: 'Fed Funds Rate', sub: 'Suku bunga acuan', dec: 2, unit: '%', corr: -1 },
  { key: 'unrate', id: 'UNRATE', name: 'Pengangguran', sub: 'Unemployment — naik = dovish Fed', dec: 1, unit: '%', corr: 1 },
  { key: 'nfp', id: 'PAYEMS', units: 'chg', name: 'NFP (perubahan bulanan)', sub: 'Nonfarm Payrolls — lemah = dovish (bullish emas)', dec: 0, unit: 'K', corr: 1 },
  { key: 'wagegrowth', id: 'CES0500000003', units: 'pc1', name: 'Pertumbuhan Upah (YoY)', sub: 'Average Hourly Earnings — naik = tekanan inflasi', dec: 1, unit: '%', corr: -1 },
]

export type MacroPoint = { key: string; value: number; prior: number; date: string }

function keyParam() {
  const k = process.env.FRED_API_KEY
  if (!k) throw new Error('FRED_API_KEY belum diset')
  return k
}

async function fetchSeries(s: FredSeries): Promise<MacroPoint | null> {
  const url = `${BASE}?series_id=${s.id}&api_key=${keyParam()}&file_type=json&sort_order=desc&limit=6${s.units ? `&units=${s.units}` : ''}`
  const res = await fetch(url, { cache: 'no-store' })
  const j = await res.json()
  const obs = (j.observations ?? []) as { date: string; value: string }[]
  const valid = obs.filter(o => o.value !== '.' && o.value !== '' && !isNaN(parseFloat(o.value)))
  if (valid.length < 1) return null
  return { key: s.key, value: parseFloat(valid[0].value), prior: parseFloat((valid[1] ?? valid[0]).value), date: valid[0].date }
}

export async function fetchMacro(): Promise<MacroPoint[]> {
  const results = await Promise.all(FRED_SERIES.map(s => fetchSeries(s).catch(() => null)))
  return results.filter((r): r is MacroPoint => r !== null)
}
