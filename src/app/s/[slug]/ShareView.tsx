'use client'

// Badan halaman berbagi publik. Client component karena kategorinya bisa diklik
// dan chart-nya perlu berjalan di browser — tapi TIDAK melakukan satu pun
// panggilan data: seluruh isinya datang dari payload yang sudah diambil server.
// Tidak ada kunci Supabase, tidak ada sesi, tidak ada endpoint yang bisa dikorek
// dari sini.
import { useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'
import { X as XIcon, ChevronRight, TrendingUp, Wallet } from 'lucide-react'
import { SHARE_TONE, rpShare, type SharePayload, type ShareCat } from '@/lib/finance-share'

const TIP = { borderRadius: 14, border: '1px solid #E2E8F0', fontSize: 12, fontWeight: 700, background: '#fff' }

export default function ShareView({ p, title, expiresAt }: { p: SharePayload; title: string; expiresAt: string | null }) {
  const [pick, setPick] = useState<{ c: ShareCat; kind: 'income' | 'expense' } | null>(null)
  const masked = p.masked
  const money = (n: number) => masked ? 'Rp•••' : rpShare(n)
  // Saat disamarkan, sumbu dan tooltip tidak boleh menampilkan angka apa pun —
  // nilainya sudah jadi indeks relatif, menampilkannya hanya menyesatkan.
  const axis = (v: number) => masked ? '' : Math.round(v).toLocaleString('id-ID')
  const tip = (v: unknown) => masked ? '•••' : rpShare(Number(v ?? 0))

  const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) =>
    <div className={`rounded-3xl bg-white p-5 shadow-sm ${className}`}>{children}</div>

  const CatBars = ({ rows, kind, title: t }: { rows: ShareCat[]; kind: 'income' | 'expense'; title: string }) => (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[13px] font-black">{t}</p>
        <span className="text-[10px] font-bold text-slate-300">ketuk untuk rincian</span>
      </div>

      {/* Donut memakai `pct`, bukan `v` — saat nominal disembunyikan `v` sudah
          dinolkan, dan donut dari nilai nol tidak menggambar apa pun. */}
      <div className="w-40 h-40 mx-auto relative mb-4 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows.map(r => ({ name: r.name, value: Math.max(0.01, r.pct) }))}
              dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2} strokeWidth={0}
              isAnimationActive={false} className="cursor-pointer"
              onClick={(_, i) => setPick({ c: rows[i], kind })}>
              {rows.map(r => <Cell key={r.name} fill={r.color} />)}
            </Pie>
            <Tooltip contentStyle={TIP} formatter={(v: unknown) => `${Math.round(Number(v ?? 0))}%`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-[10px] text-slate-400 font-semibold">{rows.length} kategori</p>
          <p className="text-[13px] font-black tabular-nums">{rows[0] ? `${Math.round(rows[0].pct)}%` : ''}</p>
          <p className="text-[9px] text-slate-300 truncate max-w-[88px]">{rows[0]?.name ?? ''}</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {rows.map(r => (
          <button key={r.name} onClick={() => setPick({ c: r, kind })}
            className="w-full text-left rounded-xl px-2 py-1.5 -mx-2 hover:bg-slate-50 transition-colors">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[12px] font-semibold truncate flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                <span className="truncate">{r.name}</span>
              </span>
              <span className="text-[12px] font-black tabular-nums shrink-0 flex items-center gap-1">
                {!masked && <span className="text-slate-400 font-semibold">{rpShare(r.v)}</span>}
                {Math.round(r.pct)}%
                <ChevronRight size={13} className="text-slate-300" />
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#F0F0F4] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.pct)}%`, background: r.color }} />
            </div>
          </button>
        ))}
      </div>
    </Card>
  )

  return (
    // overflow-x-hidden: ResponsiveContainer recharts tidak menyusut kembali saat
    // viewport MENGECIL — memutar ponsel dari lanskap ke potret meninggalkan SVG
    // selebar layar lama dan halaman jadi bisa digeser ke samping. Terbukti di
    // uji resize 375→320. Tiap kotak chart juga diberi overflow-hidden sendiri.
    <div className="min-h-screen overflow-x-hidden bg-[#F2F2F7] text-slate-900 px-4 py-8 md:py-12">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="text-center mb-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-indigo-500">Ringkasan Keuangan</p>
          <h1 className="text-2xl font-black tracking-tight mt-1">{title}</h1>
          <p className="text-[12px] text-slate-400 mt-1">
            Periode {p.period} · dibuat {new Date(p.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {masked && (
            <p className="inline-block mt-2 px-3 py-1 rounded-full bg-slate-200 text-[11px] font-bold text-slate-500">
              Nominal disembunyikan oleh pembuat
            </p>
          )}
        </div>

        {p.note && <Card><p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-line">{p.note}</p></Card>}

        {p.balance != null && (
          <div className="rounded-3xl p-6 shadow-sm" style={{ background: '#E3F84E' }}>
            <p className="text-[12px] font-semibold text-lime-900/60 mb-1 flex items-center gap-1.5"><Wallet size={14} /> Total Saldo</p>
            <p className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 tabular-nums">{rpShare(p.balance)}</p>
            <p className="text-[11px] text-lime-900/60 mt-1">Saldo seluruh rekening saat ringkasan ini dibuat.</p>
          </div>
        )}

        {/* Di ponsel: satu kartu berisi tiga BARIS (label kiri, nominal kanan).
            Tiga kolom sejajar hanya menyisakan ~78px per nominal di layar 375px,
            dan "Rp24.500.000" butuh 104px — jadi angkanya terpotong jadi
            "Rp24.50…". Nominal keuangan yang terpotong lebih buruk daripada tata
            letak yang lebih tinggi. Mulai sm ke atas baru dijejer tiga. */}
        {p.totals && (
          <>
            <div className="sm:hidden rounded-3xl bg-white px-5 py-2 shadow-sm">
              {[
                { k: 'Masuk', v: p.totals.income, c: 'text-emerald-600' },
                { k: 'Keluar', v: p.totals.expense, c: 'text-rose-600' },
                { k: 'Selisih', v: p.totals.net, c: p.totals.net >= 0 ? 'text-emerald-600' : 'text-rose-600' },
              ].map(s => (
                <div key={s.k} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
                  <span className="text-[12px] font-semibold text-slate-400">{s.k}</span>
                  <span className={`text-[16px] font-black tabular-nums ${s.c}`}>{money(s.v)}</span>
                </div>
              ))}
            </div>
            <div className="hidden sm:grid grid-cols-3 gap-3">
              {[
                { k: 'Masuk', v: p.totals.income, c: 'text-emerald-600' },
                { k: 'Keluar', v: p.totals.expense, c: 'text-rose-600' },
                { k: 'Selisih', v: p.totals.net, c: p.totals.net >= 0 ? 'text-emerald-600' : 'text-rose-600' },
              ].map(s => (
                <div key={s.k} className="rounded-3xl bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold text-slate-400">{s.k}</p>
                  <p className={`text-lg font-black tabular-nums mt-1 truncate ${s.c}`}>{money(s.v)}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {p.score && (
          <Card>
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
          </Card>
        )}

        {p.cashflow && p.cashflow.length > 0 && (
          <Card>
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-[13px] font-black flex items-center gap-1.5"><TrendingUp size={16} className="text-indigo-500" /> Arus Kas 6 Bulan</p>
              <div className="flex items-center gap-3 text-[10px] font-bold">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Masuk</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />Keluar</span>
              </div>
            </div>
            <div className="h-52 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={p.cashflow} margin={{ top: 4, right: masked ? 14 : 4, left: masked ? 14 : 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.28} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={axis} tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={masked ? 8 : 74} />
                  <Tooltip contentStyle={TIP} formatter={(v: unknown, n: unknown) => [tip(v), n === 'masuk' ? 'Masuk' : 'Keluar']} />
                  <Area type="monotone" dataKey="masuk" stroke="#10b981" strokeWidth={2} fill="url(#gm)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="keluar" stroke="#ef4444" strokeWidth={2} fill="url(#gk)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {masked && <p className="text-[10px] text-slate-300 mt-2">Sumbu disembunyikan — tinggi grafik menunjukkan perbandingan relatif, bukan nominal.</p>}
          </Card>
        )}

        {p.daily && p.daily.length > 1 && (
          <Card>
            <p className="text-[13px] font-black mb-3">Pengeluaran Harian · {p.period}</p>
            <div className="h-40 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={p.daily} margin={{ top: 4, right: masked ? 14 : 4, left: masked ? 14 : 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tickFormatter={axis} tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={masked ? 8 : 74} />
                  <Tooltip contentStyle={TIP} formatter={(v: unknown) => [tip(v), 'Pengeluaran']} />
                  <Bar dataKey="keluar" fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {p.insights && p.insights.length > 0 && (
          <Card>
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
          </Card>
        )}

        {p.expense && p.expense.length > 0 && <CatBars rows={p.expense} kind="expense" title="Pengeluaran per Kategori" />}
        {p.income && p.income.length > 0 && <CatBars rows={p.income} kind="income" title="Pemasukan per Kategori" />}

        <div className="text-center pt-4 pb-2">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Ringkasan ini salinan tetap — angkanya tidak ikut berubah saat data aslinya diperbarui.
            {expiresAt && ` Tautan berlaku sampai ${new Date(expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`}
          </p>
          <Link href="/" className="inline-block mt-3 text-[12px] font-black text-indigo-500 hover:text-indigo-600">Datalitiq</Link>
        </div>
      </div>

      {pick && (
        <CatDetail c={pick.c} kind={pick.kind} masked={masked} rel={!!p.rel}
          monthLabels={p.monthLabels ?? []} onClose={() => setPick(null)} />
      )}
    </div>
  )
}

function CatDetail({ c, kind, masked, rel, monthLabels, onClose }: {
  c: ShareCat; kind: 'income' | 'expense'; masked: boolean; rel: boolean
  monthLabels: string[]; onClose: () => void
}) {
  const money = (n?: number) => n == null ? '—' : masked ? 'Rp•••' : rpShare(n)
  const trend = (c.trend ?? []).map((v, i) => ({ label: monthLabels[i] ?? '', v }))

  const Stat = ({ k, v, sub }: { k: string; v: string; sub?: string }) => (
    <div className="rounded-2xl bg-[#F7F7FA] px-3.5 py-3">
      <p className="text-[10px] font-semibold text-slate-400">{k}</p>
      <p className="text-[14px] font-black tabular-nums mt-0.5 truncate">{v}</p>
      {sub && <p className="text-[10px] text-slate-300 truncate">{sub}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/30 backdrop-blur-sm p-0 md:p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 pt-5 pb-3 rounded-t-3xl z-10">
          <p className="text-[15px] font-black flex items-center gap-2 min-w-0">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
            <span className="truncate">{c.name}</span>
          </p>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-[#F7F7FA] flex items-center justify-center hover:bg-slate-100 shrink-0"><XIcon size={16} /></button>
        </div>

        <div className="px-5 pb-8">
          <div className="rounded-3xl p-5 mb-4" style={{ background: `${c.color}12`, border: `1px solid ${c.color}33` }}>
            <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: c.color }}>
              {kind === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
            </p>
            <p className="text-3xl font-black tabular-nums mt-1" style={{ color: c.color }}>{money(c.v)}</p>
            <p className="text-[12px] text-slate-500 mt-1">
              {Math.round(c.pct)}% dari total {kind === 'expense' ? 'pengeluaran' : 'pemasukan'} di periode ini
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <Stat k="Jumlah transaksi" v={c.count != null ? String(c.count) : '—'} sub={c.days != null ? `${c.days} hari aktif` : undefined} />
            <Stat k="Rata-rata / transaksi" v={money(c.avg)} />
            <Stat k="Terbesar" v={money(c.max)} />
            <Stat k="Porsi" v={`${Math.round(c.pct)}%`} />
          </div>

          {trend.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 mb-1.5">Tren 6 bulan</p>
              <div className="h-32 w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TIP} formatter={(v: unknown) => masked ? '•••' : rpShare(Number(v ?? 0))} />
                    {/* Warna seragam → cukup fill di Bar. <Cell> per batang hanya
                        perlu kalau tiap batang beda warna, dan menambah satu lagi
                        tempat yang bisa gagal diam-diam. */}
                    <Bar dataKey="v" fill={c.color} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {rel && (
                <p className="text-[10px] text-slate-300 mt-1.5 leading-relaxed">
                  Tinggi batang relatif terhadap bulan tertinggi kategori ini — bukan perbandingan antar-kategori.
                </p>
              )}
            </div>
          )}

          {c.txs && c.txs.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-bold text-slate-400 mb-1.5">
                Transaksi ({c.txs.length}{c.count != null && c.count > c.txs.length ? ` dari ${c.count}` : ''})
              </p>
              <div className="space-y-1.5 md:max-h-72 md:overflow-y-auto">
                {c.txs.map((t, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-[#F7F7FA] px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold truncate">{t.n || c.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(t.d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="text-[13px] font-black tabular-nums shrink-0" style={{ color: c.color }}>{money(t.v)}</span>
                  </div>
                ))}
              </div>
              {c.count != null && c.count > c.txs.length && (
                <p className="text-[10px] text-slate-300 mt-1.5">Menampilkan {c.txs.length} transaksi terbesar.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
