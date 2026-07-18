'use client'

// Hub / launcher — pusat setelah login: pilih tools + status langganan + akun.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSubscription } from '@/hooks/useSubscription'
import { BrandLogo } from '@/components/layout/BrandLogo'
import {
  Activity, BookOpen, ArrowRight, LogOut, Loader2, Sparkles, Gauge, Bell, Landmark,
  LineChart, Lock, UserCog, FlaskConical, Calculator, TrendingUp, TrendingDown, Minus, Crown, Calendar, ShieldCheck, ChevronRight, Newspaper, CalendarDays,
} from 'lucide-react'

type OutlookTeaser = { outlook_date: string; title: string; bias: string; summary: string | null }
const biasMeta = (b: string) => b === 'bullish'
  ? { t: 'Bullish', c: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/25', ic: TrendingUp }
  : b === 'bearish' ? { t: 'Bearish', c: 'text-red-400 bg-red-500/12 border-red-500/25', ic: TrendingDown }
  : { t: 'Netral', c: 'text-white/60 bg-white/[0.06] border-white/15', ic: Minus }

const fmtDate = (d: Date | null) => d ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function HubPage() {
  const router = useRouter()
  const sub = useSubscription()
  const [name, setName] = useState<string>('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [outlook, setOutlook] = useState<OutlookTeaser | null | undefined>(undefined)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      const user = data.user
      if (!user) { router.replace('/login?next=%2Fhub'); return }
      setName((user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'Trader')
      sb.from('app_config').select('logo_url').eq('id', 1).maybeSingle().then(({ data: cfg }) => setLogoUrl((cfg?.logo_url as string | null) ?? null))
      sb.from('daily_outlook').select('outlook_date, title, bias, summary').eq('published', true).order('outlook_date', { ascending: false }).limit(1).maybeSingle()
        .then(({ data: o }) => setOutlook((o as OutlookTeaser | null) ?? null))
    })
  }, [router])

  async function logout() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  if (sub.loading) {
    return <div className="min-h-screen bg-[#060a09] flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }
  const pro = sub.isPro
  const expiredSoon = sub.daysLeft != null && sub.daysLeft <= 7
  const lapsed = !pro && !!sub.order  // pernah langganan tapi sudah kadaluarsa

  // Kartu tool bonus (Pro-only): jurnal, backtesting, KPI
  const BONUS_TOOLS = [
    { href: '/jurnal', icon: BookOpen, t: 'Jurnal Trading', d: 'Catat & evaluasi performa — Datalitiq Score, equity curve, insight AI.', tags: [{ i: LineChart, t: 'Statistik' }, { i: Gauge, t: 'Score' }] },
    { href: '/simulator', icon: FlaskConical, t: 'Strategy Backtesting', d: 'Uji & bandingkan rencana strategi tanpa risiko sebelum eksekusi nyata.', tags: [{ i: TrendingUp, t: 'Risk-reward' }, { i: Calculator, t: 'Sizing' }] },
    { href: '/kpi', icon: LineChart, t: 'KPI Projection', d: 'Proyeksikan pertumbuhan equity dari target & KPI trading kamu.', tags: [{ i: TrendingUp, t: 'Proyeksi' }, { i: Calculator, t: 'Compound' }] },
    { href: '/lot-calculator', icon: Calculator, t: 'Kalkulator Lot', d: 'Hitung ukuran lot ideal dari risiko & stop loss + saran lot aman. Multi-pair: emas, forex, kripto, indeks.', tags: [{ i: ShieldCheck, t: 'Lot aman' }, { i: Gauge, t: 'Multi-pair' }] },
  ]

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[460px] bg-primary/12 blur-[150px] rounded-full pointer-events-none" />
      {/* Header */}
      <header className="relative max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {logoUrl ? <BrandLogo url={logoUrl} /> : <span className="text-xl font-black tracking-tight">Datalitiq</span>}
        </div>
        <div className="flex items-center gap-1">
          <Link href="/blog" className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white px-3 py-2 transition-colors"><Newspaper size={14} /> Blog</Link>
          <Link href="/account" className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white px-3 py-2 transition-colors"><UserCog size={14} /> Akun</Link>
          <button onClick={logout} className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white px-3 py-2 transition-colors"><LogOut size={14} /> Keluar</button>
        </div>
      </header>

      <main className="relative max-w-5xl mx-auto px-5 pt-8 pb-16">
        <div className="mb-6">
          <p className="text-sm text-white/45">Halo, {name} 👋</p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1">Pilih tools yang mau kamu pakai</h1>
        </div>

        {/* Status langganan */}
        <Link href="/account" className={`group flex items-center gap-3 rounded-2xl border p-4 mb-6 transition-colors ${pro ? 'border-primary/25 bg-gradient-to-r from-primary/[0.08] to-transparent hover:border-primary/40' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}>
          <span className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${pro ? 'bg-primary/15 ring-1 ring-primary/30 text-primary' : 'bg-white/5 text-white/40'}`}><Crown size={18} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold flex items-center gap-2">{sub.isAdmin ? 'Akses Admin' : pro ? 'Langganan Pro Aktif' : lapsed ? 'Langganan Berakhir' : 'Mode Gratis'}
              <span className={`text-[9px] font-bold uppercase rounded-full px-2 py-0.5 ${pro ? 'bg-primary/15 text-primary' : lapsed ? 'bg-red-500/15 text-red-400' : 'bg-white/10 text-white/50'}`}>{sub.isAdmin ? 'ADMIN' : pro ? 'PRO' : lapsed ? 'KADALUARSA' : 'FREE'}</span>
            </p>
            <p className="text-xs text-white/50 mt-0.5 flex items-center gap-1.5">
              {sub.isAdmin && !sub.order ? 'Akses penuh tak terbatas' : pro ? <><Calendar size={11} className={expiredSoon ? 'text-amber-400' : 'text-primary/70'} /> Berlaku sampai {fmtDate(sub.expiresAt)}{sub.daysLeft != null ? ` · ${sub.daysLeft} hari lagi` : ''}</> : lapsed ? 'Langganan sudah berakhir — perpanjang untuk buka akses lagi' : 'Upgrade untuk buka Terminal AI & tools bonus'}
            </p>
          </div>
          <ChevronRight size={18} className="text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
        </Link>

        {/* Terminal — tool utama (hero) */}
        <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-primary/70 via-primary/20 to-cyan-500/30 mb-5">
          <div className="relative rounded-3xl bg-[#0a1110] p-6 md:p-7 overflow-hidden">
            <span className="absolute top-4 right-4 text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/12 rounded-full px-2.5 py-1">Tool Utama</span>
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              <div className="flex-1">
                <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/15 ring-1 ring-primary/30 mb-4"><Activity size={22} className="text-primary" /></span>
                <h2 className="text-lg font-black">Terminal Datalitiq AI</h2>
                <p className="text-sm text-white/55 mt-1.5 leading-relaxed max-w-md">Analisa emas XAU/USD real-time berbasis AI — arah pasar, tingkat keyakinan & alasannya dalam satu layar.</p>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {[{ i: Gauge, t: 'Signal & keputusan AI' }, { i: Landmark, t: 'Makro & sentimen' }, { i: Bell, t: 'Notifikasi Telegram' }].map(x => (
                    <span key={x.t} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/55"><x.i size={10} className="text-primary" /> {x.t}</span>
                  ))}
                </div>
              </div>
              <div className="md:w-56 shrink-0">
                {pro ? (
                  <Link href="/terminal" className="group w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-3 text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/25">
                    Buka Terminal <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <Link href="/terminal" className="group w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-3 text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/25">
                      Akses Terminal <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                    <p className="flex items-center justify-center gap-1.5 text-[10px] text-white/35"><Lock size={10} /> Mode gratis · fitur terbatas</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Outlook XAU/USD */}
        <Link href="/daily-outlook" className="group relative block rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden mb-5 hover:border-primary/25 transition-colors">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-primary/10 blur-[60px] rounded-full pointer-events-none" />
          <div className="relative p-5 md:p-6 flex items-center gap-4">
            <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-primary/15 ring-1 ring-primary/30 text-primary shrink-0"><CalendarDays size={20} /></span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Daily Outlook · XAU/USD</p>
                {outlook && (() => { const m = biasMeta(outlook.bias); return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${m.c}`}><m.ic size={9} /> {m.t}</span> })()}
              </div>
              {outlook === undefined ? (
                <p className="text-sm text-white/40 mt-1">Memuat outlook…</p>
              ) : outlook ? (
                <>
                  <p className="text-base font-black tracking-tight truncate mt-0.5">{outlook.title}</p>
                  {outlook.summary && <p className="text-[12px] text-white/50 mt-0.5 line-clamp-1">{outlook.summary}</p>}
                </>
              ) : (
                <p className="text-sm text-white/50 mt-0.5">Pandangan harian emas segera hadir — cek kembali nanti.</p>
              )}
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-primary">Lihat <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" /></span>
          </div>
        </Link>

        {/* Tools bonus (Pro-only) */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {BONUS_TOOLS.map(tool => (
            <div key={tool.href} className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 flex flex-col hover:border-white/20 transition-colors">
              <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 ring-1 ring-white/10 mb-4"><tool.icon size={22} className="text-white/80" /></span>
              <h2 className="text-lg font-black">{tool.t}</h2>
              <p className="text-sm text-white/55 mt-1.5 leading-relaxed flex-1">{tool.d}</p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {tool.tags.map(x => (
                  <span key={x.t} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/55"><x.i size={10} className="text-white/50" /> {x.t}</span>
                ))}
              </div>
              <div className="mt-auto pt-6">
                {pro ? (
                  <Link href={tool.href} className="group w-full inline-flex items-center justify-center gap-2 bg-white/10 text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-white/15 transition-colors">Buka <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" /></Link>
                ) : (
                  <Link href="/upgrade" className="w-full inline-flex items-center justify-center gap-2 bg-primary/15 text-primary rounded-xl px-5 py-3 text-sm font-semibold hover:bg-primary/25 transition-colors"><Lock size={14} /> Khusus Pro</Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Admin */}
        {sub.isAdmin && (
          <Link href="/admin" className="group mt-6 flex items-center gap-3 rounded-2xl border border-red-500/25 bg-red-500/[0.05] p-4 hover:border-red-500/40 transition-colors">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/15 text-red-400 shrink-0"><ShieldCheck size={18} /></span>
            <div className="flex-1 min-w-0"><p className="text-sm font-bold">Panel Admin (CMS)</p><p className="text-xs text-white/45">Kelola user & langganan, konten homepage, branding & pembayaran</p></div>
            <ChevronRight size={18} className="text-white/30 group-hover:text-white/60 transition-colors" />
          </Link>
        )}
      </main>
    </div>
  )
}
