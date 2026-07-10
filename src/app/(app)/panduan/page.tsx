'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  LayoutDashboard, TrendingUp, BarChart3, ClipboardList, FlaskConical,
  Wallet, BookOpen, Settings, ChevronDown, Rocket, Lightbulb, ShieldAlert,
} from 'lucide-react'

type Section = {
  icon: React.ElementType
  title: string
  color: string
  steps: { q: string; a: string }[]
}

const SECTIONS: Section[] = [
  {
    icon: Rocket, title: 'Mulai Cepat', color: 'text-primary',
    steps: [
      { q: '1. Catat modal awal', a: 'Buka menu Keuangan → tab Catat Transfer → pilih Deposit, masukkan jumlah modal trading kamu. Ini jadi dasar perhitungan equity & ROI.' },
      { q: '2. Input trade pertama', a: 'Buka menu Trade → Add Trade. Isi tanggal, jam entry, pair, arah (long/short), hasil (win/loss/BE), dan nominal P&L.' },
      { q: '3. Lihat performa', a: 'Buka Dashboard untuk ringkasan, atau Analisis untuk insight mendalam (jam terbaik, strategi, psikologi).' },
    ],
  },
  {
    icon: LayoutDashboard, title: 'Dashboard', color: 'text-blue-400',
    steps: [
      { q: 'Apa yang ditampilkan?', a: 'Ringkasan cepat: modal aktif, net profit, total P&L, win rate, profit factor, avg win, max drawdown, dan equity curve total (modal + akumulasi P&L).' },
      { q: 'Target bulanan', a: 'Kalau kamu set target bulanan di Setting, progress bar akan muncul di Dashboard menunjukkan pencapaian bulan ini.' },
    ],
  },
  {
    icon: TrendingUp, title: 'Trade', color: 'text-emerald-400',
    steps: [
      { q: 'Menambah trade', a: 'Klik Add Trade. Masukkan angka P&L positif — tanda +/− otomatis mengikuti pilihan Result (win = +, loss = −).' },
      { q: 'Overtrade', a: 'Aktifkan toggle Overtrade untuk trade emosional/di luar plan. Equity tetap berkurang, tapi TIDAK dihitung di statistik (win rate, PF, dll).' },
      { q: 'Filter & cari', a: 'Gunakan filter chips (Winners/Losers/Big Wins), dropdown (Result/Type/Symbol/Strategy), rentang tanggal, dan min profit / max loss.' },
      { q: 'Edit / hapus', a: 'Klik salah satu baris trade untuk buka detail. Di sana ada tombol Edit dan Hapus.' },
    ],
  },
  {
    icon: BarChart3, title: 'Analisis', color: 'text-purple-400',
    steps: [
      { q: 'Kalender P&L', a: 'Melihat P&L harian dalam bentuk kalender. Klik tanggal untuk lihat detail trade + jurnal hari itu (bisa langsung ditulis/diedit).' },
      { q: 'Jam Trading', a: 'Analisa jam terbaik & terburuk berdasarkan waktu entry. Klik kotak jam untuk detail. Lihat juga performa per sesi market (Asia/London/NY).' },
      { q: 'Strategi & Pair', a: 'Win rate dan P&L per strategi dan per pair, untuk tahu mana yang paling menguntungkan.' },
      { q: 'Psikologi', a: 'Bandingkan hasil saat ikut plan vs tidak, dan saat yakin arah vs ragu — untuk evaluasi disiplin.' },
    ],
  },
  {
    icon: ClipboardList, title: 'Laporan', color: 'text-amber-400',
    steps: [
      { q: 'Laporan mingguan', a: 'Rekap performa per minggu: total trade, win rate, profit factor, trade terbaik & terburuk.' },
    ],
  },
  {
    icon: FlaskConical, title: 'Simulator', color: 'text-cyan-400',
    steps: [
      { q: 'Untuk apa?', a: 'Latihan money management: simulasikan hasil win/loss dengan risk-reward tertentu dan lihat dampaknya ke equity — tanpa mempengaruhi data trade asli.' },
    ],
  },
  {
    icon: Wallet, title: 'Keuangan', color: 'text-indigo-400',
    steps: [
      { q: 'Deposit & Withdraw', a: 'Catat setiap top-up modal (deposit) dan penarikan profit (withdraw). Ini yang membentuk perhitungan modal & ROI.' },
      { q: 'Per akun', a: 'Kalau punya beberapa akun broker, lihat saldo, deposit, P&L, dan withdraw masing-masing di tab Per Akun.' },
    ],
  },
  {
    icon: BookOpen, title: 'Jurnal', color: 'text-rose-400',
    steps: [
      { q: 'Refleksi harian', a: 'Tulis catatan & pilih mood per hari. Jurnal terhubung otomatis dengan trade hari itu — muncul juga di popup kalender Analisis.' },
      { q: 'Edit & hapus', a: 'Jurnal bisa diedit kapan saja dan dihapus jika tidak diperlukan.' },
    ],
  },
  {
    icon: Settings, title: 'Setting', color: 'text-slate-400',
    steps: [
      { q: 'Mata uang & target', a: 'Atur mata uang default (IDR/USD/dll) dan target harian/mingguan/bulanan.' },
      { q: 'Strategi & akun', a: 'Kelola daftar strategi dan akun trading kamu.' },
      { q: 'Backup', a: 'Export data ke JSON atau CSV untuk cadangan.' },
    ],
  },
]

function Accordion({ section, open, onToggle }: { section: Section; open: boolean; onToggle: () => void }) {
  const Icon = section.icon
  return (
    <Card className="overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left">
        <span className={`p-2 rounded-lg bg-muted/60 ${section.color}`}><Icon size={16} /></span>
        <span className="font-semibold text-sm flex-1">{section.title}</span>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <CardContent className="pt-0 pb-4 space-y-3 border-t border-border/30">
          {section.steps.map((s, i) => (
            <div key={i} className="pt-3">
              <p className="text-sm font-semibold text-foreground/90 mb-0.5">{s.q}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.a}</p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}

export default function PanduanPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">Panduan Penggunaan</h1>
        <p className="text-sm text-muted-foreground">Cara pakai semua fitur di aplikasi jurnal trading ini</p>
      </div>

      {/* Intro */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="pt-5 pb-5 flex items-start gap-3">
          <Lightbulb size={20} className="text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Kenapa jurnal trading penting?</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Trader konsisten bukan yang selalu profit, tapi yang <strong>mengevaluasi</strong> setiap keputusan.
              Aplikasi ini bantu kamu melacak performa, menemukan jam & strategi terbaik, dan menjaga disiplin lewat jurnal harian.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Accordions */}
      <div className="space-y-2.5">
        {SECTIONS.map((s, i) => (
          <Accordion key={s.title} section={s} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} />
        ))}
      </div>

      {/* Tips */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-5 pb-5 flex items-start gap-3">
          <ShieldAlert size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-amber-400">Tips konsistensi</p>
            <ul className="text-sm text-muted-foreground mt-1.5 space-y-1 list-disc list-inside leading-relaxed">
              <li>Catat trade segera setelah selesai, jangan ditunda.</li>
              <li>Selalu isi jam entry agar analisa jam trading akurat.</li>
              <li>Jujur menandai overtrade — itu kunci evaluasi disiplin.</li>
              <li>Review jurnal mingguan tiap akhir pekan.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
