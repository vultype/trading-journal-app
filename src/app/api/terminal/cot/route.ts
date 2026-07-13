import { NextResponse } from 'next/server'

// COT emas COMEX dari CFTC (publik, tanpa API key). Rilis mingguan (Jumat).
// Retail vs Institusi: Non-commercial=fund/spekulan besar, Commercial=hedger/bank,
// Non-reportable=trader kecil (proksi retail).
const URL = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=088691&$order=report_date_as_yyyy_mm_dd%20DESC&$limit=12'

type Group = { long: number; short: number; net: number; deltaNet: number }
type Cot = { date: string; funds: Group; commercials: Group; retail: Group; fundsHistory: number[]; retailHistory: number[] }

let cache: { data: Cot; at: number } | null = null
const TTL_MS = 6 * 3600_000 // mingguan → cache 6 jam cukup

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return NextResponse.json(cache.data)
  try {
    const res = await fetch(URL, { cache: 'no-store' })
    const rows = await res.json()
    if (!Array.isArray(rows) || !rows.length) throw new Error('COT kosong')
    const n = (v: unknown) => parseInt(String(v ?? '0'), 10) || 0
    const grp = (r: Record<string, unknown>, pfx: string, prev?: Record<string, unknown>): Group => {
      const long = n(r[`${pfx}_long_all`]), short = n(r[`${pfx}_short_all`]), net = long - short
      const pnet = prev ? n(prev[`${pfx}_long_all`]) - n(prev[`${pfx}_short_all`]) : net
      return { long, short, net, deltaNet: net - pnet }
    }
    const r0 = rows[0], r1 = rows[1]
    const netOf = (r: Record<string, unknown>, pfx: string) => n(r[`${pfx}_long_all`]) - n(r[`${pfx}_short_all`])
    // riwayat kronologis (lama -> baru) untuk sparkline tren posisi
    const hist = (rows as Record<string, unknown>[]).slice().reverse()
    const data: Cot = {
      date: String(r0.report_date_as_yyyy_mm_dd ?? '').slice(0, 10),
      funds: grp(r0, 'noncomm_positions', r1),
      commercials: grp(r0, 'comm_positions', r1),
      retail: grp(r0, 'nonrept_positions', r1),
      fundsHistory: hist.map(r => netOf(r, 'noncomm_positions')),
      retailHistory: hist.map(r => netOf(r, 'nonrept_positions')),
    }
    cache = { data, at: now }
    return NextResponse.json(data)
  } catch (err) {
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'fetch failed' }, { status: 502 })
  }
}
