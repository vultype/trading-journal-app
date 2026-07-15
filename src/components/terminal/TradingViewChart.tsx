'use client'

// Chart XAU/USD via widget resmi TradingView (Advanced Real-Time Chart).
// Menggantikan chart lightweight lokal — candle, indikator & drawing tools penuh
// dari TradingView. Level AI (entry/SL/TP) tetap ditampilkan sebagai daftar di
// panel Analisa AI (widget embed tidak bisa digambari garis kustom kita).
import { useEffect, useRef, useState } from 'react'

type TvInterval = { label: string; value: string }
const INTERVALS: TvInterval[] = [
  { label: 'M5', value: '5' },
  { label: 'M15', value: '15' },
  { label: 'H1', value: '60' },
  { label: 'H4', value: '240' },
  { label: 'D1', value: 'D' },
]

export function TradingViewChart({ symbol = 'OANDA:XAUUSD', defaultInterval = '15', height = 380 }: { symbol?: string; defaultInterval?: string; height?: number | string }) {
  const [interval, setInterval] = useState(defaultInterval)
  const holderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    holder.innerHTML = ''
    const container = document.createElement('div')
    container.className = 'tradingview-widget-container__widget'
    container.style.height = '100%'
    container.style.width = '100%'
    holder.appendChild(container)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'id',
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      allow_symbol_change: false,
      save_image: false,
      backgroundColor: 'rgba(6,10,9,1)',
      gridColor: 'rgba(255,255,255,0.04)',
      studies: ['STD;EMA', 'STD;VWAP'],
      support_host: 'https://www.tradingview.com',
    })
    holder.appendChild(script)
    return () => { holder.innerHTML = '' }
  }, [symbol, interval])

  return (
    <div className="flex flex-col h-full min-h-0" style={{ minHeight: typeof height === 'number' ? height : undefined }}>
      <div className="flex items-center gap-1 mb-2 shrink-0">
        {INTERVALS.map(iv => (
          <button
            key={iv.value}
            onClick={() => setInterval(iv.value)}
            className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${interval === iv.value ? 'bg-primary/20 text-primary' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
          >{iv.label}</button>
        ))}
        <span className="ml-auto text-[9px] text-white/30">TradingView · OANDA</span>
      </div>
      <div ref={holderRef} className="flex-1 min-h-0 rounded-xl overflow-hidden" />
    </div>
  )
}
