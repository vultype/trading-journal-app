import { NextResponse } from 'next/server'
import { fetchCandles } from '@/lib/twelvedata'
import { detectMomentumCandle, type MomentumSignal } from '@/lib/momentum'

// Dipanggil berkala oleh scheduler EKSTERNAL (mis. cron-job.org tiap 5 menit) —
// Vercel Hobby cron dibatasi 1x/hari, tidak cukup untuk pantau candle M15.
// Cek candle M15 XAU/USD terakhir yang sudah tertutup; jika terdeteksi "momentum
// candle" (body besar + momentum score kuat, searah), kirim notifikasi Telegram.
// Dedup state (biar tidak kirim ulang untuk candle yang sama) disimpan di Supabase.

const SUPABASE_URL = 'https://lmoduthkogsystlnljlb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2R1dGhrb2dzeXN0bG5samxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDA1MDEsImV4cCI6MjA5ODExNjUwMX0.bVWD_H9bYzvE4lK6hg-mjw5nA0_qYi1D2vzROzhL-4Q'
const STATE_ID = 'XAUUSD:M15'

async function getLastAlertedCandleTime(): Promise<number | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/momentum_alert_state?id=eq.${encodeURIComponent(STATE_ID)}&select=last_candle_time`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, cache: 'no-store',
  })
  const rows = await res.json()
  return Array.isArray(rows) && rows[0] ? Number(rows[0].last_candle_time) : null
}

async function saveAlertedCandleTime(candleTime: number) {
  await fetch(`${SUPABASE_URL}/rest/v1/momentum_alert_state`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: STATE_ID, last_candle_time: candleTime, last_alert_at: new Date().toISOString() }),
  })
}

function buildMessage(s: MomentumSignal): string {
  const arrow = s.direction === 'bullish' ? '🟢📈' : '🔴📉'
  const dirLabel = s.direction === 'bullish' ? 'BULLISH' : 'BEARISH'
  const waktu = new Date(s.candleTime).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
  return `${arrow} *Momentum Candle ${dirLabel}* — XAU/USD M15\n\n` +
    `Harga: *${s.price.toFixed(2)}*\n` +
    `Body candle: *${s.bodyRatio.toFixed(1)}x* ATR rata-rata\n` +
    `Momentum score: *${s.momentum >= 0 ? '+' : ''}${s.momentum.toFixed(0)}*\n` +
    `RSI: ${s.rsi.toFixed(0)} · MACD: ${s.macdState} · Struktur: ${s.structure}\n` +
    `Waktu candle: ${waktu} WIB\n\n` +
    `_Sinyal otomatis dari Datalitiq Terminal — bukan nasihat keuangan._`
}

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
  const j = await res.json()
  if (!j.ok) throw new Error(j.description || 'gagal kirim Telegram')
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret') ?? req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  if (!expected) return NextResponse.json({ error: 'CRON_SECRET belum diset di server' }, { status: 503 })
  if (secret !== expected) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const botToken = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return NextResponse.json({ error: 'Telegram belum dikonfigurasi (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)' }, { status: 503 })

  try {
    const candles = await fetchCandles('M15', 150)
    const signal = detectMomentumCandle(candles)
    if (!signal) return NextResponse.json({ checked: true, triggered: false })

    const lastAlerted = await getLastAlertedCandleTime()
    if (lastAlerted === signal.candleTime) return NextResponse.json({ checked: true, triggered: true, alerted: false, reason: 'candle ini sudah dinotifikasi' })

    await sendTelegram(buildMessage(signal))
    await saveAlertedCandleTime(signal.candleTime)
    return NextResponse.json({ checked: true, triggered: true, alerted: true, signal })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal cek momentum candle' }, { status: 502 })
  }
}
