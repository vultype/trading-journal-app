'use client'

import { useMemo, useState } from 'react'
import { Sparkles, Loader2, RefreshCw, Send, Brain, ShieldCheck, Wand2, AlertTriangle } from 'lucide-react'
import type { Trade, DashboardStats, AppSettings } from '@/types'
import { pnlByGroup } from '@/lib/calculations'
import { Markdown } from '@/components/ui/markdown'

// Sesi WIB (selaras dengan HourAnalysis & tag list trades)
function sessionOf(h: number): string {
  if (h >= 5 && h < 15) return 'Asia'
  if (h >= 15 && h < 20) return 'London'
  if (h >= 20 && h < 24) return 'Overlap'
  return 'New York'
}
const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

const SUGGESTIONS = [
  'Kebocoran terbesar yang menggerus profit saya apa?',
  'Jam & sesi mana yang harus saya hindari?',
  'Seberapa besar overtrade & tidak ikut plan merusak hasil saya?',
  'Strategi mana yang paling layak saya perbesar?',
]

export function JournalAiAnalysis({ trades, stats, fmt, currency }: {
  trades: Trade[]; stats: DashboardStats; fmt: (n: number) => string; currency: AppSettings['currency']
}) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState<false | 'auto' | 'custom'>(false)
  const [result, setResult] = useState<{ text: string; mode: string; at: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const snapshot = useMemo(() => {
    const normal = trades.filter(t => !t.is_overtrade)
    const withTime = normal.filter(t => t.entry_time && /^\d{1,2}:/.test(t.entry_time))
    const r2 = (n: number) => Math.round(n * 100) / 100

    // per jam (WIB)
    const hourMap: Record<number, Trade[]> = {}
    for (const t of withTime) { const h = parseInt(t.entry_time!.slice(0, 2)); if (!isNaN(h)) (hourMap[h] ??= []).push(t) }
    const perHour = Object.entries(hourMap).map(([h, ts]) => {
      const pnl = ts.reduce((s, t) => s + t.pnl, 0), wins = ts.filter(t => t.result === 'win').length
      return { jam: `${h.padStart(2, '0')}:00`, sesi: sessionOf(+h), n: ts.length, winRate: Math.round(wins / ts.length * 100), pnl: r2(pnl), perTrade: r2(pnl / ts.length) }
    }).sort((a, b) => b.pnl - a.pnl)

    // per sesi
    const sesMap: Record<string, Trade[]> = {}
    for (const t of withTime) { const h = parseInt(t.entry_time!.slice(0, 2)); if (!isNaN(h)) (sesMap[sessionOf(h)] ??= []).push(t) }
    const perSesi = Object.entries(sesMap).map(([s, ts]) => {
      const pnl = ts.reduce((a, t) => a + t.pnl, 0), wins = ts.filter(t => t.result === 'win').length
      return { sesi: s, n: ts.length, winRate: Math.round(wins / ts.length * 100), pnl: r2(pnl), perTrade: r2(pnl / ts.length) }
    })

    // per hari (dow)
    const dowMap: Record<number, Trade[]> = {}
    for (const t of normal) { const d = new Date(t.date + 'T00:00:00').getDay(); (dowMap[d] ??= []).push(t) }
    const perHari = Object.entries(dowMap).map(([d, ts]) => {
      const pnl = ts.reduce((a, t) => a + t.pnl, 0), wins = ts.filter(t => t.result === 'win').length
      return { hari: DAYS_ID[+d], n: ts.length, winRate: Math.round(wins / ts.length * 100), pnl: r2(pnl) }
    })

    // psikologi
    const wPlan = normal.filter(t => t.followed_plan === true), woPlan = normal.filter(t => t.followed_plan === false)
    const wr = (a: Trade[]) => a.length ? Math.round(a.filter(t => t.result === 'win').length / a.length * 100) : null
    const overtrades = trades.filter(t => t.is_overtrade)
    const knowDir = normal.filter(t => t.know_direction === true), noDir = normal.filter(t => t.know_direction === false)

    const grp = (fn: (t: Trade) => string) => pnlByGroup(normal, fn).map(g => ({ nama: g.name, n: g.total, winRate: g.winRate, pnl: r2(g.pnl) }))

    // sampel trade terbaru (maks 20)
    const recent = [...trades].sort((a, b) => (b.date + (b.entry_time ?? '')).localeCompare(a.date + (a.entry_time ?? ''))).slice(0, 20).map(t => ({
      tgl: t.date, jam: t.entry_time ?? null, pair: t.pair, arah: t.direction, hasil: t.result, pnl: r2(t.pnl),
      ikutPlan: t.followed_plan ?? null, overtrade: !!t.is_overtrade, strategi: t.strategy ?? null,
      catatan: t.note ? t.note.replace(/\s+/g, ' ').slice(0, 120) : null,
    }))

    return {
      currency,
      ringkasan: {
        totalTrade: normal.length, totalTradeTermasukOvertrade: trades.length,
        winRate: Math.round(stats.win_rate), profitFactor: stats.profit_factor === Infinity ? '∞' : r2(stats.profit_factor),
        totalPnl: r2(stats.total_pnl), avgWin: r2(stats.avg_win), avgLoss: r2(stats.avg_loss),
        expectancyPerTrade: r2(stats.expectancy), maxDrawdown: r2(stats.max_drawdown),
        winStreakTerbaik: stats.win_streak, lossStreakTerburuk: stats.loss_streak,
        streakSaatIni: `${stats.current_streak}x ${stats.current_streak_type}`,
      },
      psikologi: {
        ikutPlan: { n: wPlan.length, winRate: wr(wPlan), pnl: r2(wPlan.reduce((s, t) => s + t.pnl, 0)) },
        tidakIkutPlan: { n: woPlan.length, winRate: wr(woPlan), pnl: r2(woPlan.reduce((s, t) => s + t.pnl, 0)) },
        overtrade: { n: overtrades.length, pnl: r2(overtrades.reduce((s, t) => s + t.pnl, 0)) },
        tahuArah: { n: knowDir.length, winRate: wr(knowDir) }, tidakTahuArah: { n: noDir.length, winRate: wr(noDir) },
      },
      perStrategi: grp(t => t.strategy ?? '—'),
      perPair: grp(t => t.pair),
      perArah: grp(t => t.direction),
      perJam: perHour, perSesi, perHari,
      sampelTradeTerbaru: recent,
    }
  }, [trades, stats, currency])

  const enough = snapshot.ringkasan.totalTradeTermasukOvertrade >= 3

  async function run(mode: 'auto' | 'custom') {
    if (mode === 'custom' && !prompt.trim()) return
    setLoading(mode); setError(null)
    try {
      const j = await (await fetch('/api/journal/ai-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot, prompt, mode }),
      })).json()
      if (j.error) throw new Error(j.error)
      setResult(j)
    } catch (e) { setError(e instanceof Error ? e.message : 'gagal menganalisa') }
    finally { setLoading(false) }
  }

  return (
    <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card to-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/15 ring-1 ring-primary/30"><Brain size={18} className="text-primary" /></span>
          <div>
            <h3 className="text-sm font-black flex items-center gap-1.5">Analisa Jurnal dengan AI <span className="text-[8px] font-bold uppercase bg-primary/15 text-primary rounded px-1.5 py-0.5">Claude</span><span className="text-[8px] font-bold uppercase bg-amber-500/15 text-amber-400 rounded px-1.5 py-0.5 flex items-center gap-0.5"><ShieldCheck size={9} /> Admin</span></h3>
            <p className="text-[11px] text-muted-foreground">Claude membaca statistik & pola jurnalmu, lalu memberi evaluasi + rekomendasi.</p>
          </div>
        </div>
        <button onClick={() => run('auto')} disabled={!!loading || !enough}
          className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0">
          {loading === 'auto' ? <><Loader2 size={14} className="animate-spin" /> Menganalisa…</> : <><Wand2 size={14} /> Analisa Otomatis</>}
        </button>
      </div>

      {!enough ? (
        <div className="rounded-lg bg-muted/20 border border-border/40 p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <AlertTriangle size={14} className="text-amber-400" /> Catat minimal 3 trade dulu supaya AI punya cukup data untuk dianalisa.
        </div>
      ) : (
        <>
          {/* Input prompt custom */}
          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
            <label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Tanya spesifik (opsional)</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2}
              placeholder="Contoh: kenapa win rate saya turun bulan ini? Jam mana yang paling boros?"
              className="w-full mt-1.5 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/40" />
            <div className="flex items-center justify-between gap-2 mt-1.5 pt-2 border-t border-border/30">
              <div className="flex flex-wrap gap-1">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => setPrompt(s)} disabled={!!loading}
                    className="text-[10px] rounded-full border border-border/50 px-2 py-1 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-50">{s}</button>
                ))}
              </div>
              <button onClick={() => run('custom')} disabled={!!loading || !prompt.trim()}
                className="flex items-center gap-1.5 text-xs font-semibold bg-foreground/10 hover:bg-foreground/15 rounded-lg px-3 py-1.5 disabled:opacity-40 transition-colors shrink-0">
                {loading === 'custom' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Tanya
              </button>
            </div>
          </div>

          {/* State & hasil */}
          {loading && <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground"><Loader2 size={22} className="animate-spin text-primary" /><p className="text-xs">Claude sedang membaca jurnalmu…</p></div>}
          {error && !loading && <div className="mt-3 rounded-lg bg-red-500/8 border border-red-500/25 p-3 text-center"><p className="text-xs text-red-400">Gagal: {error}</p><button onClick={() => run(result?.mode === 'custom' ? 'custom' : 'auto')} className="text-xs font-semibold text-primary hover:underline mt-1">Coba lagi</button></div>}
          {result && !loading && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-primary/70 flex items-center gap-1.5"><Sparkles size={11} /> {result.mode === 'custom' ? 'Jawaban AI' : 'Analisa Menyeluruh'}</span>
                <button onClick={() => run(result.mode === 'custom' ? 'custom' : 'auto')} disabled={!!loading} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"><RefreshCw size={10} /> Ulang</button>
              </div>
              <div className="rounded-xl bg-background/40 border border-border/40 p-4"><Markdown text={result.text} /></div>
              <p className="text-[9px] text-muted-foreground/50 text-right mt-2">Diolah Claude dari {snapshot.ringkasan.totalTradeTermasukOvertrade} trade · {new Date(result.at).toLocaleTimeString('id-ID')}. Alat bantu refleksi, bukan nasihat keuangan.</p>
            </div>
          )}
          {!result && !loading && !error && (
            <p className="text-[11px] text-muted-foreground/60 text-center py-4">Klik <b className="text-primary">Analisa Otomatis</b> untuk evaluasi menyeluruh, atau ketik pertanyaan spesifik lalu <b>Tanya</b>.</p>
          )}
        </>
      )}
    </div>
  )
}
