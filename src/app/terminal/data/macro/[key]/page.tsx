'use client'

// Halaman detail 1 indikator makro FRED — generic, dipakai untuk 12 indikator
// (DXY, Yield 10Y/2Y, Real Yield, Breakeven, CPI, Core CPI, Core PCE, Fed Funds,
// Pengangguran, NFP, Pertumbuhan Upah). Config per-key di lib/macro-detail-config.tsx.
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import { DetailLineChart, Row, Stat, LockedTeaser, fmtDate, fmtDateShort, type ChartPoint } from '@/components/terminal/DetailChart'
import { MACRO_DETAIL, MACRO_LABEL } from '@/lib/macro-detail-config'
import { FRED_SERIES } from '@/lib/fred'
import { ArrowLeft, Loader2, Info, Check } from 'lucide-react'

type MacroPoint = { key: string; value: number; prior: number; date: string; history: number[] }
type HistPoint = { date: string; value: number }
const RANGES = [{ label: '1B', days: 30 }, { label: '3B', days: 90 }, { label: '6B', days: 180 }, { label: '1T', days: 365 }]

export default function MacroDetailPage() {
  const params = useParams<{ key: string }>()
  const key = params.key
  const router = useRouter()
  const sub = useSubscription()
  const [rangeDays, setRangeDays] = useState(90)
  const [macro, setMacro] = useState<Record<string, MacroPoint> | null>(null)
  const [hist, setHist] = useState<HistPoint[] | null>(null)

  const meta = MACRO_DETAIL[key]
  const series = FRED_SERIES.find(s => s.key === key)

  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace(`/login?next=${encodeURIComponent(`/terminal/data/macro/${key}`)}`)
  }, [sub.loading, sub.userId, router, key])

  useEffect(() => {
    if (!sub.isPro || !meta) return
    fetch('/api/terminal/macro').then(r => r.json()).then((arr: MacroPoint[]) => {
      if (!Array.isArray(arr)) return
      const m: Record<string, MacroPoint> = {}
      for (const p of arr) m[p.key] = p
      setMacro(m)
    }).catch(() => {})
    fetch(`/api/terminal/macro-history?key=${key}&limit=250`).then(r => r.json()).then(d => { if (Array.isArray(d)) setHist(d) }).catch(() => {})
  }, [sub.isPro, key, meta])

  if (sub.loading || !sub.userId) return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>
  if (!meta || !series) {
    return (
      <div className="min-h-screen bg-[#060a09] text-white flex items-center justify-center p-4 text-center">
        <div>
          <p className="text-lg font-bold mb-2">Indikator tidak ditemukan</p>
          <Link href="/terminal" className="text-primary hover:underline text-sm">← Kembali ke Terminal</Link>
        </div>
      </div>
    )
  }
  if (!sub.isPro) return <LockedTeaser icon={meta.icon} title={`Detail ${meta.title}`} desc="Chart penuh + data historis & konteks makro — khusus langganan Pro." />

  const point = macro?.[key]
  const changed = point ? point.value - point.prior : null
  const view = hist ? hist.slice(-rangeDays) : null
  const chartData: ChartPoint[] | null = view ? view.map(d => ({ label: fmtDateShort(d.date), value: d.value })) : null
  const stats = view && view.length >= 2 ? (() => {
    const vals = view.map(d => d.value)
    const first = vals[0], last = vals[vals.length - 1]
    const chg = last - first
    const chgPct = first !== 0 ? (chg / Math.abs(first)) * 100 : 0
    return { chg, chgPct, hi: Math.max(...vals), lo: Math.min(...vals), avg: vals.reduce((a, b) => a + b, 0) / vals.length, last }
  })() : null
  const fmtV = (v: number) => `${v.toFixed(series.dec)}${series.unit}`
  // Warna perubahan berdasarkan korelasi ke emas: corr<0 (naik=bearish emas, mis. dolar/yield),
  // corr>0 (naik=bullish emas, mis. breakeven/pengangguran/NFP).
  const changeColor = (chg: number | null) => {
    if (chg == null || chg === 0) return 'text-white/70'
    const goodForGold = series.corr < 0 ? chg < 0 : chg > 0
    return goodForGold ? 'text-emerald-400' : 'text-red-400'
  }
  const Icon = meta.icon

  return (
    <div className="min-h-screen bg-[#060a09] text-white">
      <header className="sticky top-0 z-30 bg-[#060a09]/95 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
          <Link href="/terminal" className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors shrink-0"><ArrowLeft size={15} /> Kembali ke Terminal</Link>
          <span className="w-px h-4 bg-white/10 shrink-0" />
          <span className="flex items-center gap-1.5 text-sm font-bold shrink-0"><Icon size={14} className="text-primary" /> {meta.title}</span>
          {point && (
            <span className="ml-auto flex items-center gap-2 text-xs shrink-0">
              <span className="font-black tabular-nums">{fmtV(point.value)}</span>
              {changed != null && <span className={`font-bold tabular-nums ${changeColor(changed)}`}>{changed >= 0 ? '+' : ''}{changed.toFixed(series.dec)}</span>}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-wrap gap-2">
            <p className="text-sm font-bold flex items-center gap-2">{series.name} <span className="text-[9px] font-semibold text-white/30 normal-case">{series.sub}</span></p>
            <div className="flex items-center gap-0.5">
              {RANGES.map(r => (
                <button key={r.days} onClick={() => setRangeDays(r.days)} className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-colors ${rangeDays === r.days ? 'bg-primary/20 text-primary' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}>{r.label}</button>
              ))}
            </div>
          </div>
          <div className="p-3">
            {chartData ? <DetailLineChart data={chartData} height={340} /> : <div className="h-[340px] flex items-center justify-center"><Loader2 size={20} className="animate-spin text-white/30" /></div>}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label={`Perubahan ${rangeDays}h`} value={`${stats.chgPct >= 0 ? '+' : ''}${stats.chgPct.toFixed(2)}%`} tone={stats.chgPct >= 0 ? 'up' : 'down'} sub={`${stats.chg >= 0 ? '+' : ''}${stats.chg.toFixed(series.dec)}${series.unit}`} />
            <Stat label="Tertinggi" value={fmtV(stats.hi)} tone="neutral" />
            <Stat label="Terendah" value={fmtV(stats.lo)} tone="neutral" />
            <Stat label="Rata-rata" value={fmtV(stats.avg)} tone="neutral" sub={`skrg ${stats.last > stats.avg ? 'di atas' : 'di bawah'} rata²`} />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">Data Resmi (Federal Reserve)</p>
            <div className="space-y-1.5">
              <Row l={series.name} v={point ? fmtV(point.value) : '—'} />
              <Row l="Rilis sebelumnya" v={point ? fmtV(point.prior) : '—'} />
              <Row l="Perubahan vs prior" v={changed != null ? `${changed >= 0 ? '+' : ''}${changed.toFixed(series.dec)}${series.unit}` : '—'} c={changeColor(changed)} />
              <Row l="Tanggal rilis" v={point ? fmtDate(point.date) : '—'} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">Indikator Berkorelasi</p>
            <div className="space-y-1.5">
              {meta.related.map(rk => {
                const rp = macro?.[rk]
                const rs = FRED_SERIES.find(s => s.key === rk)
                return (
                  <Link key={rk} href={`/terminal/data/macro/${rk}`} className="flex items-center justify-between rounded-lg bg-white/[0.03] hover:bg-white/[0.06] px-3 py-2.5 transition-colors">
                    <span className="text-[12px] text-white/60">{MACRO_LABEL[rk] ?? rk}</span>
                    <span className="text-[13px] font-bold tabular-nums text-primary">{rp && rs ? `${rp.value.toFixed(rs.dec)}${rs.unit}` : '—'}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="flex items-center gap-2 text-sm font-black mb-2"><Info size={15} className="text-primary" /> Kenapa {meta.title} Penting untuk Emas</p>
          <div className="text-[13px] text-white/60 leading-relaxed space-y-2">
            {meta.explain.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <div className="flex items-start gap-2 mt-4 pt-4 border-t border-white/[0.06]">
            <Check size={14} className="text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-white/45 leading-relaxed">Terminal sudah menghitung dampak indikator ini otomatis ke skor pilar Makro — lihat kartu &quot;Kesimpulan Makro&quot; di tab Makro.</p>
          </div>
        </div>

        <p className="text-[10px] text-white/25 pt-1">Data resmi Federal Reserve (FRED). Bukan nasihat keuangan.</p>
      </main>
    </div>
  )
}
