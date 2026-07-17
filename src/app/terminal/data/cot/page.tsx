'use client'

// Halaman detail COT (Commitment of Traders) — Funds/Commercials/Retail sekaligus,
// 1 tahun mingguan (CFTC). Chart 3-jalur (beda dari FRED/market: mingguan, net posisi
// bukan harga) — pakai DetailMultiLineChart.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import { DetailMultiLineChart, Row, Stat, LockedTeaser, fmtDate, fmtDateShort, type ChartPoint } from '@/components/terminal/DetailChart'
import { ArrowLeft, Loader2, Users, Info, Check } from 'lucide-react'

type Group = { long: number; short: number; net: number; deltaNet: number }
type HistPoint = { date: string; value: number }
type Cot = {
  date: string; funds: Group; commercials: Group; retail: Group
  fundsHistory: number[]; retailHistory: number[]
  fundsHistoryFull: HistPoint[]; commercialsHistoryFull: HistPoint[]; retailHistoryFull: HistPoint[]
}

const kfmt = (n: number) => (n >= 0 ? '+' : '') + (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toFixed(0))

export default function CotDetailPage() {
  const router = useRouter()
  const sub = useSubscription()
  const [cot, setCot] = useState<Cot | null>(null)

  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace('/login?next=%2Fterminal%2Fdata%2Fcot')
  }, [sub.loading, sub.userId, router])

  useEffect(() => {
    if (!sub.isPro) return
    fetch('/api/terminal/cot').then(r => r.json()).then(d => { if (d && d.date) setCot(d) }).catch(() => {})
  }, [sub.isPro])

  if (sub.loading || !sub.userId) return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>
  if (!sub.isPro) return <LockedTeaser icon={Users} title="Detail COT — Retail vs Institusi" desc="Chart posisi Funds/Commercials/Retail 1 tahun + data historis — khusus langganan Pro." />

  if (!cot) return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>

  const series = [
    { name: 'Funds (Institusi)', color: '#34d399', data: cot.fundsHistoryFull.map(d => ({ label: fmtDateShort(d.date), value: d.value } as ChartPoint)) },
    { name: 'Commercials (Hedger)', color: '#60a5fa', data: cot.commercialsHistoryFull.map(d => ({ label: fmtDateShort(d.date), value: d.value } as ChartPoint)) },
    { name: 'Retail', color: '#a78bfa', data: cot.retailHistoryFull.map(d => ({ label: fmtDateShort(d.date), value: d.value } as ChartPoint)) },
  ]
  const conflict = cot.funds.net * cot.retail.net < 0

  return (
    <div className="min-h-screen bg-[#060a09] text-white">
      <header className="sticky top-0 z-30 bg-[#060a09]/95 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
          <Link href="/terminal" className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors shrink-0"><ArrowLeft size={15} /> Kembali ke Terminal</Link>
          <span className="w-px h-4 bg-white/10 shrink-0" />
          <span className="flex items-center gap-1.5 text-sm font-bold shrink-0"><Users size={14} className="text-primary" /> COT — Retail vs Institusi</span>
          <span className="ml-auto text-[10px] text-white/35 shrink-0">Rilis {fmtDate(cot.date)}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-wrap gap-2">
            <p className="text-sm font-bold flex items-center gap-2">Posisi Net (kontrak) — 1 Tahun <span className="text-[9px] font-semibold text-white/30 normal-case">CFTC · mingguan</span></p>
            <div className="flex items-center gap-3 text-[10px]">
              {series.map(s => <span key={s.name} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.name}</span>)}
            </div>
          </div>
          <div className="p-3">
            <DetailMultiLineChart series={series} height={340} />
          </div>
        </div>

        {/* 3 kartu ringkasan posisi terbaru */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat label="Funds (Institusi)" value={kfmt(cot.funds.net)} tone={cot.funds.net >= 0 ? 'up' : 'down'} sub={`Δ${kfmt(cot.funds.deltaNet)} minggu ini · smart money`} />
          <Stat label="Commercials (Hedger)" value={kfmt(cot.commercials.net)} tone={cot.commercials.net >= 0 ? 'up' : 'down'} sub={`Δ${kfmt(cot.commercials.deltaNet)} minggu ini · produsen/bank`} />
          <Stat label="Retail" value={kfmt(cot.retail.net)} tone="neutral" sub={`Δ${kfmt(cot.retail.deltaNet)} minggu ini · sering kontrarian`} />
        </div>

        {conflict && (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 p-4">
            <span className="text-amber-400 text-sm mt-0.5">⚠</span>
            <p className="text-[12px] text-amber-200/90 leading-relaxed">Institusi & Retail sedang <b>berlawanan arah</b> — institusi {cot.funds.net >= 0 ? 'net long' : 'net short'}, retail {cot.retail.net >= 0 ? 'net long' : 'net short'}. Kondisi ini historisnya condong mengikuti arah institusi (smart money).</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/[0.07] bg-[#0b100e] p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">Rincian Posisi (kontrak)</p>
            <div className="space-y-1.5">
              <Row l="Funds — Long" v={cot.funds.long.toLocaleString('id-ID')} />
              <Row l="Funds — Short" v={cot.funds.short.toLocaleString('id-ID')} />
              <Row l="Commercials — Long" v={cot.commercials.long.toLocaleString('id-ID')} />
              <Row l="Commercials — Short" v={cot.commercials.short.toLocaleString('id-ID')} />
              <Row l="Retail — Long" v={cot.retail.long.toLocaleString('id-ID')} />
              <Row l="Retail — Short" v={cot.retail.short.toLocaleString('id-ID')} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="flex items-center gap-2 text-sm font-black mb-2"><Info size={15} className="text-primary" /> Cara Baca COT</p>
            <div className="text-[13px] text-white/60 leading-relaxed space-y-2">
              <p><b className="text-emerald-400">Funds (Non-Commercial)</b> = hedge fund & spekulan besar, trend-follower. Posisinya sering dianggap "smart money" karena berbasis analisa fundamental & teknikal profesional.</p>
              <p><b className="text-sky-400">Commercials</b> = produsen & bank (hedger) — sering di sisi berlawanan Funds karena tujuannya lindung nilai, bukan spekulasi. Ekstrem posisi Commercials kadang jadi sinyal kontrarian yang kuat.</p>
              <p><b className="text-violet-400">Retail (Non-Reportable)</b> = trader kecil. Historisnya sering salah arah di titik ekstrem — kalau posisinya berlawanan dengan Funds, banyak trader condong mengikuti arah Funds.</p>
              <p className="text-white/40 text-[11px] pt-1">Data mingguan (rilis Jumat, lagging beberapa hari) — konteks strategis, bukan sinyal entry harian.</p>
            </div>
            <div className="flex items-start gap-2 mt-4 pt-4 border-t border-white/[0.06]">
              <Check size={14} className="text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] text-white/45 leading-relaxed">Terminal sudah memasukkan posisi Funds ke skor pilar Sentimen — lihat kartu &quot;Kesimpulan Sentimen&quot; di tab Sentimen.</p>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-white/25 pt-1">Data resmi CFTC (Commodity Futures Trading Commission). Bukan nasihat keuangan.</p>
      </main>
    </div>
  )
}
