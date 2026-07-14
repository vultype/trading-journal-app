'use client'

// Helper visual bersama untuk panel analisa AI terminal (Berita/Makro/Sentimen):
// bias bar bullish/bearish, ikon arah dampak ke emas, section, warna per arah.
import { TrendingUp, TrendingDown, MinusCircle } from 'lucide-react'

export type Dir = 'bullish' | 'bearish' | 'netral'

export const dirColor = (a: Dir | string) => a === 'bullish' ? 'text-emerald-400' : a === 'bearish' ? 'text-red-400' : 'text-white/50'
export const dirBg = (a: Dir | string) => a === 'bullish' ? 'bg-emerald-500/12 border-emerald-500/25' : a === 'bearish' ? 'bg-red-500/12 border-red-500/25' : 'bg-white/[0.03] border-white/10'

export function DirIcon({ a, size = 12 }: { a: Dir | string; size?: number }) {
  return a === 'bullish' ? <TrendingUp size={size} className="text-emerald-400" />
    : a === 'bearish' ? <TrendingDown size={size} className="text-red-400" />
      : <MinusCircle size={size} className="text-white/40" />
}

export function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2"><Icon size={12} /> {title}</p>
      {children}
    </div>
  )
}

// Bar bias bullish/bearish terhadap XAU/USD (hijau kiri = bullish, merah kanan = bearish)
export function BiasBar({ bullishPct }: { bullishPct: number }) {
  return (
    <div>
      <div className="relative h-7 rounded-lg overflow-hidden bg-red-500/20 flex">
        <div className="h-full bg-gradient-to-r from-emerald-500/70 to-emerald-400/70 flex items-center justify-start pl-2 transition-all" style={{ width: `${bullishPct}%` }}>
          {bullishPct >= 22 && <span className="text-[11px] font-black text-white">▲ {bullishPct}%</span>}
        </div>
        <div className="flex-1 flex items-center justify-end pr-2">
          {100 - bullishPct >= 22 && <span className="text-[11px] font-black text-red-300">{100 - bullishPct}% ▼</span>}
        </div>
      </div>
      <div className="flex justify-between text-[9px] font-semibold mt-1"><span className="text-emerald-400/80">BULLISH (emas naik)</span><span className="text-red-400/80">BEARISH (emas turun)</span></div>
    </div>
  )
}

// Kolom sentimen berita: headline mendukung emas vs menekan emas
export function NewsSentimentColumns({ mendukung, menentang }: { mendukung: string[]; menentang: string[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5">
        <p className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 mb-1.5"><TrendingUp size={12} /> Mendukung Emas Naik</p>
        {mendukung.length ? <ul className="space-y-1">{mendukung.map((h, i) => <li key={i} className="text-[10px] text-white/70 leading-snug flex gap-1.5"><span className="text-emerald-400/70 mt-0.5">+</span>{h}</li>)}</ul> : <p className="text-[10px] text-white/30">—</p>}
      </div>
      <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-2.5">
        <p className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 mb-1.5"><TrendingDown size={12} /> Menekan Emas</p>
        {menentang.length ? <ul className="space-y-1">{menentang.map((h, i) => <li key={i} className="text-[10px] text-white/70 leading-snug flex gap-1.5"><span className="text-red-400/70 mt-0.5">−</span>{h}</li>)}</ul> : <p className="text-[10px] text-white/30">—</p>}
      </div>
    </div>
  )
}

// Daftar faktor + dampak ke emas (arah/bobot/nilai/catatan)
export function FaktorRow({ nama, nilai, arah, bobot, catatan }: { nama: string; nilai?: string; arah: Dir; bobot?: string; catatan?: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${dirBg(arah)}`}>
      <DirIcon a={arah} size={13} />
      <span className="text-[11px] font-semibold text-white/85">{nama}</span>
      {nilai && <span className="text-[11px] font-bold tabular-nums text-white/70">{nilai}</span>}
      {bobot && <span className={`text-[8px] font-bold rounded px-1 py-0.5 ${bobot === 'Tinggi' ? 'bg-primary/20 text-primary' : bobot === 'Sedang' ? 'bg-white/10 text-white/60' : 'bg-white/5 text-white/40'}`}>{bobot}</span>}
      <span className="text-[9px] text-white/45 flex-1 text-right leading-tight">{catatan}</span>
    </div>
  )
}
