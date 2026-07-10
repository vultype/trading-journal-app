'use client'

import { useState } from 'react'
import { useLang } from '@/lib/i18n'
import { Card, CardContent } from '@/components/ui/card'
import {
  LayoutDashboard, TrendingUp, BarChart3, ClipboardList, FlaskConical,
  Wallet, BookOpen, Settings, ChevronDown, Rocket, Lightbulb, ShieldAlert,
} from 'lucide-react'

type Step = { q: string; a: string }
type Section = { icon: React.ElementType; color: string; title: string; steps: Step[] }
type Content = {
  pageTitle: string; pageSub: string
  introTitle: string; introBody: string
  tipsTitle: string; tips: string[]
  sections: Section[]
}

const ICONS = [Rocket, LayoutDashboard, TrendingUp, BarChart3, ClipboardList, FlaskConical, Wallet, BookOpen, Settings]
const COLORS = ['text-primary', 'text-blue-400', 'text-emerald-400', 'text-purple-400', 'text-amber-400', 'text-cyan-400', 'text-indigo-400', 'text-rose-400', 'text-slate-400']

const ID: Omit<Content, 'sections'> & { sections: Omit<Section, 'icon' | 'color'>[] } = {
  pageTitle: 'Panduan Penggunaan',
  pageSub: 'Cara pakai semua fitur di aplikasi jurnal trading ini',
  introTitle: 'Kenapa jurnal trading penting?',
  introBody: 'Trader konsisten bukan yang selalu profit, tapi yang mengevaluasi setiap keputusan. Aplikasi ini bantu kamu melacak performa, menemukan jam & strategi terbaik, dan menjaga disiplin lewat jurnal harian.',
  tipsTitle: 'Tips konsistensi',
  tips: [
    'Catat trade segera setelah selesai, jangan ditunda.',
    'Selalu isi jam entry agar analisa jam trading akurat.',
    'Jujur menandai overtrade — itu kunci evaluasi disiplin.',
    'Review jurnal mingguan tiap akhir pekan.',
  ],
  sections: [
    { title: 'Mulai Cepat', steps: [
      { q: '1. Isi saldo awal', a: 'Saat setup, isi Saldo Awal akun broker kamu. Ini jadi dasar perhitungan saldo & ROI.' },
      { q: '2. Catat trade pertama', a: 'Di Dashboard, isi form trade pertama: tanggal, pair, arah, hasil, dan P&L. Semua menu terbuka setelah ini.' },
      { q: '3. Lihat performa', a: 'Buka Dashboard untuk ringkasan, atau Analisis untuk insight (jam terbaik, strategi, psikologi).' },
    ] },
    { title: 'Dashboard', steps: [
      { q: 'Apa yang ditampilkan?', a: 'Ringkasan: saldo trading, total deposit, profit trading, win rate, profit factor, avg win, max drawdown, dan equity curve.' },
      { q: 'Target bulanan', a: 'Set target bulanan di Setting, progress bar muncul menunjukkan pencapaian bulan ini.' },
    ] },
    { title: 'Trade', steps: [
      { q: 'Menambah trade', a: 'Klik Catat Trade Baru. Masukkan P&L positif — tanda +/− otomatis dari pilihan Result.' },
      { q: 'Overtrade', a: 'Aktifkan toggle Overtrade untuk trade di luar plan. Saldo tetap berkurang, tapi TIDAK dihitung di statistik.' },
      { q: 'Filter & cari', a: 'Gunakan chips (Winners/Losers/Big Wins), dropdown, rentang tanggal, dan min profit / max loss.' },
      { q: 'Edit / hapus', a: 'Klik baris trade untuk buka detail. Ada tombol Edit dan Hapus di sana.' },
    ] },
    { title: 'Analisis', steps: [
      { q: 'Kalender P&L', a: 'P&L harian dalam kalender. Klik tanggal untuk lihat detail trade + jurnal hari itu.' },
      { q: 'Jam Trading', a: 'Analisa jam terbaik & terburuk. Klik kotak jam untuk detail, lihat performa per sesi (Asia/London/NY).' },
      { q: 'Strategi & Pair', a: 'Win rate dan P&L per strategi & pair untuk tahu mana yang paling menguntungkan.' },
      { q: 'Psikologi', a: 'Bandingkan hasil saat ikut plan vs tidak untuk evaluasi disiplin.' },
    ] },
    { title: 'Laporan', steps: [
      { q: 'Laporan mingguan', a: 'Rekap per minggu: total trade, win rate, profit factor, trade terbaik & terburuk.' },
    ] },
    { title: 'Simulator', steps: [
      { q: 'Untuk apa?', a: 'Latihan money management: simulasikan win/loss dengan risk-reward tertentu tanpa mempengaruhi data asli.' },
    ] },
    { title: 'Keuangan', steps: [
      { q: 'Murni catatan broker', a: 'Hanya mencatat dana di broker. Saldo Sekarang = Saldo Awal + Deposit − Withdraw + Profit Trading.' },
      { q: 'Deposit & Withdraw', a: 'Catat uang setor & tarik dari broker. Deposit BUKAN profit — profit hanya dari hasil trade.' },
      { q: 'Multi-akun', a: 'Punya beberapa akun? Pakai pemilih akun untuk lihat angka per akun atau gabungan.' },
    ] },
    { title: 'Jurnal', steps: [
      { q: 'Refleksi harian', a: 'Tulis catatan & pilih mood per hari. Jurnal terhubung otomatis dengan trade hari itu.' },
      { q: 'Edit & hapus', a: 'Jurnal bisa diedit kapan saja dan dihapus jika tidak diperlukan.' },
    ] },
    { title: 'Setting', steps: [
      { q: 'Bahasa, mata uang & target', a: 'Atur bahasa (ID/EN), mata uang, dan target harian/mingguan/bulanan.' },
      { q: 'Strategi & akun', a: 'Kelola daftar strategi dan akun broker kamu.' },
      { q: 'Backup', a: 'Export data ke JSON atau CSV untuk cadangan.' },
    ] },
  ],
}

const EN: typeof ID = {
  pageTitle: 'User Guide',
  pageSub: 'How to use every feature in this trading journal app',
  introTitle: 'Why is a trading journal important?',
  introBody: 'Consistent traders are not the ones who always profit, but the ones who evaluate every decision. This app helps you track performance, find your best hours & strategies, and stay disciplined through daily journaling.',
  tipsTitle: 'Consistency tips',
  tips: [
    'Log trades right after they close — don\'t postpone.',
    'Always fill in the entry time so hour analysis is accurate.',
    'Mark overtrades honestly — it\'s key to evaluating discipline.',
    'Review your weekly journal every weekend.',
  ],
  sections: [
    { title: 'Quick Start', steps: [
      { q: '1. Set starting balance', a: 'During setup, enter your broker account\'s starting balance. It becomes the basis for balance & ROI.' },
      { q: '2. Log your first trade', a: 'On the Dashboard, fill the first-trade form: date, pair, direction, result, and P&L. All menus unlock after this.' },
      { q: '3. Review performance', a: 'Open the Dashboard for a summary, or Analysis for insights (best hours, strategy, psychology).' },
    ] },
    { title: 'Dashboard', steps: [
      { q: 'What is shown?', a: 'Summary: trading balance, total deposit, trading profit, win rate, profit factor, avg win, max drawdown, and equity curve.' },
      { q: 'Monthly target', a: 'Set a monthly target in Settings and a progress bar shows this month\'s achievement.' },
    ] },
    { title: 'Trades', steps: [
      { q: 'Adding a trade', a: 'Click New Trade. Enter a positive P&L — the +/− sign follows the Result automatically.' },
      { q: 'Overtrade', a: 'Toggle Overtrade for trades outside your plan. Balance still drops, but it is NOT counted in stats.' },
      { q: 'Filter & search', a: 'Use chips (Winners/Losers/Big Wins), dropdowns, date range, and min profit / max loss.' },
      { q: 'Edit / delete', a: 'Click a trade row to open details. Edit and Delete buttons are there.' },
    ] },
    { title: 'Analysis', steps: [
      { q: 'P&L Calendar', a: 'Daily P&L in a calendar. Click a date to see trade details + that day\'s journal.' },
      { q: 'Trading Hours', a: 'Analyze best & worst hours. Click an hour box for details, view per-session performance (Asia/London/NY).' },
      { q: 'Strategy & Pair', a: 'Win rate and P&L per strategy & pair to see what is most profitable.' },
      { q: 'Psychology', a: 'Compare results when following your plan vs not, to evaluate discipline.' },
    ] },
    { title: 'Reports', steps: [
      { q: 'Weekly report', a: 'Weekly recap: total trades, win rate, profit factor, best & worst trades.' },
    ] },
    { title: 'Simulator', steps: [
      { q: 'What for?', a: 'Money-management practice: simulate wins/losses at a given risk-reward without affecting real data.' },
    ] },
    { title: 'Finance', steps: [
      { q: 'Pure broker log', a: 'Only records broker funds. Current Balance = Starting Balance + Deposit − Withdraw + Trading Profit.' },
      { q: 'Deposit & Withdraw', a: 'Record money in/out of your broker. A deposit is NOT profit — profit comes only from trades.' },
      { q: 'Multi-account', a: 'Have several accounts? Use the account picker to view per-account or combined figures.' },
    ] },
    { title: 'Journal', steps: [
      { q: 'Daily reflection', a: 'Write notes & pick a mood per day. The journal links automatically to that day\'s trades.' },
      { q: 'Edit & delete', a: 'Journals can be edited anytime and deleted when not needed.' },
    ] },
    { title: 'Settings', steps: [
      { q: 'Language, currency & targets', a: 'Set language (ID/EN), currency, and daily/weekly/monthly targets.' },
      { q: 'Strategies & accounts', a: 'Manage your strategy list and broker accounts.' },
      { q: 'Backup', a: 'Export data to JSON or CSV for backup.' },
    ] },
  ],
}

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
  const [lang] = useLang()
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  const c = lang === 'en' ? EN : ID
  const sections: Section[] = c.sections.map((s, i) => ({ ...s, icon: ICONS[i], color: COLORS[i] }))

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">{c.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{c.pageSub}</p>
      </div>

      {/* Intro */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="pt-5 pb-5 flex items-start gap-3">
          <Lightbulb size={20} className="text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">{c.introTitle}</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{c.introBody}</p>
          </div>
        </CardContent>
      </Card>

      {/* Accordions */}
      <div className="space-y-2.5">
        {sections.map((s, i) => (
          <Accordion key={i} section={s} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} />
        ))}
      </div>

      {/* Tips */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-5 pb-5 flex items-start gap-3">
          <ShieldAlert size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-amber-400">{c.tipsTitle}</p>
            <ul className="text-sm text-muted-foreground mt-1.5 space-y-1 list-disc list-inside leading-relaxed">
              {c.tips.map((tip, i) => <li key={i}>{tip}</li>)}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
