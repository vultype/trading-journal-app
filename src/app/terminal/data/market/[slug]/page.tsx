'use client'

// Halaman detail 1 aset market (VIX/S&P500/Nasdaq/BTC/Silver) — data LIVE via
// Twelve Data candle (sama infra dgn chart XAU/USD utama), lebih detail dari
// FRED karena granularitas intraday, bukan cuma harian.
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import { DetailLineChart, Row, Stat, LockedTeaser, type ChartPoint } from '@/components/terminal/DetailChart'
import { MARKET_DETAIL } from '@/lib/market-detail-config'
import { ArrowLeft, Loader2, Info } from 'lucide-react'

type Candle = { o: number; h: number; l: number; c: number; t: number }
const TFS: { label: string; value: string }[] = [
  { label: 'M15', value: 'M15' }, { label: 'H1', value: 'H1' }, { label: 'H4', value: 'H4' }, { label: 'D1', value: 'D1' },
]

function fmtLabel(t: number, tf: string) {
  const d = new Date(t)
  if (tf === 'D1') return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtLabelFull(t: number, tf: string) {
  const d = new Date(t)
  if (tf === 'D1') return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC'
}

export default function MarketDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const router = useRouter()
  const sub = useSubscription()
  const [tf, setTf] = useState('H1')
  const [candles, setCandles] = useState<Candle[] | null>(null)
  const [live, setLive] = useState<{ price: number; changePct: number } | null>(null)

  const meta = MARKET_DETAIL[slug]

  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace(`/login?next=${encodeURIComponent(`/terminal/data/market/${slug}`)}`)
  }, [sub.loading, sub.userId, router, slug])

  useEffect(() => {
    if (!sub.isPro || !meta) return
    setCandles(null)
    fetch(`/api/terminal/candles?tf=${tf}&symbol=${encodeURIComponent(meta.apiSymbol)}`).then(r => r.json()).then(d => { if (Array.isArray(d)) setCandles(d) }).catch(() => {})
  }, [sub.isPro, meta, tf])

  useEffect(() => {
    if (!sub.isPro || !meta) return
    fetch('/api/terminal/crossasset').then(r => r.json()).then(j => { if (j && j[meta.apiSymbol]) setLive(j[meta.apiSymbol]) }).catch(() => {})
  }, [sub.isPro, meta])

  if (sub.loading || !sub.userId) return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>
  if (!meta) {
    return (
      <div className="min-h-screen bg-[#060a09] text-white flex items-center justify-center p-4 text-center">
        <div><p className="text-lg font-bold mb-2">Aset tidak ditemukan</p><Link href="/terminal" className="text-primary hover:underline text-sm">← Kembali ke Terminal</Link></div>
      </div>
    )
  }
  if (!sub.isPro) return <LockedTeaser icon={meta.icon} title={`Detail ${meta.title}`} desc="Chart live intraday + data historis — khusus langganan Pro." />

  const chartData: ChartPoint[] | null = candles ? candles.map(c => ({ label: fmtLabel(c.t, tf), value: c.c })) : null
  const stats = candles && candles.length >= 2 ? (() => {
    const closes = candles.map(c => c.c)
    const first = closes[0], last = closes[closes.length - 1]
    const chg = last - first
    const chgPct = first !== 0 ? (chg / Math.abs(first)) * 100 : 0
    const hi = Math.max(...candles.map(c => c.h)), lo = Math.min(...candles.map(c => c.l))
    return { chg, chgPct, hi, lo, avg: closes.reduce((a, b) => a + b, 0) / closes.length, last }
  })() : null
  const fmtV = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: meta.dec, maximumFractionDigits: meta.dec })
  const Icon = meta.icon
  const lastCandle = candles?.[candles.length - 1]

  return (
    <div className="min-h-screen bg-[#060a09] text-white">
      <header className="sticky top-0 z-30 bg-[#060a09]/95 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
          <Link href="/terminal" className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors shrink-0"><ArrowLeft size={15} /> Kembali ke Terminal</Link>
          <span className="w-px h-4 bg-white/10 shrink-0" />
          <span className="flex items-center gap-1.5 text-sm font-bold shrink-0"><Icon size={14} className="text-primary" /> {meta.title}</span>
          {live && (
            <span className="ml-auto flex items-center gap-2 text-xs shrink-0">
              <span className="font-black tabular-nums">{fmtV(live.price)}</span>
              <span className={`font-bold tabular-nums ${live.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{live.changePct >= 0 ? '+' : ''}{live.changePct.toFixed(2)}%</span>
            </span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-wrap gap-2">
            <p className="text-sm font-bold flex items-center gap-2">{meta.title} <span className="text-[9px] font-semibold text-white/30 normal-case">{meta.sub} · live</span></p>
            <div className="flex items-center gap-0.5">
              {TFS.map(t => (
                <button key={t.value} onClick={() => setTf(t.value)} className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-colors ${tf === t.value ? 'bg-primary/20 text-primary' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}>{t.label}</button>
              ))}
            </div>
          </div>
          <div className="p-3">
            {chartData ? <DetailLineChart data={chartData} height={340} /> : <div className="h-[340px] flex items-center justify-center"><Loader2 size={20} className="animate-spin text-white/30" /></div>}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label={`Perubahan (${tf})`} value={`${stats.chgPct >= 0 ? '+' : ''}${stats.chgPct.toFixed(2)}%`} tone={stats.chgPct >= 0 ? 'up' : 'down'} sub={`${stats.chg >= 0 ? '+' : ''}${fmtV(stats.chg)}`} />
            <Stat label="Tertinggi" value={fmtV(stats.hi)} tone="neutral" />
            <Stat label="Terendah" value={fmtV(stats.lo)} tone="neutral" />
            <Stat label="Rata-rata" value={fmtV(stats.avg)} tone="neutral" sub={`skrg ${stats.last > stats.avg ? 'di atas' : 'di bawah'} rata²`} />
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">Data Live (Twelve Data)</p>
          <div className="space-y-1.5">
            <Row l="Harga terakhir" v={live ? fmtV(live.price) : lastCandle ? fmtV(lastCandle.c) : '—'} />
            <Row l="Perubahan hari ini" v={live ? `${live.changePct >= 0 ? '+' : ''}${live.changePct.toFixed(2)}%` : '—'} c={live ? (live.changePct >= 0 ? 'text-emerald-400' : 'text-red-400') : undefined} />
            <Row l="Candle terakhir" v={lastCandle ? fmtLabelFull(lastCandle.t, tf) : '—'} />
            <Row l="Timeframe chart" v={tf} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="flex items-center gap-2 text-sm font-black mb-2"><Info size={15} className="text-primary" /> Kenapa {meta.title} Relevan untuk Emas</p>
          <div className="text-[13px] text-white/60 leading-relaxed space-y-2">
            {meta.explain.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>

        <p className="text-[10px] text-white/25 pt-1">Data live Twelve Data. Bukan nasihat keuangan.</p>
      </main>
    </div>
  )
}
