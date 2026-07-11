'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { BrandLogo } from '@/components/layout/BrandLogo'
import {
  Sparkles, Brain, Clock, CalendarDays, GitCompare, BookOpen, Gauge,
  Check, ArrowRight, ChevronDown, TrendingUp, ShieldCheck, Crown, LineChart, Zap,
  Star, Wallet, Quote,
} from 'lucide-react'

type Lang = 'id' | 'en'

const BROKERS = ['Exness', 'XM', 'IC Markets', 'FTMO', 'Binance', 'Bybit', 'MIFX', 'Pepperstone', 'OANDA', 'FundedNext', 'Deriv', 'Octa']

const C = {
  id: {
    nav: { features: 'Fitur', pricing: 'Harga', faq: 'FAQ', reviews: 'Testimoni', login: 'Masuk', cta: 'Coba Gratis', dash: 'Buka Dashboard' },
    hero: {
      badge: 'Jurnal & Analitik Trading Bertenaga AI',
      title: ['Berhenti Trading Buta.', 'Ukur Performa Nyata Kamu.'],
      sub: 'Catat, analisa, dan tingkatkan trading kamu dengan AI insight, Datalitiq Score, dan analisa jam terbaik — semua dalam satu dashboard yang cantik.',
      cta1: 'Mulai Gratis', cta2: 'Lihat Fitur', trust: 'Gratis selamanya · Tanpa kartu kredit',
      floatA: 'Win Rate naik 12%', floatB: 'Datalitiq Score 87',
    },
    trustBar: 'Dipercaya trader XAUUSD, Forex, Crypto & Saham',
    stats: [
      { v: 'Rp0', l: 'Biaya untuk mulai' }, { v: '5 mnt', l: 'Setup sampai jalan' },
      { v: '6', l: 'Metrik Datalitiq Score' }, { v: '24/7', l: 'Analisa AI otomatis' },
    ],
    problem: {
      title: 'Kenapa trader rugi terus? Bukan strategi — tapi tidak pernah evaluasi.',
      sub: 'Datalitiq membantu kamu berhenti mengulang kesalahan yang sama.',
      items: [
        { icon: Brain, t: 'Nggak tahu kenapa loss terus', d: 'Kebanyakan trader mengulang kesalahan yang sama karena tak pernah menganalisa datanya sendiri. AI Datalitiq membaca pola tiap trade — jam, hari, pair, strategi — dan kasih tahu apa yang bikin kamu untung & rugi.', tags: ['Insight otomatis', 'Deteksi pola loss', 'Rekomendasi actionable'] },
        { icon: Wallet, t: 'Modal & profit campur aduk', d: 'Kalau modal, deposit, withdraw & profit tercampur, kamu tak pernah tahu apakah benar berkembang. Datalitiq memisahkan semuanya — saldo broker, profit murni, dan Datalitiq Score yang naik dari waktu ke waktu.', tags: ['Pencatatan broker murni', 'Skor 0–100', 'Equity real-time'] },
        { icon: BookOpen, t: 'Trading tanpa evaluasi = tak disiplin', d: 'Trader konsisten bukan yang paling jago, tapi paling disiplin evaluasi. Tanpa jurnal, emosi & overtrade terus berulang. Datalitiq bikin refleksi jadi kebiasaan lewat jurnal + mood harian.', tags: ['Jurnal + mood', 'Deteksi overtrade', 'Reminder konsistensi'] },
      ],
      closer: 'Trading konsisten bukan soal menang terus — tapi tahu persis kenapa kamu menang, dan berhenti mengulang kenapa kamu kalah.',
    },
    featTitle: 'Semua yang kamu butuh untuk jadi trader profitable',
    featSub: 'Dirancang untuk trader yang serius berkembang berbasis data.',
    features: [
      { icon: Gauge, t: 'Datalitiq Score', d: 'Skor performa 0–100 dari 6 metrik trading penting.' },
      { icon: Brain, t: 'Insight by AI', d: 'Temuan otomatis: hari, jam, pair & strategi terbaikmu.' },
      { icon: Clock, t: 'Analisa Jam & Sesi', d: 'Tahu kapan kamu paling cuan: Asia, London, Overlap, NY.' },
      { icon: CalendarDays, t: 'Kalender P&L & Equity', d: 'Lihat progres profit tiap hari dan kurva equity kamu.' },
      { icon: GitCompare, t: 'Komparasi Strategi & Pair', d: 'Bandingkan mana strategi & pair paling menguntungkan.' },
      { icon: BookOpen, t: 'Jurnal Harian + Mood', d: 'Evaluasi psikologi & disiplin trading kamu tiap hari.' },
    ],
    howTitle: 'Cukup 3 langkah untuk mulai',
    how: [
      { t: 'Pilih Broker', d: 'Setup akun broker kamu & saldo awal dalam hitungan detik.' },
      { t: 'Catat Trade', d: 'Input trade harian — win/loss, pair, jam, dan catatan.' },
      { t: 'Dapat Insight', d: 'Dashboard & AI langsung analisa performa kamu otomatis.' },
    ],
    showcase: [
      { icon: LineChart, t: 'Dashboard analitik yang lengkap', d: 'Datalitiq Score, equity curve, drawdown, net P&L harian, dan performa per waktu — divisualisasikan modern dan mudah dibaca.', img: '/landing/dashboard.png' },
      { icon: Brain, t: 'Insight AI yang benar-benar actionable', d: 'Bukan sekadar angka. Datalitiq menganalisa ratusan trade-mu dan memberi rekomendasi konkret: jam terbaik entry, strategi paling profit, hingga peringatan overtrade.', img: '/landing/insight-ai.png' },
      { icon: Clock, t: 'Tahu jam & sesi paling menguntungkan', d: 'Heatmap jam trading, chart P&L per jam, dan performa per sesi (Asia/London/Overlap/NY). Fokuskan energimu di waktu yang benar-benar cuan.', img: '/landing/time-analysis.png' },
    ],
    reviewsTitle: 'Dipakai trader yang serius berkembang',
    reviews: [
      { name: 'Rangga P.', role: 'Trader XAUUSD', text: 'Baru sadar 70% loss saya di jam yang sama. Setelah tahu dari Datalitiq, win rate naik drastis dalam sebulan.', stars: 5 },
      { name: 'Dewi A.', role: 'Swing Trader', text: 'Insight AI-nya nampol. Dia kasih tahu strategi mana yang profit dan mana yang cuma buang modal. Game changer.', stars: 5 },
      { name: 'Bima S.', role: 'Prop Firm Trader', text: 'Jurnal + mood tracker bikin saya jauh lebih disiplin. Overtrade saya turun banyak sejak pakai ini.', stars: 5 },
    ],
    pricingTitle: 'Harga sederhana, transparan',
    pricingSub: 'Mulai gratis. Upgrade kapan pun kamu siap.',
    popular: 'Paling Populer', month: '/bln', forever: 'selamanya',
    plans: [
      { name: 'Standar', price: 'Gratis', tagline: 'Untuk mulai mencatat trading', cta: 'Mulai Gratis', highlight: false, features: ['Catat trade tanpa batas', '1 akun broker', 'Dashboard & statistik dasar', 'Jurnal harian & Kalender P&L', 'Insight AI (3 temuan)'] },
      { name: 'Professional', price: 'Rp99.000', tagline: 'Untuk trader yang serius berkembang', cta: 'Upgrade ke Pro', highlight: true, features: ['Semua fitur Standar', 'Multi akun broker', 'Insight AI lengkap + Datalitiq Score', 'Analisa jam & sesi trading', 'Komparasi strategi & pair', 'Upload screenshot chart', 'Export data (CSV/JSON)', 'Prioritas support'] },
    ],
    faqTitle: 'Pertanyaan yang sering ditanya',
    faqs: [
      { q: 'Apakah data saya aman?', a: 'Ya. Data disimpan aman di Supabase dengan proteksi Row-Level Security — hanya kamu yang bisa mengakses datamu.' },
      { q: 'Apakah bisa untuk banyak akun broker?', a: 'Paket Professional mendukung multi-akun broker. Paket Standar mendukung 1 akun.' },
      { q: 'Bagaimana cara upgrade ke Professional?', a: 'Lewat transfer bank (BCA). Setelah transfer, konfirmasi ke admin via WhatsApp dan akunmu diaktifkan.' },
      { q: 'Apakah perlu kartu kredit untuk daftar?', a: 'Tidak. Paket Standar gratis selamanya tanpa kartu kredit.' },
      { q: 'Broker apa saja yang didukung?', a: 'Semua broker — cukup catat trade-mu manual. Kami mendukung Forex, Crypto, Saham, dan Prop Firm.' },
    ],
    finalTitle: 'Siap trading dengan data, bukan feeling?',
    finalSub: 'Gabung sekarang dan mulai ukur performa trading kamu yang sebenarnya.',
    finalCta: 'Mulai Gratis Sekarang',
    footerTagline: 'Jurnal & analitik trading untuk trader serius.',
  },
  en: {
    nav: { features: 'Features', pricing: 'Pricing', faq: 'FAQ', reviews: 'Reviews', login: 'Sign in', cta: 'Try Free', dash: 'Open Dashboard' },
    hero: {
      badge: 'AI-Powered Trading Journal & Analytics',
      title: ['Stop Trading Blind.', 'Measure Your Real Performance.'],
      sub: 'Log, analyze, and improve your trading with AI insights, the Datalitiq Score, and best-hour analysis — all in one beautiful dashboard.',
      cta1: 'Start Free', cta2: 'See Features', trust: 'Free forever · No credit card',
      floatA: 'Win Rate up 12%', floatB: 'Datalitiq Score 87',
    },
    trustBar: 'Trusted by XAUUSD, Forex, Crypto & Stock traders',
    stats: [
      { v: '$0', l: 'To get started' }, { v: '5 min', l: 'Setup to running' },
      { v: '6', l: 'Datalitiq Score metrics' }, { v: '24/7', l: 'Automatic AI analysis' },
    ],
    problem: {
      title: 'Why do traders keep losing? Not strategy — a lack of evaluation.',
      sub: 'Datalitiq helps you stop repeating the same mistakes.',
      items: [
        { icon: Brain, t: "Don't know why you keep losing", d: 'Most traders repeat the same mistakes because they never analyze their own data. Datalitiq AI reads the pattern of every trade — hour, day, pair, strategy — and tells you what makes you win and lose.', tags: ['Automatic insights', 'Loss-pattern detection', 'Actionable tips'] },
        { icon: Wallet, t: 'Capital & profit all mixed up', d: 'When capital, deposits, withdrawals & profit are mixed, you never know if you\'re truly growing. Datalitiq separates it all — broker balance, pure profit, and a Datalitiq Score that grows over time.', tags: ['Pure broker tracking', '0–100 score', 'Real-time equity'] },
        { icon: BookOpen, t: 'Trading without evaluation = no discipline', d: 'Consistent traders aren\'t the best — they\'re the most disciplined at evaluating. Without a journal, emotions & overtrading repeat. Datalitiq makes reflection a habit with a daily journal + mood.', tags: ['Journal + mood', 'Overtrade detection', 'Consistency reminders'] },
      ],
      closer: 'Consistent trading isn\'t about always winning — it\'s knowing exactly why you win, and stopping why you lose.',
    },
    featTitle: 'Everything you need to become a profitable trader',
    featSub: 'Built for traders serious about improving with data.',
    features: [
      { icon: Gauge, t: 'Datalitiq Score', d: 'A 0–100 performance score from 6 key trading metrics.' },
      { icon: Brain, t: 'Insight by AI', d: 'Automatic findings: your best day, hour, pair & strategy.' },
      { icon: Clock, t: 'Hour & Session Analysis', d: 'Know when you profit most: Asia, London, Overlap, NY.' },
      { icon: CalendarDays, t: 'P&L Calendar & Equity', d: 'See daily profit progress and your equity curve.' },
      { icon: GitCompare, t: 'Strategy & Pair Comparison', d: 'Compare which strategies & pairs are most profitable.' },
      { icon: BookOpen, t: 'Daily Journal + Mood', d: 'Evaluate your trading psychology & discipline daily.' },
    ],
    howTitle: 'Just 3 steps to get started',
    how: [
      { t: 'Pick Your Broker', d: 'Set up your broker account & starting balance in seconds.' },
      { t: 'Log Trades', d: 'Enter daily trades — win/loss, pair, time, and notes.' },
      { t: 'Get Insights', d: 'Dashboard & AI instantly analyze your performance.' },
    ],
    showcase: [
      { icon: LineChart, t: 'A complete analytics dashboard', d: 'Datalitiq Score, equity curve, drawdown, daily net P&L, and time-of-day performance — visualized cleanly and clearly.', img: '/landing/dashboard.png' },
      { icon: Brain, t: 'AI insights that are actually actionable', d: 'Not just numbers. Datalitiq analyzes hundreds of your trades and gives concrete recommendations: best entry hours, most profitable strategy, even overtrade warnings.', img: '/landing/insight-ai.png' },
      { icon: Clock, t: 'Know your most profitable hours & sessions', d: 'Trading-hour heatmap, P&L-per-hour chart, and per-session performance (Asia/London/Overlap/NY). Focus your energy where it truly pays.', img: '/landing/time-analysis.png' },
    ],
    reviewsTitle: 'Used by traders serious about growth',
    reviews: [
      { name: 'Rangga P.', role: 'XAUUSD Trader', text: 'Realized 70% of my losses were at the same hour. After seeing it in Datalitiq, my win rate jumped in a month.', stars: 5 },
      { name: 'Dewi A.', role: 'Swing Trader', text: 'The AI insights hit hard. It told me which strategy profits and which just burns capital. Game changer.', stars: 5 },
      { name: 'Bima S.', role: 'Prop Firm Trader', text: 'Journal + mood tracker made me way more disciplined. My overtrading dropped a lot since using this.', stars: 5 },
    ],
    pricingTitle: 'Simple, transparent pricing',
    pricingSub: "Start free. Upgrade whenever you're ready.",
    popular: 'Most Popular', month: '/mo', forever: 'forever',
    plans: [
      { name: 'Standard', price: 'Free', tagline: 'To start journaling your trades', cta: 'Start Free', highlight: false, features: ['Unlimited trade logging', '1 broker account', 'Basic dashboard & stats', 'Daily journal & P&L calendar', 'AI Insights (3 findings)'] },
      { name: 'Professional', price: '$7', tagline: 'For traders serious about growth', cta: 'Upgrade to Pro', highlight: true, features: ['Everything in Standard', 'Multiple broker accounts', 'Full AI Insights + Datalitiq Score', 'Hour & session analysis', 'Strategy & pair comparison', 'Chart screenshot upload', 'Data export (CSV/JSON)', 'Priority support'] },
    ],
    faqTitle: 'Frequently asked questions',
    faqs: [
      { q: 'Is my data safe?', a: 'Yes. Data is stored securely in Supabase with Row-Level Security — only you can access your data.' },
      { q: 'Can I use multiple broker accounts?', a: 'The Professional plan supports multiple broker accounts. Standard supports 1 account.' },
      { q: 'How do I upgrade to Professional?', a: 'Via bank transfer (BCA). After transferring, confirm with admin on WhatsApp and your account is activated.' },
      { q: 'Do I need a credit card to sign up?', a: 'No. The Standard plan is free forever with no credit card.' },
      { q: 'Which brokers are supported?', a: 'All brokers — just log your trades manually. We support Forex, Crypto, Stocks, and Prop Firms.' },
    ],
    finalTitle: 'Ready to trade with data, not feelings?',
    finalSub: 'Join now and start measuring your real trading performance.',
    finalCta: 'Start Free Now',
    footerTagline: 'Trading journal & analytics for serious traders.',
  },
}

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

// ── CSS mockup fallback ──
function Mockup() {
  return (
    <div className="p-4 space-y-3 bg-[#0a1210]">
      <div className="grid grid-cols-4 gap-2">
        {[['w-8', 'bg-white/40'], ['w-10', 'bg-primary/60'], ['w-12', 'bg-emerald-400/60'], ['w-9', 'bg-emerald-400/60']].map(([w, c], i) => (
          <div key={i} className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5"><div className="h-1.5 w-8 rounded bg-white/10 mb-2" /><div className={`h-3 ${w} rounded ${c}`} /></div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex flex-col items-center justify-center">
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90"><circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" /><circle cx="32" cy="32" r="27" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round" strokeDasharray="130 170" /></svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-emerald-400">87</span>
          </div>
          <span className="text-[9px] text-white/40 mt-1">Datalitiq Score</span>
        </div>
        <div className="col-span-2 rounded-xl bg-white/[0.03] border border-white/5 p-3">
          <svg viewBox="0 0 200 70" className="w-full h-full" preserveAspectRatio="none">
            <defs><linearGradient id="lgm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity="0.4" /><stop offset="100%" stopColor="#10b981" stopOpacity="0" /></linearGradient></defs>
            <path d="M0,55 L25,50 L50,52 L75,38 L100,42 L125,28 L150,30 L175,15 L200,18 L200,70 L0,70 Z" fill="url(#lgm)" />
            <path d="M0,55 L25,50 L50,52 L75,38 L100,42 L125,28 L150,30 L175,15 L200,18" fill="none" stroke="#10b981" strokeWidth="2" />
          </svg>
        </div>
      </div>
      <div className="rounded-xl bg-gradient-to-br from-primary/15 to-transparent border border-primary/20 p-3 flex items-center gap-2.5">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20"><Sparkles size={14} className="text-primary" /></span>
        <div className="space-y-1"><div className="h-1.5 w-40 rounded bg-white/20" /><div className="h-1.5 w-28 rounded bg-white/10" /></div>
      </div>
    </div>
  )
}

// ── Browser-frame screenshot (dummy fallback jika file belum ada) ──
function Shot({ src, alt }: { src?: string; alt?: string }) {
  const [err, setErr] = useState(false)
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a1210] shadow-2xl shadow-black/60 overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
        <span className="w-3 h-3 rounded-full bg-red-500/60" /><span className="w-3 h-3 rounded-full bg-yellow-500/60" /><span className="w-3 h-3 rounded-full bg-emerald-500/60" />
        <span className="ml-3 text-[10px] text-white/30 font-mono truncate">datalitiq.app</span>
      </div>
      {src && !err
        ? <img src={src} alt={alt} onError={() => setErr(true)} className="w-full block" />
        : <Mockup />}
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

export function LandingPage() {
  const [lang, setLang] = useState<Lang>('id')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const t = C[lang]

  useEffect(() => {
    const stored = (typeof window !== 'undefined' && localStorage.getItem('dtq_lang')) as Lang | null
    if (stored === 'en' || stored === 'id') setLang(stored)
    const sb = createClient()
    sb.from('app_config').select('logo_url').eq('id', 1).maybeSingle().then(({ data }) => setLogoUrl((data?.logo_url as string | null) ?? null))
    sb.auth.getSession().then(({ data }) => setLoggedIn(!!data.session))
  }, [])

  function switchLang(l: Lang) { setLang(l); if (typeof window !== 'undefined') localStorage.setItem('dtq_lang', l) }

  const primaryHref = loggedIn ? '/dashboard' : '/login'

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#060a09]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1.5">{logoUrl ? <BrandLogo url={logoUrl} /> : <span className="text-xl font-black tracking-tight">Datalitiq</span>}</div>
          <nav className="hidden md:flex items-center gap-7 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition-colors">{t.nav.features}</a>
            <a href="#reviews" className="hover:text-white transition-colors">{t.nav.reviews}</a>
            <a href="#pricing" className="hover:text-white transition-colors">{t.nav.pricing}</a>
            <a href="#faq" className="hover:text-white transition-colors">{t.nav.faq}</a>
          </nav>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-white/5 p-0.5 text-xs font-semibold">
              {(['id', 'en'] as Lang[]).map(l => (
                <button key={l} onClick={() => switchLang(l)} className={`px-2 py-1 rounded-md transition-colors ${lang === l ? 'bg-white/10 text-white' : 'text-white/40'}`}>{l.toUpperCase()}</button>
              ))}
            </div>
            <Link href="/login" className="hidden sm:block text-sm font-medium text-white/70 hover:text-white px-3 py-2 transition-colors">{t.nav.login}</Link>
            <Link href={primaryHref} className="text-sm font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">{loggedIn ? t.nav.dash : t.nav.cta}</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[560px] bg-primary/15 blur-[150px] rounded-full pointer-events-none dtq-pulse" />
        <div className="absolute top-40 right-0 w-72 h-72 bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-5 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 ring-1 ring-primary/25 px-3 py-1 text-xs font-semibold text-primary mb-6">
              <Sparkles size={13} /> {t.hero.badge}
            </span>
            <h1 className="text-4xl md:text-[3.4rem] font-black tracking-tight leading-[1.05]">
              {t.hero.title[0]}<br />
              <span className="bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 bg-clip-text text-transparent">{t.hero.title[1]}</span>
            </h1>
            <p className="text-base text-white/60 mt-5 leading-relaxed max-w-lg">{t.hero.sub}</p>
            <div className="flex flex-wrap items-center gap-3 mt-7">
              <Link href={primaryHref} className="group inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-semibold hover:opacity-90 transition-all shadow-xl shadow-primary/25 hover:shadow-primary/40">
                {loggedIn ? t.nav.dash : t.hero.cta1} <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a href="#features" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 transition-colors">{t.hero.cta2}</a>
            </div>
            <p className="text-xs text-white/40 mt-4 flex items-center gap-1.5"><ShieldCheck size={13} className="text-primary" /> {t.hero.trust}</p>
          </Reveal>
          <Reveal delay={150} className="lg:pl-6">
            <div className="relative">
              <Shot src="/landing/dashboard.png" alt="Datalitiq Dashboard" />
              {/* floating badges */}
              <div className="absolute -left-4 top-16 hidden sm:flex items-center gap-2 rounded-xl bg-[#0d1614] ring-1 ring-emerald-500/30 px-3 py-2 shadow-xl dtq-float">
                <TrendingUp size={15} className="text-emerald-400" /><span className="text-xs font-semibold">{t.hero.floatA}</span>
              </div>
              <div className="absolute -right-3 bottom-14 hidden sm:flex items-center gap-2 rounded-xl bg-[#0d1614] ring-1 ring-primary/30 px-3 py-2 shadow-xl dtq-float2">
                <Gauge size={15} className="text-primary" /><span className="text-xs font-semibold">{t.hero.floatB}</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Broker marquee ── */}
      <section className="border-y border-white/5 bg-white/[0.015] py-6 overflow-hidden">
        <p className="text-center text-xs text-white/30 mb-4 uppercase tracking-widest">{t.trustBar}</p>
        <div className="relative">
          <div className="flex gap-12 w-max dtq-marquee">
            {[...BROKERS, ...BROKERS].map((b, i) => (
              <span key={i} className="text-sm font-bold text-white/25 whitespace-nowrap">{b}</span>
            ))}
          </div>
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#060a09] to-transparent" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#060a09] to-transparent" />
        </div>
      </section>

      {/* ── Stats band ── */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {t.stats.map((s, i) => (
            <Reveal key={i} delay={i * 80}>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-center">
                <p className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">{s.v}</p>
                <p className="text-xs text-white/45 mt-1">{s.l}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Problem → Solution (diperkuat) ── */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">{t.problem.title}</h2>
            <p className="text-sm text-white/50 mt-3">{t.problem.sub}</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {t.problem.items.map((it, i) => (
            <Reveal key={i} delay={i * 120}>
              <div className="h-full rounded-2xl border border-white/8 bg-white/[0.02] p-6 hover:border-primary/25 transition-colors">
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/12 ring-1 ring-primary/20 mb-4"><it.icon size={20} className="text-primary" /></span>
                <p className="text-base font-bold text-white mb-2">{it.t}</p>
                <p className="text-sm text-white/55 leading-relaxed mb-4">{it.d}</p>
                <div className="flex flex-wrap gap-1.5">
                  {it.tags.map(tag => <span key={tag} className="text-[10px] font-semibold text-primary/80 bg-primary/10 rounded-full px-2 py-0.5">{tag}</span>)}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={150}>
          <div className="mt-8 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 to-transparent p-6 text-center">
            <Quote size={20} className="text-primary/60 mx-auto mb-2" />
            <p className="text-base md:text-lg font-semibold text-white/90 max-w-3xl mx-auto leading-relaxed">{t.problem.closer}</p>
          </div>
        </Reveal>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-16">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">{t.nav.features}</span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">{t.featTitle}</h2>
            <p className="text-sm text-white/50 mt-3">{t.featSub}</p>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {t.features.map((f, i) => (
            <Reveal key={i} delay={(i % 3) * 100}>
              <div className="h-full rounded-2xl border border-white/8 bg-white/[0.02] p-6 hover:border-primary/25 hover:bg-white/[0.04] transition-all hover:-translate-y-1">
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/12 ring-1 ring-primary/20 mb-4"><f.icon size={20} className="text-primary" /></span>
                <p className="text-base font-bold mb-1.5">{f.t}</p>
                <p className="text-sm text-white/55 leading-relaxed">{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <Reveal><h2 className="text-2xl md:text-3xl font-black tracking-tight text-center mb-12">{t.howTitle}</h2></Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {t.how.map((s, i) => (
            <Reveal key={i} delay={i * 120}>
              <div className="relative h-full rounded-2xl border border-white/8 bg-white/[0.02] p-6">
                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground font-black text-sm mb-4">{i + 1}</span>
                <p className="text-base font-bold mb-1.5">{s.t}</p>
                <p className="text-sm text-white/55 leading-relaxed">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Showcase (zigzag dengan screenshot) ── */}
      <section className="max-w-6xl mx-auto px-5 py-10 space-y-20">
        {t.showcase.map((s, i) => (
          <Reveal key={i}>
            <div className={`grid lg:grid-cols-2 gap-10 items-center ${i % 2 ? 'lg:[direction:rtl]' : ''}`}>
              <div className="lg:[direction:ltr]">
                <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/12 ring-1 ring-primary/20 mb-5"><s.icon size={22} className="text-primary" /></span>
                <h3 className="text-2xl font-black tracking-tight leading-tight">{s.t}</h3>
                <p className="text-base text-white/60 mt-4 leading-relaxed">{s.d}</p>
              </div>
              <div className="lg:[direction:ltr]"><Shot src={s.img} alt={s.t} /></div>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ── Testimoni ── */}
      <section id="reviews" className="max-w-6xl mx-auto px-5 py-16">
        <Reveal><h2 className="text-2xl md:text-3xl font-black tracking-tight text-center mb-12">{t.reviewsTitle}</h2></Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {t.reviews.map((r, i) => (
            <Reveal key={i} delay={i * 120}>
              <div className="h-full rounded-2xl border border-white/8 bg-white/[0.02] p-6 flex flex-col">
                <div className="flex gap-0.5 mb-3">{Array.from({ length: r.stars }).map((_, k) => <Star key={k} size={14} className="text-amber-400 fill-amber-400" />)}</div>
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

      {/* ── Pricing ── */}
      <section id="pricing" className="max-w-4xl mx-auto px-5 py-16">
        <Reveal>
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">{t.nav.pricing}</span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">{t.pricingTitle}</h2>
            <p className="text-sm text-white/50 mt-3">{t.pricingSub}</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-5">
          {t.plans.map((p, i) => (
            <Reveal key={i} delay={i * 120}>
              <div className={`relative rounded-3xl p-[1px] h-full ${p.highlight ? 'bg-gradient-to-br from-primary/70 via-primary/20 to-cyan-500/30' : 'bg-white/10'}`}>
                <div className="rounded-3xl bg-[#0a1110] h-full p-7 flex flex-col">
                  {p.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full">{t.popular}</span>}
                  <div className="flex items-center gap-2 mb-1">
                    {p.highlight ? <Crown size={18} className="text-primary" /> : <Sparkles size={18} className="text-white/60" />}
                    <h3 className="text-xl font-black">{p.name}</h3>
                  </div>
                  <p className="text-xs text-white/45 mb-5">{p.tagline}</p>
                  <div className="flex items-end gap-1.5 mb-6">
                    <span className="text-4xl font-black tracking-tight">{p.price}</span>
                    <span className="text-sm text-white/40 mb-1">{p.price === 'Gratis' || p.price === 'Free' ? `· ${t.forever}` : t.month}</span>
                  </div>
                  <ul className="space-y-2.5 mb-7 flex-1">
                    {p.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <span className={`shrink-0 mt-0.5 rounded-full p-0.5 ${p.highlight ? 'bg-primary/15' : 'bg-white/10'}`}><Check size={12} className={p.highlight ? 'text-primary' : 'text-white/60'} /></span>
                        <span className="text-white/80">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={primaryHref} className={`w-full text-center rounded-xl px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 ${p.highlight ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'bg-white/10 text-white'}`}>{p.cta}</Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-3xl mx-auto px-5 py-16">
        <Reveal><h2 className="text-2xl md:text-3xl font-black tracking-tight text-center mb-10">{t.faqTitle}</h2></Reveal>
        <div className="space-y-3">{t.faqs.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}</div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <Reveal>
          <div className="relative rounded-3xl overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/15 via-[#0a1110] to-[#0a1110] p-10 md:p-16 text-center">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 blur-[100px] rounded-full pointer-events-none dtq-pulse" />
            <h2 className="relative text-2xl md:text-4xl font-black tracking-tight max-w-2xl mx-auto leading-tight">{t.finalTitle}</h2>
            <p className="relative text-sm text-white/60 mt-4 max-w-lg mx-auto">{t.finalSub}</p>
            <Link href={primaryHref} className="relative inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-8 py-4 text-sm font-semibold mt-7 hover:opacity-90 transition-opacity shadow-xl shadow-primary/30">
              {loggedIn ? t.nav.dash : t.finalCta} <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {logoUrl ? <BrandLogo url={logoUrl} /> : <span className="text-lg font-black tracking-tight">Datalitiq</span>}
            <span className="text-xs text-white/30 hidden sm:inline">· {t.footerTagline}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <a href="#features" className="hover:text-white transition-colors">{t.nav.features}</a>
            <a href="#pricing" className="hover:text-white transition-colors">{t.nav.pricing}</a>
            <Link href="/login" className="hover:text-white transition-colors">{t.nav.login}</Link>
          </div>
        </div>
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
      `}</style>
    </div>
  )
}
