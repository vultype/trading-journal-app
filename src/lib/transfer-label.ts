import type { TransferType } from '@/types'

// Label & warna tiap jenis transfer, satu sumber untuk seluruh aplikasi.
//
// Sebelumnya tiap halaman menulis `type === 'deposit' ? 'Deposit' : 'Withdraw'`.
// Pola itu diam-diam salah begitu ada jenis ketiga: penyesuaian rekonsiliasi
// akan tampil sebagai "Withdraw" tanpa ada yang menyadarinya.
export const TRANSFER_META: Record<TransferType, { label: string; short: string; color: string; bg: string }> = {
  deposit:      { label: 'Deposit',            short: 'Deposit',  color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  withdraw:     { label: 'Withdraw',           short: 'Withdraw', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  adjust_cost:  { label: 'Biaya tak tercatat', short: 'Biaya',    color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  adjust_other: { label: 'Koreksi saldo',      short: 'Koreksi',  color: 'text-sky-400',    bg: 'bg-sky-500/10' },
  expense:      { label: 'Pengeluaran Pribadi', short: 'Pribadi', color: 'text-rose-400',   bg: 'bg-rose-500/10' },
}

export const transferMeta = (t: TransferType) => TRANSFER_META[t] ?? TRANSFER_META.withdraw

// Dampak sebuah baris terhadap saldo. deposit positif; withdraw & expense
// negatif (amount-nya positif, arah dari jenisnya); penyesuaian memakai tandanya
// sendiri karena amount-nya boleh negatif.
export const transferDelta = (t: { type: TransferType; amount: number }) =>
  t.type === 'deposit' ? t.amount
  : t.type === 'withdraw' || t.type === 'expense' ? -t.amount
  : t.amount
