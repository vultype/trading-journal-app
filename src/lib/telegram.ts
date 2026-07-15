// Pengirim notifikasi Telegram (server-only). Butuh env:
//   TELEGRAM_BOT_TOKEN  — token bot dari @BotFather
//   TELEGRAM_CHAT_ID    — chat id tujuan (dari @userinfobot / getUpdates)
// Pakai parse_mode HTML supaya bisa <b>tebal</b> dll.

export function telegramConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
}

export async function sendTelegram(html: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return { ok: false, error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diset' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || j?.ok === false) return { ok: false, error: j?.description || `HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'gagal kirim' }
  }
}
