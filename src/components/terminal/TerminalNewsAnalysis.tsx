'use client'

import { useState } from 'react'
import { Newspaper, Loader2, RefreshCw, Wand2, CalendarClock } from 'lucide-react'
import { Markdown } from '@/components/ui/markdown'

const EVENTS = ['CPI', 'Core CPI', 'Core PCE', 'NFP (Non-Farm Payrolls)', 'FOMC / Rate Decision', 'Fed Chair Speech', 'PPI', 'Unemployment Rate', 'Retail Sales', 'GDP', 'ISM PMI', 'Jobless Claims']

// Analisa dampak rilis berita/data ekonomi ke XAU/USD, digabung dengan snapshot terminal.
export function TerminalNewsAnalysis({ snapshot }: { snapshot: unknown }) {
  const [event, setEvent] = useState('')
  const [forecast, setForecast] = useState('')
  const [previous, setPrevious] = useState('')
  const [actual, setActual] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ text: string; at: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!event.trim()) { setError('Pilih atau tulis nama berita/event dulu.'); return }
    setLoading(true); setError(null)
    try {
      const j = await (await fetch('/api/terminal/ai-scope', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'news', snapshot, mode: 'auto', extra: { event, forecast, previous, actual, notes } }),
      })).json()
      if (j.error) throw new Error(j.error)
      setResult(j)
    } catch (e) { setError(e instanceof Error ? e.message : 'gagal menganalisa') }
    finally { setLoading(false) }
  }

  const field = (label: string, val: string, set: (v: string) => void, ph: string) => (
    <div>
      <label className="text-[10px] uppercase tracking-widest font-semibold text-white/40">{label}</label>
      <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
        className="w-full mt-1 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-sm text-white outline-none focus:border-primary/40 placeholder:text-white/25" />
    </div>
  )

  return (
    <div className="lg:col-span-12 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-[#0b100e] to-[#0b100e] p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/15 ring-1 ring-primary/30"><Newspaper size={18} className="text-primary" /></span>
        <div>
          <h3 className="text-sm font-black flex items-center gap-1.5">Analisa Dampak Berita <span className="text-[8px] font-bold uppercase bg-primary/15 text-primary rounded px-1.5 py-0.5">Claude</span></h3>
          <p className="text-[11px] text-white/45">Prediksi arah emas (bullish/bearish) saat rilis data — gabung makro, teknikal & sentimen terkini.</p>
        </div>
      </div>

      {/* Pilih event */}
      <label className="text-[10px] uppercase tracking-widest font-semibold text-white/40">Berita / rilis data</label>
      <div className="flex flex-wrap gap-1 mt-1.5 mb-2">
        {EVENTS.map(e => (
          <button key={e} onClick={() => setEvent(e)} disabled={loading}
            className={`text-[10px] rounded-full border px-2 py-1 transition-colors disabled:opacity-50 ${event === e ? 'border-primary/50 bg-primary/15 text-primary' : 'border-white/15 text-white/50 hover:text-white'}`}>{e}</button>
        ))}
      </div>
      <input value={event} onChange={e => setEvent(e.target.value)} placeholder="atau ketik event lain (mis. Powell testimony, Geopolitik...)"
        className="w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-sm text-white outline-none focus:border-primary/40 placeholder:text-white/25" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2.5">
        {field('Ekspektasi (forecast)', forecast, setForecast, 'mis. 3.1%')}
        {field('Sebelumnya (previous)', previous, setPrevious, 'mis. 3.4%')}
        {field('Aktual (jika sudah rilis)', actual, setActual, 'kosongkan jika belum')}
      </div>
      <div className="mt-2.5">
        <label className="text-[10px] uppercase tracking-widest font-semibold text-white/40">Catatan (opsional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="mis. rilis jam 20:30 WIB, pasar sedang wait-and-see..."
          className="w-full mt-1 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-sm text-white resize-none outline-none focus:border-primary/40 placeholder:text-white/25" />
      </div>

      <button onClick={run} disabled={loading || !event.trim()}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity">
        {loading ? <><Loader2 size={14} className="animate-spin" /> Menganalisa dampak…</> : <><Wand2 size={14} /> Analisa Dampak ke Emas</>}
      </button>

      {loading && <div className="py-8 flex flex-col items-center gap-2 text-white/50"><Loader2 size={22} className="animate-spin text-primary" /><p className="text-xs">Claude menimbang skenario bullish/bearish…</p></div>}
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
