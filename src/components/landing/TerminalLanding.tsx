'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { BrandLogo } from '@/components/layout/BrandLogo'
import {
  Sparkles, Brain, ArrowRight, ChevronDown, ShieldCheck, Check, Star,
  Compass, Landmark, Newspaper, Bell, Target, MessageSquare,
  BookOpen, FlaskConical, LineChart, Calculator, Layers, Globe,
  X, Zap, Radio, TrendingUp, BarChart3,
} from 'lucide-react'

const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID')
const TERMINAL_PRICE = 179000

// Platform/broker tempat trader kami berasal — sinyal kepercayaan (bukan klaim kemitraan resmi).
const CLIENTS = ['Exness', 'XM', 'IC Markets', 'FTMO', 'Pepperstone', 'OANDA', 'Binance', 'Bybit', 'MIFX', 'FundedNext', 'Octa', 'Deriv']

// Angka nyata dari sistem yang berjalan — bukan klaim marketing.
const STATS: { icon: React.ElementType; v: string; l: string }[] = [
  { icon: Layers, v: '3 Pilar', l: 'Makro · Teknikal · Sentimen' },
  { icon: Landmark, v: '12+', l: 'Data makro resmi' },
  { icon: Radio, v: '24/7', l: 'Pemantauan pasar' },
  { icon: Compass, v: '1', l: 'Bias harian yang jelas' },
]
// Sebelum & Sesudah — copy pendek untuk toggle interaktif
const OLD_WAY = [
  '5–6 layar terbuka sekaligus',
  'Berjam-jam menyusun analisa',
  'Sinyal bertentangan → balik ke feeling',
  'FOMO saat berita, tanpa konteks',
]
const NEW_WAY = [
  'Satu layar, bias harian jelas',
  'Kesimpulan siap dalam hitungan detik',
  'Makro + teknikal + sentimen ditimbang AI',
  'News guard: tahan entry saat rilis besar',
]

// Cara Kerja — stepper interaktif dengan visual animasi per langkah
const STEPS: { icon: React.ElementType; t: string; d: string }[] = [
  { icon: Globe, t: 'Pantau', d: 'Harga, makro & sentimen dipantau real-time dari sumber institusi.' },
  { icon: Layers, t: 'Timbang', d: 'Tiga pilar analisa ditimbang bersamaan oleh AI — objektif, tanpa emosi.' },
  { icon: ShieldCheck, t: 'Saring', d: 'Sinyal yang melawan tren besar atau dekat rilis berita, disaring keluar.' },
  { icon: Target, t: 'Simpulkan', d: 'Satu bias harian yang jelas: arah, keyakinan, dan alasannya.' },
]

// Fitur — explorer interaktif (klik untuk ganti), teks singkat
const FEATURES_X: { icon: React.ElementType; t: string; d: string; visual: string }[] = [
  { icon: Compass, t: 'Bias Harian Jelas', d: 'Buka terminal, langsung tahu arah hari ini dan seberapa yakin sistem terhadapnya.', visual: 'gauge' },
  { icon: Brain, t: 'Keputusan AI', d: 'AI menimbang semua data jadi satu keputusan — beli, jual, atau tunggu — beserta alasannya.', visual: 'decision' },
  { icon: Landmark, t: 'Makro Real-Time', d: 'Dolar, yield & kebijakan Fed dari sumber resmi, diterjemahkan dampaknya ke emas.', visual: 'macro' },
  { icon: Newspaper, t: 'Posisi Institusi', d: 'Lihat ke mana uang besar bergerak setiap minggu — jangan berdiri di sisi yang salah.', visual: 'sentiment' },
  { icon: MessageSquare, t: 'Tanya AI', d: 'Ajukan pertanyaan spesifik, dijawab dari data pasar saat itu juga.', visual: 'chat' },
  { icon: Bell, t: 'Alert Telegram', d: 'Pasar dipantau untukmu — notifikasi hanya saat kondisi benar-benar berubah.', visual: 'notif' },
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

// ── Hero chart: chart emas animasi (garis menggambar sendiri + harga berdetak)
//    + tab insight interaktif (Teknikal/Makro/Sentimen) ──
const HERO_TABS = [
  { id: 'teknikal', label: 'Teknikal', chip: 'Bullish · 74%', chipCls: 'text-emerald-400', text: 'Tren naik terkonfirmasi di M15 & H1 — bias harian Bullish, tunggu pullback untuk entry.' },
  { id: 'makro', label: 'Makro', chip: 'Mendukung', chipCls: 'text-emerald-400', text: 'Dolar & yield melemah pasca rilis inflasi — angin makro berpihak ke emas.' },
  { id: 'sentimen', label: 'Sentimen', chip: 'Risk-Off', chipCls: 'text-amber-400', text: 'Institusi menambah posisi long minggu ini; pasar cenderung mencari aset aman.' },
] as const
function HeroChart() {
  const [price, setPrice] = useState(4032.4)
  const [up, setUp] = useState(true)
  const [tab, setTab] = useState<(typeof HERO_TABS)[number]['id']>('teknikal')
  const active = HERO_TABS.find(t => t.id === tab)!
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
        {/* Tab insight interaktif — klik untuk lihat 3 sisi analisa */}
        <div className="mt-3 rounded-xl bg-gradient-to-br from-primary/12 to-transparent border border-primary/20 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/20 shrink-0"><Brain size={12} className="text-primary" /></span>
            {HERO_TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${tab === t.id ? 'bg-primary/25 text-primary' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}>{t.label}</button>
            ))}
            <span className={`ml-auto text-[10px] font-black ${active.chipCls}`} key={`chip-${tab}`}>{active.chip}</span>
          </div>
          <p key={tab} className="dtq-in text-[11px] text-white/60 leading-relaxed">{active.text}</p>
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

// ── Sebelum & Sesudah: dua sisi tampil sekaligus (tanpa toggle), item stagger ──
function CompareToggle({ primaryCta }: { primaryCta: string }) {
  return (
    <div>
      <div className="grid md:grid-cols-2 gap-6 items-stretch">
        {/* Tanpa Datalitiq */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.015] p-8 md:p-9">
          <p className="inline-flex items-center gap-2 rounded-full bg-red-500/10 ring-1 ring-red-500/25 px-3.5 py-1.5 text-xs font-bold text-red-300 mb-7"><X size={13} /> Tanpa Datalitiq</p>
          <ul className="space-y-5">
            {OLD_WAY.map((x, i) => (
              <li key={x} className="dtq-in flex items-center gap-4" style={{ animationDelay: `${i * 110}ms` }}>
                <span className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-red-500/10"><X size={16} className="text-red-400" /></span>
                <span className="text-base text-white/50 line-through decoration-red-400/40">{x}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 pt-6 border-t border-white/[0.06] text-sm font-semibold text-white/40">Melelahkan — dan tetap menebak.</p>
        </div>
        {/* Dengan Datalitiq */}
        <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-primary/60 via-primary/15 to-cyan-500/25">
          <div className="h-full rounded-3xl bg-[#0a1110] p-8 md:p-9 flex flex-col">
            <p className="inline-flex self-start items-center gap-2 rounded-full bg-primary/12 ring-1 ring-primary/30 px-3.5 py-1.5 text-xs font-bold text-primary mb-7"><Check size={13} /> Dengan Datalitiq</p>
            <ul className="space-y-5">
              {NEW_WAY.map((x, i) => (
                <li key={x} className="dtq-in flex items-center gap-4" style={{ animationDelay: `${120 + i * 110}ms` }}>
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-primary/15"><Check size={16} className="text-primary" /></span>
                  <span className="text-base text-white/85">{x}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-8 flex items-center justify-between gap-4 flex-wrap border-t border-white/[0.06] mt-8">
              <p className="text-sm font-semibold text-primary">Tenang. Terukur. Berbasis data.</p>
              <Link href={primaryCta} className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">Coba Sekarang <ArrowRight size={14} /></Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Cara Kerja: stepper auto-play + panggung visual animasi per langkah ──
function VisPantau() {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-44 h-44">
        <div className="absolute inset-0 rounded-full border border-primary/20" />
        <div className="absolute inset-7 rounded-full border border-primary/15" />
        <div className="absolute inset-14 rounded-full border border-primary/10" />
        <div className="absolute inset-0 rounded-full dtq-sweep" style={{ background: 'conic-gradient(from 0deg, rgba(52,211,153,0.35), transparent 75deg)' }} />
        <span className="absolute top-7 right-10 w-2 h-2 rounded-full bg-emerald-400 dtq-blink" />
        <span className="absolute bottom-11 left-9 w-2 h-2 rounded-full bg-cyan-400 dtq-blink" style={{ animationDelay: '.6s' }} />
        <span className="absolute top-16 left-14 w-2 h-2 rounded-full bg-amber-400 dtq-blink" style={{ animationDelay: '1.1s' }} />
      </div>
      <div className="flex flex-wrap justify-center gap-2">{['Harga live', 'Makro AS', 'Sentimen pasar'].map(t => <span key={t} className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/55">{t}</span>)}</div>
    </div>
  )
}
function VisTimbang() {
  const bars = [{ l: 'Teknikal', h: 78, c: 'bg-emerald-400/80' }, { l: 'Makro', h: 62, c: 'bg-cyan-400/80' }, { l: 'Sentimen', h: 45, c: 'bg-amber-400/80' }]
  return (
    <div className="flex flex-col items-center gap-7">
      <div className="flex items-end gap-8">
        {bars.map((b, i) => (
          <div key={b.l} className="flex flex-col items-center gap-2.5">
            <div className="w-14 h-32 rounded-lg bg-white/5 flex items-end overflow-hidden">
              <span className={`block w-full rounded-t ${b.c} dtq-grow`} style={{ height: `${b.h}%`, animationDelay: `${i * 180}ms` }} />
            </div>
            <span className="text-xs text-white/50">{b.l}</span>
          </div>
        ))}
      </div>
      <div className="dtq-in flex items-center gap-2 text-sm font-bold text-primary" style={{ animationDelay: '680ms' }}><ArrowRight size={15} /> Ditimbang jadi satu skor</div>
    </div>
  )
}
function VisSaring() {
  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div className="w-full space-y-3">
        <div className="dtq-in flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3.5"><span className="text-sm text-white/80">Sinyal searah tren besar</span><Check size={16} className="text-emerald-400" /></div>
        <div className="dtq-reject flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3.5" style={{ animationDelay: '450ms' }}><span className="text-sm text-white/50 line-through">Sinyal melawan tren H4/Daily</span><X size={16} className="text-red-400" /></div>
        <div className="dtq-reject flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3.5" style={{ animationDelay: '850ms' }}><span className="text-sm text-white/50 line-through">Entry 20 menit sebelum CPI</span><X size={16} className="text-red-400" /></div>
      </div>
      <div className="dtq-in flex items-center gap-2 text-sm font-bold text-primary" style={{ animationDelay: '1250ms' }}><ShieldCheck size={16} /> Hanya sinyal sehat yang lolos</div>
    </div>
  )
}
function VisSimpulkan() {
  return (
    <div className="dtq-pop rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-transparent p-7">
      <p className="text-[11px] uppercase tracking-widest text-white/40 mb-3">Bias harian · XAU/USD</p>
      <div className="flex items-center gap-5">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" /><circle cx="18" cy="18" r="15" fill="none" stroke="#34d399" strokeWidth="3.5" strokeDasharray="70 94" strokeLinecap="round" /></svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-emerald-400">74%</span>
        </div>
        <div>
          <p className="text-2xl font-black text-emerald-400 leading-none">Bias Bullish</p>
          <p className="dtq-in text-sm text-white/55 mt-2.5 leading-relaxed" style={{ animationDelay: '380ms' }}>Tren naik + makro mendukung. Tunggu pullback, lalu entry beli.</p>
        </div>
      </div>
    </div>
  )
}
function HowItWorks() {
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setStep(s => (s + 1) % STEPS.length), 3500)
    return () => clearInterval(id)
  }, [paused])
  return (
    <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6 lg:gap-10 items-stretch" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="space-y-3">
        {STEPS.map((s, i) => {
          const on = i === step
          return (
            <button key={s.t} onClick={() => setStep(i)} className={`w-full text-left rounded-2xl border p-5 transition-all ${on ? 'border-primary/30 bg-primary/[0.06]' : 'border-white/[0.07] bg-white/[0.015] hover:border-white/15'}`}>
              <div className="flex items-center gap-3.5">
                <span className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-colors ${on ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/40'}`}><s.icon size={18} /></span>
                <div className="flex-1 min-w-0">
                  <p className={`text-base font-bold ${on ? 'text-white' : 'text-white/55'}`}>{s.t}</p>
                  {on && <p className="dtq-in text-sm text-white/55 mt-1.5 leading-relaxed">{s.d}</p>}
                </div>
              </div>
              {on && !paused && <div className="mt-4 h-0.5 rounded-full bg-white/5 overflow-hidden"><span key={step} className="block h-full bg-primary/70 dtq-progress" /></div>}
            </button>
          )
        })}
      </div>
      <div className="relative rounded-3xl border border-white/10 bg-[#0a1210] overflow-hidden min-h-[340px] flex items-center justify-center p-8 md:p-10">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div key={step} className="dtq-in relative w-full max-w-sm">
          {step === 0 && <VisPantau />}
          {step === 1 && <VisTimbang />}
          {step === 2 && <VisSaring />}
          {step === 3 && <VisSimpulkan />}
        </div>
      </div>
    </div>
  )
}

// ── Fitur: BENTO GRID (mix full-width + wide + normal). Kartu besar menampilkan
//    gambar upload admin (fallback visual dummy); kartu biasa ikon + teks. ──
function BentoVisual({ visual }: { visual: string }) {
  return (
    <div className="w-full max-w-sm">
      {visual === 'decision' ? <MDecision /> : visual === 'gauge' ? <MGauge /> : visual === 'macro' ? <MMacro /> : visual === 'sentiment' ? <MSentiment /> : visual === 'chat' ? <MChat /> : <MNotif />}
    </div>
  )
}
function BentoImageCard({ f, img, className = '' }: { f: typeof FEATURES_X[number]; img?: string; className?: string }) {
  return (
    <div className={`group relative rounded-3xl border border-white/10 bg-[#0a1210] overflow-hidden hover:border-primary/30 transition-colors ${className}`}>
      <div className="absolute -top-16 -right-14 w-56 h-56 rounded-full bg-primary/12 blur-3xl pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity" />
      {/* area gambar */}
      <div className="relative w-full aspect-[16/9] overflow-hidden border-b border-white/[0.06]">
        {img
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={img} alt={f.t} className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0 flex items-center justify-center p-6">{<BentoVisual visual={f.visual} />}</div>}
      </div>
      {/* teks */}
      <div className="relative p-5 md:p-6">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 rounded-full px-2.5 py-1 mb-3"><f.icon size={11} /> Fitur</span>
        <p className="text-lg font-black">{f.t}</p>
        <p className="text-sm text-white/55 mt-1.5 leading-relaxed">{f.d}</p>
      </div>
    </div>
  )
}
function BentoTextCard({ f }: { f: typeof FEATURES_X[number] }) {
  return (
    <div className="group relative h-full rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 overflow-hidden hover:border-primary/30 transition-colors">
      <div className="absolute -top-12 -right-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <span className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-primary/12 ring-1 ring-primary/20 text-primary mb-4"><f.icon size={20} /></span>
      <p className="relative text-base font-black">{f.t}</p>
      <p className="relative text-sm text-white/55 mt-1.5 leading-relaxed">{f.d}</p>
    </div>
  )
}
function FeatureBento({ images }: { images: Record<string, string> }) {
  const F = Object.fromEntries(FEATURES_X.map(f => [f.visual, f])) as Record<string, typeof FEATURES_X[number]>
  return (
    <div className="grid md:grid-cols-3 gap-4 auto-rows-auto">
      {/* Baris 1: kartu lebar (image) + kartu biasa */}
      <BentoImageCard f={F.gauge} img={images['gauge']} className="md:col-span-2" />
      <BentoTextCard f={F.decision} />
      {/* Baris 2: 3 kartu biasa */}
      <BentoTextCard f={F.macro} />
      <BentoTextCard f={F.sentiment} />
      <BentoTextCard f={F.chat} />
      {/* Baris 3: kartu FULL-WIDTH (image di samping teks) */}
      <div className="md:col-span-3 group relative rounded-3xl border border-white/10 bg-[#0a1210] overflow-hidden hover:border-primary/30 transition-colors">
        <div className="absolute -top-16 -left-14 w-64 h-64 rounded-full bg-primary/12 blur-3xl pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity" />
        <div className="grid md:grid-cols-2 items-stretch">
          <div className="relative p-6 md:p-9 flex flex-col justify-center">
            <span className="inline-flex self-start items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 rounded-full px-2.5 py-1 mb-4"><F.notif.icon size={11} /> Fitur</span>
            <p className="text-2xl md:text-3xl font-black tracking-tight">{F.notif.t}</p>
            <p className="text-sm md:text-base text-white/55 mt-3 leading-relaxed max-w-md">{F.notif.d} Sistem memeriksa kondisi pasar setiap beberapa menit — kamu hanya diberi tahu saat benar-benar penting.</p>
          </div>
          <div className="relative min-h-[220px] border-t md:border-t-0 md:border-l border-white/[0.06] overflow-hidden">
            {images['notif']
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={images['notif']} alt={F.notif.t} className="absolute inset-0 w-full h-full object-cover" />
              : <div className="absolute inset-0 flex items-center justify-center p-8"><div className="w-full max-w-xs"><MNotif /></div></div>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Data-Driven section: konsol data futuristik (ticker + metrik + sparkline) ──
const DD_TICKER = ['XAU/USD 4032.4 ▲', 'DXY 104.2 ▼', 'US10Y 4.58% ▼', 'VIX +1.4% ▲', 'S&P500 +0.3%', 'BTC 68.2K ▲', 'COT net-long ▲', 'CPI 3.4% ▼', 'Real Yield 2.1% ▼', 'Gold/Silver 88.3']
function Sparkline({ up = true, delay = 0 }: { up?: boolean; delay?: number }) {
  const d = up ? 'M0,26 L14,22 L28,24 L42,15 L56,18 L70,8 L84,11 L98,3' : 'M0,4 L14,9 L28,7 L42,15 L56,12 L70,20 L84,17 L98,26'
  const c = up ? '#34d399' : '#f87171'
  return (
    <svg viewBox="0 0 98 30" className="w-full h-8" preserveAspectRatio="none">
      <path d={`${d} L98,30 L0,30 Z`} fill={c} opacity="0.08" />
      <path d={d} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeDasharray="220" strokeDashoffset="220" className="dtq-draw" style={{ animationDelay: `${delay}ms` }} />
    </svg>
  )
}
const DD_METRICS = [
  { l: 'Bias Harian', v: 'Bullish', s: '74% keyakinan', up: true },
  { l: 'Momentum M15', v: '+62', s: 'menguat', up: true },
  { l: 'Tekanan Dolar', v: '−0.31%', s: 'dukung emas', up: true },
  { l: 'Sentimen Risiko', v: 'Risk-Off', s: 'defensif', up: true },
]
function DataDrivenSection({ primaryCta }: { primaryCta: string }) {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(52,211,153,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.06) 1px, transparent 1px)', backgroundSize: '32px 32px', WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, #000, transparent 100%)', maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, #000, transparent 100%)' }} />
      <div className="absolute left-1/2 -translate-x-1/2 top-10 w-[700px] h-72 bg-primary/10 blur-[130px] rounded-full pointer-events-none dtq-pulse" />
      <div className="relative max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 ring-1 ring-primary/30 px-3.5 py-1.5 text-xs font-bold text-primary mb-6"><BarChart3 size={13} /> Data-Driven Analysis</span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.05]">Keputusan yang Digerakkan <span className="bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 bg-clip-text text-transparent">Data</span>, Bukan Feeling dan Emosi.</h2>
            <p className="text-base text-white/55 mt-5 leading-relaxed">Setiap angka di layar punya arti. Terminal menerjemahkan aliran data pasar jadi sinyal yang bisa ditindak — dan menyesuaikannya dengan gaya trading-mu.</p>
          </div>
        </Reveal>
        {/* Konsol data */}
        <Reveal delay={100}>
          <div className="relative rounded-3xl border border-primary/20 bg-gradient-to-b from-[#0a1512] to-[#080d0b] overflow-hidden">
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/12 blur-3xl pointer-events-none dtq-pulse" />
            {/* Ticker atas */}
            <div className="relative border-b border-white/[0.06] py-2.5 overflow-hidden">
              <div className="flex gap-8 w-max dtq-marquee">
                {[...DD_TICKER, ...DD_TICKER].map((t, i) => {
                  const up = t.includes('▲'), down = t.includes('▼')
                  return <span key={i} className={`text-xs font-bold tabular-nums whitespace-nowrap ${up ? 'text-emerald-400/90' : down ? 'text-red-400/80' : 'text-white/50'}`}>{t}</span>
                })}
              </div>
              <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0a1210] to-transparent" />
              <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0a1210] to-transparent" />
            </div>
            {/* Metrik + sparkline */}
            <div className="relative grid grid-cols-2 lg:grid-cols-4">
              {DD_METRICS.map((m, i) => (
                <div key={m.l} className="p-5 md:p-6 border-b lg:border-b-0 border-white/[0.05] [&:not(:nth-child(2n))]:border-r lg:[&:not(:last-child)]:border-r">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] uppercase tracking-wider text-white/40">{m.l}</p>
                    <span className={`flex items-center gap-1 text-[10px] font-bold ${m.up ? 'text-emerald-400' : 'text-red-400'}`}><span className={`w-1.5 h-1.5 rounded-full ${m.up ? 'bg-emerald-400' : 'bg-red-400'} dtq-blink`} style={{ animationDelay: `${i * 300}ms` }} /> live</span>
                  </div>
                  <p className={`text-2xl font-black tracking-tight ${m.up ? 'text-white' : 'text-white'}`}>{m.v}</p>
                  <p className="text-[11px] text-white/45 mb-2">{m.s}</p>
                  <Sparkline up={m.up} delay={i * 250} />
                </div>
              ))}
            </div>
            {/* scanline */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 dtq-scan" style={{ background: 'linear-gradient(180deg, rgba(52,211,153,0.12), transparent)' }} />
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="text-center mt-10">
            <Link href={primaryCta} className="group inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3.5 text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/25">Trading dengan Data Sekarang <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" /></Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ── Premium AI section: graphic konvergensi data futuristik ──
const AI_SOURCES = ['Makro', 'Teknikal', 'Sentimen', 'Berita', 'COT', 'Price Action']
function AiDataViz() {
  // node kiri → core tengah → output kanan; garis mengalir (dash), core berdenyut
  const nodes = AI_SOURCES.map((l, i) => ({ l, x: 26, y: 44 + i * 54 }))
  const core = { x: 232, y: 180 }
  return (
    <svg viewBox="0 0 420 360" className="w-full h-auto">
      <defs>
        <radialGradient id="aicore" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#34d399" stopOpacity="0.9" /><stop offset="70%" stopColor="#059669" stopOpacity="0.35" /><stop offset="100%" stopColor="#059669" stopOpacity="0" /></radialGradient>
        <linearGradient id="ailine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#34d399" stopOpacity="0.05" /><stop offset="100%" stopColor="#34d399" stopOpacity="0.7" /></linearGradient>
      </defs>
      {/* garis dari tiap sumber ke core */}
      {nodes.map((n, i) => (
        <path key={`p${i}`} d={`M${n.x + 20},${n.y} C110,${n.y} 150,${core.y} ${core.x - 34},${core.y}`} fill="none" stroke="url(#ailine)" strokeWidth="1.5" strokeDasharray="5 7" className="dtq-flow" style={{ animationDelay: `${i * 0.25}s` }} />
      ))}
      {/* node sumber */}
      {nodes.map((n, i) => (
        <g key={`n${i}`}>
          <rect x={n.x - 20} y={n.y - 13} width="86" height="26" rx="13" fill="rgba(255,255,255,0.03)" stroke="rgba(52,211,153,0.25)" />
          <circle cx={n.x - 6} cy={n.y} r="3.5" fill="#34d399" className="dtq-blink" style={{ animationDelay: `${i * 0.3}s` }} />
          <text x={n.x + 6} y={n.y + 3.5} fontSize="11" fontWeight="700" fill="rgba(255,255,255,0.75)">{n.l}</text>
        </g>
      ))}
      {/* core */}
      <circle cx={core.x} cy={core.y} r="70" fill="url(#aicore)" className="dtq-corepulse" />
      <circle cx={core.x} cy={core.y} r="46" fill="none" stroke="rgba(52,211,153,0.3)" strokeWidth="1" strokeDasharray="4 5" className="dtq-sweep" style={{ transformOrigin: `${core.x}px ${core.y}px` }} />
      <circle cx={core.x} cy={core.y} r="30" fill="#0a1210" stroke="rgba(52,211,153,0.6)" strokeWidth="1.5" />
      <text x={core.x} y={core.y - 3} fontSize="10" fontWeight="800" fill="#34d399" textAnchor="middle">DATALITIQ</text>
      <text x={core.x} y={core.y + 9} fontSize="8" fontWeight="700" fill="rgba(255,255,255,0.5)" textAnchor="middle">AI CORE</text>
      {/* output ke kanan */}
      <path d={`M${core.x + 32},${core.y} C330,${core.y} 340,${core.y} 366,${core.y}`} fill="none" stroke="url(#ailine)" strokeWidth="2" strokeDasharray="5 6" className="dtq-flow" />
      <g>
        <rect x="332" y="150" width="78" height="60" rx="12" fill="rgba(52,211,153,0.1)" stroke="rgba(52,211,153,0.4)" />
        <text x="371" y="172" fontSize="9" fontWeight="700" fill="rgba(255,255,255,0.55)" textAnchor="middle">BIAS HARIAN</text>
        <text x="371" y="190" fontSize="15" fontWeight="900" fill="#34d399" textAnchor="middle">Bullish</text>
        <text x="371" y="203" fontSize="8" fontWeight="700" fill="rgba(255,255,255,0.45)" textAnchor="middle">Keyakinan 74%</text>
      </g>
    </svg>
  )
}
const AI_FEATURES: { icon: React.ElementType; t: string; d: string }[] = [
  { icon: Brain, t: 'Penalaran Multi-Langkah', d: 'AI menimbang konflik antar-data & memeriksa ulang dirinya (extended thinking) sebelum menyimpulkan.' },
  { icon: Layers, t: 'Konfluensi M5 · M15 · H1', d: 'Membaca keselarasan timeframe scalping + price action candle mentah, bukan sekadar indikator.' },
  { icon: Landmark, t: 'Makro dari Sumber Resmi', d: 'Dolar, yield, inflasi & Fed (FRED) diterjemahkan otomatis jadi dampak ke emas.' },
  { icon: Newspaper, t: 'News Intelligence', d: 'Headline & kalender ekonomi diringkas AI — dampak tiap rilis ke emas, tanpa melarang.' },
  { icon: ShieldCheck, t: 'Kalibrasi Track-Record', d: 'Keyakinan disesuaikan dengan akurasi historis nyata pada kondisi pasar serupa.' },
  { icon: Target, t: 'Level & Rencana Konkret', d: 'Entry, stop, target berupa angka harga — plus skenario "jika-maka" yang bisa langsung dipakai.' },
]
function PremiumAiSection({ primaryCta }: { primaryCta: string }) {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      {/* latar futuristik */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(52,211,153,0.08), transparent 55%)' }} />
      <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(52,211,153,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.06) 1px, transparent 1px)', backgroundSize: '40px 40px', WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, #000, transparent 100%)', maskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, #000, transparent 100%)' }} />
      <div className="relative max-w-6xl mx-auto px-6">
        {/* Blok atas: teks kiri + graphic kanan */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center mb-16">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 ring-1 ring-primary/30 px-3.5 py-1.5 text-xs font-bold text-primary mb-6"><Sparkles size={13} /> Mesin Analisa · Premium AI</span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.05]">Bukan Sekadar Chart.<br /><span className="bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 bg-clip-text text-transparent">Mesin Analisa</span> Dengan AI Data Driven.</h2>
            <p className="text-base text-white/55 mt-6 leading-relaxed max-w-lg">Terminal Datalitiq menyerap ribuan titik data pasar — makro, teknikal, sentimen, berita — lalu menalarnya seperti seorang analis institusi, dan menyulingnya jadi <span className="text-white/85 font-semibold">satu keputusan yang bisa kamu pahami dalam hitungan detik.</span></p>
            <div className="flex flex-wrap gap-2.5 mt-7">
              {['Extended thinking', 'Data real-time', 'Kalibrasi nyata', 'Fokus scalping'].map(t => (
                <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.05] px-3 py-1.5 text-xs font-semibold text-white/70"><span className="w-1.5 h-1.5 rounded-full bg-primary dtq-blink" /> {t}</span>
              ))}
            </div>
            <Link href={primaryCta} className="group inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-semibold mt-8 hover:opacity-90 transition-all shadow-lg shadow-primary/25">Coba Mesin Analisa <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" /></Link>
          </Reveal>
          <Reveal delay={150}>
            <div className="relative rounded-3xl border border-primary/20 bg-gradient-to-br from-[#0a1512] to-[#080d0b] p-5 md:p-7 overflow-hidden">
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/15 blur-3xl pointer-events-none dtq-pulse" />
              <div className="relative flex items-center gap-2 mb-3">
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dtq-blink" /> LIVE ENGINE</span>
                <span className="ml-auto text-[10px] text-white/30">memproses 6 aliran data → 1 keputusan</span>
              </div>
              <AiDataViz />
            </div>
          </Reveal>
        </div>
        {/* Grid kartu fitur (layout gambar #2) */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AI_FEATURES.map((f, i) => (
            <Reveal key={f.t} delay={i * 70}>
              <div className="group relative h-full rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 overflow-hidden hover:border-primary/30 transition-colors">
                <div className="absolute -top-12 -right-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <span className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-primary/12 ring-1 ring-primary/20 text-primary mb-4"><f.icon size={20} /></span>
                <p className="relative text-base font-black">{f.t}</p>
                <p className="relative text-sm text-white/55 mt-1.5 leading-relaxed">{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
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

// ── Section: pasar bergerak (noise → sinyal), versi imersif & berbeda ──
function MarketNoiseSection() {
  // fragmen data acak yang "berisik" — melayang di latar
  const noise = ['XAU 4032.4', 'DXY 104.2 ▼', 'US10Y 4.58%', 'CPI 3.4%', 'FOMC 02:00', 'VIX +1.4%', 'COT net-long', 'Powell: hawkish?', 'NFP 187K', 'Real Yield 2.1%', 'Gold/Silver 88', 'BTC 68.2K ▲', 'RSI 71', 'ADX 27', 'Breakout?', 'Fake move', 'Sesi London', 'Spread melebar']
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      {/* latar berisik: dua baris fragmen drifting berlawanan arah, sangat samar */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden style={{ WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, #000 90%)', maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, #000 90%)' }}>
        <div className="absolute top-[12%] left-0 flex gap-8 w-max dtq-driftx text-white/[0.08] text-lg font-bold whitespace-nowrap">{[...noise, ...noise].map((n, i) => <span key={i}>{n}</span>)}</div>
        <div className="absolute top-[34%] left-0 flex gap-10 w-max dtq-driftx text-white/[0.06] text-base font-bold whitespace-nowrap" style={{ animationDuration: '46s' }}>{[...noise.slice().reverse(), ...noise.slice().reverse()].map((n, i) => <span key={i}>{n}</span>)}</div>
        <div className="absolute bottom-[14%] left-0 flex gap-8 w-max dtq-driftx text-white/[0.07] text-lg font-bold whitespace-nowrap" style={{ animationDuration: '40s' }}>{[...noise, ...noise].map((n, i) => <span key={i}>{n}</span>)}</div>
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-64 bg-primary/10 blur-[120px] rounded-full pointer-events-none dtq-pulse" />

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full bg-red-500/10 ring-1 ring-red-500/25 px-3.5 py-1.5 text-xs font-bold text-red-300 mb-6"><Radio size={13} /> Pasar emas tak pernah tidur</span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.06]">Satu Engine untuk Semua Keputusan Open Posisi</h2>
          <p className="text-base md:text-lg text-white/55 mt-6 leading-relaxed">Harga, dolar, yield, berita Fed, posisi institusi — semua bergerak bersamaan. Datalitiq menimbang semuanya lewat satu engine, lalu menyaringnya jadi <span className="text-white/90 font-semibold">satu arah emas yang jelas.</span></p>
        </Reveal>
        {/* alur: banyak sumber → satu sinyal */}
        <Reveal delay={120}>
          <div className="mt-12 inline-flex flex-wrap items-center justify-center gap-2.5">
            {['Harga', 'Makro', 'Sentimen', 'Berita'].map((s, i) => (
              <span key={s} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold text-white/70">
                <span className="w-1.5 h-1.5 rounded-full bg-primary dtq-blink" style={{ animationDelay: `${i * 250}ms` }} /> {s}
              </span>
            ))}
            <ArrowRight size={16} className="text-primary/70 mx-1" />
            <span className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-xs font-black shadow-lg shadow-primary/25"><Sparkles size={12} /> 1 Bias Emas Jelas</span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ── Section: cocok untuk semua gaya trading (scalping/intraday/swing) — full animasi ──
function ScalpingViz() {
  const bars = [40, 68, 52, 82, 60, 90, 48, 74, 58]
  return (
    <div className="flex items-end justify-center gap-1.5 h-24">
      {bars.map((h, i) => (
        <span key={i} className={`w-2.5 rounded-sm dtq-candle ${i % 3 === 0 ? 'bg-red-400/70' : 'bg-emerald-400/80'}`} style={{ height: `${h}%`, animationDelay: `${i * 110}ms` }} />
      ))}
    </div>
  )
}
function IntradayViz() {
  const sesi = [{ l: 'Asia', w: 45, c: 'bg-sky-400/70' }, { l: 'London', w: 72, c: 'bg-emerald-400/80' }, { l: 'New York', w: 58, c: 'bg-amber-400/70' }]
  return (
    <div className="flex flex-col justify-center gap-2.5 h-24 w-full px-2">
      {sesi.map((s, i) => (
        <div key={s.l} className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] text-white/45 text-right">{s.l}</span>
          <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
            <span className={`block h-full rounded-full dtq-fillbar ${s.c}`} style={{ ['--w' as string]: `${s.w}%`, animationDelay: `${i * 400}ms` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
function SwingViz() {
  return (
    <svg viewBox="0 0 200 96" className="w-full h-24" preserveAspectRatio="none">
      <defs><linearGradient id="swfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity="0.25" /><stop offset="100%" stopColor="#34d399" stopOpacity="0" /></linearGradient></defs>
      <path d="M4,84 L40,70 L72,76 L108,48 L140,58 L176,22 L196,30" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="340" className="dtq-drawloop" style={{ ['--len' as string]: '340' }} />
      <path d="M4,84 L40,70 L72,76 L108,48 L140,58 L176,22 L196,30 L196,96 L4,96 Z" fill="url(#swfill)" opacity="0.7" />
      <circle cx="176" cy="22" r="3.5" fill="#34d399" className="dtq-blink" />
    </svg>
  )
}
const TRADING_STYLES: { icon: React.ElementType; t: string; tf: string; d: string; viz: React.ReactNode }[] = [
  { icon: Zap, t: 'Scalping', tf: 'M5 · M15', d: 'Momentum cepat, konfluensi M5/M15/H1, level entry rapat & alert real-time untuk masuk-keluar dalam menit.', viz: <ScalpingViz /> },
  { icon: Compass, t: 'Intraday', tf: 'H1 · Sesi', d: 'Bias harian jelas + ringkasan arah tiap sesi Asia/London/NY untuk timing entry sepanjang hari.', viz: <IntradayViz /> },
  { icon: TrendingUp, t: 'Swing', tf: 'H4 · Daily', d: 'Konteks tren besar, makro bank sentral & posisi institusi (COT) untuk menahan posisi berhari-hari.', viz: <SwingViz /> },
]
function TradingStylesSection({ primaryCta }: { primaryCta: string }) {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(52,211,153,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px', WebkitMaskImage: 'radial-gradient(ellipse 65% 60% at 50% 40%, #000, transparent 100%)', maskImage: 'radial-gradient(ellipse 65% 60% at 50% 40%, #000, transparent 100%)' }} />
      <div className="relative max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 ring-1 ring-primary/30 px-3.5 py-1.5 text-xs font-bold text-primary mb-6"><Layers size={13} /> Semua Gaya Trading</span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.05]">Terminal Ini Cocok untuk Semua Gaya Trading<br /><span className="bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 bg-clip-text text-transparent">Scalping, Intraday, atau Swing.</span></h2>
            <p className="text-base text-white/55 mt-5 leading-relaxed">Terminal menyesuaikan timeframe & kedalaman analisa dengan gaya trading emas-mu — bukan memaksamu ikut satu metode.</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {TRADING_STYLES.map((s, i) => (
            <Reveal key={s.t} delay={i * 120}>
              <div className="group relative h-full rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent p-6 overflow-hidden hover:border-primary/30 transition-colors">
                <div className="absolute -top-16 -right-14 w-56 h-56 rounded-full bg-primary/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                {/* panggung animasi */}
                <div className="relative rounded-2xl border border-white/[0.06] bg-[#0a1210] mb-5 p-4 flex items-center justify-center min-h-[128px]">{s.viz}</div>
                <div className="relative flex items-center gap-2.5 mb-2">
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/12 ring-1 ring-primary/20 text-primary"><s.icon size={18} /></span>
                  <div><p className="text-lg font-black leading-none">{s.t}</p><p className="text-[10px] font-bold uppercase tracking-widest text-primary/70 mt-1">{s.tf}</p></div>
                </div>
                <p className="relative text-sm text-white/55 leading-relaxed">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}><div className="text-center mt-10"><Link href={primaryCta} className="group inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3.5 text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/25">Akses Terminal Sekarang <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" /></Link></div></Reveal>
      </div>
    </section>
  )
}

// ── Section: bonus tools (jurnal, backtest, simulator, dll) — modern & informatif ──
const BONUS_TOOLS: { icon: React.ElementType; t: string; d: string; points: string[] }[] = [
  { icon: BookOpen, t: 'Jurnal Trading', d: 'Catat & evaluasi tiap trade emas dengan disiplin.', points: ['Datalitiq Score & equity curve', 'Insight AI: jam & sesi terbaikmu', 'Analisa win-rate & R:R otomatis'] },
  { icon: FlaskConical, t: 'Backtest Tools', d: 'Uji strategi di data historis sebelum pakai uang asli.', points: ['Simulasi entry/exit historis', 'Ukur ekspektasi & drawdown', 'Validasi setup tanpa risiko'] },
  { icon: Zap, t: 'Simulator', d: 'Latih eksekusi & psikologi tanpa menyentuh dana nyata.', points: ['Latihan real-time paper trading', 'Uji position sizing & risiko', 'Bangun jam terbang dengan aman'] },
  { icon: Calculator, t: 'Risk Calculator', d: 'Hitung lot & risiko presisi sebelum entry.', points: ['Lot size dari % risiko', 'Kalkulasi R:R & target', 'Proyeksi profit/loss'] },
]
function BonusSection({ primaryCta }: { primaryCta: string }) {
  return (
    <section className="relative max-w-6xl mx-auto px-6 py-20 md:py-24">
      <Reveal>
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/25 px-3.5 py-1.5 text-xs font-bold text-emerald-400 mb-6"><Sparkles size={13} /> Bonus · Gratis untuk pelanggan Terminal</span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-[1.08]">Bukan Cuma Terminal.<br />Satu Ekosistem Trading Lengkap.</h2>
          <p className="text-base text-white/50 mt-5 leading-relaxed">Setiap langganan Terminal sudah termasuk perangkat pendukung untuk berkembang — tanpa biaya tambahan.</p>
        </div>
      </Reveal>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {BONUS_TOOLS.map((b, i) => (
          <Reveal key={b.t} delay={i * 90}>
            <div className="group relative h-full rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 overflow-hidden hover:border-emerald-500/30 transition-colors">
              <span className="absolute top-4 right-4 text-[9px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5">Gratis</span>
              <div className="absolute -bottom-14 -left-10 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <span className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/12 ring-1 ring-primary/20 text-primary mb-4"><b.icon size={22} /></span>
              <p className="relative text-base font-black">{b.t}</p>
              <p className="relative text-sm text-white/50 mt-1.5 leading-relaxed">{b.d}</p>
              <ul className="relative mt-4 space-y-1.5">
                {b.points.map(p => <li key={p} className="flex items-start gap-2 text-[12px] text-white/60"><Check size={13} className="text-emerald-400 shrink-0 mt-0.5" />{p}</li>)}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={120}><p className="text-center text-sm text-white/45 mt-10">Semua tools ini <span className="text-emerald-400 font-semibold">otomatis terbuka</span> begitu langganan Terminal aktif. <Link href={primaryCta} className="text-primary font-semibold hover:underline">Akses sekarang →</Link></p></Reveal>
    </section>
  )
}

export function TerminalLanding() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [featureImages, setFeatureImages] = useState<Record<string, string>>({})
  const [clientLogos, setClientLogos] = useState<string[]>([])
  const [paymentLogos, setPaymentLogos] = useState<string[]>([])

  useEffect(() => {
    const sb = createClient()
    // Setiap kolom di-select TERPISAH agar satu kolom yang belum ada (mis. migrasi
    // client_logos belum jalan) tidak ikut menggagalkan kolom lain (logo_url, feature_images).
    sb.from('app_config').select('logo_url, feature_images').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) {
        sb.from('app_config').select('logo_url').eq('id', 1).maybeSingle().then(({ data: d2 }) => setLogoUrl((d2?.logo_url as string | null) ?? null))
        return
      }
      setLogoUrl((data?.logo_url as string | null) ?? null)
      const fi = data?.feature_images
      if (fi && typeof fi === 'object') setFeatureImages(fi as Record<string, string>)
    })
    sb.from('app_config').select('client_logos').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) return // kolom client_logos belum ada — slider pakai fallback teks, tidak masalah
      const cl = data?.client_logos
      if (Array.isArray(cl)) setClientLogos(cl.filter((x): x is string => typeof x === 'string'))
    })
    sb.from('app_config').select('payment_logos').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) return // kolom payment_logos belum ada — baris logo pembayaran disembunyikan
      const pl = data?.payment_logos
      if (Array.isArray(pl)) setPaymentLogos(pl.filter((x): x is string => typeof x === 'string'))
    })
    sb.auth.getSession().then(({ data }) => setLoggedIn(!!data.session))
  }, [])

  const checkoutHref = loggedIn ? '/checkout?plan=terminal&months=1' : `/login?next=${encodeURIComponent('/checkout?plan=terminal&months=1')}`
  const primaryCta = loggedIn ? '/terminal' : checkoutHref
  const heroImage = featureImages['hero']

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#060a09]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {logoUrl ? <BrandLogo url={logoUrl} /> : <span className="text-xl font-black tracking-tight">Datalitiq</span>}
            <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-widest text-primary/80 bg-primary/10 rounded-full px-2 py-0.5">AI Terminal Tools</span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm text-white/60">
            <a href="#cara-kerja" className="hover:text-white transition-colors">Cara Kerja</a>
            <a href="#fitur" className="hover:text-white transition-colors">Fitur</a>
            <a href="#testimoni" className="hover:text-white transition-colors">Testimoni</a>
            <a href="#harga" className="hover:text-white transition-colors">Harga</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:block text-sm font-medium text-white/70 hover:text-white px-3 py-2 transition-colors">Masuk</Link>
            <Link href={primaryCta} className="text-sm font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">{loggedIn ? 'Buka Terminal' : 'Mulai'}</Link>
          </div>
        </div>
      </header>

      {/* ── Hero — terpusat + dashboard besar (gambar bisa diupload admin) ── */}
      <section className="relative overflow-hidden">
        {/* grid halus */}
        <div className="absolute inset-0 pointer-events-none opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '56px 56px', WebkitMaskImage: 'radial-gradient(ellipse 70% 55% at 50% 0%, #000 40%, transparent 100%)', maskImage: 'radial-gradient(ellipse 70% 55% at 50% 0%, #000 40%, transparent 100%)' }} />
        {/* crescent / horizon glow emerald di atas */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-[560px] w-[1100px] h-[1100px] rounded-full pointer-events-none dtq-pulse" style={{ boxShadow: 'inset 0 -2px 40px 0 rgba(52,211,153,0.35), 0 80px 260px 30px rgba(52,211,153,0.18)', border: '1px solid rgba(52,211,153,0.25)' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-primary/12 blur-[150px] rounded-full pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-6 pt-20 md:pt-28 text-center">
          <Reveal>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.06]">
              Terminal <span className="bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 bg-clip-text text-transparent">XAUUSD</span> Kelas Institusi untuk Trader Retail
            </h1>
            <p className="text-lg text-white/55 mt-7 leading-relaxed max-w-xl mx-auto">
              Data makro real-time, sentimen institusi, dan bias harian yang jelas — dalam satu layar. Fokus penuh ke satu instrumen, dianalisa sedalam mungkin.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
              <Link href={primaryCta} className="group inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-7 py-3.5 text-sm font-semibold hover:opacity-90 transition-all shadow-xl shadow-primary/25 hover:shadow-primary/40">
                {loggedIn ? 'Buka Terminal' : `Mulai — ${rp(TERMINAL_PRICE)}/bln`} <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a href="#cara-kerja" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-7 py-3.5 text-sm font-semibold text-white/80 hover:bg-white/5 transition-colors">Lihat Cara Kerja</a>
            </div>
            <p className="text-xs text-white/35 mt-6 flex items-center justify-center gap-1.5"><ShieldCheck size={13} className="text-primary/70" /> Bukan sinyal otomatis — keputusan tetap di tangan Anda</p>
          </Reveal>
        </div>

        {/* Dashboard besar — gambar upload admin (fallback: chart animasi).
            Hanya bagian ATAS gambar yang tampil; sisanya tertutup section logo di depan. */}
        <Reveal delay={150}>
          <div className={`relative max-w-6xl mx-auto px-6 mt-14 md:mt-20 ${heroImage ? '' : 'pb-28 md:pb-36'}`}>
            {heroImage ? (
              <div className="relative rounded-t-2xl border border-white/10 border-b-0 bg-[#0a1210] overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/5">
                {/* chrome bar */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" /><span className="w-2.5 h-2.5 rounded-full bg-amber-400/60" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
                  <span className="ml-3 text-[10px] text-white/30 font-medium">datalitiq.com/terminal</span>
                </div>
                {/* Klip: hanya tampil bagian atas gambar (object-top) */}
                <div className="relative max-h-[260px] md:max-h-[440px] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroImage} alt="Datalitiq AI Terminal" className="w-full h-auto block object-top" />
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto"><HeroChart /></div>
            )}
          </div>
        </Reveal>
      </section>

      {/* ── Client trust slider (overlap di DEPAN gambar hero) ── */}
      <section className="relative z-20 -mt-14 md:-mt-24 border-b border-white/5 py-6 overflow-hidden">
        {/* backdrop: transparan di atas (gambar menembus) → solid di bawah (menutup gambar) */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#060a09]/70 via-[#060a09] to-[#060a09]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <p className="relative text-center text-xs text-white/30 mb-4 pt-4 uppercase tracking-widest">Dipakai trader dari berbagai broker & platform</p>
        <div className="relative">
          {clientLogos.length > 0 ? (
            <div className="flex items-center gap-14 w-max dtq-marquee">
              {[...clientLogos, ...clientLogos].map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="broker" className="h-7 md:h-8 w-auto object-contain opacity-40 hover:opacity-80 transition-opacity grayscale hover:grayscale-0" />
              ))}
            </div>
          ) : (
            <div className="flex gap-12 w-max dtq-marquee">
              {[...CLIENTS, ...CLIENTS].map((b, i) => <span key={i} className="text-sm font-bold text-white/25 whitespace-nowrap">{b}</span>)}
            </div>
          )}
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#060a09] to-transparent" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#060a09] to-transparent" />
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="max-w-5xl mx-auto px-6 py-20 md:py-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {STATS.map((s, i) => (
            <Reveal key={i} delay={i * 80}>
              <div className="group rounded-2xl border border-white/8 bg-white/[0.02] p-6 text-center h-full hover:border-primary/25 transition-colors">
                <span className="mx-auto mb-4 flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 ring-1 ring-primary/20 group-hover:bg-primary/15 transition-colors"><s.icon size={22} className="text-primary" /></span>
                <p className="text-4xl font-black tracking-tight bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">{s.v}</p>
                <p className="text-sm text-white/45 mt-2">{s.l}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Premium AI: mesin analisa data futuristik ── */}
      <PremiumAiSection primaryCta={primaryCta} />

      {/* ── Pasar bergerak (noise → sinyal), imersif ── */}
      <MarketNoiseSection />

      {/* ── Rasakan Bedanya (dua sisi tampil sekaligus) ── */}
      <section className="max-w-5xl mx-auto px-6 py-20 md:py-24">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Rasakan Bedanya.</h2>
            <p className="text-base text-white/45 mt-4">Cara lama yang melelahkan vs cara baru yang menjelaskan.</p>
          </div>
        </Reveal>
        <Reveal delay={100}><CompareToggle primaryCta={primaryCta} /></Reveal>
      </section>

      {/* ── Cara Kerja (stepper interaktif, auto-play) ── */}
      <section id="cara-kerja" className="max-w-6xl mx-auto px-6 py-20 md:py-24">
        <Reveal>
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Dari Ribuan Data,<br />Jadi Satu Bias Harian.</h2>
            <p className="text-base text-white/50 mt-5 leading-relaxed">Harga tiap detik, data ekonomi resmi, posisi institusi, dan berita terkini diproses bersamaan. Datalitiq AI menimbang tiga pilar — makro, teknikal, sentimen — lalu menyaringnya jadi <span className="text-white/80 font-semibold">satu arah yang jelas beserta tingkat keyakinannya</span>. Empat langkah di bawah terjadi otomatis, real-time.</p>
          </div>
        </Reveal>
        <Reveal delay={100}><HowItWorks /></Reveal>
        <Reveal delay={120}>
          <p className="text-center text-sm text-white/45 mt-12 max-w-xl mx-auto">
            <span className="text-primary font-semibold">Asisten analisa</span> — bukan robot auto-trading. Keputusan akhir tetap di tangan Anda.
          </p>
        </Reveal>
      </section>

      {/* ── Fitur (explorer interaktif) ── */}
      <section id="fitur" className="max-w-6xl mx-auto px-6 py-20 md:py-24">
        <Reveal>
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Satu Terminal.<br />Semua yang Institusi Punya.</h2>
            <p className="text-base text-white/45 mt-4">Enam alat analisa, dalam satu layar.</p>
          </div>
        </Reveal>
        <Reveal delay={100}><FeatureBento images={featureImages} /></Reveal>
      </section>

      {/* ── Data-Driven (konsol data futuristik) ── */}
      <DataDrivenSection primaryCta={primaryCta} />

      {/* ── Gaya trading (scalping/intraday/swing) full animasi ── */}
      <TradingStylesSection primaryCta={primaryCta} />

      {/* ── Bonus tools (jurnal, backtest, simulator, dll) ── */}
      <BonusSection primaryCta={primaryCta} />

      {/* ── Testimoni ── */}
      <section id="testimoni" className="max-w-6xl mx-auto px-6 py-20 md:py-24">
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
      <section id="harga" className="max-w-5xl mx-auto px-6 py-20 md:py-24">
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
                <div className="mb-3 flex items-end gap-1.5"><span className="text-5xl font-black tracking-tight">{rp(TERMINAL_PRICE)}</span><span className="text-sm text-white/40 mb-1.5">/ bulan</span></div>
                {/* Spotlight: harga per hari */}
                <div className="mb-3 inline-flex items-center gap-2.5 self-start rounded-2xl border border-primary/30 bg-primary/[0.08] px-4 py-2.5">
                  <span className="text-2xl">☕</span>
                  <div>
                    <p className="text-lg font-black text-primary leading-none">≈ Rp6 ribu <span className="text-sm font-bold text-primary/80">/ hari</span></p>
                    <p className="text-[11px] text-white/55 mt-1">Lebih murah dari secangkir kopi</p>
                  </div>
                </div>
                <p className="text-xs text-white/45 mb-6">Satu keputusan yang lebih jelas sudah menutupnya · akses penuh, tanpa batas · tanpa kontrak, berhenti kapan saja</p>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {['Kesimpulan arah pasar + tingkat keyakinan real-time', 'Analisa makro ekonomi & sentimen pasar', 'Level kunci & konteks multi-timeframe', 'Analisa AI sesuai permintaan', 'Notifikasi kondisi pasar penting'].map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm"><span className="shrink-0 mt-0.5 rounded-full bg-primary/15 p-0.5"><Check size={12} className="text-primary" /></span><span className="text-white/80">{f}</span></li>
                  ))}
                </ul>
                <Link href={checkoutHref} className="group w-full inline-flex items-center justify-center gap-2 text-center rounded-xl px-4 py-3.5 text-sm font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity">Akses Terminal Sekarang <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" /></Link>
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
        {/* Metode pembayaran — logo bisa diupload dari admin */}
        <Reveal>
          <div className="mt-8 text-center">
            {paymentLogos.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mb-4">
                {paymentLogos.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="metode pembayaran" className="h-6 md:h-7 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" />
                ))}
              </div>
            )}
            <p className="inline-flex items-center gap-1.5 text-xs text-white/40"><ShieldCheck size={13} className="text-primary/70" /> Bayar aman via Kartu · QRIS · e-Wallet · Virtual Account · akses aktif otomatis</p>
          </div>
        </Reveal>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-3xl mx-auto px-6 py-20 md:py-24">
        <Reveal><h2 className="text-2xl md:text-3xl font-black tracking-tight text-center mb-10">Pertanyaan yang Sering Ditanya</h2></Reveal>
        <div className="space-y-3">{FAQS.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}</div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <Reveal>
          <div className="relative rounded-3xl overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/15 via-[#0a1110] to-[#0a1110] p-10 md:p-16 text-center">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 blur-[100px] rounded-full pointer-events-none dtq-pulse" />
            <h2 className="relative text-2xl md:text-4xl font-black tracking-tight max-w-2xl mx-auto leading-tight">Berhenti Tebak Arah Market.<br className="hidden md:block" /> Mulai Naik Level dengan Pakai Data.</h2>
            <p className="relative text-sm text-white/60 mt-4 max-w-lg mx-auto">Gabung hari ini seharga ≈ Rp6 ribu/hari — makro, sentimen & bias harian XAU/USD dalam satu terminal. Tanpa kontrak, berhenti kapan saja.</p>
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
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/40">
            <a href="#fitur" className="hover:text-white transition-colors">Fitur</a>
            <a href="#harga" className="hover:text-white transition-colors">Harga</a>
            <Link href="/jurnal-trading-tools" className="hover:text-white transition-colors">Jurnal Tools</Link>
            <Link href="/login" className="hover:text-white transition-colors">Masuk</Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-5 pb-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-white/30 border-t border-white/5 pt-6">
          <Link href="/syarat-ketentuan" className="hover:text-white transition-colors">Syarat & Ketentuan</Link>
          <Link href="/kebijakan-refund" className="hover:text-white transition-colors">Kebijakan Refund</Link>
          <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
          <Link href="/kontak" className="hover:text-white transition-colors">Kontak</Link>
        </div>
        <p className="text-center text-[11px] text-white/25 pb-2 px-5 max-w-3xl mx-auto leading-relaxed">Datalitiq bukan penasihat keuangan berizin. Seluruh analisa adalah alat bantu, bukan rekomendasi investasi. Trading mengandung risiko.</p>
        <p className="text-center text-xs text-white/20 pb-6">© {new Date().getFullYear()} PT Datalitiq Indonesia. All rights reserved.</p>
      </footer>

      <style jsx global>{`
        @keyframes dtq-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .dtq-marquee { animation: dtq-marquee 28s linear infinite; }
        @keyframes dtq-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        .dtq-float { animation: dtq-float 4s ease-in-out infinite; }
        .dtq-float2 { animation: dtq-float 4.5s ease-in-out infinite 0.8s; }
        @keyframes dtq-pulse { 0%,100% { opacity: .6 } 50% { opacity: 1 } }
        .dtq-pulse { animation: dtq-pulse 5s ease-in-out infinite; }
        @keyframes dtq-in-kf { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        .dtq-in { animation: dtq-in-kf .5s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes dtq-pop-kf { from { opacity: 0; transform: scale(.92) } to { opacity: 1; transform: scale(1) } }
        .dtq-pop { animation: dtq-pop-kf .55s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes dtq-sweep-kf { to { transform: rotate(360deg) } }
        .dtq-sweep { animation: dtq-sweep-kf 2.6s linear infinite; }
        @keyframes dtq-blink-kf { 0%,100% { opacity: .2 } 50% { opacity: 1 } }
        .dtq-blink { animation: dtq-blink-kf 1.6s ease-in-out infinite; }
        @keyframes dtq-grow-kf { from { transform: scaleY(0) } }
        .dtq-grow { transform-origin: bottom; animation: dtq-grow-kf .7s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes dtq-reject-kf { 0% { opacity: 0; transform: translateY(8px) } 40% { opacity: 1; transform: none } 100% { opacity: .38; transform: none } }
        .dtq-reject { animation: dtq-reject-kf 1.6s ease-out both; }
        @keyframes dtq-progress-kf { from { width: 0 } to { width: 100% } }
        .dtq-progress { animation: dtq-progress-kf 3.5s linear both; }
        @keyframes dtq-bob-kf { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
        .dtq-bob { animation: dtq-bob-kf 3s ease-in-out infinite; }
        @keyframes dtq-ripple-kf { 0% { transform: scale(1); opacity: .6 } 100% { transform: scale(1.35); opacity: 0 } }
        .dtq-ripple { animation: dtq-ripple-kf 2.8s ease-out infinite; }
        @keyframes dtq-slide-up-kf { from { opacity: 0; transform: translateY(22px) } to { opacity: 1; transform: none } }
        .dtq-slide-up { animation: dtq-slide-up-kf .5s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes dtq-flow-kf { to { stroke-dashoffset: -48 } }
        .dtq-flow { animation: dtq-flow-kf 1.4s linear infinite; }
        @keyframes dtq-corepulse-kf { 0%,100% { opacity: .75; transform: scale(1) } 50% { opacity: 1; transform: scale(1.06) } }
        .dtq-corepulse { transform-box: fill-box; transform-origin: center; animation: dtq-corepulse-kf 2.4s ease-in-out infinite; }
        @keyframes dtq-draw-kf { to { stroke-dashoffset: 0 } }
        .dtq-draw { animation: dtq-draw-kf 1.6s ease-out both; }
        @keyframes dtq-scan-kf { 0% { transform: translateY(-64px) } 100% { transform: translateY(360px) } }
        .dtq-scan { animation: dtq-scan-kf 4s ease-in-out infinite; }
        @keyframes dtq-candle-kf { 0%,100% { transform: scaleY(.45) } 50% { transform: scaleY(1) } }
        .dtq-candle { transform-origin: bottom; animation: dtq-candle-kf 1.15s ease-in-out infinite; }
        @keyframes dtq-fillbar-kf { 0% { width: 6% } 65%,100% { width: var(--w,60%) } }
        .dtq-fillbar { animation: dtq-fillbar-kf 3.2s ease-in-out infinite; }
        @keyframes dtq-drawloop-kf { 0% { stroke-dashoffset: var(--len,340) } 55%,100% { stroke-dashoffset: 0 } }
        .dtq-drawloop { animation: dtq-drawloop-kf 3.4s ease-in-out infinite; }
        @keyframes dtq-driftx-kf { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .dtq-driftx { animation: dtq-driftx-kf 34s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .dtq-marquee, .dtq-float, .dtq-float2, .dtq-pulse, .dtq-in, .dtq-pop, .dtq-sweep, .dtq-blink, .dtq-grow, .dtq-reject, .dtq-progress, .dtq-bob, .dtq-ripple, .dtq-slide-up, .dtq-flow, .dtq-corepulse, .dtq-draw, .dtq-scan, .dtq-candle, .dtq-fillbar, .dtq-drawloop, .dtq-driftx { animation: none } }
      `}</style>
    </div>
  )
}
