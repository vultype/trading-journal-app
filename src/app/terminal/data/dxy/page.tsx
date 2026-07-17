'use client'

// Halaman detail 1 indikator (DXY) — deep-dive dari kartu "Dolar (Live)" di Terminal.
// URL terpisah (bukan overlay) supaya bisa di-bookmark & tidak menambah beban ke
// TradingTerminal.tsx yang sudah besar. Pola gating & layout konsisten dgn /terminal.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import { TradingViewChart } from '@/components/terminal/TradingViewChart'
import { ArrowLeft, Loader2, Landmark, Crown, Lock, Check, Info } from 'lucide-react'

type MacroPoint = { key: string; value: number; prior: number; date: string; history: number[] }
type HistPoint = { date: string; value: number }

const CHART_TFS: { label: string; value: string }[] = [
  { label: 'M15', value: '15' }, { label: 'H1', value: '60' }, { label: 'H4', value: '240' }, { label: 'D1', value: 'D' }, { label: 'W', value: 'W' },
]

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return d }
}

// Area/line chart panjang (90 hari) — lebih besar dari Sparkline kartu kecil di Terminal.
function TrendChart({ data }: { data: HistPoint[] }) {
  if (data.length < 2) return <div className="h-24 flex items-center justify-center text-[11px] text-white/30">Data tren belum cukup</div>
  const w = 100, h = 100 // viewBox persentase, discale via CSS
  const vals = data.map(d => d.value)
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d.value - min) / range) * (h - 8) - 4}`).join(' ')
  const up = vals[vals.length - 1] >= vals[0]
  const color = up ? '#34d399' : '#f87171'
  const areaPts = `0,${h} ${pts} ${w},${h}`
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-28">
        <polygon points={areaPts} fill={color} opacity="0.08" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex items-center justify-between text-[10px] text-white/35 mt-1.5">
        <span>{fmtDate(data[0].date)}</span>
        <span>{fmtDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  )
}

function Row({ l, v, c }: { l: string; v: React.ReactNode; c?: string }) {
  return <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2.5"><span className="text-[12px] text-white/60">{l}</span><span className={`text-[13px] font-bold tabular-nums ${c ?? 'text-white/85'}`}>{v}</span></div>
}

function LockedTeaser() {
  return (
    <div className="min-h-screen bg-[#060a09] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-3xl border border-primary/20 bg-gradient-to-b from-[#0b1512] to-[#0b100e] p-8 text-center">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 ring-1 ring-primary/30 text-primary mb-5"><Landmark size={26} /></span>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 rounded-full px-2.5 py-1"><Crown size={11} /> Fitur Pro</span>
        <h2 className="text-2xl font-black tracking-tight mt-4">Detail Indeks Dolar (DXY)</h2>
        <p className="text-sm text-white/55 mt-2.5 leading-relaxed">Chart penuh + data historis & konteks makro — khusus langganan Pro.</p>
        <Link href="/upgrade" className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-bold mt-7 hover:opacity-90 transition-all"><Crown size={15} /> Upgrade ke Pro</Link>
      </div>
    </div>
  )
}

export default function DxyDetailPage() {
  const router = useRouter()
  const sub = useSubscription()
  const [tf, setTf] = useState('60')
  const [macro, setMacro] = useState<Record<string, MacroPoint> | null>(null)
  const [hist, setHist] = useState<HistPoint[] | null>(null)

  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace('/login?next=%2Fterminal%2Fdata%2Fdxy')
  }, [sub.loading, sub.userId, router])

  useEffect(() => {
    if (!sub.isPro) return
    fetch('/api/terminal/macro').then(r => r.json()).then((arr: MacroPoint[]) => {
      if (!Array.isArray(arr)) return
      const m: Record<string, MacroPoint> = {}
      for (const p of arr) m[p.key] = p
      setMacro(m)
    }).catch(() => {})
    fetch('/api/terminal/macro-history?key=dollar&limit=90').then(r => r.json()).then(d => { if (Array.isArray(d)) setHist(d) }).catch(() => {})
  }, [sub.isPro])

  if (sub.loading || !sub.userId) {
    return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>
  }
  if (!sub.isPro) return <LockedTeaser />

  const dollar = macro?.dollar
  const us10y = macro?.us10y
  const realyield = macro?.realyield
  const changed = dollar ? dollar.value - dollar.prior : null

  return (
    <div className="min-h-screen bg-[#060a09] text-white">
      <header className="sticky top-0 z-30 bg-[#060a09]/95 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
          <Link href="/terminal" className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors shrink-0"><ArrowLeft size={15} /> Kembali ke Terminal</Link>
          <span className="w-px h-4 bg-white/10 shrink-0" />
          <span className="flex items-center gap-1.5 text-sm font-bold shrink-0"><Landmark size={14} className="text-primary" /> Indeks Dolar (DXY)</span>
          {dollar && (
            <span className="ml-auto flex items-center gap-2 text-xs shrink-0">
              <span className="font-black tabular-nums">{dollar.value.toFixed(2)}</span>
              <span className={`font-bold tabular-nums ${changed! >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>{changed! >= 0 ? '+' : ''}{changed!.toFixed(2)}</span>
            </span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* Chart utama — TradingView, simbol resmi ICE US Dollar Index */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <p className="text-sm font-bold flex items-center gap-2">Chart DXY <span className="text-[9px] font-semibold text-white/30 normal-case">TradingView · ICE US Dollar Index</span></p>
            <div className="flex items-center gap-0.5">
              {CHART_TFS.map(x => (
                <button key={x.value} onClick={() => setTf(x.value)} className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-colors ${tf === x.value ? 'bg-primary/20 text-primary' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}>{x.label}</button>
              ))}
            </div>
          </div>
          <TradingViewChart symbol="TVC:DXY" interval={tf} chartStyle="1" height={520} />
        </div>

        {/* Konteks & data resmi */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">Data Resmi (Federal Reserve, harian)</p>
            <div className="space-y-1.5">
              <Row l="Broad USD Index" v={dollar ? dollar.value.toFixed(2) : '—'} />
              <Row l="Prior" v={dollar ? dollar.prior.toFixed(2) : '—'} />
              <Row l="Tanggal rilis" v={dollar ? fmtDate(dollar.date) : '—'} />
            </div>
            <p className="text-[10px] text-white/35 mt-3">Catatan: skala Fed Broad USD Index berbeda dari indeks TVC:DXY di chart atas (metodologi & basket mata uang beda) — arah pergerakannya tetap searah, angka mentahnya tidak sama.</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">Indikator Terkait</p>
            <div className="space-y-1.5">
              <Row l="Yield 10Y" v={us10y ? `${us10y.value}%` : '—'} c={us10y && us10y.value > us10y.prior ? 'text-red-400' : 'text-emerald-400'} />
              <Row l="Real Yield 10Y" v={realyield ? `${realyield.value}%` : '—'} c={realyield && realyield.value > realyield.prior ? 'text-red-400' : 'text-emerald-400'} />
            </div>
            <p className="text-[10px] text-white/35 mt-3">Dolar & yield sering bergerak searah — dua-duanya naik biasanya menekan emas bersamaan.</p>
          </div>
        </div>

        {/* Tren 90 hari */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">Tren Broad USD Index — 90 Rilis Terakhir</p>
          {hist ? <TrendChart data={hist} /> : <div className="h-28 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-white/30" /></div>}
        </div>

        {/* Penjelasan */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="flex items-center gap-2 text-sm font-black mb-2"><Info size={15} className="text-primary" /> Kenapa DXY Penting untuk Emas</p>
          <div className="text-[13px] text-white/60 leading-relaxed space-y-2">
            <p>Emas (XAU/USD) dihargakan dalam dolar AS. Saat dolar <b className="text-red-400">menguat</b>, emas jadi relatif lebih mahal bagi pemegang mata uang lain — permintaan cenderung turun, harga tertekan. Sebaliknya, dolar <b className="text-emerald-400">melemah</b> biasanya mengangkat harga emas.</p>
            <p>Korelasi ini bukan mutlak 100% — di masa risk-off ekstrem, dolar & emas bisa naik bersamaan (sama-sama dicari sebagai aset aman). Tapi mayoritas waktu, dolar & emas bergerak <b>berlawanan arah</b>, sehingga DXY jadi salah satu indikator makro paling dipantau trader emas.</p>
          </div>
          <div className="flex items-start gap-2 mt-4 pt-4 border-t border-white/[0.06]">
            <Check size={14} className="text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-white/45 leading-relaxed">Terminal sudah menghitung dampak DXY ini otomatis ke skor pilar Makro — lihat kartu &quot;Kesimpulan Makro&quot; di tab Makro.</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-white/25 pt-1">
          <Lock size={10} /> Data resmi Federal Reserve (FRED) & TradingView. Bukan nasihat keuangan.
        </div>
      </main>
    </div>
  )
}
