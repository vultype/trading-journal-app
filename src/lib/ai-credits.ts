// Konfigurasi Kredit AI (token) — dipakai bersama client & server.
// Model: subscription Pro dapat ALLOWANCE bulanan (reset tiap siklus, tak roll-over) +
// SALDO TOPUP permanen. Tiap aksi AI memotong kredit: allowance dulu, lalu topup.
//
// Angka DASAR dari biaya real Anthropic (console, Jul 2026) + buffer ~30% untuk
// nutup retry, fluktuasi harga, dan biaya API lain (Twelve Data, hosting). BUKAN profit.
// Semua angka di sini gampang diubah tanpa mengubah arsitektur.

export const RP_PER_CREDIT = 100 // 1 kredit = Rp100

// Jenis aksi AI yang dikenai biaya. Tiap endpoint AI dipetakan ke salah satu ini.
export type AiAction = 'analysis' | 'scope' | 'news'

// Biaya kredit per aksi (real cost → +~30% buffer):
//  analysis: Opus + extended thinking (paling mahal) ~Rp1.750 → 23 kredit (Rp2.300)
//  scope   : Opus tanpa thinking (per-tab)          ~Rp850  → 11 kredit (Rp1.100)
//  news    : Opus tanpa thinking (dampak berita)    ~Rp1.200 → 16 kredit (Rp1.600)
export const CREDIT_COST: Record<AiAction, number> = {
  analysis: 23,
  scope: 11,
  news: 16,
}

export const AI_ACTION_LABEL: Record<AiAction, string> = {
  analysis: 'Analisa AI Menyeluruh',
  scope: 'Analisa per-Tab (Teknikal/Makro/Sentimen)',
  news: 'Analisa Dampak Berita',
}

// Jatah gratis bulanan untuk subscriber Pro (reset tiap siklus billing, tak roll-over).
// ~10x Analisa AI utama, atau campuran lebih banyak bila pakai scope/news.
export const MONTHLY_ALLOWANCE = 250

// Paket topup (dijual sebagai nominal kredit). Harga = kredit × RP_PER_CREDIT.
export type TopupPackage = { id: string; credits: number; price: number; label: string; popular?: boolean }
export const TOPUP_PACKAGES: TopupPackage[] = [
  { id: 'kecil', credits: 100, price: 10_000, label: 'Kecil' },
  { id: 'sedang', credits: 250, price: 25_000, label: 'Sedang', popular: true },
  { id: 'besar', credits: 500, price: 50_000, label: 'Besar' },
]

export const findPackage = (id: string) => TOPUP_PACKAGES.find(p => p.id === id) || null

// Top up jumlah custom (user isi sendiri). Harga = credits × RP_PER_CREDIT.
// Min Rp10.000 (100 kredit) menyesuaikan minimum transfer/VA gateway.
export const CUSTOM_TOPUP_MIN = 100    // 100 kredit = Rp10.000
export const CUSTOM_TOPUP_MAX = 10_000 // 10.000 kredit = Rp1.000.000

// Perkiraan berapa kali sebuah aksi bisa dijalankan dari sejumlah kredit.
export const runsFor = (credits: number, action: AiAction) => Math.floor(credits / CREDIT_COST[action])
