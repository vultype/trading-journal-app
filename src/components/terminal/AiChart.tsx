'use client'

// Chart XAU/USD berbasis TradingView Lightweight Charts (OSS) — supaya bisa menggambar
// garis level dari Analisa AI (entry/SL/TP/support/resistance) langsung di atas harga.
// Candle + EMA9/EMA21 + VWAP dari data yang sudah kita hitung (Twelve Data).

import { useEffect, useRef, useState } from 'react'
import {
  createChart, ColorType, LineStyle,
  type IChartApi, type ISeriesApi, type IPriceLine, type UTCTimestamp,
} from 'lightweight-charts'

export type TF = 'M5' | 'M15' | 'H1'
export type ChartCandle = { o: number; h: number; l: number; c: number; t: number }
export type ChartTFData = { candles: ChartCandle[]; ema9: number[]; ema21: number[]; vwapArr: number[] }
export type ChartLevels = { entry: number | null; sl: number | null; tp: number | null; support: number | null; resistance: number | null } | null

const TFS: TF[] = ['M5', 'M15', 'H1']
const sec = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp

export function AiChart({ tfData, levels, height = 400, defaultTf = 'M15' }: { tfData: Record<TF, ChartTFData>; levels: ChartLevels; height?: number; defaultTf?: TF }) {
  const [tf, setTf] = useState<TF>(defaultTf)
  const [showMA, setShowMA] = useState(true)
  const wrapRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const ema9Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ema21Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const vwapRef = useRef<ISeriesApi<'Line'> | null>(null)
  const linesRef = useRef<IPriceLine[]>([])

  // buat chart sekali
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const chart = createChart(el, {
      width: el.clientWidth, height,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: 'rgba(255,255,255,0.45)', fontSize: 10 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#1f2937' }, horzLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#1f2937' } },
      handleScale: { axisPressedMouseMove: true }, handleScroll: true,
    })
    const candle = chart.addCandlestickSeries({ upColor: '#34d399', downColor: '#f87171', wickUpColor: '#34d399', wickDownColor: '#f87171', borderVisible: false, priceLineVisible: true, priceLineColor: 'rgba(255,255,255,0.25)', priceLineStyle: LineStyle.Dotted })
    const ema9 = chart.addLineSeries({ color: '#60a5fa', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    const ema21 = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    const vwap = chart.addLineSeries({ color: '#a78bfa', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    chartRef.current = chart; candleRef.current = candle; ema9Ref.current = ema9; ema21Ref.current = ema21; vwapRef.current = vwap
    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }))
    ro.observe(el)
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; candleRef.current = null; linesRef.current = [] }
  }, [height])

  // set data saat TF / data berubah
  useEffect(() => {
    const d = tfData[tf]
    const candle = candleRef.current
    if (!d || !candle || !d.candles.length) return
    const uniq = new Map<number, ChartCandle & { i: number }>()
    d.candles.forEach((c, i) => uniq.set(sec(c.t), { ...c, i }))
    const rows = Array.from(uniq.values()).sort((a, b) => a.t - b.t)
    candle.setData(rows.map(c => ({ time: sec(c.t), open: c.o, high: c.h, low: c.l, close: c.c })))
    ema9Ref.current?.setData(rows.map(c => ({ time: sec(c.t), value: d.ema9[c.i] })))
    ema21Ref.current?.setData(rows.map(c => ({ time: sec(c.t), value: d.ema21[c.i] })))
    vwapRef.current?.setData(rows.map(c => ({ time: sec(c.t), value: d.vwapArr[c.i] })))
    chartRef.current?.timeScale().fitContent()
  }, [tf, tfData])

  // tampil/sembunyikan MA & VWAP
  useEffect(() => {
    ema9Ref.current?.applyOptions({ visible: showMA })
    ema21Ref.current?.applyOptions({ visible: showMA })
    vwapRef.current?.applyOptions({ visible: showMA })
  }, [showMA])

  // gambar garis level AI
  useEffect(() => {
    const s = candleRef.current
    if (!s) return
    linesRef.current.forEach(l => { try { s.removePriceLine(l) } catch { } })
    linesRef.current = []
    if (!levels) return
    const defs: { p: number | null; color: string; title: string; style?: LineStyle }[] = [
      { p: levels.resistance, color: 'rgba(248,113,113,0.55)', title: 'AI Resistance', style: LineStyle.Dotted },
      { p: levels.tp, color: '#34d399', title: 'AI Target' },
      { p: levels.entry, color: '#eab308', title: 'AI Entry' },
      { p: levels.sl, color: '#f87171', title: 'AI Stop' },
      { p: levels.support, color: 'rgba(52,211,153,0.55)', title: 'AI Support', style: LineStyle.Dotted },
    ]
    defs.forEach(d => {
      if (typeof d.p === 'number' && Number.isFinite(d.p)) {
        linesRef.current.push(s.createPriceLine({ price: d.p, color: d.color, lineWidth: 1, lineStyle: d.style ?? LineStyle.Dashed, axisLabelVisible: true, title: d.title }))
      }
    })
  }, [levels, tf])

  const hasLevels = !!levels && [levels.entry, levels.sl, levels.tp, levels.support, levels.resistance].some(v => typeof v === 'number')
  const legendItem = (color: string, label: string, dash = false) => (
    <span className="flex items-center gap-1 text-[9px] text-white/45"><span className="inline-block w-3 h-0" style={{ borderTop: `2px ${dash ? 'dashed' : 'solid'} ${color}` }} />{label}</span>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <div className="flex items-center gap-1">
          {TFS.map(t => (
            <button key={t} onClick={() => setTf(t)} className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${tf === t ? 'bg-primary text-primary-foreground' : 'bg-white/5 text-white/50 hover:text-white/80'}`}>{t}</button>
          ))}
          <button onClick={() => setShowMA(v => !v)} className={`text-[10px] font-semibold px-2 py-0.5 rounded ml-1 transition-colors ${showMA ? 'bg-white/10 text-white/70' : 'bg-white/5 text-white/35'}`}>EMA·VWAP</button>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {showMA && <>{legendItem('#60a5fa', 'EMA9')}{legendItem('#f59e0b', 'EMA21')}{legendItem('#a78bfa', 'VWAP', true)}</>}
        </div>
      </div>
      <div ref={wrapRef} className="flex-1 min-h-0 w-full" />
      {hasLevels ? (
        <div className="flex items-center gap-3 flex-wrap mt-1.5 pt-1.5 border-t border-white/5">
          {typeof levels?.entry === 'number' && legendItem('#eab308', `Entry ${levels.entry.toFixed(1)}`)}
          {typeof levels?.sl === 'number' && legendItem('#f87171', `Stop ${levels.sl.toFixed(1)}`)}
          {typeof levels?.tp === 'number' && legendItem('#34d399', `Target ${levels.tp.toFixed(1)}`)}
          {typeof levels?.support === 'number' && legendItem('rgba(52,211,153,0.7)', `Sup ${levels.support.toFixed(1)}`, true)}
          {typeof levels?.resistance === 'number' && legendItem('rgba(248,113,113,0.7)', `Res ${levels.resistance.toFixed(1)}`, true)}
        </div>
      ) : (
        <p className="text-[9px] text-white/30 mt-1.5 pt-1.5 border-t border-white/5">💡 Klik <b className="text-primary/70">Analisa AI</b> untuk menandai level entry/SL/TP & support-resistance langsung di chart.</p>
      )}
    </div>
  )
}
