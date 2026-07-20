// Notifikasi ke ADMIN untuk kejadian penting (checkout, bukti transfer, signup).
// Utama: email via Resend (HTTP API, tanpa dependency tambahan).
// Fallback: Telegram — sudah terintegrasi di proyek ini, jadi notifikasi tetap sampai
// walau email belum dikonfigurasi. Semua gagal-diam: notifikasi TIDAK BOLEH menggagalkan
// alur pembayaran/pendaftaran user.
import { sendTelegram, telegramConfigured } from '@/lib/telegram'

const ADMIN_EMAIL = 'vultype@gmail.com'
// from wajib domain terverifikasi di Resend; 'onboarding@resend.dev' bisa dipakai
// tanpa verifikasi domain (hanya untuk kirim ke email pemilik akun Resend).
const FROM = process.env.RESEND_FROM || 'Datalitiq <onboarding@resend.dev>'

async function sendEmail(subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [ADMIN_EMAIL], subject, html }),
    })
    return res.ok
  } catch { return false }
}

// Kirim ke email; kalau email tak terkonfigurasi/gagal, jatuh ke Telegram.
export async function notifyAdmin(subject: string, lines: string[]): Promise<void> {
  try {
    const html = `<h2 style="font-family:system-ui;margin:0 0 12px">${subject}</h2>
<table style="font-family:system-ui;font-size:14px;border-collapse:collapse">
${lines.map(l => {
      const i = l.indexOf(':')
      const k = i > 0 ? l.slice(0, i) : l, v = i > 0 ? l.slice(i + 1).trim() : ''
      return `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0"><b>${v}</b></td></tr>`
    }).join('')}
</table>`
    const ok = await sendEmail(subject, html)
    if (!ok && telegramConfigured()) {
      await sendTelegram(`<b>${subject}</b>\n` + lines.map(l => `• ${l}`).join('\n'))
    }
  } catch { /* jangan pernah ganggu alur utama */ }
}
