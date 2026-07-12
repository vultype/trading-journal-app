'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { BANK } from '@/lib/pricing'
import {
  TrendingUp, ArrowRight, Check, ChevronDown, ShieldCheck, Zap, Star, Bell,
  Activity, Layers, Crosshair, Waves, Lock, Sparkles, Crown, MessageCircle,
  Quote, BarChart3, Wallet, AtSign, Unlock, CheckCircle2,
} from 'lucide-react'

const GREEN = '#34d399'
const RED = '#f87171'
const waOrder = (item: string) =>
  `https://wa.me/${BANK.wa}?text=${encodeURIComponent(`Halo admin Datalitiq, saya mau order indikator: ${item}. Mohon info cara aktivasi & pembayaran.`)}`
const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID')

// ── Scroll reveal ──
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

// ════════════════════════════ DUMMY CHART MOCKS ════════════════════════════
const CDATA = [
  { o: 26, c: 38, h: 43, l: 23 }, { o: 38, c: 34, h: 41, l: 31 }, { o: 34, c: 47, h: 51, l: 32 },
  { o: 47, c: 44, h: 50, l: 41 }, { o: 44, c: 56, h: 60, l: 42 }, { o: 56, c: 52, h: 58, l: 49 },
  { o: 52, c: 63, h: 67, l: 50 }, { o: 63, c: 70, h: 74, l: 61 }, { o: 70, c: 66, h: 73, l: 63 },
  { o: 66, c: 78, h: 82, l: 64 }, { o: 78, c: 75, h: 81, l: 72 }, { o: 75, c: 88, h: 92, l: 73 },
]

function Candles({ overlay = 'none', signals = true }: { overlay?: 'none' | 'ob' | 'bands' | 'session'; signals?: boolean }) {
  const W = 360, H = 190, pad = 12, n = CDATA.length
  const cw = (W - pad * 2) / n
  const yv = (v: number) => H - 14 - v * 1.55
  const cx = (i: number) => pad + i * cw + cw / 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {[0.2, 0.45, 0.7].map((g, i) => <line key={i} x1="0" x2={W} y1={H * g} y2={H * g} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />)}

      {overlay === 'session' && (
        <>
          <rect x={cx(2) - cw / 2} y="0" width={cw * 3} height={H} fill="rgba(52,211,153,0.06)" />
          <rect x={cx(8) - cw / 2} y="0" width={cw * 3} height={H} fill="rgba(96,165,250,0.07)" />
        </>
      )}
      {overlay === 'ob' && (
        <>
          <rect x={pad} y={yv(50)} width={W - pad * 2} height={yv(41) - yv(50)} fill="rgba(52,211,153,0.10)" stroke="rgba(52,211,153,0.3)" strokeDasharray="3 3" />
          <rect x={pad} y={yv(35)} width={W - pad * 2} height={yv(31) - yv(35)} fill="rgba(248,113,113,0.10)" stroke="rgba(248,113,113,0.3)" strokeDasharray="3 3" />
        </>
      )}
      {overlay === 'bands' && (
        <>
          <polyline points={CDATA.map((d, i) => `${cx(i)},${yv(d.h + 9)}`).join(' ')} fill="none" stroke="rgba(96,165,250,0.5)" strokeWidth="1.5" />
          <polyline points={CDATA.map((d, i) => `${cx(i)},${yv(d.l - 9)}`).join(' ')} fill="none" stroke="rgba(96,165,250,0.5)" strokeWidth="1.5" />
        </>
      )}

      {CDATA.map((d, i) => {
        const up = d.c >= d.o
        const col = up ? GREEN : RED
        const top = yv(Math.max(d.o, d.c)), bot = yv(Math.min(d.o, d.c))
        return (
          <g key={i}>
            <line x1={cx(i)} x2={cx(i)} y1={yv(d.h)} y2={yv(d.l)} stroke={col} strokeWidth="1.4" />
            <rect x={cx(i) - cw * 0.28} width={cw * 0.56} y={top} height={Math.max(2, bot - top)} rx="1" fill={col} />
          </g>
        )
      })}

      {signals && [2, 6].map(i => (
        <g key={i}>
          <path d={`M ${cx(i)} ${yv(CDATA[i].l) + 7} l -5 8 l 10 0 z`} fill={GREEN} />
          <text x={cx(i)} y={yv(CDATA[i].l) + 27} fill={GREEN} fontSize="8.5" fontWeight="800" textAnchor="middle">BUY</text>
        </g>
      ))}
    </svg>
  )
}

function Oscillator() {
  const W = 360, H = 120
  const pts = [10, 22, 34, 58, 76, 82, 66, 42, 28, 20, 38, 64, 84, 70]
  const step = W / (pts.length - 1)
  const yv = (v: number) => H - 10 - (v / 100) * (H - 20)
  const path = pts.map((p, i) => `${i ? 'L' : 'M'} ${i * step} ${yv(p)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <rect x="0" y={yv(100)} width={W} height={yv(70) - yv(100)} fill="rgba(248,113,113,0.08)" />
      <rect x="0" y={yv(30)} width={W} height={yv(0) - yv(30)} fill="rgba(52,211,153,0.08)" />
      <line x1="0" x2={W} y1={yv(70)} y2={yv(70)} stroke="rgba(248,113,113,0.3)" strokeDasharray="4 3" />
      <line x1="0" x2={W} y1={yv(30)} y2={yv(30)} stroke="rgba(52,211,153,0.3)" strokeDasharray="4 3" />
      <path d={path} fill="none" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={5 * step} cy={yv(82)} r="3.5" fill={RED} />
      <circle cx={9 * step} cy={yv(20)} r="3.5" fill={GREEN} />
    </svg>
  )
}

function DashTable() {
  const rows: [string, string, 'up' | 'down' | 'flat'][] = [
    ['M5', 'Bullish', 'up'], ['M15', 'Bullish', 'up'], ['H1', 'Neutral', 'flat'], ['H4', 'Bearish', 'down'], ['D1', 'Bullish', 'up'],
  ]
  const c = { up: 'text-emerald-400 bg-emerald-500/10', down: 'text-red-400 bg-red-500/10', flat: 'text-white/40 bg-white/5' }
  return (
    <div className="w-full space-y-1.5">
      {rows.map(([tf, sig, k]) => (
        <div key={tf} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
          <span className="text-[11px] font-bold text-white/70 tabular-nums">{tf}</span>
          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${c[k]}`}>{sig}</span>
        </div>
      ))}
    </div>
  )
}

function Thumb({ kind }: { kind: string }) {
  if (kind === 'osc') return <Oscillator />
  if (kind === 'dash') return <DashTable />
  if (kind === 'smc') return <Candles overlay="ob" signals={false} />
  if (kind === 'bands') return <Candles overlay="bands" signals={false} />
  if (kind === 'session') return <Candles overlay="session" />
  return <Candles />
}

function SignalPanel() {
  return (
    <div className="rounded-xl bg-[#0b1512]/90 backdrop-blur-md ring-1 ring-primary/25 p-3.5 w-[160px] shadow-2xl">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Live Signal</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 dtq-pulse" />
      </div>
      <div className="text-2xl font-black text-emerald-400 leading-none mb-2.5">BUY</div>
      {[['Trend', 'Bullish', 'text-emerald-400'], ['Confidence', '87%', 'text-white'], ['Volatility', 'Medium', 'text-white/70']].map(([k, v, cls]) => (
        <div key={k} className="flex items-center justify-between text-[11px] py-0.5">
          <span className="text-white/45">{k}</span><span className={`font-bold ${cls}`}>{v}</span>
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════ DATA ════════════════════════════
type Product = { id: string; name: string; tag: string; badge: string | null; rating: number; users: string; price: number; kind: string; desc: string }

const PRODUCTS: Product[] = [
  { id: 'signal-pro', name: 'Signal Pro X', tag: 'Signals', badge: 'Best Seller', rating: 4.9, users: '2.4k', price: 149000, kind: 'candles', desc: 'Sinyal buy/sell otomatis dengan filter tren & konfirmasi momentum. No-repaint.' },
  { id: 'trend-matrix', name: 'Trend Matrix', tag: 'Trend', badge: 'Populer', rating: 4.8, users: '1.8k', price: 129000, kind: 'dash', desc: 'Dashboard tren multi-timeframe dalam satu tabel. Tahu arah pasar sekejap.' },
  { id: 'momentum', name: 'Momentum Oscillator', tag: 'Oscillator', badge: null, rating: 4.7, users: '1.2k', price: 99000, kind: 'osc', desc: 'Deteksi overbought/oversold & divergence otomatis dengan zona dinamis.' },
  { id: 'smc', name: 'Smart Money Concepts', tag: 'SMC', badge: 'Baru', rating: 4.9, users: '980', price: 179000, kind: 'smc', desc: 'Order block, fair value gap & likuiditas ala smart money — auto-plot.' },
  { id: 'volatility', name: 'Volatility Bands', tag: 'S/R', badge: null, rating: 4.6, users: '760', price: 99000, kind: 'bands', desc: 'Support & resistance dinamis yang mengikuti volatilitas real-time.' },
  { id: 'session', name: 'Session Sniper', tag: 'Session', badge: null, rating: 4.8, users: '640', price: 119000, kind: 'session', desc: 'Sinyal berbasis sesi Asia/London/New York dengan high-low otomatis.' },
]

type Bento = { icon: React.ElementType; t: string; d: string; kind: string; tag: string; span: string; wide: boolean }
const BENTO: Bento[] = [
  { icon: Crosshair, t: 'Signal Overlay Suite', d: 'Sinyal entry buy/sell presisi langsung di chart — sudah tersaring tren & momentum, tanpa repaint.', kind: 'candles', tag: 'Signals', span: 'col-span-2 lg:col-span-4', wide: true },
  { icon: Activity, t: 'Oscillator Matrix', d: 'Overbought, oversold & divergence otomatis.', kind: 'osc', tag: 'Oscillator', span: 'col-span-2 lg:col-span-2', wide: false },
  { icon: Layers, t: 'Smart Money Concepts', d: 'Order block & FVG auto-plot.', kind: 'smc', tag: 'SMC', span: 'col-span-2 sm:col-span-1 lg:col-span-2', wide: false },
  { icon: Waves, t: 'Volatility Bands', d: 'S/R dinamis real-time.', kind: 'bands', tag: 'S/R', span: 'col-span-2 sm:col-span-1 lg:col-span-2', wide: false },
  { icon: Bell, t: 'Real-time Alerts', d: 'Notifikasi email & app tiap sinyal.', kind: 'session', tag: 'Alerts', span: 'col-span-2 sm:col-span-1 lg:col-span-2', wide: false },
  { icon: BarChart3, t: 'Multi-Timeframe Dashboard', d: 'Satu panel merangkum bias tren M5 sampai Daily — ambil keputusan tanpa gonta-ganti timeframe.', kind: 'dash', tag: 'Dashboard', span: 'col-span-2 lg:col-span-6', wide: true },
]

type Tier = { id: string; name: string; icon: React.ElementType; monthly: number | null; oneTime?: number; tagline: string; highlight: boolean; features: string[] }
const TIERS: Tier[] = [
  { id: 'starter', name: 'Starter', icon: Sparkles, monthly: 149000, tagline: 'Untuk mulai pakai sinyal', highlight: false, features: ['Akses 3 indikator inti', 'Update selamanya', 'Alert dasar', 'Komunitas Telegram', '1 perangkat'] },
  { id: 'pro', name: 'Pro', icon: Crown, monthly: 299000, tagline: 'Semua indikator + alert real-time', highlight: true, features: ['Semua indikator (6+)', 'Real-time alert (email & app)', 'Dashboard multi-timeframe', 'Akses fitur baru lebih dulu', 'Prioritas support', 'Multi perangkat'] },
  { id: 'lifetime', name: 'Lifetime', icon: Zap, monthly: null, oneTime: 2499000, tagline: 'Sekali bayar, akses selamanya', highlight: false, features: ['Semua fitur Pro', 'Bayar sekali — tanpa langganan', 'Update seumur hidup', 'Badge Founder', 'Slot terbatas'] },
]

const CMP: { label: string; vals: [string, string, string] }[] = [
  { label: 'Jumlah indikator', vals: ['3 inti', '6+ (semua)', '6+ (semua)'] },
  { label: 'No-repaint', vals: ['✓', '✓', '✓'] },
  { label: 'Real-time alert', vals: ['Dasar', '✓', '✓'] },
  { label: 'Dashboard multi-TF', vals: ['—', '✓', '✓'] },
  { label: 'Multi perangkat', vals: ['—', '✓', '✓'] },
  { label: 'Update', vals: ['Selama aktif', 'Selama aktif', 'Selamanya'] },
  { label: 'Support', vals: ['Komunitas', 'Prioritas', 'Prioritas'] },
]

const STEPS = [
  { n: 1, icon: Wallet, t: 'Pilih paket & bayar', d: 'Transfer ke rekening Mandiri. Pesanan kamu langsung tercatat & diverifikasi.' },
  { n: 2, icon: AtSign, t: 'Kirim username TradingView', d: 'Cukup kirim username TradingView kamu ke admin lewat WhatsApp — tanpa install apa pun.' },
  { n: 3, icon: Unlock, t: 'Akses langsung aktif', d: 'Indikator muncul di daftar “Invite-only scripts” kamu. Source code tetap terlindungi.' },
]

const REVIEWS = [
  { name: 'Bagas W.', role: 'Scalper XAUUSD', text: 'Signal Pro X bener-bener no-repaint. Win rate scalping gold naik jauh sejak filter tren-nya aktif.', stars: 5 },
  { name: 'Nadia R.', role: 'Swing Forex', text: 'Dashboard multi-TF hemat waktu banget. Nggak perlu buka 5 chart cuma buat cek bias tren.', stars: 5 },
  { name: 'Fikri A.', role: 'Crypto Trader', text: 'SMC-nya auto-plot order block rapi. Proses aktivasi via TradingView juga cepet, tinggal kasih username.', stars: 5 },
]

const FAQS = [
  { q: 'Apakah indikatornya repaint?', a: 'Tidak. Semua sinyal terkunci (fixed) setelah candle close — yang kamu lihat di masa lalu sama dengan yang muncul real-time. Bebas repaint.' },
  { q: 'Bagaimana cara akses setelah bayar?', a: 'Sistemnya invite-only lewat TradingView. Setelah bayar, kirim username TradingView kamu ke admin. Admin mengaktifkan akses, dan indikator langsung muncul di daftar Invite-only scripts kamu. Source code tidak pernah dibagikan.' },
  { q: 'Perlu akun TradingView berbayar?', a: 'Tidak wajib — akun gratis pun bisa memakai indikator. Sebagian fitur multi-timeframe memerlukan paket TradingView berbayar (batasan dari TradingView, bukan dari kami).' },
  { q: 'Apakah dapat update?', a: 'Ya. Selama langganan aktif kamu otomatis dapat semua update & indikator baru. Paket Lifetime dapat update selamanya.' },
  { q: 'Bisa untuk MT4/MT5?', a: 'Saat ini fokus di TradingView (Pine Script). Versi MetaTrader sedang dikembangkan — hubungi admin untuk info lebih lanjut.' },
  { q: 'Ada garansi?', a: 'Ada masa coba. Kalau dalam 7 hari kamu merasa tidak cocok, hubungi admin untuk pengembalian dana.' },
]

// ════════════════════════════ BENTO TILE ════════════════════════════
function BentoTile({ item, index }: { item: Bento; index: number }) {
  const { icon: Icon, t: title, d, kind, tag, wide } = item
  return (
    <div className={`group relative h-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-5 overflow-hidden hover:border-primary/30 transition-colors ${wide ? 'md:flex md:items-center md:gap-6' : ''}`}>
      <div className="absolute inset-0 dtq-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
      <span className="absolute top-3 right-4 text-4xl font-black text-white/[0.04] select-none">{String(index + 1).padStart(2, '0')}</span>
      <div className={`relative ${wide ? 'md:flex-1' : ''}`}>
        <div className="flex items-center gap-2 mb-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/15 ring-1 ring-primary/25"><Icon size={17} className="text-primary" /></span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-primary/80 bg-primary/10 rounded-full px-2 py-0.5">{tag}</span>
        </div>
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="text-xs text-white/45 mt-1 leading-relaxed">{d}</p>
      </div>
      <div className={`relative flex items-center justify-center rounded-xl bg-black/30 border border-white/[0.06] p-3 ${wide ? 'mt-4 md:mt-0 md:w-[48%]' : 'mt-4'}`}>
        <Thumb kind={kind} />
      </div>
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

// ════════════════════════════ PAGE ════════════════════════════
export function IndicatorMarket() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [yearly, setYearly] = useState(false)

  useEffect(() => {
    createClient().from('app_config').select('logo_url').eq('id', 1).maybeSingle()
      .then(({ data }) => setLogoUrl((data?.logo_url as string | null) ?? null))
  }, [])

  const tierPrice = (t: Tier) => {
    if (t.monthly == null) return t.oneTime ?? 0
    return yearly ? Math.round(t.monthly * 12 * 0.65 / 1000) * 1000 : t.monthly
  }

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#060a09]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5">{logoUrl ? <BrandLogo url={logoUrl} /> : <span className="text-xl font-black tracking-tight">Datalitiq</span>}</Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-white/60">
            <a href="#showcase" className="hover:text-white transition-colors">Fitur</a>
            <a href="#catalog" className="hover:text-white transition-colors">Indikator</a>
            <a href="#access" className="hover:text-white transition-colors">Cara Akses</a>
            <a href="#pricing" className="hover:text-white transition-colors">Harga</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden sm:block text-sm font-medium text-white/70 hover:text-white px-3 py-2 transition-colors">Jurnal</Link>
            <a href="#pricing" className="text-sm font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">Lihat Harga</a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative max-w-6xl mx-auto px-5 pt-16 pb-12 md:pt-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_70%_20%,rgba(52,211,153,0.10),transparent)]" />
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-5">
              <Sparkles size={13} /> Indikator Premium · TradingView
            </span>
            <h1 className="text-4xl md:text-5xl font-black leading-[1.08] tracking-tight">
              Indikator Trading Premium.
              <span className="block text-primary mt-1">Sinyal Presisi, Bukan Tebakan.</span>
            </h1>
            <p className="text-white/55 mt-5 text-[15px] leading-relaxed max-w-md">
              Koleksi indikator no-repaint untuk XAUUSD, Forex & Crypto — sinyal entry, deteksi tren, dan smart money concepts langsung di chart TradingView kamu.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-7">
              <a href="#catalog" className="group inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-semibold hover:opacity-90 transition-all shadow-xl shadow-primary/25">
                Lihat Indikator <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a href="#access" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 transition-colors">Cara Akses</a>
            </div>
            <div className="flex items-center gap-4 mt-6 text-xs text-white/45">
              <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-primary" /> No-repaint</span>
              <span className="flex items-center gap-1.5"><Bell size={13} className="text-primary" /> Real-time alert</span>
              <span className="flex items-center gap-1.5"><Lock size={13} className="text-primary" /> Invite-only</span>
            </div>
          </div>

          {/* Chart mockup */}
          <div className="relative">
            <div className="rounded-2xl border border-white/10 bg-[#0a1210] shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 h-10 border-b border-white/5 bg-white/[0.02]">
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" /><span className="w-2.5 h-2.5 rounded-full bg-white/15" /><span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="ml-2 text-[11px] font-semibold text-white/40">XAUUSD · 15m · Signal Pro X</span>
                <span className="ml-auto text-[10px] font-bold text-emerald-400 bg-emerald-500/10 rounded px-1.5 py-0.5">+2.14%</span>
              </div>
              <div className="p-4"><Candles /></div>
              <div className="px-4 pb-4"><Oscillator /></div>
            </div>
            <div className="absolute -right-3 top-16 hidden sm:block dtq-float"><SignalPanel /></div>
            <div className="absolute -left-4 bottom-20 hidden sm:flex items-center gap-2 rounded-xl bg-[#0d1614] ring-1 ring-emerald-500/30 px-3 py-2 shadow-xl dtq-float2">
              <Bell size={14} className="text-emerald-400" /><span className="text-[11px] font-semibold">Alert: BUY XAUUSD</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust marquee ── */}
      <section className="border-y border-white/5 py-6 overflow-hidden">
        <p className="text-center text-xs text-white/40 mb-4">Dipakai 5.000+ trader di berbagai platform</p>
        <div className="relative overflow-hidden">
          <div className="flex gap-12 w-max dtq-marquee px-6">
            {[...['TradingView', 'MetaTrader 4', 'MetaTrader 5', 'Exness', 'IC Markets', 'Binance', 'Bybit', 'FTMO'], ...['TradingView', 'MetaTrader 4', 'MetaTrader 5', 'Exness', 'IC Markets', 'Binance', 'Bybit', 'FTMO']].map((b, i) => (
              <span key={i} className="text-white/25 font-bold text-lg whitespace-nowrap">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="max-w-5xl mx-auto px-5 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[['6+', 'Indikator premium'], ['5.000+', 'Trader aktif'], ['No-repaint', 'Sinyal terkunci'], ['24/7', 'Alert otomatis']].map(([v, l]) => (
            <Reveal key={l} className="text-center rounded-2xl border border-white/8 bg-white/[0.02] py-6">
              <div className="text-2xl md:text-3xl font-black text-primary">{v}</div>
              <div className="text-xs text-white/45 mt-1">{l}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Bento showcase ── */}
      <section id="showcase" className="max-w-6xl mx-auto px-5 py-16">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Toolkit</span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">Satu koleksi, semua yang chart kamu butuh</h2>
            <p className="text-sm text-white/50 mt-3">Dari sinyal entry sampai smart money concepts — semua no-repaint dan langsung di TradingView.</p>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 auto-rows-fr">
          {BENTO.map((g, i) => (
            <Reveal key={i} delay={(i % 3) * 90} className={g.span}>
              <BentoTile item={g} index={i} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Catalog ── */}
      <section id="catalog" className="max-w-6xl mx-auto px-5 py-16">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Marketplace</span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">Pilih indikator kamu</h2>
            <p className="text-sm text-white/50 mt-3">Beli satuan atau ambil paket berlangganan untuk akses semua.</p>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PRODUCTS.map((p, i) => (
            <Reveal key={p.id} delay={(i % 3) * 90}>
              <div className="group h-full flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden hover:border-primary/30 transition-colors">
                <div className="relative border-b border-white/5 bg-black/30 p-4 flex items-center justify-center min-h-[130px]">
                  <div className="absolute inset-0 dtq-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
                  {p.badge && <span className="absolute top-2.5 left-2.5 z-10 text-[9px] font-bold uppercase tracking-wide bg-primary text-primary-foreground rounded-full px-2 py-0.5">{p.badge}</span>}
                  <div className="w-full"><Thumb kind={p.kind} /></div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-white">{p.name}</h3>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-primary/80 bg-primary/10 rounded-full px-2 py-0.5 shrink-0">{p.tag}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-white/40">
                    <Star size={12} className="text-amber-400 fill-amber-400" /><span className="text-white/70 font-semibold">{p.rating}</span>
                    <span>·</span><span>{p.users} pengguna</span>
                  </div>
                  <p className="text-xs text-white/45 mt-2.5 leading-relaxed flex-1">{p.desc}</p>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                    <div><span className="text-lg font-black">{rp(p.price)}</span><span className="text-[11px] text-white/40">/bln</span></div>
                    <a href={waOrder(p.name)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold bg-primary text-primary-foreground rounded-lg px-3.5 py-2 hover:opacity-90 transition-opacity">Beli</a>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Access ── */}
      <section id="access" className="max-w-5xl mx-auto px-5 py-16">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Cara Akses</span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">Aktivasi invite-only, aman & simpel</h2>
            <p className="text-sm text-white/50 mt-3">Source code tidak pernah dibagikan. Akses diberikan langsung ke akun TradingView kamu.</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <Reveal key={s.n} delay={i * 120}>
                <div className="relative h-full rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                  <span className="absolute top-4 right-5 text-5xl font-black text-white/[0.04] select-none">{s.n}</span>
                  <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/15 ring-1 ring-primary/25 mb-4"><Icon size={19} className="text-primary" /></span>
                  <h3 className="font-bold text-white">{s.t}</h3>
                  <p className="text-sm text-white/50 mt-1.5 leading-relaxed">{s.d}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
        <Reveal>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/45">
            <ShieldCheck size={14} className="text-primary" /> Kompatibel dengan akun TradingView gratis maupun berbayar
          </div>
        </Reveal>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="max-w-5xl mx-auto px-5 py-16">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Harga</span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-2">Berlangganan & akses semua indikator</h2>
            <p className="text-sm text-white/50 mt-3">Hemat lebih banyak dengan tagihan tahunan.</p>
          </div>
        </Reveal>
        <Reveal>
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-1 rounded-2xl bg-white/5 p-1">
              <button onClick={() => setYearly(false)} className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${!yearly ? 'bg-primary text-primary-foreground' : 'text-white/50 hover:text-white'}`}>Bulanan</button>
              <button onClick={() => setYearly(true)} className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${yearly ? 'bg-primary text-primary-foreground' : 'text-white/50 hover:text-white'}`}>Tahunan <span className={`ml-1 text-[9px] font-bold ${yearly ? 'text-primary-foreground/80' : 'text-primary'}`}>-35%</span></button>
            </div>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {TIERS.map((t, i) => {
            const Icon = t.icon
            const price = tierPrice(t)
            const isLife = t.monthly == null
            return (
              <Reveal key={t.id} delay={i * 100}>
                <div className={`relative h-full rounded-3xl p-[1px] ${t.highlight ? 'bg-gradient-to-br from-primary/70 via-primary/20 to-cyan-500/30' : 'bg-white/10'}`}>
                  <div className="rounded-3xl bg-[#0a1110] h-full p-7 flex flex-col">
                    {t.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full">Paling Populer</span>}
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={18} className={t.highlight ? 'text-primary' : 'text-white/60'} />
                      <h3 className="text-xl font-black">{t.name}</h3>
                    </div>
                    <p className="text-xs text-white/45 mb-5">{t.tagline}</p>
                    <div className="mb-1 flex items-end gap-1.5">
                      <span className="text-4xl font-black tracking-tight">{rp(price)}</span>
                      <span className="text-sm text-white/40 mb-1">{isLife ? '/sekali' : '/bln'}</span>
                    </div>
                    <p className="text-xs text-white/40 mb-6">
                      {isLife ? 'Bayar sekali, akses selamanya' : yearly ? `Ditagih ${rp(price * 12)} / tahun` : 'Ditagih bulanan'}
                    </p>
                    <ul className="space-y-2.5 mb-7 flex-1">
                      {t.features.map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-sm">
                          <span className={`shrink-0 mt-0.5 rounded-full p-0.5 ${t.highlight ? 'bg-primary/15' : 'bg-white/10'}`}><Check size={12} className={t.highlight ? 'text-primary' : 'text-white/60'} /></span>
                          <span className="text-white/80">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <a href={waOrder(`${t.name} (${isLife ? 'Lifetime' : yearly ? 'Tahunan' : 'Bulanan'})`)} target="_blank" rel="noopener noreferrer" className={`w-full text-center rounded-xl px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 ${t.highlight ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'bg-white/10 text-white'}`}>Pilih {t.name}</a>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>

        {/* Comparison table */}
        <Reveal>
          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-left font-semibold text-white/50 py-3 px-4">Perbandingan</th>
                  {TIERS.map(t => <th key={t.id} className={`py-3 px-4 font-bold ${t.highlight ? 'text-primary' : 'text-white/80'}`}>{t.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {CMP.map((row, r) => (
                  <tr key={row.label} className={r % 2 ? 'bg-white/[0.02]' : ''}>
                    <td className="py-3 px-4 text-white/60">{row.label}</td>
                    {row.vals.map((v, c) => (
                      <td key={c} className="py-3 px-4 text-center">
                        {v === '✓' ? <Check size={15} className="inline text-primary" /> : v === '—' ? <span className="text-white/25">—</span> : <span className="text-white/75">{v}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      {/* ── Reviews ── */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <Reveal><h2 className="text-2xl md:text-3xl font-black tracking-tight text-center mb-12">Dipercaya trader yang serius</h2></Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {REVIEWS.map((r, i) => (
            <Reveal key={i} delay={i * 120}>
              <div className="h-full rounded-2xl border border-white/8 bg-white/[0.02] p-6 flex flex-col">
                <Quote size={20} className="text-primary/40 mb-3" />
                <p className="text-sm text-white/75 leading-relaxed flex-1">{r.text}</p>
                <div className="flex gap-0.5 mt-4 mb-3">{Array.from({ length: r.stars }).map((_, k) => <Star key={k} size={13} className="text-amber-400 fill-amber-400" />)}</div>
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/15 text-primary font-bold text-sm">{r.name[0]}</span>
                  <div><p className="text-sm font-semibold text-white">{r.name}</p><p className="text-xs text-white/40">{r.role}</p></div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-3xl mx-auto px-5 py-16">
        <Reveal><h2 className="text-2xl md:text-3xl font-black tracking-tight text-center mb-10">Pertanyaan yang sering ditanya</h2></Reveal>
        <div className="space-y-3">
          {FAQS.map((f, i) => <Reveal key={i} delay={i * 60}><FaqItem q={f.q} a={f.a} /></Reveal>)}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <Reveal>
          <div className="relative rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent p-10 md:p-14 text-center overflow-hidden">
            <div className="absolute inset-0 dtq-shimmer" />
            <div className="relative">
              <CheckCircle2 size={34} className="text-primary mx-auto mb-4" />
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">Mulai trading dengan sinyal yang bisa dipercaya</h2>
              <p className="text-white/55 mt-3 max-w-lg mx-auto text-sm">Akses semua indikator premium hari ini. Aktivasi cepat, no-repaint, langsung di TradingView kamu.</p>
              <a href="#pricing" className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-8 py-4 text-sm font-semibold mt-7 hover:opacity-90 transition-opacity shadow-xl shadow-primary/30">
                Lihat Paket <ArrowRight size={16} />
              </a>
              <p className="text-xs text-white/40 mt-4 flex items-center justify-center gap-1.5"><MessageCircle size={13} className="text-primary" /> Butuh bantuan? Chat admin via WhatsApp</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-white/50">
            <TrendingUp size={16} className="text-primary" /> Datalitiq · Indikator Premium
          </div>
          <div className="flex items-center gap-6 text-sm text-white/50">
            <Link href="/" className="hover:text-white transition-colors">Jurnal & Analitik</Link>
            <a href="#pricing" className="hover:text-white transition-colors">Harga</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <p className="text-xs text-white/30">© {new Date().getFullYear()} Datalitiq</p>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes dtq-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .dtq-marquee { animation: dtq-marquee 30s linear infinite; }
        @keyframes dtq-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        .dtq-float { animation: dtq-float 4s ease-in-out infinite; }
        .dtq-float2 { animation: dtq-float 4.5s ease-in-out infinite 0.8s; }
        @keyframes dtq-pulse { 0%,100% { opacity: .5 } 50% { opacity: 1 } }
        .dtq-pulse { animation: dtq-pulse 1.8s ease-in-out infinite; }
        .dtq-shimmer { background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.05) 50%, transparent 65%); background-size: 200% 100%; animation: dtq-shimmer 2.6s linear infinite; }
        @keyframes dtq-shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
      `}</style>
    </div>
  )
}
