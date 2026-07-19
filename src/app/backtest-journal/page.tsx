'use client'

// Backtest Journal (ADMIN) — jurnal backtest strategi berbasis KALENDER. Input: Win/Lose +
// tanggal (+ plan & RR opsional). Kalender bulanan menandai hasil per hari; laporan win rate,
// streak, expectancy & per-plan. Persist di localStorage (per browser, tanpa DB).
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import {
  ArrowLeft, Loader2, Trophy, X as XIcon, Trash2, RotateCcw, ChevronLeft, ChevronRight,
  Calendar as CalIcon, Tag, Info, Flame,
} from 'lucide-react'

type Result = 'win' | 'loss'
type Entry = { id: number; date: string; result: Result; plan: string; rr: number | null; note: string }
const KEY = 'dtq_backtest_journal'

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const todayKey = () => dateKey(new Date())
const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] // Senin-first
const fmtDayLabel = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }

export default function BacktestJournalPage() {
  const router = useRouter()
  const sub = useSubscription()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selDate, setSelDate] = useState(todayKey())
  const [plan, setPlan] = useState('Umum')
  const [rr, setRr] = useState('')
  const [note, setNote] = useState('')
  const [view, setView] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })

  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace('/login?next=%2Fbacktest-journal')
    else if (!sub.loading && sub.userId && !sub.isAdmin) router.replace('/hub')
  }, [sub.loading, sub.userId, sub.isAdmin, router])

  useEffect(() => { try { const raw = localStorage.getItem(KEY); if (raw) setEntries(JSON.parse(raw)) } catch { } setLoaded(true) }, [])
  useEffect(() => { if (loaded) try { localStorage.setItem(KEY, JSON.stringify(entries)) } catch { } }, [entries, loaded])

  function add(result: Result) {
    const rrN = rr.trim() ? parseFloat(rr.replace(',', '.')) : null
    setEntries(prev => [...prev, { id: Date.now() + Math.floor(Math.random() * 1000), date: selDate, result, plan: plan.trim() || 'Umum', rr: rrN && rrN > 0 ? rrN : null, note: note.trim() }])
    setNote('')
  }
  const del = (id: number) => setEntries(prev => prev.filter(e => e.id !== id))
  const resetAll = () => { if (confirm('Hapus SEMUA entri jurnal backtest?')) setEntries([]) }

  // ── kalender bulan aktif ──
  const cal = useMemo(() => {
    const first = new Date(view.y, view.m, 1)
    const startDow = (first.getDay() + 6) % 7 // 0=Senin
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
    const cells: (string | null)[] = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(dateKey(new Date(view.y, view.m, d)))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [view])
  const byDate = useMemo(() => {
    const m = new Map<string, { w: number; l: number }>()
    for (const e of entries) { const g = m.get(e.date) ?? { w: 0, l: 0 }; if (e.result === 'win') g.w++; else g.l++; m.set(e.date, g) }
    return m
  }, [entries])

  // ── statistik ──
  const stats = useMemo(() => {
    const total = entries.length
    const wins = entries.filter(e => e.result === 'win').length
    const losses = total - wins
    const winRate = total ? (wins / total) * 100 : 0
    const withRr = entries.filter(e => e.result === 'win' && e.rr != null)
    const avgWinRR = withRr.length ? withRr.reduce((s, e) => s + (e.rr ?? 0), 0) / withRr.length : null
    const expectancy = avgWinRR != null ? (winRate / 100) * avgWinRR - (1 - winRate / 100) * 1 : null
    // streak dari urutan kronologis (tanggal lalu id)
    const chrono = [...entries].sort((a, b) => a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date))
    let cur = 0, curRes: Result | null = null, best = 0, bestRes: Result | null = null
    for (const e of chrono) {
      if (e.result === curRes) cur++
      else { cur = 1; curRes = e.result }
      if (cur > best) { best = cur; bestRes = curRes }
    }
    return { total, wins, losses, winRate, avgWinRR, expectancy, curStreak: cur, curRes, bestStreak: best, bestRes }
  }, [entries])

  const byPlan = useMemo(() => {
    const m = new Map<string, { w: number; l: number }>()
    for (const e of entries) { const g = m.get(e.plan) ?? { w: 0, l: 0 }; if (e.result === 'win') g.w++; else g.l++; m.set(e.plan, g) }
    return [...m.entries()].map(([plan, g]) => { const t = g.w + g.l; return { plan, ...g, total: t, wr: t ? g.w / t * 100 : 0 } }).sort((a, b) => b.total - a.total)
  }, [entries])

  const plansUsed = useMemo(() => Array.from(new Set(entries.map(e => e.plan))), [entries])
  const dayEntries = useMemo(() => entries.filter(e => e.date === selDate).sort((a, b) => a.id - b.id), [entries, selDate])
  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  if (sub.loading || !sub.isAdmin) return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>

  const StatBox = ({ label, value, color = '' }: { label: string; value: React.ReactNode; color?: string }) => (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-black tabular-nums mt-0.5 ${color}`}>{value}</p>
    </div>
  )

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
            <p className="text-sm text-white/50">Catat Win/Lose per tanggal — kalender, win rate & statistik strategi.</p>
          </div>
        </div>

        {/* Stats atas */}
        {stats.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
            <StatBox label="Win Rate" value={`${Math.round(stats.winRate)}%`} color={stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'} />
            <StatBox label="Total" value={stats.total} />
            <StatBox label="W / L" value={<span><span className="text-emerald-400">{stats.wins}</span> / <span className="text-red-400">{stats.losses}</span></span>} />
            <StatBox label="Streak" value={<span className={stats.curRes === 'win' ? 'text-emerald-400' : 'text-red-400'}>{stats.curStreak}{stats.curRes === 'win' ? 'W' : 'L'}</span>} />
            <StatBox label="Expectancy" value={stats.expectancy != null ? `${stats.expectancy >= 0 ? '+' : ''}${stats.expectancy.toFixed(2)}R` : '—'} color={stats.expectancy != null ? (stats.expectancy >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-white/40'} />
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
                  <button key={i} onClick={() => { setSelDate(key); }} className={`relative aspect-square rounded-lg border p-1 flex flex-col items-center justify-center transition-colors ${bg} ${isSel ? 'ring-2 ring-primary' : ''}`}>
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

          {/* INPUT HARI TERPILIH */}
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
                  <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">RR (opsional)</label>
                  <div className="mt-1.5 relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">1:</span><input value={rr} onChange={e => setRr(e.target.value)} inputMode="decimal" placeholder="2" className="w-full rounded-xl border border-white/10 bg-black/30 pl-8 pr-3 py-2 text-sm outline-none focus:border-primary/50" /></div>
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
              <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
                <Info size={12} className="text-white/40 shrink-0 mt-0.5" />
                <p className="text-[10px] text-white/45 leading-relaxed">Klik tanggal di kalender atau ubah field tanggal, lalu tekan WIN/LOSE. Data tersimpan di browser ini.</p>
              </div>
            </div>

            {/* Entri hari terpilih */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/[0.06]"><p className="text-[12px] font-bold capitalize">{fmtDayLabel(selDate)}</p></div>
              {dayEntries.length ? (
                <div className="divide-y divide-white/[0.04]">
                  {dayEntries.map(e => (
                    <div key={e.id} className="flex items-center gap-2 px-4 py-2 group">
                      <span className={`text-[9px] font-bold uppercase rounded px-1.5 py-0.5 shrink-0 ${e.result === 'win' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{e.result === 'win' ? 'WIN' : 'LOSE'}</span>
                      <span className="text-[11px] text-white/50">{e.plan}</span>
                      {e.rr != null && <span className="text-[10px] text-white/40">1:{e.rr}</span>}
                      {e.note && <span className="text-[10px] text-white/35 truncate">· {e.note}</span>}
                      <button onClick={() => del(e.id)} className="ml-auto text-white/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" aria-label="Hapus"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-[12px] text-white/35 px-4 py-4">Belum ada entri di tanggal ini.</p>}
            </div>
          </div>
        </div>

        {/* Report per plan + streak */}
        {stats.total > 0 && (
          <div className="grid lg:grid-cols-2 gap-5 mt-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]"><Tag size={14} className="text-primary" /><p className="text-[13px] font-bold">Win Rate per Plan</p></div>
              <div className="divide-y divide-white/[0.05]">
                {byPlan.map(p => (
                  <div key={p.plan} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5"><span className="text-[13px] font-bold">{p.plan} <span className="text-[10px] text-white/35 font-normal">({p.total})</span></span><span className={`text-[12px] font-black tabular-nums ${p.wr >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{Math.round(p.wr)}% WR</span></div>
                    <div className="h-2 rounded-full overflow-hidden bg-red-500/30 flex"><div className="h-full bg-emerald-500/70" style={{ width: `${p.wr}%` }} /></div>
                    <div className="flex justify-between text-[10px] mt-1"><span className="text-emerald-400/80">{p.w}W</span><span className="text-red-400/80">{p.l}L</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[13px] font-bold flex items-center gap-2 mb-3"><Flame size={14} className="text-primary" /> Ringkasan Strategi</p>
              <div className="space-y-2 text-[12px] text-white/65">
                <p>• Win rate keseluruhan <b className={stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>{Math.round(stats.winRate)}%</b> dari {stats.total} trade.</p>
                {stats.expectancy != null && <p>• Expectancy <b className={stats.expectancy >= 0 ? 'text-emerald-400' : 'text-red-400'}>{stats.expectancy >= 0 ? '+' : ''}{stats.expectancy.toFixed(2)}R</b> per trade (rata-rata RR menang 1:{stats.avgWinRR?.toFixed(1)}) — {stats.expectancy >= 0 ? 'secara statistik menguntungkan.' : 'masih rugi jangka panjang, perlu perbaikan.'}</p>}
                <p>• Streak berjalan: <b className={stats.curRes === 'win' ? 'text-emerald-400' : 'text-red-400'}>{stats.curStreak} {stats.curRes === 'win' ? 'menang' : 'kalah'}</b> beruntun. Terpanjang: <b>{stats.bestStreak} {stats.bestRes === 'win' ? 'menang' : 'kalah'}</b>.</p>
                <p className="text-[11px] text-white/35 pt-1">{stats.total < 30 ? 'Kumpulkan ≥30 trade agar win rate lebih meyakinkan (sampel masih kecil).' : 'Sampel cukup untuk gambaran statistik yang wajar.'}</p>
              </div>
              <button onClick={resetAll} className="mt-4 inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-red-400 transition-colors"><RotateCcw size={12} /> Reset semua data</button>
            </div>
          </div>
        )}

        <p className="text-[10px] text-white/25 mt-6 text-center">Modul admin · data lokal di browser ini · bukan nasihat keuangan.</p>
      </main>
    </div>
  )
}
