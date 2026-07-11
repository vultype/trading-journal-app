'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { BrandLogo } from '@/components/layout/BrandLogo'
import {
  Sparkles, Brain, Clock, CalendarDays, GitCompare, BookOpen, Gauge, Wallet,
  Check, ArrowRight, ChevronDown, TrendingUp, ShieldCheck, Crown, LineChart, Zap,
} from 'lucide-react'

type Lang = 'id' | 'en'

const BROKERS = ['Exness', 'XM', 'IC Markets', 'FTMO', 'Binance', 'Bybit', 'MIFX', 'Pepperstone']

const C = {
  id: {
    nav: { features: 'Fitur', pricing: 'Harga', faq: 'FAQ', login: 'Masuk', cta: 'Coba Gratis', dash: 'Buka Dashboard' },
    hero: {
      badge: 'Jurnal & Analitik Trading Bertenaga AI',
      title: ['Berhenti Trading Buta.', 'Ukur Performa Nyata Kamu.'],
      sub: 'Catat, analisa, dan tingkatkan trading kamu dengan AI insight, Datalitiq Score, dan analisa jam terbaik — semua dalam satu dashboard modern.',
      cta1: 'Mulai Gratis', cta2: 'Lihat Fitur', trust: 'Gratis selamanya · Tanpa kartu kredit',
    },
    trustBar: 'Cocok untuk trader XAUUSD, Forex, Crypto & Saham',
    problem: {
      title: 'Kebanyakan trader rugi bukan karena strategi, tapi karena tidak evaluasi.',
      items: [
        { t: 'Nggak tahu kenapa loss terus', d: 'Datalitiq kasih insight otomatis: hari, jam, dan strategi mana yang bikin kamu rugi.' },
        { t: 'Modal & profit campur aduk', d: 'Pencatatan murni broker — saldo, deposit, withdraw, dan profit trading terpisah rapi.' },
        { t: 'Trading tanpa refleksi', d: 'Jurnal harian + kalender P&L bikin kamu konsisten mengevaluasi setiap keputusan.' },
      ],
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
      { icon: Brain, t: 'Insight AI yang benar-benar actionable', d: 'Bukan sekadar angka. Datalitiq menganalisa ratusan trade-mu dan memberi rekomendasi konkret: jam terbaik entry, strategi paling profit, hingga peringatan overtrade.' },
      { icon: LineChart, t: 'Dashboard analitik yang lengkap', d: 'Equity curve, drawdown, net P&L harian, distribusi win rate, dan performa per waktu — divisualisasikan modern dan mudah dibaca.' },
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
    ],
    finalTitle: 'Siap trading dengan data, bukan feeling?',
    finalSub: 'Gabung sekarang dan mulai ukur performa trading kamu yang sebenarnya.',
    finalCta: 'Mulai Gratis Sekarang',
    footerTagline: 'Jurnal & analitik trading untuk trader serius.',
  },
  en: {
    nav: { features: 'Features', pricing: 'Pricing', faq: 'FAQ', login: 'Sign in', cta: 'Try Free', dash: 'Open Dashboard' },
    hero: {
      badge: 'AI-Powered Trading Journal & Analytics',
      title: ['Stop Trading Blind.', 'Measure Your Real Performance.'],
      sub: 'Log, analyze, and improve your trading with AI insights, the Datalitiq Score, and best-hour analysis — all in one modern dashboard.',
      cta1: 'Start Free', cta2: 'See Features', trust: 'Free forever · No credit card',
    },
    trustBar: 'Built for XAUUSD, Forex, Crypto & Stock traders',
    problem: {
      title: 'Most traders lose not because of strategy, but a lack of evaluation.',
      items: [
        { t: "Don't know why you keep losing", d: 'Datalitiq gives automatic insights: which day, hour, and strategy cost you money.' },
        { t: 'Capital & profit all mixed up', d: 'Pure broker tracking — balance, deposits, withdrawals, and trading profit kept clean and separate.' },
        { t: 'Trading without reflection', d: 'Daily journal + P&L calendar keep you consistently evaluating every decision.' },
      ],
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
      { icon: Brain, t: 'AI insights that are actually actionable', d: "Not just numbers. Datalitiq analyzes hundreds of your trades and gives concrete recommendations: best entry hours, most profitable strategy, even overtrade warnings." },
      { icon: LineChart, t: 'A complete analytics dashboard', d: 'Equity curve, drawdown, daily net P&L, win-rate distribution, and time-of-day performance — visualized cleanly and clearly.' },
    ],
    pricingTitle: 'Simple, transparent pricing',
    pricingSub: 'Start free. Upgrade whenever you\'re ready.',
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
    ],
    finalTitle: 'Ready to trade with data, not feelings?',
    finalSub: 'Join now and start measuring your real trading performance.',
    finalCta: 'Start Free Now',
    footerTagline: 'Trading journal & analytics for serious traders.',
  },
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

// Mockup dashboard visual (tanpa gambar asli)
function HeroMockup() {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-[#0a1210] shadow-2xl shadow-black/50 overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
        <span className="w-3 h-3 rounded-full bg-red-500/60" /><span className="w-3 h-3 rounded-full bg-yellow-500/60" /><span className="w-3 h-3 rounded-full bg-emerald-500/60" />
        <span className="ml-3 text-[10px] text-white/30 font-mono">datalitiq.app/dashboard</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {[['Saldo', 'text-white'], ['Deposit', 'text-primary'], ['Profit', 'text-emerald-400'], ['Win Rate', 'text-emerald-400']].map(([l, c], i) => (
            <div key={i} className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
              <div className="h-1.5 w-8 rounded bg-white/10 mb-2" />
              <div className={`h-3 w-12 rounded ${c === 'text-white' ? 'bg-white/40' : c === 'text-primary' ? 'bg-primary/60' : 'bg-emerald-400/60'}`} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {/* score ring */}
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex flex-col items-center justify-center">
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
                <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                <circle cx="32" cy="32" r="27" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round" strokeDasharray="130 170" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-emerald-400">76</span>
            </div>
            <span className="text-[9px] text-white/40 mt-1">Datalitiq Score</span>
          </div>
          {/* equity curve */}
          <div className="col-span-2 rounded-xl bg-white/[0.03] border border-white/5 p-3">
            <svg viewBox="0 0 200 70" className="w-full h-full" preserveAspectRatio="none">
              <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity="0.4" /><stop offset="100%" stopColor="#10b981" stopOpacity="0" /></linearGradient></defs>
              <path d="M0,55 L25,50 L50,52 L75,38 L100,42 L125,28 L150,30 L175,15 L200,18 L200,70 L0,70 Z" fill="url(#lg)" />
              <path d="M0,55 L25,50 L50,52 L75,38 L100,42 L125,28 L150,30 L175,15 L200,18" fill="none" stroke="#10b981" strokeWidth="2" />
            </svg>
          </div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-primary/15 to-transparent border border-primary/20 p-3 flex items-center gap-2.5">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20"><Sparkles size={14} className="text-primary" /></span>
          <div className="space-y-1">
            <div className="h-1.5 w-40 rounded bg-white/20" />
            <div className="h-1.5 w-28 rounded bg-white/10" />
          </div>
        </div>
      </div>
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
  const primaryLabel = loggedIn ? t.nav.dash : t.hero.cta1

  return (
    <div className="min-h-screen bg-[#060a09] text-white">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#060a09]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1.5">{logoUrl ? <BrandLogo url={logoUrl} /> : <span className="text-xl font-black tracking-tight">Datalitiq</span>}</div>
          <nav className="hidden md:flex items-center gap-7 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition-colors">{t.nav.features}</a>
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
            <Link href={primaryHref} className="text-sm font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 transition-opacity">{loggedIn ? t.nav.dash : t.nav.cta}</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/15 blur-[140px] rounded-full pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-5 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 ring-1 ring-primary/25 px-3 py-1 text-xs font-semibold text-primary mb-6">
              <Sparkles size={13} /> {t.hero.badge}
            </span>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.1]">
              {t.hero.title[0]}<br /><span className="text-primary">{t.hero.title[1]}</span>
            </h1>
            <p className="text-base text-white/60 mt-5 leading-relaxed max-w-lg">{t.hero.sub}</p>
            <div className="flex flex-wrap items-center gap-3 mt-7">
              <Link href={primaryHref} className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity">
                {primaryLabel} <ArrowRight size={16} />
              </Link>
              <a href="#features" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 transition-colors">{t.hero.cta2}</a>
            </div>
            <p className="text-xs text-white/40 mt-4 flex items-center gap-1.5"><ShieldCheck size={13} className="text-primary" /> {t.hero.trust}</p>
          </div>
          <div className="lg:pl-6"><HeroMockup /></div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="border-y border-white/5 bg-white/[0.015]">
        <div className="max-w-6xl mx-auto px-5 py-6">
          <p className="text-center text-xs text-white/30 mb-4 uppercase tracking-widest">{t.trustBar}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {BROKERS.map(b => <span key={b} className="text-sm font-semibold text-white/25">{b}</span>)}
          </div>
        </div>
      </section>

      {/* ── Problem → Solution ── */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-center max-w-2xl mx-auto leading-tight">{t.problem.title}</h2>
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {t.problem.items.map((it, i) => (
            <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
              <p className="text-base font-bold text-white mb-2">{it.t}</p>
              <p className="text-sm text-white/55 leading-relaxed">{it.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">{t.nav.features}</span>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">{t.featTitle}</h2>
          <p className="text-sm text-white/50 mt-3">{t.featSub}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {t.features.map((f, i) => (
            <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 hover:border-primary/25 hover:bg-white/[0.04] transition-colors">
              <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/12 ring-1 ring-primary/20 mb-4"><f.icon size={20} className="text-primary" /></span>
              <p className="text-base font-bold mb-1.5">{f.t}</p>
              <p className="text-sm text-white/55 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-center mb-12">{t.howTitle}</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {t.how.map((s, i) => (
            <div key={i} className="relative rounded-2xl border border-white/8 bg-white/[0.02] p-6">
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground font-black text-sm mb-4">{i + 1}</span>
              <p className="text-base font-bold mb-1.5">{s.t}</p>
              <p className="text-sm text-white/55 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Showcase (zigzag) ── */}
      <section className="max-w-6xl mx-auto px-5 py-10 space-y-16">
        {t.showcase.map((s, i) => (
          <div key={i} className={`grid lg:grid-cols-2 gap-10 items-center ${i % 2 ? 'lg:[direction:rtl]' : ''}`}>
            <div className="lg:[direction:ltr]">
              <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/12 ring-1 ring-primary/20 mb-5"><s.icon size={22} className="text-primary" /></span>
              <h3 className="text-2xl font-black tracking-tight leading-tight">{s.t}</h3>
              <p className="text-base text-white/60 mt-4 leading-relaxed">{s.d}</p>
            </div>
            <div className="lg:[direction:ltr]">
              {i === 0
                ? <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-transparent p-6 space-y-2.5">
                    {[Zap, TrendingUp, Clock].map((Ic, k) => (
                      <div key={k} className="flex items-start gap-3 rounded-xl bg-white/[0.04] ring-1 ring-white/10 px-4 py-3">
                        <Ic size={16} className="text-primary shrink-0 mt-0.5" />
                        <div className="space-y-1.5 w-full"><div className="h-2 w-3/4 rounded bg-white/25" /><div className="h-2 w-1/2 rounded bg-white/10" /></div>
                      </div>
                    ))}
                  </div>
                : <HeroMockup />}
            </div>
          </div>
        ))}
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="max-w-4xl mx-auto px-5 py-20">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">{t.nav.pricing}</span>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">{t.pricingTitle}</h2>
          <p className="text-sm text-white/50 mt-3">{t.pricingSub}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {t.plans.map((p, i) => (
            <div key={i} className={`relative rounded-3xl p-[1px] ${p.highlight ? 'bg-gradient-to-br from-primary/70 via-primary/20 to-cyan-500/30' : 'bg-white/10'}`}>
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
                <Link href={primaryHref} className={`w-full text-center rounded-xl px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 ${p.highlight ? 'bg-primary text-primary-foreground' : 'bg-white/10 text-white'}`}>{p.cta}</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-3xl mx-auto px-5 py-20">
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-center mb-10">{t.faqTitle}</h2>
        <div className="space-y-3">{t.faqs.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}</div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <div className="relative rounded-3xl overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/15 via-[#0a1110] to-[#0a1110] p-10 md:p-14 text-center">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
          <h2 className="relative text-2xl md:text-4xl font-black tracking-tight max-w-2xl mx-auto leading-tight">{t.finalTitle}</h2>
          <p className="relative text-sm text-white/60 mt-4 max-w-lg mx-auto">{t.finalSub}</p>
          <Link href={primaryHref} className="relative inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-7 py-3.5 text-sm font-semibold mt-7 hover:opacity-90 transition-opacity">
            {loggedIn ? t.nav.dash : t.finalCta} <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {logoUrl ? <BrandLogo url={logoUrl} /> : <span className="text-lg font-black tracking-tight">Datalitiq</span>}
            <span className="text-xs text-white/30">· {t.footerTagline}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <a href="#features" className="hover:text-white transition-colors">{t.nav.features}</a>
            <a href="#pricing" className="hover:text-white transition-colors">{t.nav.pricing}</a>
            <Link href="/login" className="hover:text-white transition-colors">{t.nav.login}</Link>
          </div>
        </div>
        <p className="text-center text-xs text-white/20 pb-6">© {new Date().getFullYear()} Datalitiq. All rights reserved.</p>
      </footer>
    </div>
  )
}
