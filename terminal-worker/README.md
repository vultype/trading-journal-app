# terminal-worker (Fase 2)

Worker always-on yang memegang koneksi **streaming OANDA** dan mem-broadcast tick
XAU/USD + turunannya ke browser `/terminal` via WebSocket.

> Fase 1 saat ini: UI `/terminal` masih memakai feed **simulasi** di sisi client
> (`src/components/terminal/TradingTerminal.tsx` → `useSimFeed`). Worker ini adalah
> kerangka untuk Fase 2 — belum dijalankan sampai token OANDA tersedia.

## Rencana

```
OANDA v20 streaming ──▶ worker (Node/ws) ──▶ browser /terminal (WebSocket)
   /pricing/stream            hitung EMA/RSI/VWAP/ATR      panel realtime
   /positionBook              spread + tradeability
```

## Env yang dibutuhkan (Fase 2)

```
OANDA_TOKEN=...            # token API v20 (akun practice)
OANDA_ACCOUNT_ID=...       # account id practice
OANDA_ENV=practice         # practice | live
PORT=8080
```

Endpoint OANDA (practice):
- Stream harga: `https://stream-fxpractice.oanda.com/v3/accounts/{id}/pricing/stream?instruments=XAU_USD`
- Candles:      `https://api-fxpractice.oanda.com/v3/instruments/XAU_USD/candles`
- Position book (sentimen retail): `https://api-fxpractice.oanda.com/v3/instruments/XAU_USD/positionBook`

## Deploy

Railway / Fly.io (butuh proses persisten — bukan serverless). Set env di atas, lalu
`/terminal` akan connect ke `wss://<worker-host>` untuk menerima tick.
