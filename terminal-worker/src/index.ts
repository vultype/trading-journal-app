/*
 * terminal-worker — Fase 2 (SKELETON, belum aktif)
 *
 * Tujuan: pegang stream tick OANDA XAU/USD, hitung indikator cepat,
 * lalu broadcast ke browser /terminal via WebSocket.
 *
 * Jalankan nanti (Fase 2) setelah token OANDA tersedia:
 *   npm i ws  &&  ts-node src/index.ts
 */

// import WebSocket, { WebSocketServer } from 'ws'

const OANDA_TOKEN = process.env.OANDA_TOKEN
const OANDA_ACCOUNT_ID = process.env.OANDA_ACCOUNT_ID
const OANDA_ENV = process.env.OANDA_ENV ?? 'practice'
const PORT = Number(process.env.PORT ?? 8080)

const STREAM_HOST = OANDA_ENV === 'live' ? 'stream-fxtrade.oanda.com' : 'stream-fxpractice.oanda.com'

async function main() {
  if (!OANDA_TOKEN || !OANDA_ACCOUNT_ID) {
    console.log('[terminal-worker] Menunggu OANDA_TOKEN & OANDA_ACCOUNT_ID (Fase 2). Skeleton tidak melakukan apa-apa.')
    return
  }

  // TODO Fase 2:
  // 1. Buka WebSocketServer di PORT untuk client /terminal.
  // 2. Fetch streaming pricing OANDA:
  //    GET https://${STREAM_HOST}/v3/accounts/${OANDA_ACCOUNT_ID}/pricing/stream?instruments=XAU_USD
  //    header: Authorization: Bearer ${OANDA_TOKEN}
  // 3. Parse tiap baris JSON tick { type:'PRICE', bids, asks, ... }.
  // 4. Rolling candles + hitung EMA9/EMA21/RSI/VWAP/ATR + spread + tradeability.
  // 5. Poll /positionBook tiap ~30 dtk untuk sentimen retail (kontrarian).
  // 6. Broadcast snapshot ke semua client WS.
  console.log(`[terminal-worker] siap (skeleton). host=${STREAM_HOST} port=${PORT}`)
}

main()
