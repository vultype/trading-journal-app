'use client'

import { useState } from 'react'
import { Newspaper, Loader2, RefreshCw, Wand2, CalendarClock, Plus, X } from 'lucide-react'
import { Markdown } from '@/components/ui/markdown'

// Preset komponen umum tiap rilis (biar tidak perlu ketik label satu-satu).
const PRESETS: Record<string, string[]> = {
  'CPI': ['CPI (YoY)', 'Core CPI (YoY)', 'CPI (MoM)', 'Core CPI (MoM)'],
  'Core PCE': ['Core PCE (YoY)', 'Core PCE (MoM)'],
  'NFP (Non-Farm Payrolls)': ['Non-Farm Payrolls', 'Unemployment Rate', 'Average Hourly Earnings (MoM)'],
  'FOMC / Rate Decision': ['Fed Interest Rate Decision'],
  'Fed Chair Speech': ['Nada pidato (hawkish/dovish)'],
  'PPI': ['PPI (YoY)', 'Core PPI (YoY)', 'PPI (MoM)'],
  'Unemployment Rate': ['Unemployment Rate'],
  'Retail Sales': ['Retail Sales (MoM)', 'Core Retail Sales (MoM)'],
  'GDP': ['GDP (QoQ)'],
  'ISM PMI': ['ISM Manufacturing PMI', 'ISM Services PMI'],
  'Jobless Claims': ['Initial Jobless Claims'],
}
const EVENTS = Object.keys(PRESETS)

type Row = { label: string; forecast: string; previous: string; actual: string }
const emptyRow = (label = ''): Row => ({ label, forecast: '', previous: '', actual: '' })

export function TerminalNewsAnalysis({ snapshot }: { snapshot: unknown }) {
  const [event, setEvent] = useState('')
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ text: string; at: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function pickEvent(e: string) {
    setEvent(e)
    setRows((PRESETS[e] ?? ['']).map(l => emptyRow(l)))
  }
  const setRow = (i: number, key: keyof Row, val: string) => setRows(rs => rs.map((r, j) => j === i ? { ...r, [key]: val } : r))
  const addRow = () => setRows(rs => [...rs, emptyRow()])
  const removeRow = (i: number) => setRows(rs => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)

  async function run() {
    if (!event.trim()) { setError('Pilih atau tulis nama berita/event dulu.'); return }
    setLoading(true); setError(null)
    try {
      const j = await (await fetch('/api/terminal/ai-scope', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'news', snapshot, mode: 'auto', extra: { event, rows, notes } }),
      })).json()
      if (j.error) throw new Error(j.error)
      setResult(j)
    } catch (e) { setError(e instanceof Error ? e.message : 'gagal menganalisa') }
    finally { setLoading(false) }
  }

  return (
    <div className="lg:col-span-12 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-[#0b100e] to-[#0b100e] p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/15 ring-1 ring-primary/30"><Newspaper size={18} className="text-primary" /></span>
        <div>
          <h3 className="text-sm font-black flex items-center gap-1.5">Analisa Dampak Berita <span className="text-[8px] font-bold uppercase bg-primary/15 text-primary rounded px-1.5 py-0.5">Claude</span></h3>
          <p className="text-[11px] text-white/45">Masukkan semua komponen rilis (MoM, YoY, Core…) — AI timbang semua & jelaskan mana yang paling penting untuk emas.</p>
        </div>
      </div>

      {/* Pilih event */}
      <label className="text-[10px] uppercase tracking-widest font-semibold text-white/40">Berita / rilis data</label>
      <div className="flex flex-wrap gap-1 mt-1.5 mb-2">
        {EVENTS.map(e => (
          <button key={e} onClick={() => pickEvent(e)} disabled={loading}
            className={`text-[10px] rounded-full border px-2 py-1 transition-colors disabled:opacity-50 ${event === e ? 'border-primary/50 bg-primary/15 text-primary' : 'border-white/15 text-white/50 hover:text-white'}`}>{e}</button>
        ))}
      </div>
      <input value={event} onChange={e => setEvent(e.target.value)} placeholder="atau ketik event lain (mis. Powell testimony, Geopolitik...)"
        className="w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-sm text-white outline-none focus:border-primary/40 placeholder:text-white/25" />

      {/* Tabel komponen */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] uppercase tracking-widest font-semibold text-white/40">Komponen data (isi seperti di kalender ekonomi)</label>
          <button onClick={addRow} disabled={loading} className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline disabled:opacity-50"><Plus size={11} /> Tambah baris</button>
        </div>
        <div className="hidden sm:grid grid-cols-[1fr_5rem_5rem_5rem_1.25rem] gap-1.5 px-1 mb-1 text-[9px] uppercase tracking-wider text-white/35">
          <span>Komponen</span><span>Forecast</span><span>Previous</span><span>Aktual</span><span />
        </div>
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_5rem_5rem_5rem_1.25rem] gap-1.5">
              <input value={r.label} onChange={e => setRow(i, 'label', e.target.value)} placeholder="mis. Core CPI (YoY)"
                className="col-span-2 sm:col-span-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none focus:border-primary/40 placeholder:text-white/25" />
              <input value={r.forecast} onChange={e => setRow(i, 'forecast', e.target.value)} placeholder="fcast"
                className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none focus:border-primary/40 placeholder:text-white/25 tabular-nums" />
              <input value={r.previous} onChange={e => setRow(i, 'previous', e.target.value)} placeholder="prev"
                className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none focus:border-primary/40 placeholder:text-white/25 tabular-nums" />
              <input value={r.actual} onChange={e => setRow(i, 'actual', e.target.value)} placeholder="aktual"
                className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none focus:border-primary/40 placeholder:text-white/25 tabular-nums" />
              <button onClick={() => removeRow(i)} disabled={loading || rows.length <= 1} className="flex items-center justify-center text-white/30 hover:text-red-400 disabled:opacity-30" title="Hapus baris"><X size={13} /></button>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-white/30 mt-1.5">Kolom <b>Aktual</b> diisi kalau data sudah rilis (untuk analisa reaksi). Kosongkan kalau masih forecast.</p>
      </div>

      <div className="mt-2.5">
        <label className="text-[10px] uppercase tracking-widest font-semibold text-white/40">Catatan (opsional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="mis. rilis 19:30 WIB, pasar wait-and-see..."
          className="w-full mt-1 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-sm text-white resize-none outline-none focus:border-primary/40 placeholder:text-white/25" />
      </div>

      <button onClick={run} disabled={loading || !event.trim()}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity">
        {loading ? <><Loader2 size={14} className="animate-spin" /> Menganalisa dampak…</> : <><Wand2 size={14} /> Analisa Dampak ke Emas</>}
      </button>

      {loading && <div className="py-8 flex flex-col items-center gap-2 text-white/50"><Loader2 size={22} className="animate-spin text-primary" /><p className="text-xs">Claude menimbang semua komponen & skenario…</p></div>}
      {error && !loading && <p className="mt-3 text-xs text-red-400 text-center">{error}</p>}
      {result && !loading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-primary/70 flex items-center gap-1.5"><CalendarClock size={11} /> Analisa Dampak: {event}</span>
            <button onClick={run} disabled={loading} className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white disabled:opacity-50"><RefreshCw size={10} /> Ulang</button>
          </div>
          <div className="rounded-xl bg-black/20 border border-white/10 p-4"><Markdown text={result.text} /></div>
          <p className="text-[9px] text-white/30 text-right mt-2">Diolah Claude dari data terminal + headline berita · {new Date(result.at).toLocaleTimeString('id-ID')}. Bukan nasihat keuangan.</p>
        </div>
      )}
    </div>
  )
}
