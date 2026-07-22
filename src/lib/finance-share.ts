// Bentuk data yang disimpan di fin_shares.payload dan dibaca halaman publik
// /s/[slug]. Dipakai bersama oleh klien (yang menyusunnya) dan halaman publik
// (yang menampilkannya).
//
// Apa pun yang ada di payload otomatis ikut terbuka ke siapa pun yang memegang
// tautannya, selamanya. Karena itu tiap tambahan isi punya sakelarnya sendiri
// di UI, bukan ikut satu sakelar besar.
//
// v1 → v2  rincian agregat per kategori + deret chart.
// v2 → v3  daftar transaksi per kategori (tanggal, catatan, nominal) dan total
//          saldo. Ini isi paling sensitif: catatan transaksi adalah teks bebas
//          yang bisa memuat nama orang, nomor, atau apa pun yang pernah diketik
//          — jadi pilihannya harus sadar, bukan efek samping.
//
// Yang TETAP tidak pernah ikut: nama rekening, URL struk, dan id apa pun yang
// bisa dipakai menelusuri balik ke baris aslinya.
//
// Tautan versi lama tetap bisa dibuka: seluruh field baru opsional, jadi halaman
// lama menampilkan lebih sedikit, bukan gagal.

export const SHARE_V = 3 as const
export type ShareVersion = 1 | 2 | 3

export type ShareTone = 'good' | 'warn' | 'bad' | 'info'

export type ShareTx = { d: string; n?: string; v: number }

export type ShareCat = {
  name: string; color: string; v: number; pct: number
  count?: number          // jumlah transaksi
  avg?: number            // rata-rata per transaksi
  max?: number            // transaksi terbesar
  days?: number           // hari aktif
  trend?: number[]        // 6 bulan terakhir, sejajar dengan monthLabels
  txs?: ShareTx[]         // daftar transaksi (opsional, dibatasi 60 baris)
}

export type SharePoint = { label: string; masuk: number; keluar: number }

export type SharePayload = {
  v: ShareVersion
  period: string                       // label periode, mis. "Juli 2026"
  createdAt: string                    // ISO
  masked: boolean
  note?: string
  totals?: { income: number; expense: number; net: number }
  balance?: number                     // total saldo seluruh rekening saat dibuat
  score?: {
    score: number
    band: { label: string; color: string }
    pillars: { label: string; weight: number; score: number; detail: string }[]
  }
  expense?: ShareCat[]
  income?: ShareCat[]
  insights?: { tone: ShareTone; title: string; text: string }[]
  monthLabels?: string[]               // label untuk ShareCat.trend & cashflow
  cashflow?: SharePoint[]              // 6 bulan
  daily?: SharePoint[]                 // harian dalam periode (dibatasi 120 titik)
  rel?: boolean                        // true = angka chart sudah jadi indeks relatif 0–100
}

export const rpShare = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`

// Penyamaran nominal pada teks. Teks insight sudah terlanjur mengandung rupiah
// yang dirangkai saat dibuat, jadi menyaringnya di sini jauh lebih dapat
// diandalkan daripada menyusun ulang tiap kalimat tanpa angka — satu kalimat
// yang lupa diperbarui akan membocorkan nominal tanpa terlihat.
//
// Polanya sengaja spesifik (kelompok ribuan), bukan sekadar [\d.,]+ — versi
// longgar ikut melahap tanda baca di belakang angka, sehingga
// "…, selisih Rp250.000." berubah jadi "… selisih Rp•••" tanpa koma dan titik.
export const maskRp = (s: string) => s.replace(/Rp\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?/g, 'Rp•••')

// Saat nominal disembunyikan, chart TIDAK dikosongkan — nilainya diubah jadi
// indeks relatif 0–100. Bentuk grafiknya (naik, turun, mana yang lebih besar)
// tetap tersampaikan tanpa satu pun angka rupiah ikut terbawa.
const relOf = (vals: number[], max: number) => max > 0 ? vals.map(v => (v / max) * 100) : vals.map(() => 0)

function relPoints(pts: SharePoint[]): SharePoint[] {
  // Satu skala untuk KEDUA deret. Kalau masuk dan keluar diskalakan sendiri-
  // sendiri, batang keduanya jadi sama tinggi dan justru menyiratkan yang salah:
  // seolah pemasukan dan pengeluaran seimbang padahal belum tentu.
  const max = Math.max(0, ...pts.flatMap(p => [p.masuk, p.keluar]))
  const m = relOf(pts.map(p => p.masuk), max)
  const k = relOf(pts.map(p => p.keluar), max)
  return pts.map((p, i) => ({ label: p.label, masuk: m[i], keluar: k[i] }))
}

export function maskPayload(p: SharePayload): SharePayload {
  if (!p.masked) return p
  const cat = (rows?: ShareCat[]): ShareCat[] | undefined => rows?.map(r => ({
    ...r, v: 0, avg: undefined, max: undefined,
    // Tanggal dan catatan tetap — itulah gunanya daftar transaksi. Yang
    // disamarkan nominalnya, konsisten dengan bagian lain halaman.
    txs: r.txs?.map(t => ({ ...t, v: 0 })),
    // Tren per kategori diskalakan terhadap puncaknya SENDIRI: grafik ini hanya
    // pernah dilihat satu kategori pada satu waktu, jadi yang berguna adalah
    // bentuknya. Labelnya di UI menyebut ini relatif, bukan nominal.
    trend: r.trend ? relOf(r.trend, Math.max(0, ...r.trend)) : undefined,
  }))
  return {
    ...p,
    rel: true,
    totals: undefined,
    balance: undefined,
    expense: cat(p.expense),
    income: cat(p.income),
    cashflow: p.cashflow ? relPoints(p.cashflow) : undefined,
    daily: p.daily ? relPoints(p.daily) : undefined,
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
