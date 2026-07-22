// ═══════════════════════════════════════════════════════════════════════════
// INDEKS DOLAR SINTETIS DARI FOREX — pengganti proxy ETF UUP.
//
// MASALAH yang dipecahkan: UUP (dan IEF) adalah ETF bursa AS yang hanya trading
// 09:30–16:00 ET. Di luar jam itu — termasuk SELURUH sesi Asia & sebagian Eropa —
// candle-nya BEKU di harga penutupan terakhir. Terminal jadi menampilkan
// "dampak dolar −100" dengan penuh keyakinan padahal itu pembacaan berjam-jam
// lalu, sementara emas bergerak live. Terverifikasi: pada 01:43 UTC, candle
// XAU berumur 4 menit sedangkan UUP/IEF berumur 349 menit.
//
// SOLUSI: pasangan forex mayor trading ~24 jam (Minggu 22:00 – Jumat 22:00 UTC),
// jadi indeks dolar bisa disusun ulang dari sana dan tetap hidup sepanjang sesi.
//
// Bobot mengikuti komposisi DXY untuk mata uang yang tersedia:
//   EUR 57.6% · JPY 13.6% · GBP 11.9% · CHF 3.6%  (total 86.7% dari DXY)
// CAD & SEK dilewati (bobot kecil, menambah panggilan API tanpa manfaat berarti).
// Bobot dinormalisasi ulang ke total 1 supaya skalanya tetap konsisten.
// ═══════════════════════════════════════════════════════════════════════════
import type { Candle } from './terminal-signal'

export const FX_PAIRS = ['EUR/USD', 'USD/JPY', 'GBP/USD', 'USD/CHF'] as const
export type FxPair = (typeof FX_PAIRS)[number]

// invert = true berarti pasangan ditulis XXX/USD, jadi naiknya pasangan =
// MELEMAHNYA dolar → kontribusinya ke indeks dolar bertanda negatif.
const W: Record<FxPair, { w: number; invert: boolean }> = {
  'EUR/USD': { w: 0.576, invert: true },
  'USD/JPY': { w: 0.136, invert: false },
  'GBP/USD': { w: 0.119, invert: true },
  'USD/CHF': { w: 0.036, invert: false },
}
const TOTAL_W = Object.values(W).reduce((s, x) => s + x.w, 0)

// Nilai indeks dari satu set harga. Memakai log-return berbobot (pendekatan
// geometrik seperti DXY asli), lalu di-skala ke ~100 agar mudah dibaca.
function indexValue(prices: Partial<Record<FxPair, number>>): number | null {
  let sum = 0, used = 0
  for (const p of FX_PAIRS) {
    const v = prices[p]
    if (!v || v <= 0) continue
    const { w, invert } = W[p]
    sum += (w / TOTAL_W) * Math.log(v) * (invert ? -1 : 1)
    used += w
  }
  if (used < TOTAL_W * 0.5) return null   // butuh mayoritas bobot agar bermakna
  return 100 * Math.exp(sum)
}

/**
 * Susun candle indeks dolar dari candle beberapa pasangan forex.
 * Bar disejajarkan berdasarkan timestamp; hanya timestamp yang ada di SEMUA
 * pasangan yang dipakai, supaya tiap bar indeks mewakili momen yang sama.
 */
export function buildDollarIndex(series: Partial<Record<FxPair, Candle[]>>): Candle[] {
  const avail = FX_PAIRS.filter(p => (series[p]?.length ?? 0) > 0)
  if (!avail.length) return []

  // Timestamp yang dimiliki SEMUA pasangan
  const maps = new Map<FxPair, Map<number, Candle>>()
  for (const p of avail) maps.set(p, new Map(series[p]!.map(c => [c.t, c])))
  const base = series[avail[0]]!
  const out: Candle[] = []

  for (const b of base) {
    const row: Partial<Record<FxPair, Candle>> = {}
    let complete = true
    for (const p of avail) {
      const c = maps.get(p)!.get(b.t)
      if (!c) { complete = false; break }
      row[p] = c
    }
    if (!complete) continue

    // pick menerima NAMA pasangan, bukan objek candle — supaya aturan invert
    // ditentukan secara eksplisit dari tabel bobot, bukan dari perbandingan
    // identitas objek yang mudah salah.
    const px = (pick: (c: Candle, p: FxPair) => number) => {
      const o: Partial<Record<FxPair, number>> = {}
      for (const p of avail) o[p] = pick(row[p]!, p)
      return indexValue(o)
    }
    // PENTING untuk high/low: indeks dolar mencapai TERTINGGI saat pasangan
    // XXX/USD (yang di-invert) berada di TERENDAH, dan pasangan USD/XXX di
    // tertingginya. Memakai high untuk semuanya akan melebih-lebihkan range.
    const o = px(c => c.o)
    const c_ = px(c => c.c)
    const h = px((c, p) => (W[p].invert ? c.l : c.h))
    const l = px((c, p) => (W[p].invert ? c.h : c.l))
    if (o == null || c_ == null) continue
    const hi = h ?? Math.max(o, c_), lo = l ?? Math.min(o, c_)
    out.push({ o, c: c_, h: Math.max(hi, o, c_), l: Math.min(lo, o, c_), t: b.t, v: 1 })
  }
  return out
}

// Umur data terakhir dalam menit — dipakai untuk menandai proxy yang beku
// (ETF di luar jam bursa) supaya tidak dipakai seolah-olah masih hidup.
export function ageMinutes(candles: Candle[] | null | undefined): number | null {
  if (!candles || !candles.length) return null
  return (Date.now() - candles[candles.length - 1].t) / 60_000
}

// Ambang basi. Bar M5 normal berumur <10 menit; 45 menit sudah pasti bukan
// sekadar keterlambatan biasa, melainkan pasar sumbernya sedang tutup.
export const STALE_MIN = 45
