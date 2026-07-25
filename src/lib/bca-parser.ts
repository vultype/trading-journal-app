// Parser email "Internet Transaction Journal" dari BCA (bca@bca.co.id).
//
// Bentuk emailnya tabel label/nilai:
//   Status              : Successful
//   Transaction Date    : 22 Jul 2026 05:40:57
//   Transfer Type       : Transfer to BCA Virtual Account
//   Company/Product Name: PT ESPAY DEBIT INDONESIA KOE / DANA
//   Pay Amount          : IDR 100,000.00
//   Total Payment       : IDR 100,000.00
//   Reference No.       : A00901D5-6071-43D6-820B-534D26730351
//
// Dua jebakan yang menentukan benar-salahnya angka:
//
//  1. NOMINALNYA FORMAT AS, BUKAN INDONESIA. "IDR 100,000.00" berarti seratus
//     ribu — koma pemisah ribuan, titik desimal. Mem-parsingnya dengan aturan
//     Indonesia (titik = ribuan) menghasilkan angka yang salah TOTAL tapi tetap
//     terlihat masuk akal, jadi kesalahannya tidak akan ketahuan sampai lama.
//
//  2. Nilai bisa mengandung titik dua. "22 Jul 2026 05:40:57" punya dua. Jadi
//     pemisahan label/nilai harus pada titik dua PERTAMA saja.
//
// Parser ini sengaja tidak memaksakan daftar "Transfer Type" yang dikenal: BCA
// mengubah dan menambah jenis transaksi tanpa memberi tahu siapa pun. Yang tidak
// dikenali tetap diparsing, dan penentuan kategorinya diserahkan ke tinjauan
// manusia — bukan ditolak diam-diam.

export type BcaParsed = {
  ok: true
  ref: string                  // Reference No. — kunci idempotensi
  status: string
  successful: boolean
  date: string                 // YYYY-MM-DD (WIB, apa adanya dari email)
  time: string | null          // HH:MM:SS
  transferType: string | null
  merchant: string | null      // Company/Product Name → Name → Transfer Type
  amount: number               // Total Payment bila ada, jika tidak Pay Amount
  payAmount: number | null
  fee: number                  // selisih Total Payment - Pay Amount
  sourceOfFund: string | null  // rekening sumber (tersamar, mis. 7152xxxx40)
  description: string | null
  fields: Record<string, string>
}
export type BcaParseFail = { ok: false; reason: string; fields?: Record<string, string> }

const BULAN: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  // BCA memakai bulan Inggris, tapi email berbahasa Indonesia pernah muncul —
  // menerima keduanya lebih murah daripada gagal karena satu kata.
  mei: '05', agu: '08', agt: '08', okt: '10', des: '12',
}

// "IDR 100,000.00" / "Rp1,300,000.00" / "100,000" → number
export function parseIdr(raw: string): number | null {
  const s = raw.replace(/(IDR|Rp\.?)/gi, '').trim()
  if (!s) return null
  // Buang pemisah ribuan (koma), sisakan titik desimal.
  const cleaned = s.replace(/,/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

// "22 Jul 2026 05:40:57" → { date: '2026-07-22', time: '05:40:57' }
export function parseBcaDate(raw: string): { date: string; time: string | null } | null {
  const m = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/)
  if (!m) return null
  const mm = BULAN[m[2].slice(0, 3).toLowerCase()]
  if (!mm) return null
  return { date: `${m[3]}-${mm}-${m[1].padStart(2, '0')}`, time: m[4] ?? null }
}

// HTML → teks baris demi baris. Dipakai kalau yang tersedia hanya versi HTML.
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(tr|div|p|table|h\d)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // </td> jadi spasi, BUKAN newline: label dan nilainya ada di dua sel
    // bersebelahan — memisahkannya jadi dua baris memutus pasangan "label : nilai".
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean).join('\n')
}

export function parseBcaEmail(input: { text?: string; html?: string }): BcaParsed | BcaParseFail {
  const body = (input.text && input.text.trim()) ? input.text : (input.html ? htmlToText(input.html) : '')
  if (!body.trim()) return { ok: false, reason: 'Isi email kosong.' }

  const fields: Record<string, string> = {}
  for (const line of body.split('\n')) {
    // Titik dua PERTAMA saja — nilai boleh mengandung titik dua lain (jam).
    const m = line.match(/^([A-Za-z][A-Za-z0-9 .\/()]{2,40}?)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].trim().replace(/\s+/g, ' ')
    // Baris pertama yang menang: footer BCA memuat label mirip ("Email Halo BCA")
    // yang kalau ditimpa akan merusak nilai asli di atasnya.
    if (!(key in fields)) fields[key] = m[2].trim()
  }

  const get = (...keys: string[]) => {
    for (const k of keys) {
      const hit = Object.keys(fields).find(f => f.toLowerCase() === k.toLowerCase())
      if (hit && fields[hit]) return fields[hit]
    }
    return null
  }

  const ref = get('Reference No.', 'Reference No', 'Reference Number', 'No. Referensi')
  if (!ref) return { ok: false, reason: 'Reference No. tidak ditemukan — bukan email jurnal transaksi BCA?', fields }

  const rawDate = get('Transaction Date', 'Tanggal Transaksi')
  const d = rawDate ? parseBcaDate(rawDate) : null
  if (!d) return { ok: false, reason: `Tanggal tidak terbaca: ${rawDate ?? '(kosong)'}`, fields }

  // Nama label nominal BERBEDA per jenis transaksi:
  //   Virtual Account  → "Pay Amount" + "Total Payment"
  //   Transfer biasa   → "Transfer Amount"
  //   QRIS             → "Total Payment"
  // Daftar eksplisit di bawah menangani yang sudah diketahui; sisanya ditangkap
  // oleh penyapu di bawahnya.
  const totalRaw = get('Total Payment', 'Total Pembayaran')
  const payRaw = get('Pay Amount', 'Transfer Amount', 'Amount', 'Nominal', 'Jumlah',
                     'Payment Amount', 'Transaction Amount', 'Nominal Transaksi')
  const total = totalRaw ? parseIdr(totalRaw) : null
  const pay = payRaw ? parseIdr(payRaw) : null

  // Penyapu terakhir: BCA menambah jenis transaksi baru tanpa memberi tahu, dan
  // tiap jenis bisa memakai nama label sendiri. Mengejar tiap nama satu per satu
  // berarti setiap jenis baru gagal diam-diam sampai ada yang menyadarinya.
  // Di sini label apa pun yang MENGANDUNG kata nominal dan nilainya benar-benar
  // terbaca sebagai rupiah ikut diterima — "Source Currency: IDR - Indonesian
  // Rupiah" tersaring sendiri karena tidak menghasilkan angka.
  let sapu: number | null = null, sapuLabel = ''
  if (total == null && pay == null) {
    const kandidat = Object.keys(fields)
      .filter(k => /amount|payment|nominal|jumlah|total/i.test(k))
      .map(k => ({ k, v: parseIdr(fields[k]) }))
      .filter((x): x is { k: string; v: number } => x.v != null && x.v > 0)
    // Utamakan yang mengandung "total" — itu nilai yang benar-benar keluar dari
    // rekening bila ada biaya admin terpisah.
    const pilih = kandidat.find(x => /total/i.test(x.k)) ?? kandidat[0]
    if (pilih) { sapu = pilih.v; sapuLabel = pilih.k }
  }

  const amount = total ?? pay ?? sapu
  if (amount == null || amount <= 0) {
    const terlihat = Object.keys(fields).filter(k => /amount|payment|nominal|jumlah/i.test(k))
    return {
      ok: false,
      reason: terlihat.length
        ? `Nominal tidak terbaca dari: ${terlihat.map(k => `${k}="${fields[k]}"`).join(', ')}`
        : 'Tidak ada label nominal sama sekali di email ini.',
      fields,
    }
  }
  if (sapuLabel) fields['(nominal diambil dari)'] = sapuLabel

  const status = get('Status') ?? ''
  const transferType = get('Transfer Type', 'Transaction Type', 'Jenis Transaksi')

  return {
    ok: true,
    ref,
    status,
    successful: /success|berhasil/i.test(status),
    date: d.date,
    time: d.time,
    transferType,
    // Urutan sengaja: nama merchant/penerima jauh lebih berguna sebagai judul
    // draf daripada jenis transaksinya. "MUHAMMAD BAEHAKI RAMADHA" langsung
    // dikenali; "Transfer to BCA Account" sama untuk semua transfer dan tidak
    // membedakan apa pun — termasuk bagi aturan kategori otomatis, yang
    // mencocokkan teks ini.
    merchant: get('Company/Product Name', 'Company Product Name', 'Merchant',
                  'Beneficiary Name', 'Nama Penerima', 'Name', 'Nama') ?? transferType,
    amount,
    payAmount: pay,
    // Biaya admin: selisih antara yang keluar dari rekening dan yang diterima
    // penerima. Diabaikan diam-diam artinya saldo tidak akan pernah cocok.
    fee: total != null && pay != null && total > pay ? Math.round((total - pay) * 100) / 100 : 0,
    sourceOfFund: get('Source of Fund', 'Sumber Dana'),
    // "-" adalah cara BCA menulis "kosong" di Remarks; menyimpannya apa adanya
    // membuat catatan draf berisi tanda hubung yang tidak berarti apa-apa.
    description: (() => {
      const v = get('Description', 'Keterangan', 'Remarks', 'Berita')
      return v && v.trim() !== '-' ? v : null
    })(),
    fields,
  }
}
