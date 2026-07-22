// Bentuk data yang disimpan di fin_shares.payload dan dibaca halaman publik
// /s/[slug]. Dipakai bersama oleh klien (yang menyusunnya) dan server component
// (yang menampilkannya), jadi perubahannya harus lewat kenaikan `v`.
//
// Yang MASUK ke sini hanya angka hasil olahan. Tidak ada baris transaksi, tidak
// ada nama rekening, tidak ada catatan, tidak ada URL struk — bukan karena tidak
// muat, tapi karena apa pun yang ada di payload otomatis ikut terbuka ke siapa
// pun yang memegang tautannya, selamanya.

export const SHARE_V = 1 as const

export type ShareTone = 'good' | 'warn' | 'bad' | 'info'

export type SharePayload = {
  v: typeof SHARE_V
  period: string                       // label periode, mis. "Juli 2026"
  createdAt: string                    // ISO
  masked: boolean
  note?: string
  totals?: { income: number; expense: number; net: number }
  score?: {
    score: number
    band: { label: string; color: string }
    pillars: { label: string; weight: number; score: number; detail: string }[]
  }
  expense?: { name: string; color: string; v: number; pct: number }[]
  income?: { name: string; color: string; v: number; pct: number }[]
  insights?: { tone: ShareTone; title: string; text: string }[]
}

export const rpShare = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`

// Penyamaran nominal. Teks insight sudah terlanjur mengandung rupiah yang
// dirangkai saat dibuat, jadi menyaringnya di sini jauh lebih dapat diandalkan
// daripada menyusun ulang tiap kalimat tanpa angka — satu kalimat yang lupa
// diperbarui akan membocorkan nominal tanpa terlihat.
//
// Polanya sengaja spesifik (kelompok ribuan), bukan sekadar [\d.,]+ — versi
// longgar ikut melahap tanda baca di belakang angka, sehingga
// "…, selisih Rp250.000." berubah jadi "… selisih Rp•••" tanpa koma dan titik.
export const maskRp = (s: string) => s.replace(/Rp\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?/g, 'Rp•••')

export function maskPayload(p: SharePayload): SharePayload {
  if (!p.masked) return p
  return {
    ...p,
    totals: undefined,
    expense: p.expense?.map(r => ({ ...r, v: 0 })),
    income: p.income?.map(r => ({ ...r, v: 0 })),
    score: p.score ? { ...p.score, pillars: p.score.pillars.map(x => ({ ...x, detail: maskRp(x.detail) })) } : undefined,
    insights: p.insights?.map(i => ({ ...i, title: maskRp(i.title), text: maskRp(i.text) })),
  }
}

export const SHARE_TONE: Record<ShareTone, { bg: string; fg: string }> = {
  bad:  { bg: '#fef2f2', fg: '#ef4444' },
  warn: { bg: '#fffbeb', fg: '#f59e0b' },
  good: { bg: '#ecfdf5', fg: '#10b981' },
  info: { bg: '#F4F4F7', fg: '#6366f1' },
}
