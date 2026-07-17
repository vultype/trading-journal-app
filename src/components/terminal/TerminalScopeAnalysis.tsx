'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Brain, Loader2, RefreshCw, Send, Wand2, Gauge, Target, Eye, ShieldAlert, ListChecks, Newspaper, Coins, Sparkles, Clapperboard, Landmark } from 'lucide-react'
import { AiLoading } from './AiLoading'
import { Markdown } from '@/components/ui/markdown'
import { BiasBar, DirIcon, Section, NewsSentimentColumns, dirColor, dirBg, FaktorRow, type Dir } from './aiViz'
import { aiFetch } from '@/lib/ai-fetch'

export type ScopeKind = 'makro' | 'sentimen'
type Analysis = {
  scope: string; biasArah: 'Bullish' | 'Bearish' | 'Netral'; biasBullishPersen: number; confidence: number
  headline: string; dampakXauusd: string
  faktor: { nama: string; nilai: string; arah: Dir; bobot: string; catatan: string }[]
  sentimenBerita: { skor: number; ringkasan: string; mendukung: string[]; menentang: string[] }
  narasiPasar: { tema: string; penjelasan: string; arah: Dir; temaLain: string[] }
  nadaFed: { nada: 'Dovish' | 'Hawkish' | 'Netral'; skala: number; dampakEmas: Dir; penjelasan: string; pendorong: string[] }
  kesimpulan: string; watch: string[]; risiko: string[]; fetchedAt: string
}

export function TerminalScopeAnalysis({ scope, title, subtitle, snapshot, suggestions, hidePrompt = false }: {
  scope: ScopeKind; title: string; subtitle: string; snapshot: unknown; suggestions: string[]; hidePrompt?: boolean
}) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState<false | 'auto' | 'custom'>(false)
  const [data, setData] = useState<Analysis | null>(null)
  const [qa, setQa] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [low, setLow] = useState(false)

  async function runAuto() {
    setLoading('auto'); setError(null); setLow(false)
    try {
      const { data: j, insufficient } = await aiFetch<{ error?: string } & Analysis>('/api/terminal/scope-analysis', { scope, snapshot })
      if (insufficient) { setLow(true); setError(j.error || 'Kredit AI tidak cukup.'); return }
      if (j.error) throw new Error(j.error)
      setData(j)
    } catch (e) { setError(e instanceof Error ? e.message : 'gagal menganalisa') } finally { setLoading(false) }
  }
  async function runCustom() {
    if (!prompt.trim()) return
    setLoading('custom'); setError(null); setLow(false)
    try {
      const { data: j, insufficient } = await aiFetch<{ error?: string; text: string }>('/api/terminal/ai-scope', { scope, snapshot, prompt, mode: 'custom' })
      if (insufficient) { setLow(true); setError(j.error || 'Kredit AI tidak cukup.'); return }
      if (j.error) throw new Error(j.error)
      setQa(j.text)
    } catch (e) { setError(e instanceof Error ? e.message : 'gagal menganalisa') } finally { setLoading(false) }
  }

  return (
    <div className="lg:col-span-12 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-[#0b100e] to-[#0b100e] p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/15 ring-1 ring-primary/30"><Brain size={16} className="text-primary" /></span>
          <div>
            <h3 className="text-sm font-black flex items-center gap-1.5">{title} <span className="text-[8px] font-bold uppercase bg-primary/15 text-primary rounded px-1.5 py-0.5">Datalitiq AI</span></h3>
            <p className="text-[11px] text-white/45">{subtitle}</p>
          </div>
        </div>
        <button onClick={runAuto} disabled={!!loading}
          className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0">
          {loading === 'auto' ? <><Loader2 size={14} className="animate-spin" /> Menganalisa…</> : <><Wand2 size={14} /> {data ? 'Analisa Ulang' : 'Analisa Otomatis'}</>}
        </button>
      </div>

      {/* Input prompt — disembunyikan pada mode hidePrompt (analisa otomatis saja) */}
      {!hidePrompt && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <label className="text-[10px] uppercase tracking-widest font-semibold text-white/40">Tanya spesifik (opsional)</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2}
            placeholder={`Contoh: apa dampak terbesar ${scope} ke emas sekarang?`}
            className="w-full mt-1.5 bg-transparent text-sm text-white resize-none outline-none placeholder:text-white/30" />
          <div className="flex items-center justify-between gap-2 mt-1.5 pt-2 border-t border-white/10">
            <div className="flex flex-wrap gap-1">
              {suggestions.map(s => (
                <button key={s} onClick={() => setPrompt(s)} disabled={!!loading}
                  className="text-[10px] rounded-full border border-white/15 px-2 py-1 text-white/50 hover:border-primary/40 hover:text-white transition-colors disabled:opacity-50">{s}</button>
              ))}
            </div>
            <button onClick={runCustom} disabled={!!loading || !prompt.trim()}
              className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/15 rounded-lg px-3 py-1.5 disabled:opacity-40 transition-colors shrink-0">
              {loading === 'custom' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Tanya
            </button>
          </div>
        </div>
      )}

      {loading && <AiLoading steps={[`Membaca data ${scope}…`, 'Menimbang faktor & dampak ke emas…', 'Menyusun bias & narasi…']} />}
      {error && !loading && low && <div className="mt-3 rounded-lg bg-amber-500/8 border border-amber-500/25 p-3 text-center"><p className="flex items-center justify-center gap-1.5 text-xs text-amber-400"><Coins size={13} /> {error}</p><Link href="/account#token" className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg px-3 py-1.5 mt-2 hover:opacity-90 transition-opacity"><Sparkles size={12} /> Top Up Kredit</Link></div>}
      {error && !loading && !low && <div className="mt-3 rounded-lg bg-red-500/8 border border-red-500/25 p-3 text-center"><p className="text-xs text-red-400">Gagal: {error}</p></div>}

      {/* Jawaban prompt (markdown) */}
      {qa && !loading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2"><span className="text-[10px] uppercase tracking-widest font-bold text-primary/70 flex items-center gap-1.5"><Sparkles size={11} /> Jawaban AI</span><button onClick={() => setQa(null)} className="text-[10px] text-white/40 hover:text-white">tutup</button></div>
          <div className="rounded-xl bg-black/20 border border-white/10 p-4"><Markdown text={qa} /></div>
        </div>
      )}

      {/* Hasil terstruktur */}
      {data && !loading && <StructResult a={data} scope={scope} />}
      {!data && !qa && !loading && !error && <p className="text-[11px] text-white/40 text-center py-3">Klik <b className="text-primary">Analisa Otomatis</b> untuk lihat dampak {scope} ke XAU/USD — bias %, nada Fed, tiap faktor & kesimpulan.</p>}
    </div>
  )
}

function StructResult({ a, scope }: { a: Analysis; scope: ScopeKind }) {
  return (
    <div className="mt-4 space-y-4">
      {/* Bias ke XAUUSD */}
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <span className="flex items-center gap-2 text-sm font-black"><Gauge size={16} className="text-primary" /> Bias {scope === 'makro' ? 'Makro' : 'Sentimen'} → XAU/USD: <span className={dirColor(a.biasArah.toLowerCase())}>{a.biasArah}</span></span>
          <span className="text-[10px] text-white/40">Keyakinan <b className={a.confidence > 66 ? 'text-emerald-400' : a.confidence > 40 ? 'text-amber-400' : 'text-red-400'}>{a.confidence}%</b></span>
        </div>
        <BiasBar bullishPct={a.biasBullishPersen} />
      </div>

      {/* Dampak ke XAUUSD — menonjol */}
      <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5"><Target size={12} /> Dampak ke XAU/USD</p>
        {a.headline && <p className="text-[13px] font-bold text-white/90 leading-snug">{a.headline}</p>}
        {a.dampakXauusd && <p className="text-[11px] text-white/60 leading-snug mt-1">{a.dampakXauusd}</p>}
      </div>

      {/* Nada Kebijakan Fed (khusus makro) — dovish ↔ hawkish + dampak ke emas */}
      {scope === 'makro' && a.nadaFed.penjelasan && (() => {
        const nf = a.nadaFed
        const nadaColor = nf.nada === 'Dovish' ? 'text-emerald-400' : nf.nada === 'Hawkish' ? 'text-red-400' : 'text-white/70'
        return (
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2"><Landmark size={12} /> Nada Kebijakan The Fed</p>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className={`text-base font-black ${nadaColor}`}>{nf.nada === 'Dovish' ? '🕊️ Dovish' : nf.nada === 'Hawkish' ? '🦅 Hawkish' : '⚖️ Netral'}</span>
              <span className={`flex items-center gap-1 text-[10px] font-bold ${dirColor(nf.dampakEmas)}`}><DirIcon a={nf.dampakEmas} size={11} /> {nf.dampakEmas} emas</span>
            </div>
            {/* Gauge dovish (kiri, bullish emas) ↔ hawkish (kanan, bearish emas) */}
            <div className="relative h-2.5 rounded-full bg-gradient-to-r from-emerald-500/50 via-white/10 to-red-500/50 mb-1">
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white ring-2 ring-[#0b100e]" style={{ left: `${nf.skala}%` }} />
            </div>
            <div className="flex justify-between text-[9px] font-semibold mb-2"><span className="text-emerald-400">◀ Dovish · emas naik</span><span className="text-red-400">Hawkish · emas turun ▶</span></div>
            <p className="text-[11px] text-white/65 leading-snug">{nf.penjelasan}</p>
            {nf.pendorong.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-[9px] text-white/35 uppercase tracking-wider">Pendorong:</span>
                {nf.pendorong.map((t, i) => <span key={i} className="text-[9px] rounded-full border border-white/15 px-2 py-0.5 text-white/55">{t}</span>)}
              </div>
            )}
          </div>
        )
      })()}

      {/* Tema / Narasi Pasar (khusus sentimen) — cerita yang sedang dimainkan pasar */}
      {scope === 'sentimen' && a.narasiPasar.tema && (
        <div className={`rounded-xl border p-3 ${dirBg(a.narasiPasar.arah)}`}>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1.5"><Clapperboard size={12} /> Tema / Narasi yang Sedang Dimainkan</p>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-black text-white/90">🎬 {a.narasiPasar.tema}</span>
            <span className={`flex items-center gap-1 text-[10px] font-bold ${dirColor(a.narasiPasar.arah)}`}><DirIcon a={a.narasiPasar.arah} size={11} />{a.narasiPasar.arah}</span>
          </div>
          {a.narasiPasar.penjelasan && <p className="text-[11px] text-white/65 leading-snug">{a.narasiPasar.penjelasan}</p>}
          {a.narasiPasar.temaLain.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-[9px] text-white/35 uppercase tracking-wider">Tema lain:</span>
              {a.narasiPasar.temaLain.map((t, i) => <span key={i} className="text-[9px] rounded-full border border-white/15 px-2 py-0.5 text-white/55">{t}</span>)}
            </div>
          )}
        </div>
      )}

      {/* Faktor + dampak per parameter */}
      {a.faktor.length > 0 && (
        <Section icon={ListChecks} title={`Faktor ${scope === 'makro' ? 'Makro' : 'Sentimen'} & Dampaknya ke Emas`}>
          <div className="space-y-1.5">{a.faktor.map((f, i) => <FaktorRow key={i} nama={f.nama} nilai={f.nilai} arah={f.arah} bobot={f.bobot} catatan={f.catatan} />)}</div>
        </Section>
      )}

      {/* Sentimen berita (khusus sentimen) */}
      {scope === 'sentimen' && (a.sentimenBerita.mendukung.length > 0 || a.sentimenBerita.menentang.length > 0) && (
        <Section icon={Newspaper} title={`Sentimen Berita (skor ${a.sentimenBerita.skor >= 0 ? '+' : ''}${a.sentimenBerita.skor})`}>
          {a.sentimenBerita.ringkasan && <p className="text-[11px] text-white/55 leading-snug mb-2">{a.sentimenBerita.ringkasan}</p>}
          <NewsSentimentColumns mendukung={a.sentimenBerita.mendukung} menentang={a.sentimenBerita.menentang} />
        </Section>
      )}

      {/* Kesimpulan */}
      {a.kesimpulan && (
        <div className="rounded-xl bg-black/20 border border-white/10 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1"><Coins size={12} /> Kesimpulan</p>
          <p className="text-[12px] text-white/80 leading-snug">{a.kesimpulan}</p>
        </div>
      )}

      {/* Watch + Risiko */}
      <div className="grid sm:grid-cols-2 gap-3">
        {a.watch.length > 0 && <Section icon={Eye} title="Dipantau"><ul className="space-y-0.5">{a.watch.map((w, i) => <li key={i} className="text-[11px] text-white/60 leading-snug flex gap-1.5"><span className="text-primary">→</span>{w}</li>)}</ul></Section>}
        {a.risiko.length > 0 && <Section icon={ShieldAlert} title="Risiko"><ul className="space-y-0.5">{a.risiko.map((r, i) => <li key={i} className="text-[11px] text-white/60 leading-snug flex gap-1.5"><span className="text-amber-400/70">⚠</span>{r}</li>)}</ul></Section>}
      </div>

      <p className="text-[9px] text-white/30 text-right">Diolah Datalitiq AI dari data terminal · {new Date(a.fetchedAt).toLocaleTimeString('id-ID')}. Bukan nasihat keuangan.</p>
    </div>
  )
}
