// Template email transaksional Datalitiq.
//
// Aturan main HTML email (berbeda jauh dari web):
//  - Layout WAJIB pakai <table>. Flexbox/grid tidak didukung Outlook.
//  - CSS harus INLINE. <style> di <head> dibuang Gmail pada sebagian kasus.
//  - Latar terang. Dark mode tiap klien berbeda-beda; memaksa tema gelap sering
//    menghasilkan teks hitam di atas latar hitam.
//  - Gambar eksternal hanya untuk logo. Banyak klien memblokir gambar secara
//    default, jadi tidak ada pesan penting yang boleh hanya ada di dalam gambar;
//    logo pun punya fallback teks lewat atribut alt yang diberi gaya.
import { BANK, BASE, rp } from './pricing'

// Palet mengikuti warna merek aplikasi: --primary oklch(0.55 0.15 160) = #008B52.
// Nilainya di-hardcode karena email tidak bisa membaca CSS variable.
const BRAND = '#008B52'        // hijau Datalitiq — tombol & aksen
const BRAND_DARK = '#00632E'   // hijau tua — angka besar & judul di atas tint
const BRAND_TINT = '#F2FAF6'   // latar panel hijau paling muda
const BRAND_EDGE = '#C4E5D5'   // garis panel hijau
const BRAND_CHIP = '#DCF0E6'   // chip di dalam panel
const TEXT = '#0F1B16'         // near-black kehijauan, bukan abu netral
const BODY = '#3C4A44'         // teks paragraf
const MUTED = '#6B7A73'
const LINE = '#E3E9E6'
const CANVAS = '#EEF3F0'       // latar luar, abu kehijauan
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"

// Alamat kontak yang ditampilkan ke pelanggan. Balasan email juga diarahkan
// ke sini, bukan ke inbox pribadi admin.
export const SUPPORT_EMAIL = 'support@datalitiq.com'
export const SUPPORT_NAME = 'Tim Datalitiq'

// Spesifikasi logo email — dipakai kode DAN ditampilkan sebagai panduan di admin,
// supaya syarat yang divalidasi dan yang ditulis tidak pernah berbeda.
export const EMAIL_LOGO_SPEC = {
  displayH: 30,        // tinggi tampil di header (px)
  minH: 60,            // tinggi file minimal = 2x, agar tajam di layar retina
  maxW: 480,           // lebar file maksimal
  maxRatio: 6,         // lebar : tinggi maksimal (wordmark memanjang)
  minRatio: 1.2,       // di bawah ini terlalu kotak untuk header email
  maxBytes: 100_000,   // 100 KB
} as const

export type TemplateId =
  | 'checkout_pending'
  | 'checkout_value'
  | 'checkout_lastcall'
  | 'pro_active'
  | 'pro_expiring'

export type TemplateMeta = {
  id: TemplateId
  label: string
  desc: string
  usesOrder: boolean   // punya varian khusus bila user punya order 'menunggu_pembayaran'
  tone: 'followup' | 'status'
}

// Dipakai juga oleh UI admin untuk daftar pilihan (murni data, aman di client).
export const TEMPLATES: TemplateMeta[] = [
  { id: 'checkout_pending',  label: 'Pembayaran Belum Selesai',   desc: 'Ada order: nominal + kode unik + rekening. Tanpa order: ajakan membuat pesanan.', usesOrder: true,  tone: 'followup' },
  { id: 'checkout_value',    label: 'Follow-up: Nilai vs Biaya',  desc: 'Membandingkan Rp99.000 dengan satu kali kena SL. Bisa dikirim dengan atau tanpa order.', usesOrder: true, tone: 'followup' },
  { id: 'checkout_lastcall', label: 'Follow-up: Panggilan Akhir', desc: 'Ada order: kode unik akan dilepas. Tanpa order: penawaran penutup yang lembut.',  usesOrder: true,  tone: 'followup' },
  { id: 'pro_active',        label: 'Status Pro Aktif',           desc: 'Konfirmasi pembayaran diterima dan akses Pro sudah menyala.',                     usesOrder: false, tone: 'status' },
  { id: 'pro_expiring',      label: 'Langganan Akan Berakhir',    desc: 'Pengingat perpanjangan sebelum akses Pro habis.',                                 usesOrder: false, tone: 'status' },
]

export type TemplateVars = {
  name: string
  siteUrl: string
  logoUrl?: string      // kosong → header memakai wordmark teks
  hasOrder?: boolean    // false → varian tanpa nominal/kode unik
  total?: number
  uniqueCode?: number
  planLabel?: string
  expiresAt?: string
  daysLeft?: number
  slaText?: string
}

/* ---------- blok penyusun ---------- */

const btn = (href: string, label: string, bg = BRAND) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0"><tr>
<td style="border-radius:8px;background:${bg}">
<a href="${href}" style="display:inline-block;padding:15px 32px;font:600 15px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.2px">${label} &nbsp;&rarr;</a>
</td></tr></table>`

const h1 = (t: string) =>
  `<h1 style="margin:0 0 18px;font:700 23px/1.32 ${FONT};color:${TEXT};letter-spacing:-0.4px">${t}</h1>`

const p = (html: string) =>
  `<p style="margin:0 0 17px;font:400 15px/1.7 ${FONT};color:${BODY}">${html}</p>`

const small = (html: string) =>
  `<p style="margin:0 0 10px;font:400 13px/1.65 ${FONT};color:${MUTED}">${html}</p>`

const label = (t: string) =>
  `<div style="font:700 10px/1 ${FONT};color:${MUTED};letter-spacing:1.6px;text-transform:uppercase">${t}</div>`

const rule = () => `<div style="height:1px;background:${LINE};margin:28px 0"></div>`

// Kotak nominal — elemen terpenting di email follow-up pembayaran. Kode unik
// dibuat menonjol karena pembulatan nominal adalah penyebab gagal verifikasi
// yang paling sering terjadi.
const amountBox = (total: number, code?: number) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;border:1px solid ${BRAND_EDGE};border-radius:12px;background:${BRAND_TINT}">
<tr><td style="padding:24px;text-align:center">
  ${label('Nominal Transfer')}
  <div style="margin:12px 0 6px;font:700 36px/1.05 ${FONT};color:${BRAND_DARK};letter-spacing:-1px">${rp(total)}</div>
  ${code ? `<div style="display:inline-block;margin-top:8px;padding:7px 14px;border-radius:6px;background:${BRAND_CHIP};font:600 12px/1.4 ${FONT};color:${BRAND_DARK}">3 angka terakhir (${code}) adalah kode unik Anda &middot; jangan dibulatkan</div>` : ''}
</td></tr></table>`

const bankBox = () => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border:1px solid ${LINE};border-radius:12px;background:#F8FAF9">
<tr><td style="padding:22px 24px">
  ${label('Transfer Ke')}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;font:400 14px/1.5 ${FONT};color:${TEXT}">
    <tr><td style="padding:6px 0;color:${MUTED};width:118px">Bank</td><td style="padding:6px 0;font-weight:600">${BANK.name}</td></tr>
    <tr><td style="padding:6px 0;color:${MUTED}">No. Rekening</td><td style="padding:6px 0;font-weight:700;font-size:18px;letter-spacing:0.6px;color:${TEXT}">${BANK.number}</td></tr>
    <tr><td style="padding:6px 0;color:${MUTED}">Atas Nama</td><td style="padding:6px 0;font-weight:600">${BANK.holder}</td></tr>
  </table>
</td></tr></table>`

const featureList = (items: string[]) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px">
${items.map(i => `<tr>
<td width="26" valign="top" style="padding:8px 0;font:700 14px/1.55 ${FONT};color:${BRAND}">&#9679;</td>
<td style="padding:8px 0;font:400 14px/1.6 ${FONT};color:${BODY}">${i}</td></tr>`).join('')}
</table>`

/* ---------- kerangka ---------- */

// Header memakai logo bila ada. Wordmark teks tetap dipakai sebagai fallback,
// dan `alt` pada <img> diberi gaya agar tetap terbaca sebagai teks bermerek
// ketika penerima memblokir gambar (perilaku default banyak klien email).
function brandMark(logoUrl?: string) {
  if (!logoUrl) {
    return `<span style="font:700 20px/1 ${FONT};color:${TEXT};letter-spacing:-0.4px">Datalitiq</span>
<span style="font:600 11px/1 ${FONT};color:${BRAND};margin-left:9px;letter-spacing:0.4px">XAU/USD TERMINAL</span>`
  }
  return `<img src="${logoUrl}" alt="Datalitiq" height="${EMAIL_LOGO_SPEC.displayH}"
style="height:${EMAIL_LOGO_SPEC.displayH}px;width:auto;max-width:200px;display:block;border:0;outline:none;text-decoration:none;font:700 18px/1 ${FONT};color:${TEXT}">`
}

function shell(bodyHtml: string, preheader: string, siteUrl: string, logoUrl?: string) {
  const unsub = `${siteUrl}/account`
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
</head>
<body style="margin:0;padding:0;background:${CANVAS};-webkit-font-smoothing:antialiased">
<!-- preheader: teks pratinjau di daftar inbox, disembunyikan di badan email -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:40px 12px">
<tr><td align="center">
<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${LINE}">

  <!-- garis aksen tipis: identitas merek tanpa header blok gelap yang berat -->
  <tr><td style="height:3px;background:${BRAND};font-size:0;line-height:0">&nbsp;</td></tr>

  <tr><td style="padding:26px 36px 22px;border-bottom:1px solid ${LINE}">
    ${brandMark(logoUrl)}
  </td></tr>

  <tr><td style="padding:34px 36px 30px">${bodyHtml}</td></tr>

  <tr><td style="padding:24px 36px 30px;border-top:1px solid ${LINE};background:#F8FAF9">
    <p style="margin:0 0 14px;font:400 13px/1.6 ${FONT};color:${BODY}">
      Ada pertanyaan? Balas email ini, atau hubungi
      <a href="mailto:${SUPPORT_EMAIL}" style="color:${TEXT};font-weight:600;text-decoration:none">${SUPPORT_EMAIL}</a>.
    </p>
    <div style="height:1px;background:${LINE};margin:0 0 14px"></div>
    <p style="margin:0 0 6px;font:600 12px/1.5 ${FONT};color:${TEXT}">${SUPPORT_NAME} &middot; Terminal Analisa XAU/USD</p>
    <p style="margin:0 0 10px;font:400 11px/1.65 ${FONT};color:${MUTED}">
      <a href="${siteUrl}/terminal" style="color:${MUTED};text-decoration:none">Terminal</a> &nbsp;&middot;&nbsp;
      <a href="${siteUrl}/blog" style="color:${MUTED};text-decoration:none">Blog</a> &nbsp;&middot;&nbsp;
      <a href="${unsub}" style="color:${MUTED};text-decoration:none">Kelola preferensi email</a>
    </p>
    <p style="margin:0;font:400 10px/1.6 ${FONT};color:#96A29B">
      Anda menerima email ini karena terdaftar di Datalitiq.<br>
      Seluruh analisa bersifat informasi, bukan saran investasi. Trading mengandung risiko kerugian.
    </p>
  </td></tr>

</table></td></tr></table></body></html>`
}

/* ---------- template ---------- */

export function renderTemplate(id: TemplateId, v: TemplateVars): { subject: string; html: string } {
  const nama = v.name || 'Trader'
  const site = v.siteUrl.replace(/\/$/, '')
  const sla = v.slaText || '1x24 jam'
  // Tanpa order, nominal jatuh ke harga standar dan kode unik TIDAK ADA.
  const hasOrder = v.hasOrder !== false && !!v.total
  const total = hasOrder ? (v.total as number) : BASE.terminal

  switch (id) {
    case 'checkout_pending': {
      // Varian tanpa order: SENGAJA tidak menampilkan nomor rekening.
      // Verifikasi pembayaran mencocokkan 3 angka terakhir ke payment_orders;
      // user yang transfer nominal bulat tanpa kode unik tidak bisa dicocokkan
      // ke siapa pun. Jadi arahkan dulu ke checkout untuk mendapat kodenya.
      if (!hasOrder) {
        return { subject: `Pesanan Anda belum dibuat — prosesnya kurang dari semenit`, html: shell(
          h1(`Pesanan Anda belum sempat dibuat`) +
          p(`Hai <b>${nama}</b>, sepertinya Anda sempat melihat halaman langganan <b>Terminal XAU/USD</b>, tapi pesanannya belum selesai dibuat.`) +
          p(`Biayanya <b>${rp(total)} per bulan</b>. Setelah pesanan dibuat, Anda langsung mendapat nominal transfer khusus milik Anda — dari situ pembayaran kami kenali otomatis.`) +
          btn(`${site}/checkout`, 'Buat Pesanan Sekarang') +
          small(`Akses aktif dalam <b>${sla}</b> setelah bukti transfer masuk.`),
          `Terminal XAU/USD ${rp(total)} per bulan — buat pesanan dalam semenit`, site, v.logoUrl) }
      }
      const subject = `Nominal transfer Anda ${rp(total)} — 3 angka terakhir jangan dibulatkan`
      return { subject, html: shell(
        h1(`Tinggal satu langkah lagi`) +
        p(`Hai <b>${nama}</b>, pesanan <b>Terminal XAU/USD</b> Anda sudah tersimpan. Selesaikan transfer berikut untuk mengaktifkan akses.`) +
        amountBox(total, v.uniqueCode) +
        bankBox() +
        btn(`${site}/checkout`, 'Upload Bukti Transfer') +
        small(`Kode unik inilah yang membuat kami langsung mengenali transfer Anda. Bila nominal dibulatkan, pesanan Anda tercampur dengan yang lain dan aktivasi menjadi lebih lama.`) +
        small(`Akses aktif dalam <b>${sla}</b> setelah bukti transfer masuk.`),
        `${rp(total)} ke ${BANK.name} ${BANK.number} a.n. ${BANK.holder}`, site, v.logoUrl) }
    }

    case 'checkout_value': {
      const subject = `${rp(total)} itu setara 1,3 kali kena stop loss`
      return { subject, html: shell(
        h1(`Hitung ulang sebentar`) +
        p(`Hai <b>${nama}</b>, coba bandingkan. SL 50 poin di 0.08 lot emas kira-kira <b>Rp77.000</b>.`) +
        p(`Langganan Terminal sebulan penuh <b>${rp(total)}</b> — kurang dari satu setengah kali kena SL.`) +
        p(`Jadi pertanyaannya bukan apakah ${rp(total)} itu mahal, melainkan: dalam sebulan, apakah terminal ini bisa mencegah <b>satu saja</b> entry yang buruk?`) +
        rule() + label('Yang Anda Pakai Setiap Hari') + 
        featureList([
          'Regime pasar real-time — tahu kapan emas sedang trending dan kapan ranging, sebelum masuk posisi',
          'Arah dan ringkasan per sesi Asia, London, dan New York — dihitung dari candle',
          'Konfluensi multi-timeframe M5 sampai H4 dalam satu layar',
          'Analisa AI dan Daily Outlook XAU/USD setiap hari',
          'Kalkulator lot dan jurnal trading — bonus untuk pengguna Pro',
        ]) +
        (hasOrder
          ? amountBox(total, v.uniqueCode) + btn(`${site}/checkout`, 'Selesaikan Pesanan') + small(`Nominal Anda masih sama seperti saat checkout.`)
          : btn(`${site}/checkout`, 'Mulai Langganan') + small(`${rp(total)} per bulan, tanpa kontrak. Berhenti kapan saja.`)),
        `Sebulan akses penuh, kurang dari satu setengah kali kena SL`, site, v.logoUrl) }
    }

    case 'checkout_lastcall': {
      // Tanpa order tidak ada kode unik yang bisa "dilepas", jadi urgensinya
      // diganti penutup yang lembut. Mengarang tenggat palsu merusak kepercayaan.
      if (!hasOrder) {
        return { subject: `Masih tertarik dengan Terminal XAU/USD?`, html: shell(
          h1(`Masih tertarik?`) +
          p(`Hai <b>${nama}</b>, ini email terakhir kami soal langganan Terminal — kami tidak ingin memenuhi inbox Anda.`) +
          p(`Kalau memang belum cocok atau belum waktunya, abaikan saja. Akun Anda tetap aktif dan tidak ada tagihan apa pun.`) +
          p(`Kalau ternyata hanya tertunda, pintunya masih terbuka: <b>${rp(total)} per bulan</b>, berhenti kapan saja.`) +
          btn(`${site}/checkout`, 'Lihat Langganan') +
          small(`Setelah ini kami tidak mengirim pengingat lagi.`),
          `Email terakhir kami soal langganan Terminal`, site, v.logoUrl) }
      }
      const subject = `Kode unik Anda kami lepas besok`
      return { subject, html: shell(
        h1(`Pesanan Anda berakhir besok`) +
        p(`Hai <b>${nama}</b>, pesanan Anda akan otomatis dibatalkan besok, dan kode unik <b>${v.uniqueCode ?? '—'}</b> dilepas untuk pengguna lain.`) +
        p(`Kalau memang belum waktunya, abaikan saja email ini. Tidak ada tagihan dan tidak ada konsekuensi apa pun.`) +
        p(`Kalau hanya tertunda, ini nominalnya:`) +
        amountBox(total, v.uniqueCode) +
        bankBox() +
        btn(`${site}/checkout`, 'Selesaikan Sekarang') +
        small(`Ini pengingat terakhir dari kami untuk pesanan tersebut.`),
        `Pesanan Anda dibatalkan otomatis besok`, site, v.logoUrl) }
    }

    case 'pro_active': {
      const subject = `Akses Pro Anda sudah aktif`
      return { subject, html: shell(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-radius:12px;background:${BRAND_TINT};border:1px solid ${BRAND_EDGE}">
         <tr><td style="padding:20px 24px;text-align:center">
           <div style="font:700 17px/1.3 ${FONT};color:${BRAND_DARK}">Pembayaran diterima &middot; Akses Pro aktif</div>
           ${v.expiresAt ? `<div style="margin-top:7px;font:400 13px/1.5 ${FONT};color:${BODY}">Berlaku sampai <b style="color:${TEXT}">${v.expiresAt}</b></div>` : ''}
         </td></tr></table>` +
        p(`Hai <b>${nama}</b>, terima kasih. Pembayaran Anda sudah kami verifikasi dan seluruh fitur ${v.planLabel ? `<b>${v.planLabel}</b>` : 'Pro'} kini terbuka.`) +
        rule() + label('Mulai Dari Sini') + 
        featureList([
          'Buka Terminal — cek regime pasar sebelum entry pertama hari ini',
          'Baca Daily Outlook XAU/USD untuk konteks harian',
          'Pakai Kalkulator Lot agar ukuran posisi sesuai risiko Anda',
          'Catat setiap posisi di Jurnal Trading — bonus langganan Pro',
        ]) +
        btn(`${site}/terminal`, 'Buka Terminal') +
        small(`Ada kendala akses? Balas email ini, kami bantu.`),
        `Pembayaran diterima. Semua fitur Pro sudah terbuka.`, site, v.logoUrl) }
    }

    case 'pro_expiring': {
      const d = v.daysLeft ?? 3
      const subject = `Akses Pro Anda berakhir ${d} hari lagi`
      return { subject, html: shell(
        h1(`Langganan Anda berakhir ${d} hari lagi`) +
        p(`Hai <b>${nama}</b>, langganan Pro Anda berakhir dalam <b>${d} hari</b>${v.expiresAt ? ` (${v.expiresAt})` : ''}.`) +
        p(`Setelah itu Terminal, Daily Outlook, dan Jurnal Trading terkunci — data jurnal Anda tetap aman tersimpan dan kembali muncul begitu diperpanjang.`) +
        p(`Perpanjang sekarang agar tidak ada hari tanpa data saat sesi London dan New York berjalan.`) +
        btn(`${site}/upgrade`, 'Perpanjang Langganan') +
        small(`Sudah memperpanjang? Abaikan email ini.`),
        `Langganan Pro Anda berakhir ${d} hari lagi`, site, v.logoUrl) }
    }
  }
}
