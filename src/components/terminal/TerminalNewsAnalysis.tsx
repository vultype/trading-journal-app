'use client'

import { useState } from 'react'
import {
  Newspaper, Loader2, RefreshCw, Wand2, Plus, X,
  Target, ShieldAlert, Landmark, Activity, Layers, Gauge, ListChecks,
} from 'lucide-react'
import { BiasBar, DirIcon, Section, NewsSentimentColumns, dirColor, dirBg, type Dir } from './aiViz'

// Preset komponen umum tiap rilis (auto-isi label saat pilih event).
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

// Urutan field mengikuti tampilan forexfactory: Actual · Forecast · Previous
type Row = { label: string; actual: string; forecast: string; previous: string }
const emptyRow = (label = ''): Row => ({ label, actual: '', forecast: '', previous: '' })
type Analysis = {
  event: string; biasArah: 'Bullish' | 'Bearish' | 'Netral'; biasBullishPersen: number; confidence: number
  headline: string; ringkasan: string
  rekomendasiPreNews: { aksi: 'LONG' | 'SHORT' | 'TUNGGU'; alasan: string; entry: string; sl: string; tp: string; peringatan: string }
  prioritasKomponen: { komponen: string; bobot: string; arah: Dir; catatan: string }[]
  skenario: { nama: string; kondisi: string; arahEmas: Dir; probabilitas: number; reaksi: string; level: string }[]
  sentimenBerita: { skor: number; ringkasan: string; mendukung: string[]; menentang: string[] }
  makro: { nama: string; nilai: string; arah: Dir; catatan: string }[]
  teknikal: { nama: string; nilai: string; arah: Dir; catatan: string }[]
  levelKunci: { resistance: string[]; support: string[] }
  risiko: string[]; fetchedAt: string
}

export function TerminalNewsAnalysis({ snapshot }: { snapshot: unknown }) {
  const [event, setEvent] = useState('')
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Analysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  function pickEvent(e: string) { setEvent(e); setRows((PRESETS[e] ?? ['']).map(l => emptyRow(l))) }
  const setRow = (i: number, key: keyof Row, val: string) => setRows(rs => rs.map((r, j) => j === i ? { ...r, [key]: val } : r))
  const addRow = () => setRows(rs => [...rs, emptyRow()])
  const removeRow = (i: number) => setRows(rs => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)

  async function run() {
    if (!event.trim()) { setError('Pilih atau tulis nama berita/event dulu.'); return }
    setLoading(true); setError(null)
    try {
      const j = await (await fetch('/api/terminal/news-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot, event, rows, notes }),
      })).json()
      if (j.error) throw new Error(j.error)
      setData(j)
    } catch (e) { setError(e instanceof Error ? e.message : 'gagal menganalisa') }
    finally { setLoading(false) }
  }

  return (
    <div className="lg:col-span-12 space-y-3">
      {/* ── FORM ── */}
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-[#0b100e] to-[#0b100e] p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/15 ring-1 ring-primary/30"><Newspaper size={18} className="text-primary" /></span>
          <div>
            <h3 className="text-sm font-black flex items-center gap-1.5">Analisa Dampak Berita <span className="text-[8px] font-bold uppercase bg-primary/15 text-primary rounded px-1.5 py-0.5">Claude</span></h3>
            <p className="text-[11px] text-white/45">Prediksi arah emas sebelum rilis — gabung makro, teknikal, sentimen & semua komponen data.</p>
          </div>
        </div>

        <label className="text-[10px] uppercase tracking-widest font-semibold text-white/40">1 · Pilih berita / rilis</label>
        <div className="flex flex-wrap gap-1 mt-1.5 mb-2">
          {EVENTS.map(e => (
            <button key={e} onClick={() => pickEvent(e)} disabled={loading}
              className={`text-[10px] rounded-full border px-2.5 py-1 transition-colors disabled:opacity-50 ${event === e ? 'border-primary/50 bg-primary/15 text-primary font-semibold' : 'border-white/15 text-white/50 hover:text-white'}`}>{e}</button>
          ))}
        </div>
        <input value={event} onChange={e => setEvent(e.target.value)} placeholder="atau ketik event lain (mis. Powell testimony, Geopolitik...)"
          className="w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-sm text-white outline-none focus:border-primary/40 placeholder:text-white/25" />

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] uppercase tracking-widest font-semibold text-white/40">2 · Isi angka — urutan sama seperti forexfactory</label>
            <button onClick={addRow} disabled={loading} className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline disabled:opacity-50"><Plus size={11} /> Tambah baris</button>
          </div>
          <div className="hidden sm:grid grid-cols-[1fr_5rem_5rem_5rem_1.25rem] gap-1.5 px-1 mb-1 text-[9px] uppercase tracking-wider text-white/35">
            <span>Komponen (News)</span><span className="text-primary/70">Actual</span><span>Forecast</span><span>Previous</span><span />
          </div>
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_5rem_5rem_5rem_1.25rem] gap-1.5">
                <input value={r.label} onChange={e => setRow(i, 'label', e.target.value)} placeholder="mis. Core CPI (YoY)"
                  className="col-span-2 sm:col-span-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none focus:border-primary/40 placeholder:text-white/25" />
                <input value={r.actual} onChange={e => setRow(i, 'actual', e.target.value)} placeholder="actual"
                  className="rounded-lg border border-primary/25 bg-primary/[0.06] px-2 py-1.5 text-xs text-white outline-none focus:border-primary/50 placeholder:text-white/25 tabular-nums font-semibold" />
                <input value={r.forecast} onChange={e => setRow(i, 'forecast', e.target.value)} placeholder="forecast"
                  className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none focus:border-primary/40 placeholder:text-white/25 tabular-nums" />
                <input value={r.previous} onChange={e => setRow(i, 'previous', e.target.value)} placeholder="previous"
                  className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none focus:border-primary/40 placeholder:text-white/25 tabular-nums" />
                <button onClick={() => removeRow(i)} disabled={loading || rows.length <= 1} className="flex items-center justify-center text-white/30 hover:text-red-400 disabled:opacity-30" title="Hapus baris"><X size={13} /></button>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-white/30 mt-1.5">Urutan kolom persis forexfactory: <b className="text-primary/70">Actual</b> · Forecast · Previous — tinggal salin lurus dari tabel kalender. Kosongkan <b className="text-primary/70">Actual</b> kalau belum rilis.</p>
        </div>

        <div className="mt-2.5">
          <label className="text-[10px] uppercase tracking-widest font-semibold text-white/40">3 · Catatan (opsional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="mis. rilis 19:30 WIB, saya berencana entry 30 menit sebelum rilis..."
            className="w-full mt-1 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-sm text-white resize-none outline-none focus:border-primary/40 placeholder:text-white/25" />
        </div>

        <button onClick={run} disabled={loading || !event.trim()}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm font-bold bg-primary text-primary-foreground rounded-xl px-4 py-3 hover:opacity-90 disabled:opacity-50 transition-opacity">
          {loading ? <><Loader2 size={16} className="animate-spin" /> Menganalisa semua parameter…</> : <><Wand2 size={16} /> Analisa Dampak ke Emas</>}
          {data && !loading && <RefreshCw size={13} className="ml-1 opacity-70" />}
        </button>
        {error && !loading && <p className="mt-2 text-xs text-red-400 text-center">{error}</p>}
      </div>

      {loading && <div className="rounded-2xl border border-white/[0.06] bg-[#0b100e] py-10 flex flex-col items-center gap-2 text-white/50"><Loader2 size={24} className="animate-spin text-primary" /><p className="text-xs">Claude menimbang komponen, makro, teknikal & headline…</p></div>}

      {/* ── HASIL INTERAKTIF ── */}
      {data && !loading && <Result a={data} />}
    </div>
  )
}

function Result({ a }: { a: Analysis }) {
  const aksiStyle = a.rekomendasiPreNews.aksi === 'LONG' ? 'bg-emerald-500 text-black' : a.rekomendasiPreNews.aksi === 'SHORT' ? 'bg-red-500 text-white' : 'bg-white/15 text-white'
  const senti = a.sentimenBerita.skor
  return (
    <div className="rounded-2xl border border-primary/25 bg-[#0b100e] p-4 space-y-4">
      {/* Verdict + bias */}
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <span className="flex items-center gap-2 text-sm font-black"><Gauge size={16} className="text-primary" /> Prediksi Dampak: <span className={dirColor(a.biasArah.toLowerCase())}>{a.biasArah}</span></span>
          <span className="text-[10px] text-white/40">Keyakinan <b className={a.confidence > 66 ? 'text-emerald-400' : a.confidence > 40 ? 'text-amber-400' : 'text-red-400'}>{a.confidence}%</b></span>
        </div>
        <BiasBar bullishPct={a.biasBullishPersen} />
        {a.headline && <p className="text-[13px] font-bold text-white/90 mt-3 leading-snug">{a.headline}</p>}
        {a.ringkasan && <p className="text-[11px] text-white/55 leading-snug mt-1">{a.ringkasan}</p>}
      </div>

      {/* Rekomendasi pre-news */}
      <div className="rounded-xl border border-white/10 bg-black/25 p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-2"><Target size={12} /> Rekomendasi Sebelum Rilis</p>
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <span className={`text-base font-black rounded-lg px-4 py-1.5 ${aksiStyle}`}>{a.rekomendasiPreNews.aksi}</span>
          <p className="flex-1 min-w-[180px] text-[11px] text-white/70 leading-snug">{a.rekomendasiPreNews.alasan}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-lg bg-white/[0.03] p-2"><p className="text-[9px] text-white/35 uppercase">Entry</p><p className="text-white/85 leading-snug">{a.rekomendasiPreNews.entry || '—'}</p></div>
          <div className="rounded-lg bg-white/[0.03] p-2"><p className="text-[9px] text-red-400/60 uppercase">Stop</p><p className="text-white/85 leading-snug">{a.rekomendasiPreNews.sl || '—'}</p></div>
          <div className="rounded-lg bg-white/[0.03] p-2"><p className="text-[9px] text-emerald-400/60 uppercase">Target</p><p className="text-white/85 leading-snug">{a.rekomendasiPreNews.tp || '—'}</p></div>
        </div>
        {a.rekomendasiPreNews.peringatan && <div className="flex items-start gap-1.5 mt-2 rounded-lg bg-amber-500/8 border border-amber-500/20 p-2"><ShieldAlert size={13} className="text-amber-400 mt-0.5 shrink-0" /><p className="text-[10px] text-amber-200/80 leading-snug">{a.rekomendasiPreNews.peringatan}</p></div>}
      </div>

      {/* Skenario dengan probabilitas */}
      {a.skenario.length > 0 && (
        <Section icon={ListChecks} title="Skenario Reaksi Saat Rilis">
          <div className="grid sm:grid-cols-3 gap-2">
            {a.skenario.map((s, i) => (
              <div key={i} className={`rounded-xl border p-2.5 ${dirBg(s.arahEmas)}`}>
                <div className="flex items-center justify-between mb-1"><span className="text-[11px] font-bold text-white/85">{s.nama}</span><span className="flex items-center gap-1 text-[10px] font-bold"><DirIcon a={s.arahEmas} size={11} /><span className={dirColor(s.arahEmas)}>{s.arahEmas}</span></span></div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-1.5"><div className={`h-full ${s.arahEmas === 'bullish' ? 'bg-emerald-400' : s.arahEmas === 'bearish' ? 'bg-red-400' : 'bg-white/40'}`} style={{ width: `${s.probabilitas}%` }} /></div>
                <p className="text-[9px] text-white/40 mb-1">Peluang ~{s.probabilitas}% · {s.kondisi}</p>
                <p className="text-[10px] text-white/65 leading-snug">{s.reaksi}</p>
                {s.level && <p className="text-[9px] text-white/40 mt-1">🎯 {s.level}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Prioritas komponen */}
      {a.prioritasKomponen.length > 0 && (
        <Section icon={ListChecks} title="Komponen Mana yang Paling Penting">
          <div className="space-y-1.5">
            {a.prioritasKomponen.map((c, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 shrink-0 ${c.bobot === 'Tinggi' ? 'bg-primary/20 text-primary' : c.bobot === 'Sedang' ? 'bg-white/10 text-white/60' : 'bg-white/5 text-white/40'}`}>{c.bobot}</span>
                <span className="text-[11px] font-semibold text-white/85">{c.komponen}</span>
                <DirIcon a={c.arah} size={11} />
                <span className="text-[10px] text-white/45 flex-1 leading-snug">{c.catatan}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Sentimen berita: mendukung vs menentang */}
      <Section icon={Newspaper} title={`Sentimen Berita (skor ${senti >= 0 ? '+' : ''}${senti})`}>
        {a.sentimenBerita.ringkasan && <p className="text-[11px] text-white/55 leading-snug mb-2">{a.sentimenBerita.ringkasan}</p>}
        <NewsSentimentColumns mendukung={a.sentimenBerita.mendukung} menentang={a.sentimenBerita.menentang} />
      </Section>

      {/* Makro & Teknikal */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Section icon={Landmark} title="Data Makro">
          <div className="space-y-1.5">{a.makro.map((m, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${dirBg(m.arah)}`}>
              <DirIcon a={m.arah} size={12} />
              <span className="text-[11px] font-semibold text-white/85">{m.nama}</span>
              {m.nilai && <span className="text-[11px] font-bold tabular-nums text-white/70">{m.nilai}</span>}
              <span className="text-[9px] text-white/40 flex-1 text-right leading-tight">{m.catatan}</span>
            </div>
          ))}</div>
        </Section>
        <Section icon={Activity} title="Data Teknikal">
          <div className="space-y-1.5">{a.teknikal.map((m, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${dirBg(m.arah)}`}>
              <DirIcon a={m.arah} size={12} />
              <span className="text-[11px] font-semibold text-white/85">{m.nama}</span>
              {m.nilai && <span className="text-[11px] font-bold tabular-nums text-white/70">{m.nilai}</span>}
              <span className="text-[9px] text-white/40 flex-1 text-right leading-tight">{m.catatan}</span>
            </div>
          ))}</div>
        </Section>
      </div>

      {/* Level + Risiko */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Section icon={Layers} title="Level Kunci Saat Rilis">
          <div className="space-y-1 text-[11px]">
            <div className="flex gap-2"><span className="text-red-400/70 w-20 shrink-0">Resistance</span><span className="text-white/80">{a.levelKunci.resistance.join(' · ') || '—'}</span></div>
            <div className="flex gap-2"><span className="text-emerald-400/70 w-20 shrink-0">Support</span><span className="text-white/80">{a.levelKunci.support.join(' · ') || '—'}</span></div>
          </div>
        </Section>
        {a.risiko.length > 0 && (
          <Section icon={ShieldAlert} title="Risiko">
            <ul className="space-y-0.5">{a.risiko.map((r, i) => <li key={i} className="text-[11px] text-white/60 leading-snug flex gap-1.5"><span className="text-amber-400/70">⚠</span>{r}</li>)}</ul>
          </Section>
        )}
      </div>

      <p className="text-[9px] text-white/30 text-right">Diolah Claude dari data terminal + headline berita · {new Date(a.fetchedAt).toLocaleTimeString('id-ID')}. Masuk sebelum berita = risiko tinggi. Bukan nasihat keuangan.</p>
    </div>
  )
}
