// Notifikasi ke ADMIN untuk kejadian penting (checkout, bukti transfer, signup).
// Utama: email via Resend (HTTP API, tanpa dependency tambahan).
// Fallback: Telegram — sudah terintegrasi di proyek ini, jadi notifikasi tetap sampai
// walau email belum dikonfigurasi.
//
// notifyAdmin() TIDAK PERNAH melempar error: notifikasi tak boleh menggagalkan alur
// pembayaran/pendaftaran. Tapi ia MENGEMBALIKAN hasil detail supaya route diagnosa
// (/api/admin/notify-test) bisa menampilkan penyebab aslinya ke admin.
import { sendTelegram, telegramConfigured } from '@/lib/telegram'

export const ADMIN_EMAIL = 'vultype@gmail.com'
// `from` wajib memakai domain yang TERVERIFIKASI di Resend. Default 'onboarding@resend.dev'
// hanya bisa mengirim ke alamat email pemilik akun Resend itu sendiri — penyebab paling
// sering email "tidak masuk" tanpa error yang terlihat.
const FROM = process.env.RESEND_FROM || 'Datalitiq <onboarding@resend.dev>'

export type ChannelResult = { configured: boolean; ok: boolean; detail: string }
export type NotifyResult = { email: ChannelResult; telegram: ChannelResult }

async function sendEmail(subject: string, html: string, to: string = ADMIN_EMAIL): Promise<ChannelResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { configured: false, ok: false, detail: 'RESEND_API_KEY belum diset di environment' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    })
    const j = await res.json().catch(() => ({}))
    if (res.ok) return { configured: true, ok: true, detail: `Terkirim (id ${j?.id ?? '-'}) dari ${FROM}` }
    // Pesan error asli Resend — aman ditampilkan (tidak memuat API key)
    return { configured: true, ok: false, detail: `HTTP ${res.status}: ${j?.message || j?.error?.message || JSON.stringify(j).slice(0, 200)}` }
  } catch (e) {
    return { configured: true, ok: false, detail: e instanceof Error ? e.message : 'gagal menghubungi Resend' }
  }
}

function buildHtml(subject: string, lines: string[]) {
  return `<h2 style="font-family:system-ui;margin:0 0 12px">${subject}</h2>
<table style="font-family:system-ui;font-size:14px;border-collapse:collapse">
${lines.map(l => {
    const i = l.indexOf(':')
    const k = i > 0 ? l.slice(0, i) : l, v = i > 0 ? l.slice(i + 1).trim() : ''
    return `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0"><b>${v}</b></td></tr>`
  }).join('')}
</table>`
}

// opts.to → kirim ke alamat lain (dipakai form uji di Admin > Dev Tools). Default ke admin.
// opts.skipTelegram → jangan fallback ke Telegram; saat menguji email kita ingin melihat
// kegagalan email apa adanya, bukan tertutup oleh Telegram yang berhasil.
export async function notifyAdmin(subject: string, lines: string[], opts: { to?: string; skipTelegram?: boolean } = {}): Promise<NotifyResult> {
  const out: NotifyResult = {
    email: { configured: false, ok: false, detail: 'belum dijalankan' },
    telegram: { configured: false, ok: false, detail: 'tidak dipakai (email berhasil)' },
  }
  try {
    out.email = await sendEmail(subject, buildHtml(subject, lines), opts.to || ADMIN_EMAIL)
    if (opts.skipTelegram) {
      out.telegram = { configured: telegramConfigured(), ok: false, detail: 'dilewati (mode uji email)' }
      return out
    }
    // Fallback Telegram hanya bila email gagal/belum dikonfigurasi
    if (!out.email.ok) {
      if (!telegramConfigured()) {
        out.telegram = { configured: false, ok: false, detail: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diset' }
      } else {
        const r = await sendTelegram(`<b>${subject}</b>\n` + lines.map(l => `• ${l}`).join('\n'))
        out.telegram = { configured: true, ok: r.ok, detail: r.ok ? 'Terkirim ke Telegram' : (r.error || 'gagal kirim') }
      }
    }
  } catch (e) {
    out.email.detail = e instanceof Error ? e.message : 'error tak terduga'
  }
  return out
}
