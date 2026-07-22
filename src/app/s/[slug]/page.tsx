import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { SHARE_TONE, rpShare, type SharePayload } from '@/lib/finance-share'

// Halaman publik untuk tautan berbagi ringkasan keuangan. TANPA login.
//
// Dibaca lewat service_role di server, satu baris, dicari berdasarkan slug —
// tabel fin_shares sendiri tidak punya policy untuk anon, jadi tidak ada jalan
// bagi siapa pun untuk memanen snapshot orang lain (lihat catatan di
// supabase-personal-finance-share.sql).
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

type Row = { id: string; title: string; payload: SharePayload; expires_at: string | null; revoked: boolean; views: number; created_at: string }

async function getShare(slug: string): Promise<Row | null> {
  if (!SUPA_URL || !SERVICE || !/^[A-Za-z0-9]{6,32}$/.test(slug)) return null
  const svc = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })
  const { data } = await svc.from('fin_shares')
    .select('id,title,payload,expires_at,revoked,views,created_at').eq('slug', slug).maybeSingle()
  if (!data) return null
  const row = data as Row
  if (row.revoked) return null
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null
  return row
}

// Tautan pribadi tidak boleh masuk indeks mesin pencari — itu mengubah "hanya
// yang dikirimi tautan" menjadi "siapa pun yang mencari".
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const row = await getShare(slug)
  if (!row) notFound()

  const p = row.payload
  const masked = p.masked
  const money = (n: number) => masked ? 'Rp•••' : rpShare(n)

  // Penghitung tampilan: gagal menaikkannya bukan alasan menolak menampilkan
  // halamannya.
  try {
    const svc = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })
    await svc.from('fin_shares').update({ views: row.views + 1 }).eq('id', row.id)
  } catch { /* diamkan */ }

  const Bar = ({ rows, title }: { rows: NonNullable<SharePayload['expense']>; title: string }) => (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-[13px] font-black mb-3">{title}</p>
      <div className="space-y-2.5">
        {rows.map(r => (
          <div key={r.name}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[12px] font-semibold truncate flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />{r.name}
              </span>
              <span className="text-[12px] font-black tabular-nums shrink-0">
                {!masked && <span className="text-slate-400 font-semibold mr-1.5">{rpShare(r.v)}</span>}
                {Math.round(r.pct)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#F0F0F4] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.pct)}%`, background: r.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-slate-900 px-4 py-8 md:py-12">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="text-center mb-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-indigo-500">Ringkasan Keuangan</p>
          <h1 className="text-2xl font-black tracking-tight mt-1">{row.title}</h1>
          <p className="text-[12px] text-slate-400 mt-1">
            Periode {p.period} · dibuat {new Date(p.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {masked && (
            <p className="inline-block mt-2 px-3 py-1 rounded-full bg-slate-200 text-[11px] font-bold text-slate-500">
              Nominal disembunyikan oleh pembuat
            </p>
          )}
        </div>

        {p.note && (
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-line">{p.note}</p>
          </div>
        )}

        {p.totals && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { k: 'Masuk', v: p.totals.income, c: 'text-emerald-600' },
              { k: 'Keluar', v: p.totals.expense, c: 'text-rose-600' },
              { k: 'Selisih', v: p.totals.net, c: p.totals.net >= 0 ? 'text-emerald-600' : 'text-rose-600' },
            ].map(s => (
              <div key={s.k} className="rounded-3xl bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold text-slate-400">{s.k}</p>
                <p className={`text-[15px] sm:text-lg font-black tabular-nums mt-1 truncate ${s.c}`}>{money(s.v)}</p>
              </div>
            ))}
          </div>
        )}

        {p.score && (
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-[13px] font-black mb-3">Skor Kesehatan</p>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
                <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="#F0F0F4" strokeWidth="9" />
                  <circle cx="48" cy="48" r="40" fill="none" stroke={p.score.band.color} strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={`${(p.score.score / 100) * 2 * Math.PI * 40} ${2 * Math.PI * 40}`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black tabular-nums leading-none" style={{ color: p.score.band.color }}>{p.score.score}</span>
                  <span className="text-[9px] font-bold text-slate-300 mt-0.5">dari 100</span>
                </div>
              </div>
              <p className="text-[15px] font-black" style={{ color: p.score.band.color }}>{p.score.band.label}</p>
            </div>
            <div className="space-y-2.5">
              {p.score.pillars.map(pl => {
                const pct = Math.round(pl.score * 100)
                const clr = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={pl.label}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold text-slate-600 truncate">{pl.label} <span className="text-slate-300 font-semibold">· bobot {pl.weight}%</span></p>
                      <span className="text-[11px] font-black tabular-nums shrink-0" style={{ color: clr }}>{pct}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#F0F0F4] overflow-hidden mt-1">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: clr }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{pl.detail}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {p.insights && p.insights.length > 0 && (
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-[13px] font-black mb-3">Insight</p>
            <div className="space-y-2">
              {p.insights.map((it, i) => {
                const t = SHARE_TONE[it.tone]
                return (
                  <div key={i} className="rounded-2xl px-4 py-3" style={{ background: t.bg }}>
                    <p className="text-[12px] font-black leading-snug" style={{ color: t.fg }}>{it.title}</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{it.text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {p.expense && p.expense.length > 0 && <Bar rows={p.expense} title="Pengeluaran per Kategori" />}
        {p.income && p.income.length > 0 && <Bar rows={p.income} title="Pemasukan per Kategori" />}

        <div className="text-center pt-4 pb-2">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Ringkasan ini adalah salinan tetap — angkanya tidak ikut berubah saat data aslinya diperbarui.
            {row.expires_at && ` Tautan berlaku sampai ${new Date(row.expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`}
          </p>
          <Link href="/" className="inline-block mt-3 text-[12px] font-black text-indigo-500 hover:text-indigo-600">Datalitiq</Link>
        </div>
      </div>
    </div>
  )
}
