'use client'

// Halaman detail 1 indikator (DXY) — deep-dive dari kartu "Dolar (Live)" di Terminal.
// Chart dibangun SENDIRI dari data FRED (Broad USD Index, harian) — bukan iframe
// TradingView (sering diblokir/blank). Interaktif: hover tooltip + pilih rentang.
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import { ArrowLeft, Loader2, Landmark, Crown, Lock, Check, Info } from 'lucide-react'

type MacroPoint = { key: string; value: number; prior: number; date: string; history: number[] }
type HistPoint = { date: string; value: number }

const RANGES = [{ label: '1B', days: 30 }, { label: '3B', days: 90 }, { label: '6B', days: 180 }, { label: '1T', days: 365 }]

const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return d } }
const fmtDateShort = (d: string) => { try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) } catch { return d } }

// ── Chart garis interaktif dari data FRED ──
function FredLineChart({ data, height = 340 }: { data: HistPoint[]; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(640)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const measure = () => setW(el.clientWidth || 640)
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const padL = 46, padR = 14, padT = 14, padB = 24
  const cw = Math.max(1, w - padL - padR), ch = Math.max(1, height - padT - padB)

  const onMove = useCallback((clientX: number) => {
    const el = wrapRef.current; if (!el || data.length < 2) return
    const rect = el.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - rect.left - padL) / cw))
    setHover(Math.round(frac * (data.length - 1)))
  }, [cw, data.length])

  if (data.length < 2) return <div style={{ height }} className="flex items-center justify-center text-white/30 text-sm">Data belum cukup untuk chart</div>

  const vals = data.map(d => d.value)
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1
  const x = (i: number) => padL + (i / (data.length - 1)) * cw
  const y = (v: number) => padT + ch - ((v - min) / range) * ch
  const linePts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')
  const areaPts = `${padL},${padT + ch} ${linePts} ${padL + cw},${padT + ch}`
  const up = vals[vals.length - 1] >= vals[0]
  const color = up ? '#34d399' : '#f87171'
  const gridVals = [max, min + range * 0.5, min]
  const hd = hover != null ? data[hover] : null
  const hx = hover != null ? x(hover) : 0
  const tipLeft = Math.min(Math.max(hx, 60), w - 60)

  return (
    <div ref={wrapRef} className="relative select-none"
      onMouseMove={e => onMove(e.clientX)} onMouseLeave={() => setHover(null)}
      onTouchStart={e => onMove(e.touches[0].clientX)} onTouchMove={e => onMove(e.touches[0].clientX)}>
      <svg width={w} height={height} className="block">
        <defs><linearGradient id="dxyfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.22" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {/* gridlines + label Y */}
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line x1={padL} y1={y(gv)} x2={padL + cw} y2={y(gv)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padL - 8} y={y(gv) + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">{gv.toFixed(2)}</text>
          </g>
        ))}
        <polygon points={areaPts} fill="url(#dxyfill)" />
        <polyline points={linePts} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        {/* label X: awal, tengah, akhir */}
        {[0, Math.floor((data.length - 1) / 2), data.length - 1].map(i => (
          <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize="10" fill="rgba(255,255,255,0.35)">{fmtDateShort(data[i].date)}</text>
        ))}
        {/* crosshair + titik hover */}
        {hd && (
          <g>
            <line x1={hx} y1={padT} x2={hx} y2={padT + ch} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hx} cy={y(hd.value)} r="4" fill={color} stroke="#0b100e" strokeWidth="2" />
          </g>
        )}
      </svg>
      {/* tooltip */}
      {hd && (
        <div className="pointer-events-none absolute -top-1 rounded-lg border border-white/15 bg-[#0e1513] px-2.5 py-1.5 shadow-xl -translate-x-1/2" style={{ left: tipLeft }}>
          <p className="text-[9px] text-white/45 whitespace-nowrap">{fmtDate(hd.date)}</p>
          <p className="text-[12px] font-black tabular-nums" style={{ color }}>{hd.value.toFixed(3)}</p>
        </div>
      )}
    </div>
  )
}

function Row({ l, v, c }: { l: string; v: React.ReactNode; c?: string }) {
  return <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2.5"><span className="text-[12px] text-white/60">{l}</span><span className={`text-[13px] font-bold tabular-nums ${c ?? 'text-white/85'}`}>{v}</span></div>
}
function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' | 'neutral' }) {
  const c = tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-red-400' : 'text-white/85'
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0b100e] p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <p className={`text-lg font-black tabular-nums mt-1 ${c}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/35 mt-0.5">{sub}</p>}
    </div>
  )
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
  const [rangeDays, setRangeDays] = useState(90)
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
    // 1 tahun (~250 hari kerja) sekali; rentang lebih pendek di-slice di client.
    fetch('/api/terminal/macro-history?key=dollar&limit=250').then(r => r.json()).then(d => { if (Array.isArray(d)) setHist(d) }).catch(() => {})
  }, [sub.isPro])

  if (sub.loading || !sub.userId) return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>
  if (!sub.isPro) return <LockedTeaser />

  const dollar = macro?.dollar
  const changed = dollar ? dollar.value - dollar.prior : null
  // Slice sesuai rentang terpilih (approx: ambil N titik terakhir)
  const view = hist ? hist.slice(-rangeDays) : null
  const stats = view && view.length >= 2 ? (() => {
    const vals = view.map(d => d.value)
    const first = vals[0], last = vals[vals.length - 1]
    const chgPct = ((last - first) / first) * 100
    return { chgPct, hi: Math.max(...vals), lo: Math.min(...vals), avg: vals.reduce((a, b) => a + b, 0) / vals.length, last }
  })() : null

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
        {/* Chart utama — dibangun dari data FRED */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-wrap gap-2">
            <p className="text-sm font-bold flex items-center gap-2">Broad USD Index <span className="text-[9px] font-semibold text-white/30 normal-case">Federal Reserve · harian</span></p>
            <div className="flex items-center gap-0.5">
              {RANGES.map(r => (
                <button key={r.days} onClick={() => setRangeDays(r.days)} className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-colors ${rangeDays === r.days ? 'bg-primary/20 text-primary' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}>{r.label}</button>
              ))}
            </div>
          </div>
          <div className="p-3">
            {view ? <FredLineChart data={view} height={340} /> : <div className="h-[340px] flex items-center justify-center"><Loader2 size={20} className="animate-spin text-white/30" /></div>}
          </div>
        </div>

        {/* Statistik rentang terpilih */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label={`Perubahan ${rangeDays}h`} value={`${stats.chgPct >= 0 ? '+' : ''}${stats.chgPct.toFixed(2)}%`} tone={stats.chgPct >= 0 ? 'up' : 'down'} sub={stats.chgPct >= 0 ? 'dolar menguat' : 'dolar melemah'} />
            <Stat label="Tertinggi" value={stats.hi.toFixed(2)} tone="neutral" />
            <Stat label="Terendah" value={stats.lo.toFixed(2)} tone="neutral" />
            <Stat label="Rata-rata" value={stats.avg.toFixed(2)} tone="neutral" sub={`skrg ${stats.last > stats.avg ? 'di atas' : 'di bawah'} rata²`} />
          </div>
        )}

        {/* Data resmi + indikator terkait */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">Data Resmi (Federal Reserve)</p>
            <div className="space-y-1.5">
              <Row l="Broad USD Index" v={dollar ? dollar.value.toFixed(2) : '—'} />
              <Row l="Rilis sebelumnya" v={dollar ? dollar.prior.toFixed(2) : '—'} />
              <Row l="Perubahan vs prior" v={changed != null ? `${changed >= 0 ? '+' : ''}${changed.toFixed(3)}` : '—'} c={changed != null ? (changed >= 0 ? 'text-red-400' : 'text-emerald-400') : undefined} />
              <Row l="Tanggal rilis" v={dollar ? fmtDate(dollar.date) : '—'} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">Indikator Berkorelasi</p>
            <div className="space-y-1.5">
              <Row l="Yield 10Y" v={macro?.us10y ? `${macro.us10y.value}%` : '—'} c={macro?.us10y ? (macro.us10y.value > macro.us10y.prior ? 'text-red-400' : 'text-emerald-400') : undefined} />
              <Row l="Yield 2Y" v={macro?.us02y ? `${macro.us02y.value}%` : '—'} />
              <Row l="Real Yield 10Y" v={macro?.realyield ? `${macro.realyield.value}%` : '—'} c={macro?.realyield ? (macro.realyield.value > macro.realyield.prior ? 'text-red-400' : 'text-emerald-400') : undefined} />
              <Row l="Ekspektasi Inflasi (breakeven)" v={macro?.breakeven ? `${macro.breakeven.value}%` : '—'} />
              <Row l="Fed Funds Rate" v={macro?.fedfunds ? `${macro.fedfunds.value}%` : '—'} />
            </div>
          </div>
        </div>

        {/* Penjelasan */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="flex items-center gap-2 text-sm font-black mb-2"><Info size={15} className="text-primary" /> Kenapa DXY Penting untuk Emas</p>
          <div className="text-[13px] text-white/60 leading-relaxed space-y-2">
            <p>Emas (XAU/USD) dihargakan dalam dolar AS. Saat dolar <b className="text-red-400">menguat</b>, emas jadi relatif lebih mahal bagi pemegang mata uang lain — permintaan cenderung turun, harga tertekan. Sebaliknya, dolar <b className="text-emerald-400">melemah</b> biasanya mengangkat harga emas.</p>
            <p>Dolar sendiri sangat dipengaruhi <b>yield & suku bunga</b>: yield AS naik → dolar cenderung menguat (investor asing memburu imbal hasil) → tekanan ke emas. Karena itu DXY, yield, dan real yield sering dipantau bersamaan.</p>
            <p>Korelasi ini bukan mutlak — di masa risk-off ekstrem, dolar & emas bisa naik bersamaan (sama-sama aset aman). Tapi mayoritas waktu keduanya <b>berlawanan arah</b>.</p>
          </div>
          <div className="flex items-start gap-2 mt-4 pt-4 border-t border-white/[0.06]">
            <Check size={14} className="text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-white/45 leading-relaxed">Terminal sudah menghitung dampak DXY ini otomatis ke skor pilar Makro — lihat kartu &quot;Kesimpulan Makro&quot; di tab Makro.</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-white/25 pt-1">
          <Lock size={10} /> Data resmi Federal Reserve (FRED). Bukan nasihat keuangan.
        </div>
      </main>
    </div>
  )
}
