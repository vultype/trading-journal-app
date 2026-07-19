'use client'

// Regime Lab (ADMIN) — log observasi pasar Trending/Ranging (seperti tombol WIN/LOSE di
// backtest), lalu report perbandingan per SESI (waktu) & per PLAN. Persist di localStorage
// (per browser, tanpa DB). Tujuan: tahu sesi/plan mana yang cenderung trending vs ranging.
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import {
  ArrowLeft, Loader2, TrendingUp, Waves, Trash2, RotateCcw, BarChart3, Clock, Tag, Info, Crown,
} from 'lucide-react'

type Regime = 'trending' | 'ranging'
type Log = { id: number; regime: Regime; t: number; session: string; plan: string }
const KEY = 'dtq_regime_lab'
const SESSIONS = ['Asia', 'London', 'New York', 'Luar Sesi'] as const

const wibHour = (t: number) => (new Date(t).getUTCHours() + 7) % 24
const sessionOf = (h: number) => h >= 6 && h < 14 ? 'Asia' : h >= 14 && h < 19 ? 'London' : h >= 19 && h < 23 ? 'New York' : 'Luar Sesi'
const fmtTime = (t: number) => new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function groupStats(logs: Log[], keyFn: (l: Log) => string) {
  const m = new Map<string, { trending: number; ranging: number }>()
  for (const l of logs) { const k = keyFn(l); const g = m.get(k) ?? { trending: 0, ranging: 0 }; g[l.regime]++; m.set(k, g) }
  return [...m.entries()].map(([key, g]) => {
    const total = g.trending + g.ranging
    return { key, ...g, total, pctT: total ? (g.trending / total) * 100 : 0 }
  }).sort((a, b) => b.total - a.total)
}

function ReportTable({ title, icon: Ic, rows, unit }: { title: string; icon: React.ElementType; rows: ReturnType<typeof groupStats>; unit: string }) {
  if (!rows.length) return null
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]"><Ic size={14} className="text-primary" /><p className="text-[13px] font-bold">{title}</p></div>
      <div className="divide-y divide-white/[0.05]">
        {rows.map(r => (
          <div key={r.key} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] font-bold">{r.key} <span className="text-[10px] text-white/35 font-normal">({r.total} {unit})</span></span>
              <span className={`text-[12px] font-black tabular-nums ${r.pctT >= 60 ? 'text-emerald-400' : r.pctT <= 40 ? 'text-amber-400' : 'text-white/60'}`}>{Math.round(r.pctT)}% trending</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-amber-500/30 flex">
              <div className="h-full bg-emerald-500/70 transition-all" style={{ width: `${r.pctT}%` }} />
            </div>
            <div className="flex justify-between text-[10px] mt-1"><span className="text-emerald-400/80">{r.trending} trending</span><span className="text-amber-400/80">{r.ranging} ranging</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RegimeLabPage() {
  const router = useRouter()
  const sub = useSubscription()
  const [logs, setLogs] = useState<Log[]>([])
  const [plan, setPlan] = useState('Umum')
  const [sessionMode, setSessionMode] = useState<'auto' | typeof SESSIONS[number]>('auto')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace('/login?next=%2Fregime-lab')
    else if (!sub.loading && sub.userId && !sub.isAdmin) router.replace('/hub')
  }, [sub.loading, sub.userId, sub.isAdmin, router])

  // Muat & simpan localStorage
  useEffect(() => { try { const raw = localStorage.getItem(KEY); if (raw) setLogs(JSON.parse(raw)) } catch { } setLoaded(true) }, [])
  useEffect(() => { if (loaded) try { localStorage.setItem(KEY, JSON.stringify(logs)) } catch { } }, [logs, loaded])

  function add(regime: Regime) {
    const t = Date.now()
    const session = sessionMode === 'auto' ? sessionOf(wibHour(t)) : sessionMode
    setLogs(prev => [...prev, { id: t, regime, t, session, plan: plan.trim() || 'Umum' }])
  }
  const del = (id: number) => setLogs(prev => prev.filter(l => l.id !== id))
  const resetAll = () => { if (confirm('Hapus semua observasi?')) setLogs([]) }

  const bySession = useMemo(() => groupStats(logs, l => l.session), [logs])
  const byPlan = useMemo(() => groupStats(logs, l => l.plan), [logs])
  const total = logs.length
  const trendingN = logs.filter(l => l.regime === 'trending').length
  const pctT = total ? (trendingN / total) * 100 : 0

  // Kesimpulan otomatis (minimal 3 observasi per grup agar bermakna)
  const insight = useMemo(() => {
    const sig = bySession.filter(r => r.total >= 3)
    if (sig.length < 1) return null
    const mostTrend = [...sig].sort((a, b) => b.pctT - a.pctT)[0]
    const mostRange = [...sig].sort((a, b) => a.pctT - b.pctT)[0]
    return { mostTrend, mostRange }
  }, [bySession])

  const plansUsed = useMemo(() => Array.from(new Set(logs.map(l => l.plan))), [logs])

  if (sub.loading || !sub.isAdmin) return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[140px] rounded-full pointer-events-none" />
      <header className="relative max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/hub" className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"><ArrowLeft size={16} /> Hub</Link>
        <span className="text-lg font-black tracking-tight">Datalitiq</span>
      </header>

      <main className="relative max-w-4xl mx-auto px-5 pt-4 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-primary/15 ring-1 ring-primary/30 text-primary shrink-0"><BarChart3 size={20} /></span>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">Regime Lab <span className="text-[8px] font-bold uppercase rounded-full bg-red-500/15 text-red-400 px-1.5 py-0.5">Admin</span></h1>
            <p className="text-sm text-white/50">Catat kondisi pasar Trending/Ranging → bandingkan per sesi & per plan.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 items-start">
          {/* INPUT */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1"><Tag size={11} /> Plan / Label</label>
                <input value={plan} onChange={e => setPlan(e.target.value)} list="plans" placeholder="mis. XAUUSD scalping / GBPUSD swing" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary/50" />
                <datalist id="plans">{plansUsed.map(p => <option key={p} value={p} />)}</datalist>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1"><Clock size={11} /> Sesi</label>
                <div className="mt-1.5 flex gap-1 flex-wrap">
                  {(['auto', ...SESSIONS] as const).map(s => (
                    <button key={s} onClick={() => setSessionMode(s)} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${sessionMode === s ? 'bg-primary text-primary-foreground' : 'bg-white/5 text-white/45 hover:text-white/80'}`}>{s === 'auto' ? `Auto (${sessionOf(wibHour(Date.now()))})` : s}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button onClick={() => add('trending')} className="flex flex-col items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] py-4 hover:bg-emerald-500/[0.14] transition-colors">
                  <TrendingUp size={22} className="text-emerald-400" /><span className="text-sm font-black text-emerald-400">TRENDING</span>
                </button>
                <button onClick={() => add('ranging')} className="flex flex-col items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] py-4 hover:bg-amber-500/[0.14] transition-colors">
                  <Waves size={22} className="text-amber-400" /><span className="text-sm font-black text-amber-400">RANGING</span>
                </button>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                <Info size={13} className="text-white/40 shrink-0 mt-0.5" />
                <p className="text-[10px] text-white/45 leading-relaxed">Klik saat kamu mengamati kondisi pasar. Sesi diambil otomatis dari jam WIB sekarang (bisa override manual). Data tersimpan di browser ini.</p>
              </div>
            </div>

            {/* Ringkasan */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">Total Observasi</p>
                <span className="text-[11px] text-white/40">{total} entri</span>
              </div>
              {total > 0 ? (
                <>
                  <p className="text-3xl font-black tabular-nums">{Math.round(pctT)}%<span className="text-sm font-bold text-white/50 ml-1">trending</span></p>
                  <div className="h-2 rounded-full overflow-hidden bg-amber-500/30 flex mt-2"><div className="h-full bg-emerald-500/70" style={{ width: `${pctT}%` }} /></div>
                  <div className="flex justify-between text-[10px] mt-1"><span className="text-emerald-400/80">{trendingN} trending</span><span className="text-amber-400/80">{total - trendingN} ranging</span></div>
                </>
              ) : <p className="text-sm text-white/40 py-2">Belum ada observasi. Klik Trending / Ranging untuk mulai.</p>}
            </div>
          </div>

          {/* REPORT */}
          <div className="space-y-4">
            {insight && (
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">Kesimpulan</p>
                <p className="text-[13px] text-white/75 leading-relaxed">
                  Sesi paling sering <b className="text-emerald-400">trending</b>: <b>{insight.mostTrend.key}</b> ({Math.round(insight.mostTrend.pctT)}% dari {insight.mostTrend.total}) — cocok untuk strategi <b>trend-following</b>.
                </p>
                <p className="text-[13px] text-white/75 leading-relaxed mt-2">
                  Sesi paling sering <b className="text-amber-400">ranging</b>: <b>{insight.mostRange.key}</b> ({100 - Math.round(insight.mostRange.pctT)}% ranging) — cocok untuk strategi <b>range/scalp mantul</b>.
                </p>
              </div>
            )}
            <ReportTable title="Per Sesi (waktu)" icon={Clock} rows={bySession} unit="obs" />
            {byPlan.length > 1 && <ReportTable title="Per Plan / Label" icon={Tag} rows={byPlan} unit="obs" />}
          </div>
        </div>

        {/* Riwayat */}
        {total > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden mt-6">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
              <p className="text-[13px] font-bold">Riwayat Observasi ({total})</p>
              <button onClick={resetAll} className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-red-400 transition-colors"><RotateCcw size={12} /> Reset semua</button>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-white/[0.04]">
              {[...logs].reverse().map(l => (
                <div key={l.id} className="flex items-center gap-3 px-4 py-2 group">
                  <span className={`text-[9px] font-bold uppercase rounded px-1.5 py-0.5 shrink-0 ${l.regime === 'trending' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{l.regime === 'trending' ? 'Trending' : 'Ranging'}</span>
                  <span className="text-[12px] text-white/70">{l.session}</span>
                  <span className="text-[11px] text-white/40">· {l.plan}</span>
                  <span className="text-[10px] text-white/30 ml-auto tabular-nums">{fmtTime(l.t)}</span>
                  <button onClick={() => del(l.id)} className="text-white/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" aria-label="Hapus"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-white/25 mt-6 text-center">Modul admin · data lokal di browser ini · bukan nasihat keuangan.</p>
      </main>
    </div>
  )
}
