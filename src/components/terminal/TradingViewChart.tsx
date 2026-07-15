'use client'

// Chart XAU/USD via TradingView — pakai DIRECT IFRAME EMBED (widgetembed), bukan
// script-injection. Metode iframe langsung jauh lebih andal di lingkungan ketat
// (embed script kadang blank). Dipakai 2 gaya: candlestick (style '1') & line ('2').
// Gaya TradingView: '1'=candlestick, '2'=line, '3'=area, '0'=bars.

export function TradingViewChart({
  symbol = 'OANDA:XAUUSD',
  interval = '15',
  chartStyle = '1',
  height = 340,
}: { symbol?: string; interval?: string; chartStyle?: string; height?: number | string }) {
  const params = new URLSearchParams({
    symbol,
    interval,
    theme: 'dark',
    style: chartStyle,
    timezone: 'Etc/UTC',
    locale: 'id',
    toolbarbg: '060a09',
    hidesidetoolbar: '0',
    hidetoptoolbar: '0',
    withdateranges: '1',
    allow_symbol_change: '0',
    saveimage: '0',
    studies: '[]',
    hideideas: '1',
  })
  const src = `https://www.tradingview.com/widgetembed/?${params.toString()}`

  return (
    <div className="relative rounded-xl overflow-hidden bg-[#060a09] border border-white/[0.06]" style={{ height }}>
      {/* fallback di belakang iframe — kelihatan hanya kalau widget lambat/diblokir */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center px-4 pointer-events-none">
        <span className="text-[11px] text-white/35">Memuat chart TradingView…</span>
        <span className="text-[9px] text-white/20">Jika tetap kosong, nonaktifkan ad-blocker untuk tradingview.com</span>
      </div>
      <iframe
        key={`${symbol}-${interval}-${chartStyle}`}
        src={src}
        title={`TradingView ${chartStyle === '2' ? 'Line' : 'Candlestick'}`}
        className="relative h-full w-full"
        style={{ border: 0 }}
        allow="fullscreen"
        allowFullScreen
      />
    </div>
  )
}
