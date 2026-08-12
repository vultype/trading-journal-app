// Risiko SPIKE saat rilis data — seberapa BESAR pasar mungkin bergerak.
//
// ══ BATAS YANG MENENTUKAN SEGALANYA ══════════════════════════════════════
// Sebelum angkanya keluar, ARAH spike TIDAK BISA diprediksi. Yang menggerakkan
// harga adalah SELISIH antara angka aktual dan ekspektasi pasar — dan selisih
// itu belum ada sampai rilisnya terjadi. Alat mana pun yang mengklaim tahu arah
// spike sebelum rilis sedang menebak, bukan mengukur.
//
// Yang BISA diukur adalah BESARNYA: seberapa jauh harga cenderung terlempar,
// terlepas ke arah mana. Itu berguna untuk hal yang sangat konkret — lebar stop,
// ukuran lot, atau keputusan untuk tidak memegang posisi sama sekali.
//
// Modul ini karena itu SENGAJA tidak pernah mengeluarkan arah. Hanya besaran,
// pemicunya, dan tingkat keyakinannya.
// ═════════════════════════════════════════════════════════════════════════

export type SpikeTier = 1 | 2 | 3

// Bobot dampak per jenis rilis. Angka ini heuristik dari perilaku umum XAU/USD,
// BUKAN hasil backtest atas kalender historis — kita tidak menyimpan timestamp
// rilis masa lalu, jadi mengklaim "terukur" akan menyesatkan.
const TIER: { re: RegExp; tier: SpikeTier }[] = [
  { re: /non.?farm|nfp|payroll/i, tier: 3 },
  { re: /fomc|rate decision|suku bunga|interest rate/i, tier: 3 },
  { re: /\bcpi\b|inflasi|consumer price/i, tier: 3 },
  { re: /core pce|\bpce\b/i, tier: 2 },
  { re: /\bppi\b|producer price/i, tier: 2 },
  { re: /powell|fed chair|fed speech|pidato/i, tier: 2 },
  { re: /unemployment|pengangguran/i, tier: 2 },
  { re: /retail sales|penjualan ritel/i, tier: 2 },
  { re: /\bgdp\b|pdb/i, tier: 2 },
  { re: /\bism\b|\bpmi\b/i, tier: 1 },
  { re: /jobless|klaim pengangguran/i, tier: 1 },
]

export const tierOf = (event: string): SpikeTier =>
  TIER.find(t => t.re.test(event))?.tier ?? 1

// Perkiraan gerak 30 menit pertama, sebagai KELIPATAN ATR M15 saat ini.
// Rentang, bukan angka tunggal — memberi satu angka presisi untuk sesuatu yang
// sebaran hasilnya lebar akan memberi rasa pasti yang tidak dimiliki datanya.
const MULT: Record<SpikeTier, [number, number]> = {
  3: [2.5, 4.5],
  2: [1.8, 3.0],
  1: [1.2, 2.0],
}

export type SpikeInput = {
  event: string
  atrM15: number          // ATR M15 saat ini (poin)
  volRatio: number        // ATR7 / ATR40 di M5. <0.75 = terkompresi
  bbSqueeze: boolean      // Bollinger M15 menyempit
  session: string         // 'Asia' | 'London' | 'New York' | ...
  maxRangeM5: number      // range terbesar 30 bar M5 terakhir (poin) — TERUKUR
  surprisePct: number | null  // |aktual − forecast| / |forecast|, null bila belum rilis
}

export type SpikeResult = {
  tier: SpikeTier
  skor: number                 // 0-100
  risiko: 'Rendah' | 'Sedang' | 'Tinggi' | 'Ekstrem'
  gerakMin: number             // poin
  gerakMax: number             // poin
  pipsMin: number
  pipsMax: number
  pemicu: string[]             // faktor yang MENAIKKAN risiko
  peredam: string[]            // faktor yang MENURUNKAN risiko
  maxRangeM5: number
  sudahRilis: boolean
}

// 1 pip emas = 0.10 harga (lihat catatan di lot-calculator).
const toPips = (poin: number) => Math.round(poin * 10)

export function assessSpike(i: SpikeInput): SpikeResult {
  const tier = tierOf(i.event)
  let [lo, hi] = MULT[tier]
  const pemicu: string[] = []
  const peredam: string[] = []

  // Bobot dasar dari kelas rilisnya.
  let skor = tier === 3 ? 55 : tier === 2 ? 38 : 22
  if (tier === 3) pemicu.push('Rilis kelas berat — penggerak utama dolar & emas')
  else if (tier === 1) peredam.push('Rilis kelas ringan — dampak biasanya terbatas')

  // Kompresi volatilitas: pasar yang menyempit sebelum rilis cenderung melepas
  // lebih keras. Ini terukur, bukan asumsi — ATR7 vs ATR40 di M5.
  if (i.volRatio < 0.75) {
    skor += 18; lo *= 1.25; hi *= 1.35
    pemicu.push(`Volatilitas terkompresi (ATR7/ATR40 = ${i.volRatio.toFixed(2)}) — pegas tertekan`)
  } else if (i.volRatio > 1.4) {
    skor += 6
    pemicu.push(`Volatilitas sudah tinggi (${i.volRatio.toFixed(2)}×) — gerak besar sedang berlangsung`)
  }

  if (i.bbSqueeze) {
    skor += 12; hi *= 1.15
    pemicu.push('Bollinger M15 menyempit — energi menumpuk')
  }

  // Likuiditas tipis memperbesar lompatan untuk aliran order yang sama, dan
  // memperlebar slippage. Ini soal EKSEKUSI, bukan arah.
  if (/asia|sydney|tokyo/i.test(i.session)) {
    skor += 10; hi *= 1.2
    pemicu.push('Sesi Asia — likuiditas tipis, slippage & lompatan lebih besar')
  } else if (/new york|overlap/i.test(i.session)) {
    skor += 6
    pemicu.push('Sesi likuid — reaksi cepat tapi lebih tertata')
  }

  // Kejutan aktual vs forecast: INI penggerak sesungguhnya, dan baru ada setelah
  // rilis. Sebelum itu bagian ini kosong — bukan diisi tebakan.
  const sudahRilis = i.surprisePct != null
  if (sudahRilis) {
    const s = i.surprisePct!
    if (s >= 0.5) { skor += 25; lo *= 1.4; hi *= 1.6; pemicu.push(`Kejutan BESAR vs forecast (${(s * 100).toFixed(0)}%)`) }
    else if (s >= 0.15) { skor += 12; lo *= 1.15; hi *= 1.25; pemicu.push(`Kejutan sedang vs forecast (${(s * 100).toFixed(0)}%)`) }
    // Batas BAWAH ikut turun, bukan cuma atasnya. Rilis tanpa kejutan sering
    // nyaris tidak menggerakkan harga; menahan batas bawah di angka besar
    // membuat "tidak ada kejutan" tetap terbaca seolah pasti bergerak jauh.
    else { skor -= 12; lo *= 0.45; hi *= 0.7; peredam.push(`Aktual nyaris sesuai forecast (selisih ${(s * 100).toFixed(0)}%) — kejutan kecil`) }
  }

  skor = Math.max(0, Math.min(100, Math.round(skor)))
  const risiko = skor >= 78 ? 'Ekstrem' : skor >= 55 ? 'Tinggi' : skor >= 32 ? 'Sedang' : 'Rendah'

  const gerakMin = +(i.atrM15 * lo).toFixed(1)
  const gerakMax = +(i.atrM15 * hi).toFixed(1)

  return {
    tier, skor, risiko,
    gerakMin, gerakMax,
    pipsMin: toPips(gerakMin), pipsMax: toPips(gerakMax),
    pemicu, peredam,
    maxRangeM5: +i.maxRangeM5.toFixed(1),
    sudahRilis,
  }
}

// |aktual − forecast| / |forecast|. Mengembalikan null bila salah satu tak ada
// atau bukan angka — lebih baik kosong daripada angka yang dikarang.
export function surpriseOf(rows: { forecast?: string; actual?: string }[]): number | null {
  const n = (s?: string) => {
    if (!s) return null
    const v = parseFloat(String(s).replace(/[^\d.\-]/g, ''))
    return Number.isFinite(v) ? v : null
  }
  let best: number | null = null
  for (const r of rows) {
    const f = n(r.forecast), a = n(r.actual)
    if (f == null || a == null || f === 0) continue
    const s = Math.abs(a - f) / Math.abs(f)
    if (best == null || s > best) best = s
  }
  return best
}
