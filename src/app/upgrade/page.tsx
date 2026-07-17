'use client'

// Halaman upgrade Pro — tujuan semua overlay/CTA "Buka dengan Pro" dari terminal.
// Standalone (tanpa layout jurnal) supaya tidak kena wizard.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { rp, BASE } from '@/lib/pricing'
import { track } from '@/lib/pixel'
import {
  Crown, ArrowLeft, ArrowRight, Check, X, Brain, Landmark, Users, Newspaper,
  Gauge, Bell, BookOpen, FlaskConical, ShieldCheck, Sparkles, Zap,
} from 'lucide-react'

const PRICE = BASE.terminal
const PER_DAY = Math.round(PRICE / 30)

const BENEFITS: { icon: React.ElementType; t: string; d: string }[] = [
  { icon: Brain, t: 'Keputusan AI Lengkap', d: 'Beli / Jual / Tunggu + tingkat keyakinan, alasan, dan rencana entry/stop/target berupa angka konkret.' },
  { icon: Gauge, t: 'Signal Meter & 3 Pilar', d: 'Skor gabungan makro + teknikal + sentimen, plus detail alasan di balik setiap kesimpulan.' },
  { icon: Landmark, t: 'Analisa Makro AI', d: '12+ indikator ekonomi resmi (FRED) diterjemahkan jadi dampak jelas ke emas.' },
  { icon: Users, t: 'Analisa Sentimen AI', d: 'Posisi institusi (COT), risk-on/off, dan peta sentimen ke XAU/USD.' },
  { icon: Newspaper, t: 'Analisa News AI', d: 'Prediksi arah emas sebelum rilis CPI/NFP/FOMC — skenario reaksi + level kunci.' },
  { icon: Bell, t: 'Alert Telegram', d: 'Pasar dipantau otomatis; notifikasi hanya saat kondisi benar-benar berubah.' },
]
const BONUS: { icon: React.ElementType; t: string }[] = [
  { icon: BookOpen, t: 'Jurnal Trading' },
  { icon: FlaskConical, t: 'Simulator Backtest' },
  { icon: Zap, t: 'Trading Projection Tools' },
  { icon: Gauge, t: 'Risk Management Calculator' },
]
const COMPARE: { label: string; free: boolean; pro: boolean }[] = [
  { label: 'Harga XAU/USD real-time & info sesi', free: true, pro: true },
  { label: 'Chart TradingView', free: true, pro: true },
  { label: 'Keputusan AI (Beli/Jual/Tunggu) + alasan', free: false, pro: true },
  { label: 'Signal Meter & detail 3 pilar', free: false, pro: true },
  { label: 'Analisa Teknikal / Makro / Sentimen AI', free: false, pro: true },
  { label: 'Analisa News (prediksi dampak rilis)', free: false, pro: true },
  { label: 'Alert Telegram otomatis', free: false, pro: true },
  { label: 'Tools bonus (Jurnal, Simulator, dll)', free: false, pro: true },
]

export default function UpgradePage() {
  const router = useRouter()
  const [logoChecked, setLogoChecked] = useState(false)

  // Meta Pixel — ViewContent: pengguna melihat halaman penawaran/harga Pro.
  useEffect(() => { track('ViewContent', { content_name: 'Upgrade Terminal Pro', value: PRICE, currency: 'IDR' }) }, [])

  useEffect(() => {
    // Kalau sudah Pro, tak perlu di halaman ini — arahkan ke terminal.
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) { setLogoChecked(true); return }
      const { data: orders } = await sb.from('payment_orders').select('id').eq('user_id', user.id).eq('plan', 'terminal').eq('status', 'aktif').limit(1)
      if (orders && orders.length) { router.replace('/terminal'); return }
      setLogoChecked(true)
    })
  }, [router])

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      {/* glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[460px] bg-primary/12 blur-[150px] rounded-full pointer-events-none" />

      <header className="relative max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/terminal" className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"><ArrowLeft size={16} /> Kembali ke Terminal</Link>
        <span className="text-lg font-black tracking-tight">Datalitiq</span>
      </header>

      <main className="relative max-w-4xl mx-auto px-5 pt-8 pb-20">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 ring-1 ring-primary/30 px-3.5 py-1.5 text-xs font-bold text-primary mb-6"><Crown size={13} /> Datalitiq Pro</span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05]">Buka Seluruh Kekuatan <span className="bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 bg-clip-text text-transparent">Analisa AI</span>.</h1>
          <p className="text-base text-white/55 mt-5 leading-relaxed">Mode gratis kasih kamu harga & sesi live. <span className="text-white/85 font-semibold">Pro kasih jawabannya</span> — arah pasar, keyakinan, level, dan alasannya, dalam hitungan detik.</p>
        </div>

        {/* Kartu harga */}
        <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-primary/70 via-primary/20 to-cyan-500/30 max-w-lg mx-auto mb-14">
          <div className="rounded-3xl bg-[#0a1110] p-8 text-center">
            <div className="flex items-end justify-center gap-1.5"><span className="text-5xl font-black tracking-tight">{rp(PRICE)}</span><span className="text-sm text-white/40 mb-1.5">/ bulan</span></div>
            <div className="mt-3 inline-flex items-center gap-2.5 rounded-2xl border border-primary/30 bg-primary/[0.08] px-4 py-2">
              <span className="text-xl">☕</span>
              <p className="text-sm font-bold text-primary">≈ {rp(PER_DAY)} / hari · lebih murah dari kopi</p>
            </div>
            <Link href="/checkout?plan=terminal&months=1" className="group mt-6 w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3.5 text-sm font-bold hover:opacity-90 transition-all shadow-xl shadow-primary/25"><Crown size={16} /> Upgrade ke Pro <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" /></Link>
            <p className="text-[11px] text-white/40 mt-3 flex items-center justify-center gap-1.5"><ShieldCheck size={12} className="text-primary/70" /> Tanpa kontrak · berhenti kapan saja</p>
          </div>
        </div>

        {/* Benefit grid */}
        <h2 className="text-center text-xl font-black tracking-tight mb-6">Yang Kamu Dapat dengan Pro</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {BENEFITS.map(b => (
            <div key={b.t} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/12 ring-1 ring-primary/20 text-primary mb-4"><b.icon size={20} /></span>
              <p className="text-base font-black">{b.t}</p>
              <p className="text-sm text-white/55 mt-1.5 leading-relaxed">{b.d}</p>
            </div>
          ))}
        </div>

        {/* Perbandingan Free vs Pro */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.015] overflow-hidden mb-14">
          <div className="grid grid-cols-[1fr_auto_auto] text-sm">
            <div className="px-5 py-3.5 font-bold text-white/70 border-b border-white/[0.06]">Fitur</div>
            <div className="px-5 py-3.5 text-center font-bold text-white/50 border-b border-white/[0.06] w-24">Gratis</div>
            <div className="px-5 py-3.5 text-center font-bold text-primary border-b border-white/[0.06] w-24">Pro</div>
            {COMPARE.map((r, i) => (
              <div key={r.label} className="contents">
                <div className={`px-5 py-3 text-white/75 ${i < COMPARE.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>{r.label}</div>
                <div className={`px-5 py-3 flex items-center justify-center ${i < COMPARE.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>{r.free ? <Check size={16} className="text-emerald-400" /> : <X size={15} className="text-white/25" />}</div>
                <div className={`px-5 py-3 flex items-center justify-center bg-primary/[0.03] ${i < COMPARE.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>{r.pro ? <Check size={16} className="text-primary" /> : <X size={15} className="text-white/25" />}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bonus tools */}
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent p-6 mb-12">
          <p className="flex items-center gap-2 text-sm font-bold mb-4"><Sparkles size={16} className="text-primary" /> Bonus gratis untuk pelanggan Pro</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {BONUS.map(b => (
              <div key={b.t} className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
                <b.icon size={15} className="text-primary shrink-0" /><span className="text-xs font-semibold text-white/75">{b.t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA akhir */}
        <div className="text-center">
          <Link href="/checkout?plan=terminal&months=1" className="group inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-8 py-4 text-sm font-bold hover:opacity-90 transition-all shadow-xl shadow-primary/30"><Crown size={16} /> Jadi Pro Sekarang — {rp(PRICE)}/bln <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" /></Link>
          <p className="text-[11px] text-white/35 mt-4">{logoChecked ? 'Akses terbuka otomatis setelah pembayaran terverifikasi.' : 'Memuat…'}</p>
        </div>
      </main>
    </div>
  )
}
