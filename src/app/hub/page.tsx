'use client'

// Hub / launcher — halaman pertama setelah login. Pilih tools yang mau dipakai:
// Terminal AI (tool utama) atau Jurnal Trading. Standalone (tanpa layout jurnal).
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ADMIN_EMAIL } from '@/lib/store'
import { BrandLogo } from '@/components/layout/BrandLogo'
import {
  Activity, BookOpen, ArrowRight, LogOut, Loader2, ShieldCheck, Sparkles,
  Gauge, Bell, Landmark, LineChart, Lock, Settings, FlaskConical, Calculator, TrendingUp,
} from 'lucide-react'

export default function HubPage() {
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'ready'>('loading')
  const [name, setName] = useState<string>('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [terminalAccess, setTerminalAccess] = useState<boolean>(false)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) { router.replace('/login?next=%2Fhub'); return }
      setName(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Trader')
      // Akses terminal: admin ATAU langganan terminal aktif
      let access = user.email === ADMIN_EMAIL
      if (!access) {
        const { data: orders } = await sb.from('payment_orders').select('id').eq('user_id', user.id).eq('plan', 'terminal').eq('status', 'aktif').limit(1)
        access = !!(orders && orders.length)
      }
      setTerminalAccess(access)
      sb.from('app_config').select('logo_url').eq('id', 1).maybeSingle().then(({ data: cfg }) => setLogoUrl((cfg?.logo_url as string | null) ?? null))
      setState('ready')
    })
  }, [router])

  async function logout() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  if (state === 'loading') {
    return <div className="min-h-screen bg-[#060a09] flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[460px] bg-primary/12 blur-[150px] rounded-full pointer-events-none" />
      {/* Header */}
      <header className="relative max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {logoUrl ? <BrandLogo url={logoUrl} /> : <span className="text-xl font-black tracking-tight">Datalitiq</span>}
        </div>
        <div className="flex items-center gap-1">
          <Link href="/settings" className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white px-3 py-2 transition-colors"><Settings size={14} /> Setting</Link>
          <button onClick={logout} className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white px-3 py-2 transition-colors"><LogOut size={14} /> Keluar</button>
        </div>
      </header>

      <main className="relative max-w-5xl mx-auto px-5 pt-10 pb-16">
        <div className="mb-9">
          <p className="text-sm text-white/45">Halo, {name} 👋</p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1">Pilih tools yang mau kamu pakai</h1>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {/* Terminal — tool utama */}
          <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-primary/70 via-primary/20 to-cyan-500/30">
            <div className="relative h-full rounded-3xl bg-[#0a1110] p-6 flex flex-col overflow-hidden">
              <span className="absolute top-4 right-4 text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/12 rounded-full px-2.5 py-1">Tool Utama</span>
              <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/15 ring-1 ring-primary/30 mb-4"><Activity size={22} className="text-primary" /></span>
              <h2 className="text-lg font-black">Terminal Datalitiq AI</h2>
              <p className="text-sm text-white/55 mt-1.5 leading-relaxed">Analisa emas XAU/USD real-time berbasis AI — arah pasar, tingkat keyakinan & alasannya dalam satu layar.</p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {[{ i: Gauge, t: 'Signal & keputusan AI' }, { i: Landmark, t: 'Makro & sentimen' }, { i: Bell, t: 'Notifikasi Telegram' }].map(x => (
                  <span key={x.t} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/55"><x.i size={10} className="text-primary" /> {x.t}</span>
                ))}
              </div>
              <div className="mt-auto pt-6">
                {terminalAccess ? (
                  <Link href="/terminal" className="group w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-3 text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/25">
                    Buka Terminal <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <Link href="/checkout?plan=terminal&months=1" className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-3 text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">
                      <Sparkles size={15} /> Langganan — Rp179.000/bln
                    </Link>
                    <p className="flex items-center justify-center gap-1.5 text-[10px] text-white/35"><Lock size={10} /> Perlu langganan aktif untuk membuka terminal</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Jurnal — tool terpisah */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 flex flex-col hover:border-white/20 transition-colors">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 ring-1 ring-white/10 mb-4"><BookOpen size={22} className="text-white/80" /></span>
            <h2 className="text-lg font-black">Jurnal Trading</h2>
            <p className="text-sm text-white/55 mt-1.5 leading-relaxed">Catat & evaluasi performa trading — Datalitiq Score, equity curve, insight AI, jam & sesi terbaik.</p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {[{ i: LineChart, t: 'Statistik & equity' }, { i: Gauge, t: 'Datalitiq Score' }, { i: BookOpen, t: 'Jurnal + mood' }].map(x => (
                <span key={x.t} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/55"><x.i size={10} className="text-white/50" /> {x.t}</span>
              ))}
            </div>
            <div className="mt-auto pt-6">
              <Link href="/jurnal" className="group w-full inline-flex items-center justify-center gap-2 bg-white/10 text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-white/15 transition-colors">
                Buka Jurnal <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Simulator — tool terpisah */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 flex flex-col hover:border-white/20 transition-colors">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 ring-1 ring-white/10 mb-4"><FlaskConical size={22} className="text-white/80" /></span>
            <h2 className="text-lg font-black">Simulator</h2>
            <p className="text-sm text-white/55 mt-1.5 leading-relaxed">Latih risk-reward & position sizing tanpa menyentuh data trade asli — uji strategi sebelum eksekusi nyata.</p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {[{ i: Calculator, t: 'Position sizing' }, { i: TrendingUp, t: 'Risk-reward' }].map(x => (
                <span key={x.t} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/55"><x.i size={10} className="text-white/50" /> {x.t}</span>
              ))}
            </div>
            <div className="mt-auto pt-6">
              <Link href="/simulator" className="group w-full inline-flex items-center justify-center gap-2 bg-white/10 text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-white/15 transition-colors">
                Buka Simulator <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-8 flex items-center gap-1.5 text-[11px] text-white/30"><ShieldCheck size={13} className="text-primary/70" /> Kamu bisa berpindah antar-tools kapan saja dari halaman ini.</p>
      </main>
    </div>
  )
}
