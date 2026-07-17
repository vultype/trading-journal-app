'use client'

// Hub Makro mendalam — sub-navbar 4 menu: Summary, Lintas Aset, Inflasi & Fed,
// Institusi vs Retail. Summary punya chart komparasi ternormalisasi (XAU sbg
// fokus utama, series lain bisa difilter). Data dari endpoint yang sudah ada
// (macro, macro-history, candles, cot). Pro-gated.
import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import { DetailLineChart, DetailMultiLineChart, Row, Stat, LockedTeaser, fmtDate, fmtDateShort, type ChartPoint } from '@/components/terminal/DetailChart'
import { TerminalScopeAnalysis } from '@/components/terminal/TerminalScopeAnalysis'
import { ArrowLeft, Loader2, Landmark, LineChart, Flame, Users, LayoutDashboard, ExternalLink } from 'lucide-react'

type MacroPoint = { key: string; value: number; prior: number; date: string; history: number[] }
type Cross = Record<string, { price: number; changePct: number } | null>
type CotGroup = { long: number; short: number; net: number; deltaNet: number }
type HistPoint = { date: string; value: number }
type Cot = { date: string; funds: CotGroup; commercials: CotGroup; retail: CotGroup; fundsHistoryFull: HistPoint[]; commercialsHistoryFull: HistPoint[]; retailHistoryFull: HistPoint[] }
type Series = { date: string; value: number }[]

const kfmt = (n: number) => (n >= 0 ? '+' : '') + (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toFixed(0))

// ── util: ambil history 1 series (FRED atau market candle D1) ──
async function fetchHistory(type: 'fred' | 'mkt', id: string, limit = 120): Promise<Series> {
  const url = type === 'fred' ? `/api/terminal/macro-history?key=${id}&limit=${limit}` : `/api/terminal/candles?tf=D1&symbol=${encodeURIComponent(id)}`
  const d = await fetch(url).then(r => r.json()).catch(() => null)
  if (!Array.isArray(d)) return []
  return type === 'fred'
    ? (d as HistPoint[]).map(p => ({ date: p.date, value: p.value }))
    : (d as { t: number; c: number }[]).map(c => ({ date: new Date(c.t).toISOString().slice(0, 10), value: c.c }))
}

// ── util: align beberapa series ke tanggal-union + rebase ke % change ──
function alignNormalize(named: { name: string; color: string; main?: boolean; raw: Series }[], windowDays = 90) {
  const maps = named.map(s => new Map(s.raw.map(p => [p.date, p.value])))
  const allDates = Array.from(new Set(named.flatMap(s => s.raw.map(p => p.date)))).sort()
  const dates = allDates.slice(-windowDays)
  if (!dates.length) return { dates: [] as string[], series: [] as { name: string; color: string; main?: boolean; values: (number | null)[] }[] }
  const series = named.map((s, i) => {
    // seed: nilai terakhir sebelum jendela mulai (agar tak ada null di awal utk data bulanan)
    let last: number | null = null
    for (const p of s.raw) { if (p.date <= dates[0]) last = p.value; else break }
    const filled = dates.map(d => { if (maps[i].has(d)) last = maps[i].get(d)!; return last })
    const base = filled.find(v => v != null) ?? null
    const values = filled.map(v => (v == null || base == null || base === 0) ? null : ((v - base) / Math.abs(base)) * 100)
    return { name: s.name, color: s.color, main: s.main, values }
  })
  return { dates, series }
}

// ── Chart komparasi ternormalisasi (interaktif + filter + fokus XAU) ──
function ComparisonChart({ dates, series, visible, height = 380 }: {
  dates: string[]; series: { name: string; color: string; main?: boolean; values: (number | null)[] }[]; visible: Record<string, boolean>; height?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(720)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const m = () => setW(el.clientWidth || 720); m()
    const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect()
  }, [])
  const shown = series.filter(s => visible[s.name])
  const padL = 50, padR = 16, padT = 14, padB = 24
  const cw = Math.max(1, w - padL - padR), ch = Math.max(1, height - padT - padB)
  const n = dates.length
  const onMove = useCallback((clientX: number) => {
    const el = wrapRef.current; if (!el || n < 2) return
    const r = el.getBoundingClientRect()
    setHover(Math.round(Math.min(1, Math.max(0, (clientX - r.left - padL) / cw)) * (n - 1)))
  }, [cw, n])
  if (n < 2 || !shown.length) return <div style={{ height }} className="flex items-center justify-center text-white/30 text-sm">{n < 2 ? 'Memuat data…' : 'Pilih minimal satu data untuk ditampilkan'}</div>

  const allVals = shown.flatMap(s => s.values.filter((v): v is number => v != null))
  const min = Math.min(...allVals, 0), max = Math.max(...allVals, 0), range = max - min || 1
  const x = (i: number) => padL + (i / (n - 1)) * cw
  const y = (v: number) => padT + ch - ((v - min) / range) * ch
  const grid = [max, (max + min) / 2, min]
  const hx = hover != null ? x(hover) : 0
  const tipLeft = hover != null ? Math.min(Math.max(hx, 90), w - 90) : 0

  return (
    <div ref={wrapRef} className="relative select-none"
      onMouseMove={e => onMove(e.clientX)} onMouseLeave={() => setHover(null)}
      onTouchStart={e => onMove(e.touches[0].clientX)} onTouchMove={e => onMove(e.touches[0].clientX)}>
      <svg width={w} height={height} className="block">
        {grid.map((gv, i) => (
          <g key={i}>
            <line x1={padL} y1={y(gv)} x2={padL + cw} y2={y(gv)} stroke="rgba(255,255,255,0.06)" />
            <text x={padL - 8} y={y(gv) + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">{gv >= 0 ? '+' : ''}{gv.toFixed(1)}%</text>
          </g>
        ))}
        <line x1={padL} y1={y(0)} x2={padL + cw} y2={y(0)} stroke="rgba(255,255,255,0.14)" strokeDasharray="2 3" />
        {/* series non-utama dulu, XAU (main) terakhir agar di atas */}
        {[...shown].sort((a, b) => (a.main ? 1 : 0) - (b.main ? 1 : 0)).map(s => {
          const pts = s.values.map((v, i) => v == null ? null : `${x(i)},${y(v)}`).filter(Boolean).join(' ')
          return <polyline key={s.name} points={pts} fill="none" stroke={s.color} strokeWidth={s.main ? 2.75 : 1.4} opacity={s.main ? 1 : 0.85} strokeLinejoin="round" strokeLinecap="round" />
        })}
        {[0, Math.floor((n - 1) / 2), n - 1].map(i => (
          <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="10" fill="rgba(255,255,255,0.35)">{fmtDateShort(dates[i])}</text>
        ))}
        {hover != null && <line x1={hx} y1={padT} x2={hx} y2={padT + ch} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />}
        {hover != null && shown.map(s => s.values[hover] == null ? null : <circle key={s.name} cx={hx} cy={y(s.values[hover]!)} r={s.main ? 4 : 3} fill={s.color} stroke="#0b100e" strokeWidth="2" />)}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute -top-1 rounded-lg border border-white/15 bg-[#0e1513] px-2.5 py-2 shadow-xl -translate-x-1/2 space-y-0.5 z-10" style={{ left: tipLeft }}>
          <p className="text-[9px] text-white/45 whitespace-nowrap mb-0.5">{fmtDate(dates[hover])}</p>
          {[...shown].sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0)).map(s => (
            <p key={s.name} className="text-[11px] font-bold tabular-nums flex items-center gap-1.5 whitespace-nowrap" style={{ color: s.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />{s.name}: {s.values[hover] != null ? `${s.values[hover]! >= 0 ? '+' : ''}${s.values[hover]!.toFixed(2)}%` : '—'}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Kartu indikator kecil (chart + nilai + link detail) — fetch history sendiri ──
function IndicatorCard({ label, type, id, current, href, color = '#60a5fa' }: {
  label: string; type: 'fred' | 'mkt'; id: string; current: string; href: string; color?: string
}) {
  const [hist, setHist] = useState<Series | null>(null)
  useEffect(() => { let stop = false; fetchHistory(type, id, 90).then(s => { if (!stop) setHist(s) }); return () => { stop = true } }, [type, id])
  const data: ChartPoint[] | null = hist ? hist.map(p => ({ label: fmtDateShort(p.date), value: p.value })) : null
  return (
    <Link href={href} className="group rounded-2xl border border-white/[0.07] bg-[#0b100e] p-4 hover:border-primary/25 transition-colors block">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[12px] font-bold text-white/80">{label}</p>
        <ExternalLink size={12} className="text-white/25 group-hover:text-primary transition-colors" />
      </div>
      <p className="text-lg font-black tabular-nums mb-1">{current}</p>
      {data ? <DetailLineChart data={data} height={90} /> : <div className="h-[90px] flex items-center justify-center"><Loader2 size={14} className="animate-spin text-white/25" /></div>}
    </Link>
  )
}

const SECTIONS = [
  { id: 'summary', label: 'Summary', icon: LayoutDashboard },
  { id: 'lintas', label: 'Lintas Aset', icon: LineChart },
  { id: 'inflasi', label: 'Inflasi & Kebijakan Fed', icon: Flame },
  { id: 'cot', label: 'Institusi vs Retail', icon: Users },
] as const
type SectionId = typeof SECTIONS[number]['id']

function MacroHubInner() {
  const router = useRouter()
  const params = useSearchParams()
  const sub = useSubscription()
  const view = (SECTIONS.find(s => s.id === params.get('view'))?.id ?? 'summary') as SectionId

  const [macro, setMacro] = useState<Record<string, MacroPoint> | null>(null)
  const [cross, setCross] = useState<Cross | null>(null)
  const [cot, setCot] = useState<Cot | null>(null)
  // comparison
  const [comp, setComp] = useState<ReturnType<typeof alignNormalize> | null>(null)
  const [visible, setVisible] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace('/login?next=%2Fterminal%2Fmacro')
  }, [sub.loading, sub.userId, router])

  useEffect(() => {
    if (!sub.isPro) return
    fetch('/api/terminal/macro').then(r => r.json()).then((a: MacroPoint[]) => { if (Array.isArray(a)) { const m: Record<string, MacroPoint> = {}; for (const p of a) m[p.key] = p; setMacro(m) } }).catch(() => {})
    fetch('/api/terminal/crossasset').then(r => r.json()).then(j => { if (j && typeof j === 'object') setCross(j) }).catch(() => {})
    fetch('/api/terminal/cot').then(r => r.json()).then(d => { if (d && d.date) setCot(d) }).catch(() => {})
  }, [sub.isPro])

  // Load comparison saat pertama buka Summary
  useEffect(() => {
    if (!sub.isPro || view !== 'summary' || comp) return
    ;(async () => {
      const defs: { name: string; color: string; main?: boolean; type: 'fred' | 'mkt'; id: string }[] = [
        { name: 'XAU/USD', color: '#fbbf24', main: true, type: 'mkt', id: 'XAU/USD' },
        { name: 'DXY', color: '#60a5fa', type: 'fred', id: 'dollar' },
        { name: 'Yield 10Y', color: '#f472b6', type: 'fred', id: 'us10y' },
        { name: 'Real Yield', color: '#34d399', type: 'fred', id: 'realyield' },
        { name: 'CPI', color: '#f87171', type: 'fred', id: 'cpi' },
        { name: 'VIX', color: '#a78bfa', type: 'mkt', id: 'VIXY' },
        { name: 'S&P 500', color: '#22d3ee', type: 'mkt', id: 'SPY' },
        { name: 'Bitcoin', color: '#fb923c', type: 'mkt', id: 'BTC/USD' },
      ]
      const raws = await Promise.all(defs.map(d => fetchHistory(d.type, d.id, 120)))
      const named = defs.map((d, i) => ({ name: d.name, color: d.color, main: d.main, raw: raws[i] }))
      const aligned = alignNormalize(named, 90)
      setComp(aligned)
      setVisible(Object.fromEntries(defs.map(d => [d.name, d.main || d.name === 'DXY' || d.name === 'CPI'])))
    })()
  }, [sub.isPro, view, comp])

  if (sub.loading || !sub.userId) return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>
  if (!sub.isPro) return <LockedTeaser icon={Landmark} title="Makro Mendalam" desc="Dashboard makro multi-halaman: lintas aset, inflasi & Fed, posisi institusi, plus chart komparasi — khusus langganan Pro." />

  // snapshot ringan utk analisa AI makro (endpoint tetap tarik berita sendiri)
  const aiSnapshot = {
    macro: macro ? Object.fromEntries(Object.entries(macro).map(([k, v]) => [k, { value: v.value, prior: v.prior }])) : null,
    yieldCurve2s10: macro?.us10y && macro?.us02y ? +(macro.us10y.value - macro.us02y.value).toFixed(2) : null,
    cot: cot ? { date: cot.date, funds: { net: cot.funds.net, deltaNet: cot.funds.deltaNet }, commercials: { net: cot.commercials.net }, retail: { net: cot.retail.net, deltaNet: cot.retail.deltaNet } } : null,
    riskAssets: cross ? { spy: cross.SPY?.changePct ?? null, qqq: cross.QQQ?.changePct ?? null, vix: cross.VIXY?.changePct ?? null, dollarRealtime: cross.UUP?.changePct ?? null } : null,
    btc: cross?.['BTC/USD'] ? { price: Math.round(cross['BTC/USD']!.price), changePct: cross['BTC/USD']!.changePct } : null,
  }

  return (
    <div className="min-h-screen bg-[#060a09] text-white">
      <header className="sticky top-0 z-30 bg-[#060a09]/95 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
          <Link href="/terminal" className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors shrink-0"><ArrowLeft size={15} /> Terminal</Link>
          <span className="w-px h-4 bg-white/10 shrink-0" />
          <span className="flex items-center gap-1.5 text-sm font-bold shrink-0"><Landmark size={14} className="text-primary" /> Makro Mendalam</span>
        </div>
        {/* Sub-navbar */}
        <nav className="max-w-6xl mx-auto px-2 md:px-4 flex items-center gap-1 overflow-x-auto">
          {SECTIONS.map(s => {
            const on = view === s.id
            return (
              <button key={s.id} onClick={() => router.replace(`/terminal/macro?view=${s.id}`)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2.5 text-[12px] font-semibold whitespace-nowrap transition-colors ${on ? 'text-primary' : 'text-white/45 hover:text-white/80'}`}>
                <s.icon size={13} /> {s.label}
                {on && <span className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full bg-primary" />}
              </button>
            )
          })}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* ── SUMMARY ── */}
        {view === 'summary' && (
          <>
            <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <p className="text-sm font-bold flex items-center gap-2">Perbandingan Lintas Data <span className="text-[9px] font-semibold text-white/30 normal-case">% perubahan · 90 hari · fokus XAU/USD</span></p>
                <p className="text-[10px] text-white/40 mt-0.5">Semua data disamakan ke % perubahan dari titik awal agar bisa dibandingkan. Klik chip untuk tampilkan/sembunyikan.</p>
              </div>
              <div className="p-3">
                {comp ? <ComparisonChart dates={comp.dates} series={comp.series} visible={visible} height={380} /> : <div className="h-[380px] flex items-center justify-center"><Loader2 size={22} className="animate-spin text-white/30" /></div>}
              </div>
              {comp && (
                <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                  {comp.series.map(s => {
                    const on = visible[s.name]
                    return (
                      <button key={s.name} onClick={() => setVisible(v => ({ ...v, [s.name]: !v[s.name] }))}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${on ? 'border-white/20 bg-white/[0.06] text-white' : 'border-white/[0.08] text-white/35 hover:text-white/60'} ${s.main ? 'ring-1 ring-amber-400/40' : ''}`}>
                        <span className="w-2 h-2 rounded-full" style={{ background: on ? s.color : 'rgba(255,255,255,0.2)' }} />{s.name}{s.main && ' ★'}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Ringkasan pilar makro */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Dolar (DXY)" value={macro?.dollar ? macro.dollar.value.toFixed(2) : '—'} tone={macro?.dollar ? (macro.dollar.value > macro.dollar.prior ? 'down' : 'up') : 'neutral'} sub={macro?.dollar ? (macro.dollar.value > macro.dollar.prior ? 'menguat → tekan emas' : 'melemah → dukung emas') : ''} />
              <Stat label="Yield 10Y" value={macro?.us10y ? `${macro.us10y.value}%` : '—'} tone={macro?.us10y ? (macro.us10y.value > macro.us10y.prior ? 'down' : 'up') : 'neutral'} />
              <Stat label="Inflasi (CPI)" value={macro?.cpi ? `${macro.cpi.value}%` : '—'} tone="neutral" />
              <Stat label="Fed Funds" value={macro?.fedfunds ? `${macro.fedfunds.value}%` : '—'} tone="neutral" />
              <Stat label="Institusi (COT)" value={cot ? (cot.funds.net >= 0 ? 'Net Long' : 'Net Short') : '—'} tone={cot ? (cot.funds.net >= 0 ? 'up' : 'down') : 'neutral'} sub={cot ? kfmt(cot.funds.net) : ''} />
              <Stat label="Retail (COT)" value={cot ? (cot.retail.net >= 0 ? 'Net Long' : 'Net Short') : '—'} tone="neutral" sub={cot ? kfmt(cot.retail.net) : ''} />
              <Stat label="VIX" value={cross?.VIXY ? `${cross.VIXY.changePct >= 0 ? '+' : ''}${cross.VIXY.changePct.toFixed(1)}%` : '—'} tone={cross?.VIXY ? (cross.VIXY.changePct > 0 ? 'up' : 'neutral') : 'neutral'} />
              <Stat label="Bitcoin" value={cross?.['BTC/USD'] ? `${cross['BTC/USD']!.changePct >= 0 ? '+' : ''}${cross['BTC/USD']!.changePct.toFixed(1)}%` : '—'} tone="neutral" />
            </div>

            {/* Analisa AI otomatis (tanpa form prompt) */}
            <TerminalScopeAnalysis scope="makro" hidePrompt title="Analisa Makro AI" subtitle="Sintesis semua data makro → bias, nada Fed & dampak ke XAU/USD." snapshot={aiSnapshot} suggestions={[]} />
          </>
        )}

        {/* ── LINTAS ASET ── */}
        {view === 'lintas' && (
          <>
            <p className="text-[12px] text-white/50 leading-relaxed">Aset & instrumen yang berkorelasi dengan emas. Klik kartu untuk detail penuh + tren lebih panjang.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <IndicatorCard label="Indeks Dolar (DXY)" type="fred" id="dollar" current={macro?.dollar ? macro.dollar.value.toFixed(2) : '—'} href="/terminal/data/macro/dollar" color="#60a5fa" />
              <IndicatorCard label="Yield 10Y" type="fred" id="us10y" current={macro?.us10y ? `${macro.us10y.value}%` : '—'} href="/terminal/data/macro/us10y" color="#f472b6" />
              <IndicatorCard label="Yield 2Y" type="fred" id="us02y" current={macro?.us02y ? `${macro.us02y.value}%` : '—'} href="/terminal/data/macro/us02y" color="#f472b6" />
              <IndicatorCard label="Real Yield 10Y" type="fred" id="realyield" current={macro?.realyield ? `${macro.realyield.value}%` : '—'} href="/terminal/data/macro/realyield" color="#34d399" />
              <IndicatorCard label="VIX (Ketakutan)" type="mkt" id="VIXY" current={cross?.VIXY ? cross.VIXY.price.toFixed(2) : '—'} href="/terminal/data/market/vix" color="#a78bfa" />
              <IndicatorCard label="S&P 500" type="mkt" id="SPY" current={cross?.SPY ? cross.SPY.price.toFixed(2) : '—'} href="/terminal/data/market/spx" color="#22d3ee" />
              <IndicatorCard label="Nasdaq 100" type="mkt" id="QQQ" current={cross?.QQQ ? cross.QQQ.price.toFixed(2) : '—'} href="/terminal/data/market/ndx" color="#22d3ee" />
              <IndicatorCard label="Bitcoin" type="mkt" id="BTC/USD" current={cross?.['BTC/USD'] ? Math.round(cross['BTC/USD']!.price).toLocaleString('en-US') : '—'} href="/terminal/data/market/btc" color="#fb923c" />
              <IndicatorCard label="Perak (Silver)" type="mkt" id="XAG/USD" current={cross?.['XAG/USD'] ? cross['XAG/USD']!.price.toFixed(3) : '—'} href="/terminal/data/market/xag" color="#e2e8f0" />
            </div>
          </>
        )}

        {/* ── INFLASI & KEBIJAKAN FED ── */}
        {view === 'inflasi' && (
          <>
            <p className="text-[12px] text-white/50 leading-relaxed">Data inflasi & ketenagakerjaan yang menentukan arah kebijakan suku bunga The Fed — pendorong terbesar harga emas jangka menengah.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <IndicatorCard label="CPI (Headline)" type="fred" id="cpi" current={macro?.cpi ? `${macro.cpi.value}%` : '—'} href="/terminal/data/macro/cpi" color="#f87171" />
              <IndicatorCard label="Core CPI" type="fred" id="corecpi" current={macro?.corecpi ? `${macro.corecpi.value}%` : '—'} href="/terminal/data/macro/corecpi" color="#f87171" />
              <IndicatorCard label="Core PCE (favorit Fed)" type="fred" id="corepce" current={macro?.corepce ? `${macro.corepce.value}%` : '—'} href="/terminal/data/macro/corepce" color="#fb923c" />
              <IndicatorCard label="Ekspektasi Inflasi (breakeven)" type="fred" id="breakeven" current={macro?.breakeven ? `${macro.breakeven.value}%` : '—'} href="/terminal/data/macro/breakeven" color="#fbbf24" />
              <IndicatorCard label="Fed Funds Rate" type="fred" id="fedfunds" current={macro?.fedfunds ? `${macro.fedfunds.value}%` : '—'} href="/terminal/data/macro/fedfunds" color="#60a5fa" />
              <IndicatorCard label="Pengangguran" type="fred" id="unrate" current={macro?.unrate ? `${macro.unrate.value}%` : '—'} href="/terminal/data/macro/unrate" color="#34d399" />
              <IndicatorCard label="NFP (Payrolls)" type="fred" id="nfp" current={macro?.nfp ? `${macro.nfp.value >= 0 ? '+' : ''}${macro.nfp.value}K` : '—'} href="/terminal/data/macro/nfp" color="#34d399" />
              <IndicatorCard label="Pertumbuhan Upah" type="fred" id="wagegrowth" current={macro?.wagegrowth ? `${macro.wagegrowth.value}%` : '—'} href="/terminal/data/macro/wagegrowth" color="#a78bfa" />
            </div>
          </>
        )}

        {/* ── INSTITUSI VS RETAIL (COT) ── */}
        {view === 'cot' && (
          cot ? (
            <>
              <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-wrap gap-2">
                  <p className="text-sm font-bold flex items-center gap-2">Posisi Net (kontrak) — 1 Tahun <span className="text-[9px] font-semibold text-white/30 normal-case">CFTC · mingguan</span></p>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Funds (Institusi)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-400" />Commercials</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400" />Retail</span>
                  </div>
                </div>
                <div className="p-3">
                  <DetailMultiLineChart height={340} series={[
                    { name: 'Funds (Institusi)', color: '#34d399', data: cot.fundsHistoryFull.map(d => ({ label: fmtDateShort(d.date), value: d.value } as ChartPoint)) },
                    { name: 'Commercials', color: '#60a5fa', data: cot.commercialsHistoryFull.map(d => ({ label: fmtDateShort(d.date), value: d.value } as ChartPoint)) },
                    { name: 'Retail', color: '#a78bfa', data: cot.retailHistoryFull.map(d => ({ label: fmtDateShort(d.date), value: d.value } as ChartPoint)) },
                  ]} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Stat label="Funds (Institusi)" value={kfmt(cot.funds.net)} tone={cot.funds.net >= 0 ? 'up' : 'down'} sub={`Δ${kfmt(cot.funds.deltaNet)}/mgg · smart money`} />
                <Stat label="Commercials (Hedger)" value={kfmt(cot.commercials.net)} tone={cot.commercials.net >= 0 ? 'up' : 'down'} sub={`Δ${kfmt(cot.commercials.deltaNet)}/mgg`} />
                <Stat label="Retail" value={kfmt(cot.retail.net)} tone="neutral" sub={`Δ${kfmt(cot.retail.deltaNet)}/mgg · kontrarian`} />
              </div>
              {cot.funds.net * cot.retail.net < 0 && (
                <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 p-4">
                  <span className="text-amber-400 text-sm mt-0.5">⚠</span>
                  <p className="text-[12px] text-amber-200/90 leading-relaxed">Institusi & Retail sedang <b>berlawanan arah</b> — historisnya condong mengikuti arah institusi (smart money).</p>
                </div>
              )}
              <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">Rincian Posisi (kontrak) · rilis {fmtDate(cot.date)}</p>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                  <Row l="Funds — Long" v={cot.funds.long.toLocaleString('id-ID')} />
                  <Row l="Funds — Short" v={cot.funds.short.toLocaleString('id-ID')} />
                  <Row l="Commercials — Long" v={cot.commercials.long.toLocaleString('id-ID')} />
                  <Row l="Commercials — Short" v={cot.commercials.short.toLocaleString('id-ID')} />
                  <Row l="Retail — Long" v={cot.retail.long.toLocaleString('id-ID')} />
                  <Row l="Retail — Short" v={cot.retail.short.toLocaleString('id-ID')} />
                </div>
              </div>
              <div className="text-right">
                <Link href="/terminal/data/cot" className="text-[11px] font-semibold text-primary hover:underline">Buka halaman COT lengkap →</Link>
              </div>
            </>
          ) : <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-white/30" /></div>
        )}

        <p className="text-[10px] text-white/25 pt-1">Data: Federal Reserve (FRED), CFTC, Twelve Data. Bukan nasihat keuangan.</p>
      </main>
    </div>
  )
}

export default function MacroHubPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>}><MacroHubInner /></Suspense>
}
