'use client'

import { useState } from 'react'
import { Brain, Sparkles, Loader2, RefreshCw, Send, Wand2 } from 'lucide-react'
import { Markdown } from '@/components/ui/markdown'

export type AiScope = 'teknikal' | 'makro' | 'sentimen'

// Panel analisa AI fokus per-menu terminal: tombol Analisa Otomatis + input prompt bebas.
export function TerminalAiPanel({ scope, title, subtitle, snapshot, suggestions }: {
  scope: AiScope; title: string; subtitle: string; snapshot: unknown; suggestions: string[]
}) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState<false | 'auto' | 'custom'>(false)
  const [result, setResult] = useState<{ text: string; mode: string; at: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(mode: 'auto' | 'custom') {
    if (mode === 'custom' && !prompt.trim()) return
    setLoading(mode); setError(null)
    try {
      const j = await (await fetch('/api/terminal/ai-scope', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, snapshot, prompt, mode }),
      })).json()
      if (j.error) throw new Error(j.error)
      setResult(j)
    } catch (e) { setError(e instanceof Error ? e.message : 'gagal menganalisa') }
    finally { setLoading(false) }
  }

  return (
    <div className="lg:col-span-12 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-[#0b100e] to-[#0b100e] p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/15 ring-1 ring-primary/30"><Brain size={16} className="text-primary" /></span>
          <div>
            <h3 className="text-sm font-black flex items-center gap-1.5">{title} <span className="text-[8px] font-bold uppercase bg-primary/15 text-primary rounded px-1.5 py-0.5">Claude</span></h3>
            <p className="text-[11px] text-white/45">{subtitle}</p>
          </div>
        </div>
        <button onClick={() => run('auto')} disabled={!!loading}
          className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0">
          {loading === 'auto' ? <><Loader2 size={14} className="animate-spin" /> Menganalisa…</> : <><Wand2 size={14} /> Analisa Otomatis</>}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <label className="text-[10px] uppercase tracking-widest font-semibold text-white/40">Tanya spesifik (opsional)</label>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2}
          placeholder="Contoh: apakah setup sekarang layak entry? Level stop di mana?"
          className="w-full mt-1.5 bg-transparent text-sm text-white resize-none outline-none placeholder:text-white/30" />
        <div className="flex items-center justify-between gap-2 mt-1.5 pt-2 border-t border-white/10">
          <div className="flex flex-wrap gap-1">
            {suggestions.map(s => (
              <button key={s} onClick={() => setPrompt(s)} disabled={!!loading}
                className="text-[10px] rounded-full border border-white/15 px-2 py-1 text-white/50 hover:border-primary/40 hover:text-white transition-colors disabled:opacity-50">{s}</button>
            ))}
          </div>
          <button onClick={() => run('custom')} disabled={!!loading || !prompt.trim()}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/15 rounded-lg px-3 py-1.5 disabled:opacity-40 transition-colors shrink-0">
            {loading === 'custom' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Tanya
          </button>
        </div>
      </div>

      {loading && <div className="py-8 flex flex-col items-center gap-2 text-white/50"><Loader2 size={22} className="animate-spin text-primary" /><p className="text-xs">Claude sedang menganalisa {scope}…</p></div>}
      {error && !loading && <div className="mt-3 rounded-lg bg-red-500/8 border border-red-500/25 p-3 text-center"><p className="text-xs text-red-400">Gagal: {error}</p><button onClick={() => run(result?.mode === 'custom' ? 'custom' : 'auto')} className="text-xs font-semibold text-primary hover:underline mt-1">Coba lagi</button></div>}
      {result && !loading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-primary/70 flex items-center gap-1.5"><Sparkles size={11} /> {result.mode === 'custom' ? 'Jawaban AI' : 'Analisa Otomatis'}</span>
            <button onClick={() => run(result.mode === 'custom' ? 'custom' : 'auto')} disabled={!!loading} className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white disabled:opacity-50"><RefreshCw size={10} /> Ulang</button>
          </div>
          <div className="rounded-xl bg-black/20 border border-white/10 p-4"><Markdown text={result.text} /></div>
          <p className="text-[9px] text-white/30 text-right mt-2">Diolah Claude dari data terminal · {new Date(result.at).toLocaleTimeString('id-ID')}. Bukan nasihat keuangan.</p>
        </div>
      )}
      {!result && !loading && !error && (
        <p className="text-[11px] text-white/40 text-center py-3">Klik <b className="text-primary">Analisa Otomatis</b> untuk pandangan AI fokus {scope}, atau ketik pertanyaan lalu <b>Tanya</b>.</p>
      )}
    </div>
  )
}
