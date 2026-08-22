// Perhitungan aturan prop firm. Semua nominal dalam USD.
//
// Angka di file ini menjawab satu pertanyaan: "apakah saya sudah melanggar
// aturan?" Salah hitung di sini bukan sekadar tampilan yang keliru — trader bisa
// merasa aman padahal akunnya sudah hangus. Karena itu tiap keputusan yang
// ambigu ditulis alasannya, bukan dipilih diam-diam.

export type PfAccount = {
  id: string
  name: string
  firm: string | null
  phase: 'challenge' | 'verifikasi' | 'funded'
  initial_balance: number
  daily_loss_pct: number
  max_loss_pct: number
  profit_target_pct: number
  drawdown_type: 'static' | 'trailing'
  payout_share_pct: number
  usd_idr: number
  consistency_on: boolean
  consistency_pct: number
  note: string | null
  archived: boolean
}

export type PfTrade = {
  id: string
  account_id: string
  date: string          // YYYY-MM-DD
  pair: string | null
  direction: string | null
  pnl: number           // USD, boleh negatif
  rr: number | null
  note: string | null
}

export type HariRow = { date: string; pnl: number; saldoAwal: number; saldoAkhir: number; trades: number }

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Kelompokkan per tanggal + saldo awal/akhir tiap hari.
//
// Saldo awal hari dibutuhkan karena batas rugi HARIAN mayoritas prop firm
// dihitung dari saldo saat hari itu dimulai — bukan dari saldo awal akun. Dua
// basis ini memberi angka berbeda begitu akun sudah bergerak dari titik nol.
export function perHari(trades: PfTrade[], initial: number): HariRow[] {
  const m = new Map<string, { pnl: number; n: number }>()
  for (const t of trades) {
    const g = m.get(t.date) ?? { pnl: 0, n: 0 }
    g.pnl += Number(t.pnl); g.n++
    m.set(t.date, g)
  }
  let saldo = initial
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, g]) => {
      const saldoAwal = saldo
      saldo += g.pnl
      return { date, pnl: g.pnl, saldoAwal, saldoAkhir: saldo, trades: g.n }
    })
}

export type PfStatus = {
  saldo: number
  totalPnl: number
  puncak: number              // saldo tertinggi yang pernah dicapai

  // Batas rugi harian
  batasHarianUsd: number      // nominal rugi maksimum hari ini
  rugiHariIni: number         // positif = sedang rugi
  sisaHarianUsd: number
  harianTerpakaiPct: number   // 0-100+
  harianBreach: boolean

  // Batas rugi total
  lantaiUsd: number           // saldo terendah yang masih boleh
  jarakLantaiUsd: number
  totalTerpakaiPct: number
  totalBreach: boolean

  // Target profit
  targetUsd: number           // saldo yang harus dicapai
  targetProgressPct: number   // 0-100
  targetTercapai: boolean

  // Bagi hasil
  profitBagiHasil: number     // profit di atas modal awal, minimum 0
  payoutUsd: number
  payoutIdr: number
  bagianFirmUsd: number

  // Konsistensi
  konsistensi: null | {
    hariTerbesar: string
    profitHariTerbesar: number
    porsiPct: number          // porsi hari terbesar terhadap total profit
    batasPct: number
    lolos: boolean
    // Berapa lagi total profit yang dibutuhkan agar porsinya turun ke batas.
    butuhProfitTambahanUsd: number
  }

  hari: HariRow[]
  hariIni: HariRow | null
}

export function hitungStatus(acc: PfAccount, trades: PfTrade[], tanggalHariIni = todayISO()): PfStatus {
  const init = Number(acc.initial_balance)
  const hari = perHari(trades, init)
  const saldo = hari.length ? hari[hari.length - 1].saldoAkhir : init
  const totalPnl = saldo - init

  // Saldo tertinggi yang pernah dicapai, dihitung dari penutupan tiap hari.
  // Dipakai untuk trailing drawdown.
  const puncak = hari.reduce((mx, h) => Math.max(mx, h.saldoAkhir), init)

  // ── Batas rugi HARIAN ──
  // Basis = saldo saat hari itu dimulai. Untuk hari yang belum ada tradenya,
  // basisnya saldo sekarang.
  const hariIni = hari.find(h => h.date === tanggalHariIni) ?? null
  const basisHarian = hariIni ? hariIni.saldoAwal : saldo
  const batasHarianUsd = basisHarian * Number(acc.daily_loss_pct) / 100
  const rugiHariIni = hariIni ? Math.max(0, -hariIni.pnl) : 0
  const sisaHarianUsd = Math.max(0, batasHarianUsd - rugiHariIni)
  const harianTerpakaiPct = batasHarianUsd > 0 ? (rugiHariIni / batasHarianUsd) * 100 : 0
  // Batas dianggap terlanggar saat rugi MENYENTUH batas, bukan hanya melewatinya
  // — itu cara prop firm menilai, dan menunggu "lebih dari" membuat peringatan
  // datang terlambat.
  const harianBreach = batasHarianUsd > 0 && rugiHariIni >= batasHarianUsd

  // ── Batas rugi TOTAL ──
  // static  : lantai tetap dari saldo awal
  // trailing: lantai mengikuti puncak, ikut naik saat profit & tidak turun lagi
  const basisTotal = acc.drawdown_type === 'trailing' ? puncak : init
  const lantaiUsd = basisTotal - basisTotal * Number(acc.max_loss_pct) / 100
  const jarakLantaiUsd = saldo - lantaiUsd
  const ruangTotal = basisTotal - lantaiUsd
  const totalTerpakaiPct = ruangTotal > 0 ? Math.min(100, Math.max(0, (basisTotal - saldo) / ruangTotal * 100)) : 0
  const totalBreach = saldo <= lantaiUsd

  // ── Target profit ──
  const targetUsd = init + init * Number(acc.profit_target_pct) / 100
  const targetProfit = targetUsd - init
  const targetProgressPct = targetProfit > 0 ? Math.min(100, Math.max(0, totalPnl / targetProfit * 100)) : 0
  const targetTercapai = saldo >= targetUsd

  // ── Bagi hasil ──
  // Hanya dari profit DI ATAS modal awal. Akun yang masih minus tidak
  // menghasilkan payout negatif — tidak ada yang dibagi.
  const profitBagiHasil = Math.max(0, totalPnl)
  const payoutUsd = profitBagiHasil * Number(acc.payout_share_pct) / 100
  const payoutIdr = payoutUsd * Number(acc.usd_idr)
  const bagianFirmUsd = profitBagiHasil - payoutUsd

  // ── Konsistensi ──
  // Aturan: profit hari terbesar tidak boleh melebihi X% dari TOTAL profit.
  // Hanya hari yang PROFIT yang dinilai; hari rugi tidak punya "porsi profit".
  let konsistensi: PfStatus['konsistensi'] = null
  if (acc.consistency_on) {
    const hariProfit = hari.filter(h => h.pnl > 0)
    if (hariProfit.length && profitBagiHasil > 0) {
      const terbesar = hariProfit.reduce((a, b) => (b.pnl > a.pnl ? b : a))
      const porsiPct = terbesar.pnl / profitBagiHasil * 100
      const batasPct = Number(acc.consistency_pct)
      // Total profit minimum agar hari terbesar hanya berporsi batasPct.
      const totalDibutuhkan = batasPct > 0 ? terbesar.pnl / (batasPct / 100) : Infinity
      konsistensi = {
        hariTerbesar: terbesar.date,
        profitHariTerbesar: terbesar.pnl,
        porsiPct,
        batasPct,
        lolos: porsiPct <= batasPct,
        butuhProfitTambahanUsd: Math.max(0, totalDibutuhkan - profitBagiHasil),
      }
    }
  }

  return {
    saldo, totalPnl, puncak,
    batasHarianUsd, rugiHariIni, sisaHarianUsd, harianTerpakaiPct, harianBreach,
    lantaiUsd, jarakLantaiUsd, totalTerpakaiPct, totalBreach,
    targetUsd, targetProgressPct, targetTercapai,
    profitBagiHasil, payoutUsd, payoutIdr, bagianFirmUsd,
    konsistensi,
    hari, hariIni,
  }
}

export const usd = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const idr = (n: number) =>
  `${n < 0 ? '-' : ''}Rp${Math.round(Math.abs(n)).toLocaleString('id-ID')}`

export const PHASE_LABEL: Record<PfAccount['phase'], string> = {
  challenge: 'Challenge',
  verifikasi: 'Verifikasi',
  funded: 'Funded',
}
