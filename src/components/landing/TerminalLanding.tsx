'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { BrandLogo } from '@/components/layout/BrandLogo'
import {
  Sparkles, Brain, ArrowRight, ChevronDown, ShieldCheck, Check, Star, Quote,
  Compass, Landmark, Newspaper, Bell, Target, MessageSquare, TrendingUp,
  BookOpen, FlaskConical, LineChart, Calculator, Layers, Globe,
  X, Zap,
} from 'lucide-react'

const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID')
const TERMINAL_PRICE = 179000

// Platform/broker tempat trader kami berasal — sinyal kepercayaan (bukan klaim kemitraan resmi).
const CLIENTS = ['Exness', 'XM', 'IC Markets', 'FTMO', 'Pepperstone', 'OANDA', 'Binance', 'Bybit', 'MIFX', 'FundedNext', 'Octa', 'Deriv']
// Sumber data yang benar-benar dipakai terminal.
const DATA_SOURCES = ['Twelve Data', 'FRED (The Fed)', 'CFTC', 'TradingView']

// Angka nyata dari sistem yang berjalan — bukan klaim marketing.
const STATS = [
  { v: '8 detik', l: 'Harga emas diperbarui — nyaris real-time' },
  { v: '10.000+', l: 'Pembaruan data pasar setiap hari' },
  { v: '12+', l: 'Indikator ekonomi resmi AS dipantau' },
  { v: '3 → 1', l: 'Teknikal, makro & sentimen jadi satu kesimpulan' },
]
// Perbandingan cara lama vs dengan Datalitiq (section konversi)
const OLD_WAY = [
  '5–6 layar terbuka: chart, berita, kalender ekonomi, grup sinyal',
  'Berjam-jam menyusun analisa sebelum berani entry',
  'Sinyal saling bertentangan — akhirnya balik ke feeling',
  'FOMO masuk saat berita, tanpa paham konteksnya',
  'Tidak ada yang mengingatkan saat kondisi pasar berubah',
]
const NEW_WAY = [
  'Satu layar: arah pasar, tingkat keyakinan & alasannya',
  'Kesimpulan siap dalam hitungan detik, diperbarui otomatis',
  'Tiga sisi analisa ditimbang objektif oleh AI — bukan emosi',
  'Dampak berita & data ekonomi ke emas dijelaskan langsung',
  'Notifikasi otomatis saat pasar mulai bergerak signifikan',
]

const PROBLEMS = [
  { icon: Layers, t: 'Terlalu Banyak Layar, Terlalu Sedikit Kejelasan', d: 'Chart di satu tab, berita di tab lain, kalkulasi manual di tab ketiga. Semakin banyak yang dibuka, semakin sulit melihat gambaran besarnya.', tags: ['Informasi berserakan', 'Waktu habis menyusun'] },
  { icon: Compass, t: 'Sinyal yang Saling Bertentangan', d: 'Harga menunjukkan potensi naik, tapi kondisi ekonomi mengarah sebaliknya. Tanpa cara menimbang keduanya, keputusan kembali jadi tebakan.', tags: ['Analisa terpisah-pisah', 'Tak ada kesimpulan tunggal'] },
  { icon: Brain, t: 'Emosi Mengambil Alih Saat Ragu', d: 'Saat tidak yakin, keputusan jadi reaktif — masuk terlalu cepat, keluar terlalu panik. Bukan kurang disiplin, tapi tak ada pegangan yang jelas.', tags: ['Keputusan reaktif', 'Sulit konsisten'] },
]

const STEPS = [
  { icon: Globe, t: 'Memantau Pasar Real-Time', d: 'Pergerakan harga, kondisi ekonomi global, dan sentimen pasar dipantau terus-menerus sepanjang hari.' },
  { icon: Layers, t: 'Menimbang Tiga Sisi Sekaligus', d: 'Arah harga, kondisi makro (bank sentral, nilai tukar, suku bunga), dan sentimen pelaku pasar — ditimbang bersamaan, bukan terpisah.' },
  { icon: ShieldCheck, t: 'Menyaring Arah yang Valid', d: 'Sinyal jangka pendek dibandingkan dengan tren besar, supaya kesimpulan tidak melawan arus utama pasar.' },
  { icon: Target, t: 'Menyampaikan Kesimpulan Jelas', d: 'Hasilnya bukan data mentah, tapi kesimpulan yang langsung dipahami: arah pasar, tingkat keyakinan, dan alasannya.' },
]

// Fitur dengan penjelasan lengkap (section zigzag)
const FEATURE_ROWS: { icon: React.ElementType; kicker: string; t: string; d: string; bullets: string[]; visual: string }[] = [
  { icon: Brain, kicker: 'Keputusan AI', t: 'Satu Kesimpulan Jelas, Bukan Puluhan Angka', d: 'Setiap saat, AI menimbang seluruh kondisi pasar lalu menyimpulkannya jadi satu keputusan yang bisa langsung Anda pahami: beli, jual, atau tunggu — lengkap dengan tingkat keyakinan dan alasan di baliknya.', bullets: ['Arah + tingkat keyakinan dalam satu tampilan', 'Alasan transparan, bukan kotak hitam', 'Rencana masuk, batas risiko & target disertakan'], visual: 'decision' },
  { icon: Compass, kicker: 'Kondisi Pasar', t: 'Tahu Kapan Pasar Layak Ditradingkan', d: 'Tidak semua jam layak untuk masuk pasar. Terminal membaca kondisi pasar secara langsung — sedang bergerak searah, sedang ragu, atau sedang diam — supaya Anda tahu kapan agresif dan kapan menahan diri.', bullets: ['Status pasar real-time: trending, konfirmasi, atau ranging', 'Peringatan dini saat arah mulai berbalik', 'Ukuran volatilitas: kapan pergerakan cukup besar untuk masuk'], visual: 'gauge' },
  { icon: Landmark, kicker: 'Ekonomi Global', t: 'Paham Kenapa Emas Bergerak, Bukan Cuma Ke Mana', d: 'Harga emas digerakkan kebijakan bank sentral, nilai dolar, dan data ekonomi besar. Semua itu dipantau dari sumber resmi dan dijelaskan dampaknya ke emas — dalam bahasa yang manusiawi.', bullets: ['12+ indikator ekonomi resmi AS dipantau otomatis', 'Dampak tiap rilis data dijelaskan: dukung atau tekan emas', 'Nada kebijakan The Fed dibaca dari data & pernyataan resmi'], visual: 'macro' },
  { icon: Newspaper, kicker: 'Sentimen & Posisi Institusi', t: 'Lihat Apa yang Dilakukan Uang Besar', d: 'Pergerakan besar dimulai dari institusi. Terminal membaca posisi dana besar vs trader ritel setiap minggu, plus sentimen berita terkini — supaya Anda tidak berdiri di sisi yang salah.', bullets: ['Posisi institusi global, diperbarui mingguan (sumber resmi)', 'Berita emas & dolar dirangkum dampaknya oleh AI', 'Indikator “pasar takut vs serakah” yang mudah dibaca'], visual: 'sentiment' },
  { icon: MessageSquare, kicker: 'Tanya AI', t: 'Analisa Sesuai Situasi Anda', d: 'Setiap trader punya konteks berbeda. Ajukan pertanyaan spesifik — “layak masuk sekarang?”, “level aman di mana?” — dan AI menjawab berdasarkan data pasar saat itu juga, bukan template.', bullets: ['Jawaban berbasis data live, bukan jawaban umum', 'Bisa fokus ke sesi, level, atau rilis berita tertentu', 'Tersedia di setiap halaman analisa'], visual: 'chat' },
  { icon: Bell, kicker: 'Notifikasi', t: 'Pasar Dipantau, Anda Tidak Harus Standby', d: 'Sistem memeriksa kondisi pasar setiap beberapa menit, sepanjang hari. Saat pasar mulai bergerak searah dengan keyakinan tinggi, notifikasi masuk ke Telegram Anda — bukan spam, hanya saat kondisi berubah.', bullets: ['Notifikasi saat tren baru terkonfirmasi + % keyakinan', 'Sinyal “layak dicermati” saat semua kondisi selaras', 'Anti-spam: hanya saat kondisi benar-benar berubah'], visual: 'notif' },
]

const BONUS = [
  { icon: BookOpen, t: 'Jurnal Trading', d: 'Catat & evaluasi setiap trade.' },
  { icon: FlaskConical, t: 'Simulator Backtest', d: 'Uji strategi tanpa risiko.' },
  { icon: LineChart, t: 'Trading Projection Tools', d: 'Proyeksikan target & skenario.' },
  { icon: Calculator, t: 'Risk Management Calculator', d: 'Hitung lot & risiko presisi.' },
]

const TESTIMONIALS = [
  { name: 'Arif R.', role: 'Trader XAU/USD', text: 'Dulu saya buka lima chart dan tiga situs berita sekaligus. Sekarang cukup satu layar — arah pasar dan alasannya langsung jelas.' },
  { name: 'Nadia K.', role: 'Swing Trader', text: 'Yang saya suka, AI-nya nggak cuma bilang beli atau jual — tapi kasih alasannya. Jadi saya paham, bukan sekadar ikut-ikutan.' },
  { name: 'Bagus P.', role: 'Trader Pemula', text: 'Buat saya yang masih belajar, ini jauh lebih mudah dipahami daripada belajar indikator satu-satu. Bahasanya manusiawi.' },
  { name: 'Dimas W.', role: 'Part-time Trader', text: 'Notifikasinya tepat waktu. Saya nggak perlu melototin chart seharian, tapi tetap tahu kalau kondisi pasar berubah.' },
  { name: 'Sari M.', role: 'Trader Harian', text: 'Analisa makronya membantu banget. Saya jadi ngerti kenapa emas bergerak, bukan cuma lihat candle.' },
  { name: 'Yoga A.', role: 'Prop Firm Trader', text: 'Transparan. Setiap kesimpulan ada dasarnya, jadi saya lebih percaya diri ambil keputusan.' },
]

const FAQS = [
  { q: 'Apakah ini sinyal trading otomatis?', a: 'Bukan. Datalitiq AI memberikan analisa dan kesimpulan untuk membantu pengambilan keputusan — bukan mengeksekusi transaksi otomatis. Keputusan akhir tetap sepenuhnya di tangan Anda.' },
  { q: 'Apakah datanya benar-benar real-time?', a: 'Ya. Seluruh data pasar, ekonomi, dan sentimen diperbarui secara berkala sepanjang hari dari sumber resmi.' },
  { q: 'Saya belum berpengalaman, apakah tetap bisa memahami hasilnya?', a: 'Bisa. Kesimpulan disampaikan dalam bahasa yang mudah dipahami — arah pasar, tingkat keyakinan, dan alasannya — tanpa perlu memahami indikator teknikal secara mendalam.' },
  { q: 'Kenapa fokus hanya pada emas (XAU/USD)?', a: 'Fokus pada satu instrumen memungkinkan analisa yang lebih dalam dan akurat, dibanding mencakup banyak instrumen sekaligus secara dangkal.' },
  { q: 'Bagaimana cara pembayarannya?', a: 'Melalui transfer bank. Setelah transfer dan diverifikasi, akses Terminal terbuka otomatis untuk akun Anda.' },
]

// ── Reveal on scroll ──
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect() } }, { threshold: 0.1 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}>
      {children}
    </div>
  )
}

// ── Hero chart: chart emas animasi (garis menggambar sendiri + harga berdetak) ──
function HeroChart() {
  const [price, setPrice] = useState(4032.4)
  const [up, setUp] = useState(true)
  useEffect(() => {
    const id = setInterval(() => {
      setPrice(p => { const d = (Math.random() - 0.48) * 0.9; setUp(d >= 0); return +(p + d).toFixed(1) })
    }, 1600)
    return () => clearInterval(id)
  }, [])
  // jalur harga bergaya XAU/USD: naik bertahap dengan pullback
  const line = 'M0,150 L28,143 L52,148 L76,132 L98,138 L122,118 L146,126 L170,104 L192,112 L216,88 L240,96 L264,72 L288,80 L312,58 L336,66 L360,44 L384,52 L408,34'
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a1210] shadow-2xl shadow-black/60 overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
        <span className="w-3 h-3 rounded-full bg-red-500/50" /><span className="w-3 h-3 rounded-full bg-yellow-500/50" /><span className="w-3 h-3 rounded-full bg-emerald-500/50" />
        <span className="ml-3 text-[10px] text-white/30 font-mono">datalitiq.app/terminal</span>
        <span className="ml-auto flex items-center gap-1 text-[9px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dtq-pulse" /> LIVE</span>
      </div>
      <div className="p-4 bg-[#0a1210]">
        <div className="flex items-center justify-between mb-3">
          <div><p className="text-[10px] text-white/40">XAU/USD · Emas Spot</p>
            <p className="text-2xl font-black tabular-nums">${price.toLocaleString('en-US', { minimumFractionDigits: 1 })}<span className={`text-xs font-bold ml-2 ${up ? 'text-emerald-400' : 'text-red-400'}`}>{up ? '▲' : '▼'} live</span></p></div>
          <span className="text-[9px] font-bold uppercase tracking-wider rounded px-2 py-1 bg-emerald-500/15 text-emerald-400">Trending Bullish</span>
        </div>
        <div className="relative rounded-xl border border-white/[0.06] bg-black/25 overflow-hidden">
          <svg viewBox="0 0 408 180" className="w-full block" preserveAspectRatio="none">
            <defs>
              <linearGradient id="hcArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity="0.28" /><stop offset="100%" stopColor="#34d399" stopOpacity="0" /></linearGradient>
            </defs>
            {[36, 72, 108, 144].map(y => <line key={y} x1="0" y1={y} x2="408" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />)}
            {[68, 136, 204, 272, 340].map(x => <line key={x} x1={x} y1="0" x2={x} y2="180" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />)}
            <path d={`${line} L408,180 L0,180 Z`} fill="url(#hcArea)" className="dl-hero-area" />
            <path d={line} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="dl-hero-line" pathLength={1} />
            <circle cx="408" cy="34" r="4" fill="#34d399" className="dl-hero-dot"><animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite" /></circle>
            <circle cx="408" cy="34" r="9" fill="#34d399" opacity="0.18"><animate attributeName="r" values="7;13;7" dur="1.6s" repeatCount="indefinite" /></circle>
          </svg>
          {/* garis harga berjalan */}
          <div className="absolute right-0 top-[15%] flex items-center gap-1.5">
            <span className="h-px w-16 bg-emerald-400/40" />
            <span className="rounded bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-black text-[#062016] tabular-nums">{price.toFixed(1)}</span>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-gradient-to-br from-primary/12 to-transparent border border-primary/20 p-3 flex items-start gap-2.5">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20 shrink-0"><Brain size={14} className="text-primary" /></span>
          <div>
            <p className="text-[10px] font-bold text-white/85">Datalitiq AI · Kesimpulan <span className="ml-1 text-emerald-400">Bias Bullish · 74%</span></p>
            <p className="text-[10px] text-white/55 leading-relaxed">Tren naik didukung dolar melemah. Cari peluang beli di area pullback; hindari melawan arah utama.</p>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes dlHeroLine { from { stroke-dasharray: 1; stroke-dashoffset: 1 } to { stroke-dasharray: 1; stroke-dashoffset: 0 } }
        .dl-hero-line { animation: dlHeroLine 2.4s cubic-bezier(0.65,0,0.35,1) both }
        @keyframes dlHeroArea { from { opacity: 0 } to { opacity: 1 } }
        .dl-hero-area { animation: dlHeroArea 1s ease-out 1.6s both }
        @keyframes dlHeroDot { from { opacity: 0 } to { opacity: 1 } }
        .dl-hero-dot { animation: dlHeroDot .4s ease-out 2.2s both }
        @media (prefers-reduced-motion: reduce) { .dl-hero-line, .dl-hero-area, .dl-hero-dot { animation: none } }
      `}</style>
    </div>
  )
}

// ── Bingkai visual fitur (dipakai section fitur zigzag) ──
function FeatureFrame({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-5 hover:border-primary/30 transition-colors">
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.028) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
      <div className="absolute -top-12 -right-10 w-40 h-40 rounded-full bg-primary/15 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/12 ring-1 ring-primary/25"><Icon size={14} className="text-primary" /></span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/55">{title}</span>
          <span className="ml-auto flex items-center gap-1 text-[8px] font-bold text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dtq-pulse" /> LIVE</span>
        </div>
        <div className="flex items-center justify-center min-h-[130px]">{children}</div>
      </div>
    </div>
  )
}
function MGauge() {
  return (
    <svg viewBox="0 0 160 94" className="w-full max-w-[220px]">
      <defs><linearGradient id="tlgg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#f87171" /><stop offset="55%" stopColor="#9ca3af" /><stop offset="100%" stopColor="#34d399" /></linearGradient></defs>
      <path d="M14 84 A66 66 0 0 1 146 84" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
      <path d="M14 84 A66 66 0 0 1 132 44" fill="none" stroke="url(#tlgg)" strokeWidth="8" strokeLinecap="round" />
      <line x1="80" y1="84" x2="120" y2="42" stroke="#fff" strokeWidth="3" strokeLinecap="round" /><circle cx="80" cy="84" r="5" fill="#fff" />
      <text x="80" y="72" textAnchor="middle" fill="#34d399" fontSize="15" fontWeight="800">BULLISH</text>
    </svg>
  )
}
function MDecision() {
  return (
    <div className="w-full flex items-center gap-4">
      <div className="relative w-16 h-16 shrink-0">
        <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" /><circle cx="18" cy="18" r="15" fill="none" stroke="#34d399" strokeWidth="3.5" strokeDasharray="70 94" strokeLinecap="round" /></svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-emerald-400">74%</span>
      </div>
      <div className="space-y-2 flex-1">
        <span className="inline-flex text-[10px] font-black text-emerald-400 bg-emerald-500/10 rounded px-2 py-0.5">BIAS BULLISH</span>
        <div className="h-1.5 w-full rounded bg-emerald-400/70" />
        <div className="h-1.5 w-3/4 rounded bg-white/15" />
        <div className="h-1.5 w-2/3 rounded bg-white/10" />
      </div>
    </div>
  )
}
function MMacro() {
  const rows = [{ l: 'Dolar (DXY)', v: '▼ Bullish emas', c: 'text-emerald-400' }, { l: 'Yield 10Y', v: '▼ Bullish emas', c: 'text-emerald-400' }, { l: 'Nada Fed', v: '• Netral', c: 'text-amber-400' }]
  return <div className="w-full space-y-1.5">{rows.map(r => <div key={r.l} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5"><span className="text-[10px] text-white/70">{r.l}</span><span className={`text-[9px] font-bold ${r.c}`}>{r.v}</span></div>)}</div>
}
function MSentiment() {
  return (
    <div className="w-full space-y-3">
      <div><p className="text-[9px] text-white/40 mb-1">Institusi · net long</p><div className="h-2 rounded-full bg-white/5 overflow-hidden"><div className="h-full w-4/5 rounded-full bg-emerald-400/70" /></div></div>
      <div><p className="text-[9px] text-white/40 mb-1">Retail · net short</p><div className="h-2 rounded-full bg-white/5 overflow-hidden"><div className="h-full w-1/3 rounded-full bg-red-400/70" /></div></div>
    </div>
  )
}
function MChat() {
  return (
    <div className="w-full space-y-2">
      <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-primary/15 border border-primary/20 px-3 py-2 text-[10px] text-white/85">Layak entry sekarang, atau tunggu pullback?</div>
      <div className="max-w-[90%] rounded-xl rounded-tl-sm bg-white/[0.04] border border-white/10 px-3 py-2 text-[10px] text-white/65 leading-relaxed"><b className="text-primary">Datalitiq AI:</b> Tren naik masih sehat, tapi harga sedang di dekat area resistensi. Lebih aman menunggu pullback ke area support terdekat…</div>
    </div>
  )
}
function MNotif() {
  return (
    <div className="w-full rounded-xl bg-white/[0.03] border border-white/5 p-3">
      <div className="flex items-center gap-2 mb-1.5"><span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/20"><Bell size={12} className="text-primary" /></span><span className="text-[10px] font-bold text-white/80">Datalitiq Alert</span><span className="ml-auto text-[8px] text-white/30">baru saja</span></div>
      <p className="text-[10px] text-white/60 leading-relaxed">🟢 <b className="text-white/85">Trending Bullish</b> — keyakinan 74%. Peluang beli terkonfirmasi.</p>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="text-sm font-semibold text-white">{q}</span>
        <ChevronDown size={16} className={`text-white/50 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-5 pb-4 text-sm text-white/60 leading-relaxed">{a}</p>}
    </div>
  )
}

export function TerminalLanding() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.from('app_config').select('logo_url').eq('id', 1).maybeSingle().then(({ data }) => setLogoUrl((data?.logo_url as string | null) ?? null))
    sb.auth.getSession().then(({ data }) => setLoggedIn(!!data.session))
  }, [])

  const checkoutHref = loggedIn ? '/checkout?plan=terminal&months=1' : `/login?next=${encodeURIComponent('/checkout?plan=terminal&months=1')}`
  const primaryCta = loggedIn ? '/terminal' : checkoutHref

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#060a09]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {logoUrl ? <BrandLogo url={logoUrl} /> : <span className="text-xl font-black tracking-tight">Datalitiq</span>}
            <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-widest text-primary/80 bg-primary/10 rounded-full px-2 py-0.5">AI Terminal</span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm text-white/60">
            <a href="#cara-kerja" className="hover:text-white transition-colors">Cara Kerja</a>
            <a href="#fitur" className="hover:text-white transition-colors">Fitur</a>
            <a href="#testimoni" className="hover:text-white transition-colors">Testimoni</a>
            <a href="#harga" className="hover:text-white transition-colors">Harga</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/jurnal-trading-tools" className="hidden lg:block text-xs font-medium text-white/40 hover:text-white/70 px-2 py-2 transition-colors">Jurnal Tools</Link>
            <Link href="/login" className="hidden sm:block text-sm font-medium text-white/70 hover:text-white px-3 py-2 transition-colors">Masuk</Link>
            <Link href={primaryCta} className="text-sm font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">{loggedIn ? 'Buka Terminal' : 'Mulai'}</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative">
        <div className="absolute inset-0 pointer-events-none opacity-50" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '56px 56px', WebkitMaskImage: 'radial-gradient(ellipse 85% 65% at 50% 0%, #000 40%, transparent 100%)', maskImage: 'radial-gradient(ellipse 85% 65% at 50% 0%, #000 40%, transparent 100%)' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[560px] bg-primary/15 blur-[150px] rounded-full pointer-events-none dtq-pulse" />
        <div className="absolute top-40 right-0 w-72 h-72 bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-5 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 ring-1 ring-primary/25 px-3 py-1 text-xs font-semibold text-primary mb-6">
              <Sparkles size={13} /> AI Market Intelligence · Analisa XAU/USD
            </span>
            <h1 className="text-4xl md:text-[3.4rem] font-black tracking-tight leading-[1.05]">
              Berhenti Trading Pakai Feeling.<br />
              <span className="bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 bg-clip-text text-transparent">Mulai Trading dengan Data yang Mudah Dipahami.</span>
            </h1>
            <p className="text-base text-white/60 mt-5 leading-relaxed max-w-lg">
              Datalitiq AI membaca ribuan titik data — harga, ekonomi global, sentimen pasar — lalu menyimpulkannya untuk Anda: <span className="text-white/85 font-semibold">arah pasar, tingkat keyakinan, dan alasannya.</span> Dipahami dalam 5 detik, bukan 5 jam.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-7">
              <Link href={primaryCta} className="group inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-semibold hover:opacity-90 transition-all shadow-xl shadow-primary/25 hover:shadow-primary/40">
                {loggedIn ? 'Buka Terminal' : `Mulai — ${rp(TERMINAL_PRICE)}/bln`} <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a href="#cara-kerja" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 transition-colors">Lihat Cara Kerja</a>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              {[{ icon: Zap, t: 'Harga di-update tiap 8 detik' }, { icon: Landmark, t: '12+ indikator ekonomi resmi' }, { icon: Globe, t: 'Posisi institusi global mingguan' }].map(c => (
                <span key={c.t} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold text-white/60"><c.icon size={11} className="text-primary" /> {c.t}</span>
              ))}
            </div>
            <p className="text-xs text-white/40 mt-4 flex items-center gap-1.5"><ShieldCheck size={13} className="text-primary" /> Data real-time · Bukan sinyal otomatis · Keputusan tetap di tangan Anda</p>
          </Reveal>
          <Reveal delay={150} className="lg:pl-6">
            <div className="relative">
              <HeroChart />
              <div className="absolute -left-4 top-14 hidden sm:flex items-center gap-2 rounded-xl bg-[#0d1614] ring-1 ring-emerald-500/30 px-3 py-2 shadow-xl dtq-float">
                <TrendingUp size={15} className="text-emerald-400" /><span className="text-xs font-semibold">Arah + alasan jelas</span>
              </div>
              <div className="absolute -right-3 bottom-16 hidden sm:flex items-center gap-2 rounded-xl bg-[#0d1614] ring-1 ring-primary/30 px-3 py-2 shadow-xl dtq-float2">
                <Brain size={15} className="text-primary" /><span className="text-xs font-semibold">Ditemani AI</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Client trust slider ── */}
      <section className="border-y border-white/5 bg-white/[0.015] py-6 overflow-hidden">
        <p className="text-center text-xs text-white/30 mb-4 uppercase tracking-widest">Dipakai trader dari berbagai broker & platform</p>
        <div className="relative">
          <div className="flex gap-12 w-max dtq-marquee">
            {[...CLIENTS, ...CLIENTS].map((b, i) => <span key={i} className="text-sm font-bold text-white/25 whitespace-nowrap">{b}</span>)}
          </div>
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#060a09] to-transparent" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#060a09] to-transparent" />
        </div>
        <p className="text-center text-[10px] text-white/25 mt-5">Ditenagai data resmi: <span className="text-white/40">{DATA_SOURCES.join(' · ')}</span></p>
      </section>

      {/* ── Stats ── */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s, i) => (
            <Reveal key={i} delay={i * 80}>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-center h-full">
                <p className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">{s.v}</p>
                <p className="text-xs text-white/45 mt-1">{s.l}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal><p className="text-center text-[10px] text-white/30 mt-4">Angka nyata dari sistem yang berjalan — kecepatan refresh & cakupan sumber data aktual, bukan klaim marketing.</p></Reveal>
      </section>

      {/* ── Problem ── */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">Masalahnya Bukan Kurang Data.<br className="hidden md:block" /> Tapi Tak Ada Waktu Membacanya Semua.</h2>
            <p className="text-sm text-white/50 mt-3">Market bergerak karena ratusan faktor sekaligus. Membacanya sendirian, secara manual, adalah alasan utama keputusan trading meleset.</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {PROBLEMS.map((it, i) => (
            <Reveal key={i} delay={i * 120}>
              <div className="h-full rounded-2xl border border-white/8 bg-white/[0.02] p-6 hover:border-primary/25 transition-colors">
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/12 ring-1 ring-primary/20 mb-4"><it.icon size={20} className="text-primary" /></span>
                <p className="text-base font-bold text-white mb-2">{it.t}</p>
                <p className="text-sm text-white/55 leading-relaxed mb-4">{it.d}</p>
                <div className="flex flex-wrap gap-1.5">{it.tags.map(tag => <span key={tag} className="text-[10px] font-semibold text-primary/80 bg-primary/10 rounded-full px-2 py-0.5">{tag}</span>)}</div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={150}>
          <div className="mt-8 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 to-transparent p-6 text-center">
            <Quote size={20} className="text-primary/60 mx-auto mb-2" />
            <p className="text-base md:text-lg font-semibold text-white/90 max-w-3xl mx-auto leading-relaxed">Trader yang unggul bukan yang punya lebih banyak informasi — tapi yang punya cara paling jelas untuk menyederhanakannya.</p>
          </div>
        </Reveal>
      </section>

      {/* ── Perbandingan (konversi) ── */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Sebelum & Sesudah</span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">Cara Lama Melelahkan.<br className="hidden md:block" /> Cara Baru Menjelaskan.</h2>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-5">
          <Reveal>
            <div className="h-full rounded-2xl border border-white/10 bg-white/[0.02] p-7">
              <p className="text-xs font-bold text-white/45 uppercase tracking-widest mb-5">Tanpa Datalitiq</p>
              <ul className="space-y-3.5">
                {OLD_WAY.map(x => <li key={x} className="flex items-start gap-2.5 text-sm text-white/55"><span className="shrink-0 mt-0.5 rounded-full bg-red-500/10 p-0.5"><X size={12} className="text-red-400" /></span>{x}</li>)}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="relative h-full rounded-2xl p-[1px] bg-gradient-to-br from-primary/60 via-primary/15 to-cyan-500/25">
              <div className="h-full rounded-2xl bg-[#0a1110] p-7">
                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-5">Dengan Datalitiq</p>
                <ul className="space-y-3.5">
                  {NEW_WAY.map(x => <li key={x} className="flex items-start gap-2.5 text-sm text-white/85"><span className="shrink-0 mt-0.5 rounded-full bg-primary/15 p-0.5"><Check size={12} className="text-primary" /></span>{x}</li>)}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
        <Reveal delay={120}>
          <div className="text-center mt-8">
            <Link href={primaryCta} className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">Coba Cara Baru — {rp(TERMINAL_PRICE)}/bln <ArrowRight size={15} /></Link>
          </div>
        </Reveal>
      </section>

      {/* ── Cara Kerja ── */}
      <section id="cara-kerja" className="max-w-6xl mx-auto px-5 py-16">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Cara Kerja</span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">Satu Sistem yang Membaca Semuanya, untuk Anda</h2>
            <p className="text-sm text-white/50 mt-3">Menggantikan proses manual yang memakan waktu — bukan dengan menambah data, tapi menyederhanakannya.</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((s, i) => (
            <Reveal key={i} delay={i * 100}>
              <div className="relative h-full rounded-2xl border border-white/8 bg-white/[0.02] p-6">
                <span className="absolute top-5 right-5 text-3xl font-black text-white/[0.05] select-none">{i + 1}</span>
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/12 ring-1 ring-primary/20 mb-4"><s.icon size={20} className="text-primary" /></span>
                <p className="text-base font-bold mb-1.5">{s.t}</p>
                <p className="text-sm text-white/55 leading-relaxed">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <p className="text-center text-sm text-white/60 mt-8 max-w-2xl mx-auto">
            <span className="text-primary font-semibold">Datalitiq AI adalah asisten analisa</span> — bukan robot yang bertransaksi otomatis. Keputusan akhir, kapan pun, tetap di tangan Anda.
          </p>
        </Reveal>
      </section>

      {/* ── Fitur (zigzag dengan penjelasan lengkap) ── */}
      <section id="fitur" className="max-w-6xl mx-auto px-5 py-16">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Fitur</span>
            <h2 className="text-2xl md:text-4xl font-black tracking-tight mt-2">Semua yang Anda Butuh untuk Membaca Pasar dengan Jelas</h2>
            <p className="text-sm text-white/50 mt-3">Rumit di belakang layar. Sederhana di depan mata Anda.</p>
          </div>
        </Reveal>
        <div className="space-y-14">
          {FEATURE_ROWS.map((f, i) => (
            <Reveal key={f.t}>
              <div className={`grid lg:grid-cols-2 gap-8 lg:gap-12 items-center ${i % 2 ? 'lg:[direction:rtl]' : ''}`}>
                <div className="lg:[direction:ltr]">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 rounded-full px-2.5 py-1 mb-4"><f.icon size={11} /> {f.kicker}</span>
                  <h3 className="text-xl md:text-2xl font-black tracking-tight leading-tight">{f.t}</h3>
                  <p className="text-sm text-white/60 mt-3 leading-relaxed">{f.d}</p>
                  <ul className="mt-4 space-y-2">
                    {f.bullets.map(b => <li key={b} className="flex items-start gap-2.5 text-sm text-white/75"><span className="shrink-0 mt-0.5 rounded-full bg-primary/15 p-0.5"><Check size={12} className="text-primary" /></span>{b}</li>)}
                  </ul>
                </div>
                <div className="lg:[direction:ltr]">
                  <FeatureFrame icon={f.icon} title={f.kicker}>
                    {f.visual === 'decision' ? <MDecision /> : f.visual === 'gauge' ? <MGauge /> : f.visual === 'macro' ? <MMacro /> : f.visual === 'sentiment' ? <MSentiment /> : f.visual === 'chat' ? <MChat /> : <MNotif />}
                  </FeatureFrame>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal><p className="text-center text-[10px] text-white/30 mt-8">Ilustrasi tampilan · data aktual real-time saat berlangganan.</p></Reveal>
      </section>

      {/* ── Testimoni ── */}
      <section id="testimoni" className="max-w-6xl mx-auto px-5 py-16">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Testimoni</span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">Mereka Sudah Berhenti Menebak</h2>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TESTIMONIALS.map((r, i) => (
            <Reveal key={i} delay={(i % 3) * 100}>
              <div className="h-full rounded-2xl border border-white/8 bg-white/[0.02] p-6 flex flex-col">
                <div className="flex gap-0.5 mb-3">{Array.from({ length: 5 }).map((_, k) => <Star key={k} size={14} className="text-amber-400 fill-amber-400" />)}</div>
                <p className="text-sm text-white/75 leading-relaxed flex-1">&ldquo;{r.text}&rdquo;</p>
                <div className="flex items-center gap-3 mt-5">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/15 text-primary font-bold text-sm">{r.name.charAt(0)}</span>
                  <div><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-white/40">{r.role}</p></div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Harga ── */}
      <section id="harga" className="max-w-5xl mx-auto px-5 py-16">
        <Reveal>
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Harga</span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">Satu Paket, Semua Fitur</h2>
            <p className="text-sm text-white/50 mt-3">Tanpa tingkatan yang membingungkan. Semua kemampuan Datalitiq AI dalam satu harga jelas.</p>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="grid lg:grid-cols-5 gap-5 items-stretch">
            {/* Plan */}
            <div className="lg:col-span-3 relative rounded-3xl p-[1px] bg-gradient-to-br from-primary/70 via-primary/20 to-cyan-500/30">
              <div className="rounded-3xl bg-[#0a1110] h-full p-8 flex flex-col">
                <div className="flex items-center gap-2 mb-1"><Sparkles size={18} className="text-primary" /><h3 className="text-xl font-black">Datalitiq AI Terminal</h3></div>
                <p className="text-xs text-white/45 mb-5">Analisa pasar emas berbasis AI, real-time.</p>
                <div className="mb-1 flex items-end gap-1.5"><span className="text-5xl font-black tracking-tight">{rp(TERMINAL_PRICE)}</span><span className="text-sm text-white/40 mb-1.5">/ bulan</span></div>
                <p className="text-xs text-white/50 mb-1">≈ <b className="text-white/80">Rp6 ribu per hari</b> — satu keputusan yang lebih jelas sudah menutupnya.</p>
                <p className="text-xs text-white/40 mb-6">Akses penuh · tanpa batas penggunaan · tanpa kontrak, berhenti kapan saja</p>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {['Kesimpulan arah pasar + tingkat keyakinan real-time', 'Analisa makro ekonomi & sentimen pasar', 'Level kunci & konteks multi-timeframe', 'Analisa AI sesuai permintaan', 'Notifikasi kondisi pasar penting'].map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm"><span className="shrink-0 mt-0.5 rounded-full bg-primary/15 p-0.5"><Check size={12} className="text-primary" /></span><span className="text-white/80">{f}</span></li>
                  ))}
                </ul>
                <Link href={checkoutHref} className="w-full text-center rounded-xl px-4 py-3.5 text-sm font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity">Mulai Berlangganan</Link>
              </div>
            </div>
            {/* Bonus */}
            <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.02] p-7 flex flex-col">
              <span className="inline-flex items-center gap-1.5 self-start text-[10px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-500/10 rounded-full px-2.5 py-1 mb-4">Bonus Gratis</span>
              <p className="text-sm text-white/70 leading-relaxed mb-5">Setiap langganan Terminal sudah termasuk tools pendukung — gratis, tanpa biaya tambahan:</p>
              <div className="space-y-3 flex-1">
                {BONUS.map(b => (
                  <div key={b.t} className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 ring-1 ring-white/10 shrink-0"><b.icon size={16} className="text-primary" /></span>
                    <div><p className="text-sm font-semibold">{b.t}</p><p className="text-xs text-white/45">{b.d}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal><p className="text-center text-xs text-white/40 mt-6">Pembayaran via transfer bank · Akses aktif otomatis setelah verifikasi · Bisa berhenti kapan saja</p></Reveal>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-3xl mx-auto px-5 py-16">
        <Reveal><h2 className="text-2xl md:text-3xl font-black tracking-tight text-center mb-10">Pertanyaan yang Sering Ditanya</h2></Reveal>
        <div className="space-y-3">{FAQS.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}</div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <Reveal>
          <div className="relative rounded-3xl overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/15 via-[#0a1110] to-[#0a1110] p-10 md:p-16 text-center">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 blur-[100px] rounded-full pointer-events-none dtq-pulse" />
            <h2 className="relative text-2xl md:text-4xl font-black tracking-tight max-w-2xl mx-auto leading-tight">Pasar Bergerak Setiap Hari.<br className="hidden md:block" /> Jangan Membacanya Sendirian.</h2>
            <p className="relative text-sm text-white/60 mt-4 max-w-lg mx-auto">Mulai hari ini seharga ≈ Rp6 ribu/hari — tanpa kontrak, berhenti kapan saja. Satu keputusan yang lebih jelas sudah sepadan.</p>
            <Link href={primaryCta} className="relative inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-8 py-4 text-sm font-semibold mt-7 hover:opacity-90 transition-opacity shadow-xl shadow-primary/30">
              {loggedIn ? 'Buka Terminal' : `Mulai Sekarang — ${rp(TERMINAL_PRICE)}/bln`} <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {logoUrl ? <BrandLogo url={logoUrl} /> : <span className="text-lg font-black tracking-tight">Datalitiq</span>}
            <span className="text-xs text-white/30 hidden sm:inline">· Analisa pasar emas berbasis AI</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <a href="#fitur" className="hover:text-white transition-colors">Fitur</a>
            <a href="#harga" className="hover:text-white transition-colors">Harga</a>
            <Link href="/jurnal-trading-tools" className="hover:text-white transition-colors">Jurnal Tools</Link>
            <Link href="/login" className="hover:text-white transition-colors">Masuk</Link>
          </div>
        </div>
        <p className="text-center text-[11px] text-white/25 pb-2 px-5 max-w-3xl mx-auto leading-relaxed">Datalitiq bukan penasihat keuangan berizin. Seluruh analisa adalah alat bantu, bukan rekomendasi investasi. Trading mengandung risiko.</p>
        <p className="text-center text-xs text-white/20 pb-6">© {new Date().getFullYear()} Datalitiq. All rights reserved.</p>
      </footer>

      <style jsx global>{`
        @keyframes dtq-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .dtq-marquee { animation: dtq-marquee 28s linear infinite; }
        @keyframes dtq-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        .dtq-float { animation: dtq-float 4s ease-in-out infinite; }
        .dtq-float2 { animation: dtq-float 4.5s ease-in-out infinite 0.8s; }
        @keyframes dtq-pulse { 0%,100% { opacity: .6 } 50% { opacity: 1 } }
        .dtq-pulse { animation: dtq-pulse 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .dtq-marquee, .dtq-float, .dtq-float2, .dtq-pulse { animation: none } }
      `}</style>
    </div>
  )
}
