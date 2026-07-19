'use client'

// Backtest Journal (ADMIN) — jurnal backtest strategi berbasis KALENDER dengan uang nyata.
// Input: Win/Lose + tanggal (+ plan, RR, catatan). Modal awal + risk% + compounding → hitung
// equity per trade, kurva equity, drawdown, dan PERBANDINGAN PLAN (WR, avg RR, Net R, expectancy,
// Net P&L). Persist di localStorage (per browser, tanpa DB).
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import {
  ArrowLeft, Loader2, Trophy, X as XIcon, Trash2, RotateCcw, ChevronLeft, ChevronRight,
  Calendar as CalIcon, Tag, Wallet, LineChart as LineChartIcon,
} from 'lucide-react'

type Result = 'win' | 'loss'
type Entry = { id: number; date: string; result: Result; plan: string; rr: number | null; note: string }
type Cfg = { initEquity: number; riskPct: number; compound: boolean; defaultRR: number }
const KEY = 'dtq_backtest_journal'
const CFG_KEY = 'dtq_backtest_journal_cfg'
const DEFCFG: Cfg = { initEquity: 1000, riskPct: 1, compound: false, defaultRR: 2 }

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const todayKey = () => dateKey(new Date())
const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const fmtDayLabel = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
const fmtN = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })
const TooltipStyle = { background: '#0b100e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 11 }

export default function BacktestJournalPage() {
  const router = useRouter()
  const sub = useSubscription()
  const [entries, setEntries] = useState<Entry[]>([])
  const [cfg, setCfg] = useState<Cfg>(DEFCFG)
  const [loaded, setLoaded] = useState(false)
  const [selDate, setSelDate] = useState(todayKey())
  const [plan, setPlan] = useState('Umum')
  const [rr, setRr] = useState('2')
  const [note, setNote] = useState('')
  const [view, setView] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })

  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace('/login?next=%2Fbacktest-journal')
    else if (!sub.loading && sub.userId && !sub.isAdmin) router.replace('/hub')
  }, [sub.loading, sub.userId, sub.isAdmin, router])

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setEntries(JSON.parse(raw)) } catch { }
    try { const c = localStorage.getItem(CFG_KEY); if (c) setCfg({ ...DEFCFG, ...JSON.parse(c) }) } catch { }
    setLoaded(true)
  }, [])
  useEffect(() => { if (loaded) try { localStorage.setItem(KEY, JSON.stringify(entries)) } catch { } }, [entries, loaded])
  useEffect(() => { if (loaded) { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)) } catch { }; setRr(String(cfg.defaultRR)) } }, [cfg, loaded])

  function add(result: Result) {
    const rrN = rr.trim() ? parseFloat(rr.replace(',', '.')) : cfg.defaultRR
    setEntries(prev => [...prev, { id: Date.now() + Math.floor(Math.random() * 1000), date: selDate, result, plan: plan.trim() || 'Umum', rr: rrN && rrN > 0 ? rrN : null, note: note.trim() }])
    setNote('')
  }
  const del = (id: number) => setEntries(prev => prev.filter(e => e.id !== id))
  const resetAll = () => { if (confirm('Hapus SEMUA entri jurnal backtest?')) setEntries([]) }
  const setC = (patch: Partial<Cfg>) => setCfg(c => ({ ...c, ...patch }))

  // ── Equity kronologis (compound/fixed global) ──
  const eq = useMemo(() => {
    const chrono = [...entries].sort((a, b) => a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date))
    let bal = cfg.initEquity, peak = cfg.initEquity, maxDD = 0
    const curve: { i: number; bal: number }[] = [{ i: 0, bal: cfg.initEquity }]
    const pnlById = new Map<number, number>(), balById = new Map<number, number>()
    chrono.forEach((e, idx) => {
      const riskBase = cfg.compound ? bal : cfg.initEquity
      const riskAmt = riskBase * cfg.riskPct / 100
      const rrv = e.rr ?? 1
      const pnl = e.result === 'win' ? riskAmt * rrv : -riskAmt
      bal += pnl
      pnlById.set(e.id, pnl); balById.set(e.id, bal)
      curve.push({ i: idx + 1, bal: +bal.toFixed(2) })
      if (bal > peak) peak = bal
      const dd = peak > 0 ? (bal - peak) / peak * 100 : 0
      if (dd < maxDD) maxDD = dd
    })
    return { curve, final: bal, returnPct: cfg.initEquity ? (bal - cfg.initEquity) / cfg.initEquity * 100 : 0, maxDD, pnlById, balById }
  }, [entries, cfg])

  const stats = useMemo(() => {
    const total = entries.length
    const wins = entries.filter(e => e.result === 'win').length
    const winRate = total ? wins / total * 100 : 0
    const netR = entries.reduce((s, e) => s + (e.result === 'win' ? (e.rr ?? 1) : -1), 0)
    const expectancy = total ? netR / total : 0
    const chrono = [...entries].sort((a, b) => a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date))
    let cur = 0, curRes: Result | null = null, best = 0, bestRes: Result | null = null
    for (const e of chrono) { if (e.result === curRes) cur++; else { cur = 1; curRes = e.result }; if (cur > best) { best = cur; bestRes = curRes } }
    return { total, wins, losses: total - wins, winRate, netR, expectancy, curStreak: cur, curRes, bestStreak: best, bestRes }
  }, [entries])

  // ── Perbandingan plan (dibandingkan dalam R + P&L fixed-risk untuk keadilan lintas plan) ──
  const byPlan = useMemo(() => {
    const riskFixed = cfg.initEquity * cfg.riskPct / 100
    const m = new Map<string, { w: number; l: number; rrSum: number; netR: number }>()
    for (const e of entries) {
      const g = m.get(e.plan) ?? { w: 0, l: 0, rrSum: 0, netR: 0 }
      if (e.result === 'win') { g.w++; g.rrSum += e.rr ?? 1; g.netR += e.rr ?? 1 } else { g.l++; g.netR -= 1 }
      m.set(e.plan, g)
    }
    return [...m.entries()].map(([plan, g]) => {
      const total = g.w + g.l
      return { plan, ...g, total, wr: total ? g.w / total * 100 : 0, avgWinRR: g.w ? g.rrSum / g.w : 0, exp: total ? g.netR / total : 0, netPnl: g.netR * riskFixed }
    }).sort((a, b) => b.netR - a.netR)
  }, [entries, cfg])

  // ── kalender ──
  const cal = useMemo(() => {
    const first = new Date(view.y, view.m, 1)
    const startDow = (first.getDay() + 6) % 7
    const days = new Date(view.y, view.m + 1, 0).getDate()
    const cells: (string | null)[] = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= days; d++) cells.push(dateKey(new Date(view.y, view.m, d)))
    while (cells.length % 7) cells.push(null)
    return cells
  }, [view])
  const byDate = useMemo(() => { const m = new Map<string, { w: number; l: number }>(); for (const e of entries) { const g = m.get(e.date) ?? { w: 0, l: 0 }; if (e.result === 'win') g.w++; else g.l++; m.set(e.date, g) } return m }, [entries])

  const plansUsed = useMemo(() => Array.from(new Set(entries.map(e => e.plan))), [entries])
  const dayEntries = useMemo(() => entries.filter(e => e.date === selDate).sort((a, b) => a.id - b.id), [entries, selDate])
  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const bestPlan = byPlan[0]

  if (sub.loading || !sub.isAdmin) return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>

  const StatBox = ({ label, value, color = '' }: { label: string; value: React.ReactNode; color?: string }) => (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-black tabular-nums mt-0.5 ${color}`}>{value}</p>
    </div>
  )
  const numInput = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold tabular-nums outline-none focus:border-primary/50'

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[140px] rounded-full pointer-events-none" />
      <header className="relative max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/hub" className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"><ArrowLeft size={16} /> Hub</Link>
        <span className="text-lg font-black tracking-tight">Datalitiq</span>
      </header>

      <main className="relative max-w-5xl mx-auto px-5 pt-4 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-primary/15 ring-1 ring-primary/30 text-primary shrink-0"><CalIcon size={20} /></span>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">Backtest Journal <span className="text-[8px] font-bold uppercase rounded-full bg-red-500/15 text-red-400 px-1.5 py-0.5">Admin</span></h1>
            <p className="text-sm text-white/50">Win/Lose per tanggal + equity, risk, RR & perbandingan plan.</p>
          </div>
        </div>

        {/* Pengaturan akun */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 mb-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3 flex items-center gap-1.5"><Wallet size={12} /> Pengaturan Akun</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className="text-[10px] text-white/40">Modal Awal</label><input value={cfg.initEquity} onChange={e => setC({ initEquity: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} inputMode="numeric" className={`${numInput} mt-1`} /></div>
            <div><label className="text-[10px] text-white/40">Risk / Trade (%)</label><input value={cfg.riskPct} onChange={e => setC({ riskPct: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} inputMode="decimal" className={`${numInput} mt-1`} /></div>
            <div><label className="text-[10px] text-white/40">RR Default</label><input value={cfg.defaultRR} onChange={e => setC({ defaultRR: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} inputMode="decimal" className={`${numInput} mt-1`} /></div>
            <div>
              <label className="text-[10px] text-white/40">Mode Modal</label>
              <div className="mt-1 flex gap-0.5 rounded-lg bg-black/30 p-0.5 border border-white/10">
                {([['fixed', 'Fixed'], ['compound', 'Compound']] as const).map(([v, l]) => <button key={v} onClick={() => setC({ compound: v === 'compound' })} className={`flex-1 rounded-md px-1 py-1.5 text-[11px] font-bold transition-colors ${cfg.compound === (v === 'compound') ? 'bg-primary text-primary-foreground' : 'text-white/45 hover:text-white/70'}`}>{l}</button>)}
              </div>
            </div>
          </div>
        </div>

        {/* Stats atas */}
        {stats.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            <StatBox label="Equity Akhir" value={fmtN(eq.final)} color={eq.final >= cfg.initEquity ? 'text-emerald-400' : 'text-red-400'} />
            <StatBox label="Return" value={`${eq.returnPct >= 0 ? '+' : ''}${eq.returnPct.toFixed(1)}%`} color={eq.returnPct >= 0 ? 'text-emerald-400' : 'text-red-400'} />
            <StatBox label="Win Rate" value={`${Math.round(stats.winRate)}%`} color={stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'} />
            <StatBox label="Net R" value={`${stats.netR >= 0 ? '+' : ''}${stats.netR.toFixed(1)}R`} color={stats.netR >= 0 ? 'text-emerald-400' : 'text-red-400'} />
            <StatBox label="Max DD" value={`${eq.maxDD.toFixed(1)}%`} color="text-red-400" />
            <StatBox label="Streak" value={<span className={stats.curRes === 'win' ? 'text-emerald-400' : 'text-red-400'}>{stats.curStreak}{stats.curRes === 'win' ? 'W' : 'L'}</span>} />
          </div>
        )}

        {/* Equity curve */}
        {stats.total > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 mb-5">
            <p className="text-[13px] font-bold flex items-center gap-2 mb-3"><LineChartIcon size={14} className="text-primary" /> Kurva Equity <span className="text-[10px] text-white/35 font-normal">({cfg.compound ? 'compound' : 'fixed'} · risk {cfg.riskPct}%)</span></p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={eq.curve} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
                <defs><linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={eq.final >= cfg.initEquity ? '#10b981' : '#ef4444'} stopOpacity={0.35} /><stop offset="95%" stopColor={eq.final >= cfg.initEquity ? '#10b981' : '#ef4444'} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="i" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} width={54} tickFormatter={v => fmtN(Number(v))} />
                <Tooltip contentStyle={TooltipStyle} formatter={(v) => [fmtN(Number(v)), 'Equity']} labelFormatter={l => `Trade ${l}`} />
                <ReferenceLine y={cfg.initEquity} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="bal" stroke={eq.final >= cfg.initEquity ? '#10b981' : '#ef4444'} strokeWidth={2} fill="url(#eqGrad)" dot={eq.curve.length <= 25 ? { r: 2.5 } : false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
          {/* KALENDER */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setView(v => { const m = v.m - 1; return m < 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m } })} className="p-1.5 rounded-lg text-white/50 hover:bg-white/5"><ChevronLeft size={16} /></button>
              <p className="text-sm font-bold capitalize">{monthLabel}</p>
              <button onClick={() => setView(v => { const m = v.m + 1; return m > 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m } })} className="p-1.5 rounded-lg text-white/50 hover:bg-white/5"><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">{DOW.map(d => <div key={d} className="text-center text-[10px] font-bold text-white/35 py-1">{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">
              {cal.map((key, i) => {
                if (!key) return <div key={i} />
                const g = byDate.get(key)
                const net = g ? g.w - g.l : 0
                const isSel = key === selDate, isToday = key === todayKey()
                const bg = g ? (net > 0 ? 'bg-emerald-500/[0.12] border-emerald-500/25' : net < 0 ? 'bg-red-500/[0.12] border-red-500/25' : 'bg-white/[0.05] border-white/15') : 'border-white/[0.06] hover:border-white/15'
                return (
                  <button key={i} onClick={() => setSelDate(key)} className={`relative aspect-square rounded-lg border p-1 flex flex-col items-center justify-center transition-colors ${bg} ${isSel ? 'ring-2 ring-primary' : ''}`}>
                    <span className={`text-[11px] font-bold ${isToday ? 'text-primary' : 'text-white/70'}`}>{Number(key.split('-')[2])}</span>
                    {g && <span className="text-[8px] font-bold leading-none mt-0.5"><span className="text-emerald-400">{g.w}W</span> <span className="text-red-400">{g.l}L</span></span>}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-3 mt-3 text-[9px] text-white/40">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/40 border border-emerald-500/30" /> hari profit</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500/40 border border-red-500/30" /> hari rugi</span>
              <button onClick={() => { const t = todayKey(); setSelDate(t); const d = new Date(); setView({ y: d.getFullYear(), m: d.getMonth() }) }} className="ml-auto text-primary hover:underline">Hari ini</button>
            </div>
          </div>

          {/* INPUT */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Tanggal</label>
                <input type="date" value={selDate} onChange={e => { setSelDate(e.target.value); const [y, m] = e.target.value.split('-').map(Number); if (y && m) setView({ y, m: m - 1 }) }} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold outline-none focus:border-primary/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1"><Tag size={11} /> Plan</label>
                  <input value={plan} onChange={e => setPlan(e.target.value)} list="plans" placeholder="Umum" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-primary/50" />
                  <datalist id="plans">{plansUsed.map(p => <option key={p} value={p} />)}</datalist>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">RR</label>
                  <div className="mt-1.5 relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">1:</span><input value={rr} onChange={e => setRr(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-white/10 bg-black/30 pl-8 pr-3 py-2 text-sm outline-none focus:border-primary/50" /></div>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Catatan (opsional)</label>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="setup, alasan, dsb" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button onClick={() => add('win')} className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] py-3 hover:bg-emerald-500/[0.14] transition-colors"><Trophy size={17} className="text-emerald-400" /><span className="text-sm font-black text-emerald-400">WIN</span></button>
                <button onClick={() => add('loss')} className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.08] py-3 hover:bg-red-500/[0.14] transition-colors"><XIcon size={17} className="text-red-400" /><span className="text-sm font-black text-red-400">LOSE</span></button>
              </div>
            </div>

            {/* Entri hari terpilih */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/[0.06]"><p className="text-[12px] font-bold capitalize">{fmtDayLabel(selDate)}</p></div>
              {dayEntries.length ? (
                <div className="divide-y divide-white/[0.04]">
                  {dayEntries.map(e => {
                    const pnl = eq.pnlById.get(e.id) ?? 0
                    return (
                      <div key={e.id} className="flex items-center gap-2 px-4 py-2 group">
                        <span className={`text-[9px] font-bold uppercase rounded px-1.5 py-0.5 shrink-0 ${e.result === 'win' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{e.result === 'win' ? 'WIN' : 'LOSE'}</span>
                        <span className="text-[11px] text-white/50">{e.plan}</span>
                        {e.rr != null && <span className="text-[10px] text-white/40">1:{e.rr}</span>}
                        <span className={`text-[10px] font-bold tabular-nums ${pnl >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>{pnl >= 0 ? '+' : ''}{fmtN(pnl)}</span>
                        {e.note && <span className="text-[10px] text-white/35 truncate">· {e.note}</span>}
                        <button onClick={() => del(e.id)} className="ml-auto text-white/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" aria-label="Hapus"><Trash2 size={13} /></button>
                      </div>
                    )
                  })}
                </div>
              ) : <p className="text-[12px] text-white/35 px-4 py-4">Belum ada entri di tanggal ini.</p>}
            </div>
          </div>
        </div>

        {/* Perbandingan plan */}
        {stats.total > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden mt-5">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]"><Tag size={14} className="text-primary" /><p className="text-[13px] font-bold">Perbandingan Plan</p><span className="ml-auto text-[9px] text-white/35">Net P&amp;L pakai risk tetap {cfg.riskPct}% × modal awal</span></div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr className="text-[10px] text-white/40 border-b border-white/[0.06]">
                  <th className="text-left px-4 py-2">Plan</th><th className="text-right px-3">Trade</th><th className="text-right px-3">WR</th><th className="text-right px-3">Avg RR</th><th className="text-right px-3">Net R</th><th className="text-right px-3">Expect</th><th className="text-right px-4">Net P&amp;L</th>
                </tr></thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {byPlan.map(p => (
                    <tr key={p.plan} className={`hover:bg-white/[0.02] ${p === bestPlan && byPlan.length > 1 ? 'bg-primary/[0.05]' : ''}`}>
                      <td className="px-4 py-2.5 font-bold">{p.plan}{p === bestPlan && byPlan.length > 1 && <span className="ml-1.5 text-[8px] font-bold uppercase rounded-full bg-primary/20 text-primary px-1.5 py-0.5">terbaik</span>}</td>
                      <td className="text-right px-3 tabular-nums text-white/60">{p.total}</td>
                      <td className={`text-right px-3 tabular-nums font-bold ${p.wr >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{Math.round(p.wr)}%</td>
                      <td className="text-right px-3 tabular-nums text-white/60">1:{p.avgWinRR.toFixed(1)}</td>
                      <td className={`text-right px-3 tabular-nums font-bold ${p.netR >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{p.netR >= 0 ? '+' : ''}{p.netR.toFixed(1)}R</td>
                      <td className={`text-right px-3 tabular-nums ${p.exp >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>{p.exp >= 0 ? '+' : ''}{p.exp.toFixed(2)}R</td>
                      <td className={`text-right px-4 tabular-nums font-bold ${p.netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{p.netPnl >= 0 ? '+' : ''}{fmtN(p.netPnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-white/[0.06] flex items-center gap-2 flex-wrap">
              <p className="text-[11px] text-white/50 leading-relaxed flex-1">
                {bestPlan && byPlan.length > 1 ? <><b className="text-white/80">{bestPlan.plan}</b> plan terbaik: Net {bestPlan.netR >= 0 ? '+' : ''}{bestPlan.netR.toFixed(1)}R (expectancy {bestPlan.exp >= 0 ? '+' : ''}{bestPlan.exp.toFixed(2)}R/trade). </> : ''}
                {stats.total < 30 ? 'Kumpulkan ≥30 trade/plan agar perbandingan lebih meyakinkan.' : 'Bandingkan Net R & expectancy — bukan cuma win rate.'}
              </p>
              <button onClick={resetAll} className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-red-400 transition-colors shrink-0"><RotateCcw size={12} /> Reset semua</button>
            </div>
          </div>
        )}

        <p className="text-[10px] text-white/25 mt-6 text-center">Modul admin · data lokal di browser ini · Net P&amp;L asumsi risk tetap; equity pakai mode {cfg.compound ? 'compound' : 'fixed'}. Bukan nasihat keuangan.</p>
      </main>
    </div>
  )
}
