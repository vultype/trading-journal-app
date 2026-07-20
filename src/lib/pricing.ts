// Harga & paket langganan (dipakai subscription, checkout, billing)
// Semua tools berbayar = Rp99.000/bulan. Jurnal Tools TIDAK dijual terpisah —
// statusnya bonus untuk pelanggan Pro (lihat JURNAL_IS_BONUS di bawah).
export const BASE = { standar: 99000, pro: 99000, terminal: 99000 } as const

// Jurnal Tools adalah BONUS Pro: tak punya harga & tak bisa di-checkout.
export const JURNAL_IS_BONUS = true

export type PlanId = 'standar' | 'pro' | 'terminal'

export const DURATIONS = [
  { months: 1, off: 0, id: 'Bulanan', en: 'Monthly' },
  { months: 3, off: 10, id: '3 Bulan', en: '3 Months' },
  { months: 6, off: 20, id: '6 Bulan', en: '6 Months' },
  { months: 12, off: 35, id: '1 Tahun', en: '1 Year' },
] as const

// Harga paket dibulatkan ke ribuan terdekat
export const pkgPrice = (base: number, months: number, off: number) =>
  Math.round((base * months * (1 - off / 100)) / 1000) * 1000

export const planBase = (plan: PlanId) => (plan === 'terminal' ? BASE.terminal : plan === 'pro' ? BASE.pro : BASE.standar)
export const planName = (plan: PlanId) => (plan === 'terminal' ? 'Datalitiq AI Terminal' : plan === 'pro' ? 'Professional' : 'Standar')

export const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID')

// Rekening tujuan pembayaran manual (transfer bank)
export const BANK = {
  name: 'Bank Mandiri',
  number: '1270012873343',
  holder: 'MEGA SESVA',
  wa: '6281212124512',
}

// Kode unik 3 digit (100–999) untuk identifikasi transfer
export const genUniqueCode = () => 100 + Math.floor(Math.random() * 900)
