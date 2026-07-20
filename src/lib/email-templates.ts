// Template email transaksional Datalitiq.
//
// Aturan main HTML email (berbeda jauh dari web):
//  - Layout WAJIB pakai <table>. Flexbox/grid tidak didukung Outlook.
//  - CSS harus INLINE. <style> di <head> dibuang Gmail pada sebagian kasus.
//  - Latar terang. Dark mode tiap klien berbeda-beda; memaksa tema gelap sering
//    menghasilkan teks hitam di atas latar hitam.
//  - Tanpa gambar eksternal. Banyak klien memblokir gambar secara default, jadi
//    pesan inti tidak boleh bergantung pada gambar.
import { BANK, rp } from './pricing'

const BRAND = '#0F172A'      // slate-900 — header
const ACCENT = '#F59E0B'     // amber — aksen emas
const OK = '#059669'
const TEXT = '#1F2937'
const MUTED = '#6B7280'
const LINE = '#E5E7EB'

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
  needsOrder: boolean   // butuh order 'menunggu_pembayaran' untuk isi nominal + kode unik
  tone: 'followup' | 'status'
}

// Dipakai juga oleh UI admin untuk daftar pilihan (murni data, aman di client).
export const TEMPLATES: TemplateMeta[] = [
  { id: 'checkout_pending',  label: 'Pembayaran Belum Selesai',   desc: 'Pengingat +1 jam. Nominal, kode unik, dan rekening. Fokus menghilangkan friksi.', needsOrder: true,  tone: 'followup' },
  { id: 'checkout_value',    label: 'Follow-up: Nilai vs Biaya',  desc: 'Pengingat +24 jam. Membandingkan Rp99.000 dengan satu kali kena SL.',              needsOrder: true,  tone: 'followup' },
  { id: 'checkout_lastcall', label: 'Follow-up: Panggilan Akhir', desc: 'Pengingat +72 jam. Kode unik akan dilepas. Urgensi jujur, tanpa tekanan.',        needsOrder: true,  tone: 'followup' },
  { id: 'pro_active',        label: 'Status Pro Aktif',           desc: 'Konfirmasi pembayaran diterima dan akses Pro sudah menyala.',                     needsOrder: false, tone: 'status' },
  { id: 'pro_expiring',      label: 'Langganan Akan Berakhir',    desc: 'Pengingat perpanjangan sebelum akses Pro habis.',                                 needsOrder: false, tone: 'status' },
]

export type TemplateVars = {
  name: string
  siteUrl: string
  total?: number
  uniqueCode?: number
  planLabel?: string
  expiresAt?: string
  daysLeft?: number
  slaText?: string
}

/* ---------- blok penyusun ---------- */

const btn = (href: string, label: string, bg = BRAND) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr>
<td style="border-radius:8px;background:${bg}">
<a href="${href}" style="display:inline-block;padding:14px 28px;font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#fff;text-decoration:none;border-radius:8px">${label}</a>
</td></tr></table>`

const p = (html: string) =>
  `<p style="margin:0 0 16px;font:400 15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${TEXT}">${html}</p>`

const small = (html: string) =>
  `<p style="margin:0 0 12px;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED}">${html}</p>`

// Kotak nominal — elemen terpenting di email follow-up pembayaran. Kode unik
// dibuat menonjol karena pembulatan nominal adalah penyebab gagal verifikasi
// yang paling sering terjadi.
const amountBox = (total: number, code?: number) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border:2px solid ${ACCENT};border-radius:12px;background:#FFFBEB">
<tr><td style="padding:22px 24px;text-align:center">
  <div style="font:600 11px/1 -apple-system,Arial,sans-serif;color:#92400E;letter-spacing:1.4px;text-transform:uppercase">Nominal Transfer</div>
  <div style="margin:10px 0 4px;font:700 34px/1.1 -apple-system,Arial,sans-serif;color:#78350F;letter-spacing:-0.5px">${rp(total)}</div>
  ${code ? `<div style="font:400 12px/1.5 -apple-system,Arial,sans-serif;color:#92400E">3 angka terakhir (<b>${code}</b>) adalah kode unik Anda — mohon jangan dibulatkan</div>` : ''}
</td></tr></table>`

const bankBox = () => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid ${LINE};border-radius:12px">
<tr><td style="padding:20px 24px">
  <div style="font:600 11px/1 -apple-system,Arial,sans-serif;color:${MUTED};letter-spacing:1.4px;text-transform:uppercase;margin-bottom:14px">Transfer Ke</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font:400 14px/1.5 -apple-system,Arial,sans-serif;color:${TEXT}">
    <tr><td style="padding:5px 0;color:${MUTED};width:110px">Bank</td><td style="padding:5px 0;font-weight:600">${BANK.name}</td></tr>
    <tr><td style="padding:5px 0;color:${MUTED}">No. Rekening</td><td style="padding:5px 0;font-weight:700;font-size:17px;letter-spacing:0.5px">${BANK.number}</td></tr>
    <tr><td style="padding:5px 0;color:${MUTED}">Atas Nama</td><td style="padding:5px 0;font-weight:600">${BANK.holder}</td></tr>
  </table>
</td></tr></table>`

const featureList = (items: string[]) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 24px">
${items.map(i => `<tr><td style="padding:7px 0;font:400 14px/1.55 -apple-system,Arial,sans-serif;color:${TEXT}">
<span style="color:${OK};font-weight:700;margin-right:10px">&#10003;</span>${i}</td></tr>`).join('')}
</table>`

/* ---------- kerangka ---------- */

function shell(bodyHtml: string, preheader: string, siteUrl: string) {
  const unsub = `${siteUrl}/account`
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
</head>
<body style="margin:0;padding:0;background:#F3F4F6">
<!-- preheader: teks pratinjau di daftar inbox, disembunyikan di badan email -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid ${LINE}">

  <tr><td style="background:${BRAND};padding:26px 32px">
    <span style="font:700 19px/1 -apple-system,Arial,sans-serif;color:#fff;letter-spacing:-0.3px">Datalitiq</span>
    <span style="font:400 12px/1 -apple-system,Arial,sans-serif;color:${ACCENT};margin-left:10px">XAU/USD Terminal</span>
  </td></tr>

  <tr><td style="padding:32px">${bodyHtml}</td></tr>

  <tr><td style="padding:20px 32px 28px;border-top:1px solid ${LINE};background:#FAFAFA">
    <p style="margin:0 0 8px;font:400 12px/1.6 -apple-system,Arial,sans-serif;color:${MUTED}">
      Butuh bantuan? Balas email ini atau WhatsApp <a href="https://wa.me/${BANK.wa}" style="color:${BRAND}">+${BANK.wa}</a>.
    </p>
    <p style="margin:0;font:400 11px/1.6 -apple-system,Arial,sans-serif;color:#9CA3AF">
      Datalitiq &middot; Terminal analisa XAU/USD &middot; <a href="${unsub}" style="color:#9CA3AF">Kelola preferensi email</a><br>
      Analisa bersifat informasi, bukan saran investasi. Trading mengandung risiko kerugian.
    </p>
  </td></tr>

</table></td></tr></table></body></html>`
}

/* ---------- template ---------- */

export function renderTemplate(id: TemplateId, v: TemplateVars): { subject: string; html: string } {
  const nama = v.name || 'Trader'
  const site = v.siteUrl.replace(/\/$/, '')
  const total = v.total ?? 0
  const sla = v.slaText || '1x24 jam'

  switch (id) {
    case 'checkout_pending': {
      const subject = `Nominal transfer Anda ${rp(total)} — 3 angka terakhir jangan dibulatkan`
      return { subject, html: shell(
        p(`Hai <b>${nama}</b>,`) +
        p(`Pesanan <b>Terminal XAU/USD</b> Anda sudah tersimpan. Tinggal satu langkah lagi.`) +
        amountBox(total, v.uniqueCode) +
        bankBox() +
        btn(`${site}/checkout`, 'Upload Bukti Transfer') +
        small(`Kode unik inilah yang membuat kami langsung mengenali transfer Anda. Bila nominal dibulatkan, pesanan Anda tercampur dengan yang lain dan aktivasi menjadi lebih lama.`) +
        small(`Akses aktif dalam <b>${sla}</b> setelah bukti transfer masuk.`),
        `${rp(total)} ke ${BANK.name} ${BANK.number} a.n. ${BANK.holder}`, site) }
    }

    case 'checkout_value': {
      const subject = `${rp(total)} itu setara 1,3 kali kena stop loss`
      return { subject, html: shell(
        p(`Hai <b>${nama}</b>,`) +
        p(`Coba hitung sebentar. SL 50 poin di 0.08 lot emas kira-kira <b>Rp77.000</b>.`) +
        p(`Langganan Terminal sebulan penuh <b>${rp(total)}</b> — kurang dari satu setengah kali kena SL.`) +
        p(`Jadi pertanyaannya bukan apakah ${rp(total)} itu mahal, melainkan: dalam sebulan, apakah terminal ini bisa mencegah <b>satu saja</b> entry yang buruk?`) +
        p(`<b>Yang Anda pakai setiap hari:</b>`) +
        featureList([
          'Regime pasar real-time — tahu kapan emas sedang trending dan kapan ranging, sebelum masuk posisi',
          'Arah dan ringkasan per sesi Asia, London, dan New York — dihitung dari candle',
          'Konfluensi multi-timeframe M5 sampai H4 dalam satu layar',
          'Analisa AI dan Daily Outlook XAU/USD setiap hari',
          'Kalkulator lot dan jurnal trading — bonus untuk pengguna Pro',
        ]) +
        amountBox(total, v.uniqueCode) +
        btn(`${site}/checkout`, 'Selesaikan Pesanan') +
        small(`Nominal Anda masih sama seperti saat checkout.`),
        `Sebulan akses penuh, kurang dari satu setengah kali kena SL`, site) }
    }

    case 'checkout_lastcall': {
      const subject = `Kode unik Anda kami lepas besok`
      return { subject, html: shell(
        p(`Hai <b>${nama}</b>,`) +
        p(`Pesanan Anda akan otomatis dibatalkan besok, dan kode unik <b>${v.uniqueCode ?? '—'}</b> dilepas untuk pengguna lain.`) +
        p(`Kalau memang belum waktunya, abaikan saja email ini. Tidak ada tagihan dan tidak ada konsekuensi apa pun.`) +
        p(`Kalau hanya tertunda, ini nominalnya:`) +
        amountBox(total, v.uniqueCode) +
        bankBox() +
        btn(`${site}/checkout`, 'Selesaikan Sekarang') +
        small(`Ini pengingat terakhir dari kami untuk pesanan tersebut.`),
        `Pesanan Anda dibatalkan otomatis besok`, site) }
    }

    case 'pro_active': {
      const subject = `Akses Pro Anda sudah aktif`
      return { subject, html: shell(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-radius:12px;background:#ECFDF5;border:1px solid #A7F3D0">
         <tr><td style="padding:20px 24px;text-align:center">
           <div style="font:700 17px/1.3 -apple-system,Arial,sans-serif;color:#065F46">Pembayaran diterima &middot; Akses Pro aktif</div>
           ${v.expiresAt ? `<div style="margin-top:6px;font:400 13px/1.5 -apple-system,Arial,sans-serif;color:#047857">Berlaku sampai <b>${v.expiresAt}</b></div>` : ''}
         </td></tr></table>` +
        p(`Hai <b>${nama}</b>,`) +
        p(`Terima kasih. Pembayaran Anda sudah kami verifikasi dan seluruh fitur ${v.planLabel ? `<b>${v.planLabel}</b>` : 'Pro'} sudah terbuka.`) +
        p(`<b>Mulai dari sini:</b>`) +
        featureList([
          'Buka Terminal — cek regime pasar sebelum entry pertama hari ini',
          'Baca Daily Outlook XAU/USD untuk konteks harian',
          'Pakai Kalkulator Lot agar ukuran posisi sesuai risiko Anda',
          'Catat setiap posisi di Jurnal Trading — bonus langganan Pro',
        ]) +
        btn(`${site}/terminal`, 'Buka Terminal', OK) +
        small(`Ada kendala akses? Balas email ini, kami bantu.`),
        `Pembayaran diterima. Semua fitur Pro sudah terbuka.`, site) }
    }

    case 'pro_expiring': {
      const d = v.daysLeft ?? 3
      const subject = `Akses Pro Anda berakhir ${d} hari lagi`
      return { subject, html: shell(
        p(`Hai <b>${nama}</b>,`) +
        p(`Langganan Pro Anda berakhir dalam <b>${d} hari</b>${v.expiresAt ? ` (${v.expiresAt})` : ''}.`) +
        p(`Setelah itu Terminal, Daily Outlook, dan Jurnal Trading terkunci — data jurnal Anda tetap aman tersimpan dan kembali muncul begitu diperpanjang.`) +
        p(`Perpanjang sekarang agar tidak ada hari tanpa data saat sesi London dan New York berjalan.`) +
        btn(`${site}/upgrade`, 'Perpanjang Langganan') +
        small(`Sudah memperpanjang? Abaikan email ini.`),
        `Langganan Pro Anda berakhir ${d} hari lagi`, site) }
    }
  }
}
