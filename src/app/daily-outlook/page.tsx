'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSubscription } from '@/hooks/useSubscription'
import { Markdown } from '@/lib/markdown'
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus, CalendarDays, ChevronRight } from 'lucide-react'

type Outlook = {
  id: string; outlook_date: string; title: string; bias: string; summary: string | null
  content: string | null; support: string | null; resistance: string | null; created_at: string
}

const fmtDate = (s: string) => new Date(s).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const biasMeta = (b: string) => b === 'bullish'
  ? { t: 'Bullish', c: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/25', ic: TrendingUp }
  : b === 'bearish' ? { t: 'Bearish', c: 'text-red-400 bg-red-500/12 border-red-500/25', ic: TrendingDown }
  : { t: 'Netral', c: 'text-white/60 bg-white/[0.06] border-white/15', ic: Minus }

export default function DailyOutlookPage() {
  const router = useRouter()
  const sub = useSubscription()
  const [items, setItems] = useState<Outlook[] | null>(null)

  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace('/login?next=%2Fdaily-outlook')
  }, [sub.loading, sub.userId, router])

  useEffect(() => {
    if (!sub.userId) return
    createClient().from('daily_outlook').select('id, outlook_date, title, bias, summary, content, support, resistance, created_at')
      .eq('published', true).order('outlook_date', { ascending: false }).limit(30)
      .then(({ data }) => setItems((data as Outlook[]) ?? []))
  }, [sub.userId])

  if (sub.loading || !sub.userId || items === null) return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>

  const [latest, ...past] = items
  const bm = latest ? biasMeta(latest.bias) : null

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[140px] rounded-full pointer-events-none" />
      <header className="relative max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/hub" className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"><ArrowLeft size={16} /> Hub</Link>
        <span className="text-lg font-black tracking-tight">Datalitiq</span>
      </header>

      <main className="relative max-w-3xl mx-auto px-5 pt-4 pb-20">
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1">Daily Outlook</p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Pandangan Harian XAU/USD</h1>
        </div>

        {!latest ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center">
            <CalendarDays className="mx-auto text-white/25 mb-3" size={30} />
            <p className="text-white/50">Outlook hari ini belum tersedia. Cek kembali nanti.</p>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="p-6 md:p-7">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {bm && <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${bm.c}`}><bm.ic size={12} /> {bm.t}</span>}
                  <span className="text-[12px] text-white/40 flex items-center gap-1.5"><CalendarDays size={12} /> {fmtDate(latest.outlook_date)}</span>
                </div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-balance">{latest.title}</h2>
                {latest.summary && <p className="text-[15px] text-white/70 mt-3 leading-relaxed">{latest.summary}</p>}

                {(latest.support || latest.resistance) && (
                  <div className="grid grid-cols-2 gap-3 mt-5">
                    <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">Support</p>
                      <p className="text-sm font-black tabular-nums mt-0.5 whitespace-pre-line">{latest.support || '—'}</p>
                    </div>
                    <div className="rounded-xl bg-red-500/[0.06] border border-red-500/15 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-red-400/80">Resistance</p>
                      <p className="text-sm font-black tabular-nums mt-0.5 whitespace-pre-line">{latest.resistance || '—'}</p>
                    </div>
                  </div>
                )}
              </div>
              {latest.content && <div className="px-6 md:px-7 pb-6 pt-1 border-t border-white/[0.06]"><Markdown text={latest.content} /></div>}
            </div>

            {past.length > 0 && (
              <div className="mt-8">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">Outlook Sebelumnya</p>
                <div className="space-y-2">
                  {past.map(o => {
                    const m = biasMeta(o.bias)
                    return (
                      <details key={o.id} className="group rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                        <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0 ${m.c}`}><m.ic size={10} /> {m.t}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold truncate">{o.title}</p>
                            <p className="text-[10px] text-white/40">{fmtDate(o.outlook_date)}</p>
                          </div>
                          <ChevronRight size={16} className="text-white/30 group-open:rotate-90 transition-transform shrink-0" />
                        </summary>
                        <div className="px-4 pb-4">
                          {o.summary && <p className="text-[13px] text-white/60 leading-relaxed">{o.summary}</p>}
                          {o.content && <div className="mt-2"><Markdown text={o.content} className="text-[13px]" /></div>}
                        </div>
                      </details>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
