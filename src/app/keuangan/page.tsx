'use client'

// ═══════════════════════════════════════════════════════════════════════════
// KEUANGAN PRIBADI (khusus admin) — desain TERANG ala aplikasi fintech modern,
// sengaja terpisah total dari identitas gelap Datalitiq.
//
// Prinsip data:
//  - Saldo selalu DIHITUNG dari initial_balance + transaksi (tidak pernah
//    disimpan), jadi mustahil tidak sinkron.
//  - Transfer antar-rekening adalah tipe sendiri — bukan pengeluaran — supaya
//    pindah uang bank→e-wallet tidak merusak laporan arus kas.
//  - Pemisahan pribadi vs bisnis lewat flag kategori (is_business).
//  - Struk diupload ke storage; path diberi suffix acak agar tidak tertebak
//    (bucket publik dipakai bersama fitur lain di app ini).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSubscription } from '@/hooks/useSubscription'
import { toast } from '@/lib/toast'
import {
  ArrowLeft, Plus, Minus, ArrowLeftRight, Wallet, Landmark, Smartphone, Coins,
  Loader2, Trash2, X as XIcon, ChevronLeft, ChevronRight, Search,
  TrendingUp, TrendingDown, Camera, Briefcase, Settings2,
} from 'lucide-react'

// ── tipe ──
type FinAccount = { id: string; name: string; kind: string; initial_balance: number }
type FinCategory = { id: string; name: string; type: 'income' | 'expense'; is_business: boolean }
type FinTx = {
  id: string; account_id: string; to_account_id: string | null; category_id: string | null
  type: 'income' | 'expense' | 'transfer'; amount: number; note: string | null
  date: string; receipt_url: string | null
}

const rp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`
const rpShort = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1e9) return `Rp${(n / 1e9).toFixed(1)} M`
  if (a >= 1e6) return `Rp${(n / 1e6).toFixed(1)} jt`
  return rp(n)
}
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const todayStr = () => new Date().toISOString().slice(0, 10)

const KIND_META: Record<string, { label: string; icon: React.ElementType }> = {
  bank: { label: 'Bank', icon: Landmark },
  cash: { label: 'Tunai', icon: Coins },
  ewallet: { label: 'E-Wallet', icon: Smartphone },
  lainnya: { label: 'Lainnya', icon: Wallet },
}

// Kategori bawaan — dibuat sekali saat user belum punya kategori sama sekali.
const SEED_CATS: { name: string; type: 'income' | 'expense'; is_business?: boolean }[] = [
  { name: 'Gaji', type: 'income' },
  { name: 'Trading', type: 'income' },
  { name: 'Datalitiq', type: 'income', is_business: true },
  { name: 'Lainnya (Masuk)', type: 'income' },
  { name: 'Makan & Minum', type: 'expense' },
  { name: 'Transportasi', type: 'expense' },
  { name: 'Belanja', type: 'expense' },
  { name: 'Tagihan & Utilitas', type: 'expense' },
  { name: 'Kesehatan', type: 'expense' },
  { name: 'Hiburan', type: 'expense' },
  { name: 'Keluarga', type: 'expense' },
  { name: 'Biaya Datalitiq', type: 'expense', is_business: true },
  { name: 'Lainnya (Keluar)', type: 'expense' },
]

export default function KeuanganPage() {
  const sub = useSubscription()
  const router = useRouter()

  const [accounts, setAccounts] = useState<FinAccount[]>([])
  const [cats, setCats] = useState<FinCategory[]>([])
  const [txs, setTxs] = useState<FinTx[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)

  // bulan yang sedang dilihat
  const now = new Date()
  const [ym, setYm] = useState<{ y: number; m: number }>({ y: now.getFullYear(), m: now.getMonth() })

  const [showTx, setShowTx] = useState<null | 'income' | 'expense' | 'transfer'>(null)
  const [showAcc, setShowAcc] = useState(false)
  const [showCat, setShowCat] = useState(false)
  const [q, setQ] = useState('')

  // ── gate admin (UX; pagar sebenarnya = RLS) ──
  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace('/login?next=%2Fkeuangan')
    else if (!sub.loading && sub.userId && !sub.isAdmin) router.replace('/hub')
  }, [sub.loading, sub.userId, sub.isAdmin, router])

  // ── muat data ──
  async function loadAll() {
    const sb = createClient()
    const [a, c, t] = await Promise.all([
      sb.from('fin_accounts').select('*').order('created_at'),
      sb.from('fin_categories').select('*').order('created_at'),
      sb.from('fin_transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(1000),
    ])
    if (a.error || c.error || t.error) {
      const msg = a.error?.message || c.error?.message || t.error?.message || ''
      if (/relation|does not exist|schema cache/i.test(msg)) { setNeedsMigration(true); setLoading(false); return }
      toast.error('Gagal memuat: ' + msg); setLoading(false); return
    }
    setAccounts((a.data ?? []) as FinAccount[])
    setTxs((t.data ?? []) as FinTx[])
    let catRows = (c.data ?? []) as FinCategory[]
    // Seed kategori bawaan sekali saja
    if (!catRows.length && sub.userId) {
      const { data: seeded } = await sb.from('fin_categories')
        .insert(SEED_CATS.map(s => ({ user_id: sub.userId, name: s.name, type: s.type, is_business: !!s.is_business })))
        .select('*')
      catRows = (seeded ?? []) as FinCategory[]
    }
    setCats(catRows)
    setLoading(false)
  }
  useEffect(() => { if (sub.isAdmin) loadAll() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sub.isAdmin])

  // ── saldo per rekening (derived) ──
  const balances = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of accounts) map.set(a.id, Number(a.initial_balance))
    for (const t of txs) {
      const amt = Number(t.amount)
      if (t.type === 'income') map.set(t.account_id, (map.get(t.account_id) ?? 0) + amt)
      else if (t.type === 'expense') map.set(t.account_id, (map.get(t.account_id) ?? 0) - amt)
      else if (t.type === 'transfer') {
        map.set(t.account_id, (map.get(t.account_id) ?? 0) - amt)
        if (t.to_account_id) map.set(t.to_account_id, (map.get(t.to_account_id) ?? 0) + amt)
      }
    }
    return map
  }, [accounts, txs])
  const totalBalance = useMemo(() => [...balances.values()].reduce((a, b) => a + b, 0), [balances])

  // ── transaksi bulan terpilih ──
  const monthTxs = useMemo(() => {
    const pre = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`
    return txs.filter(t => t.date.startsWith(pre))
  }, [txs, ym])
  const monthIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const monthExpense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  // breakdown pengeluaran per kategori (bulan terpilih)
  const catBreakdown = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of monthTxs) if (t.type === 'expense') m.set(t.category_id ?? '-', (m.get(t.category_id ?? '-') ?? 0) + Number(t.amount))
    return [...m.entries()]
      .map(([cid, v]) => ({ cat: cats.find(c => c.id === cid), v }))
      .sort((a, b) => b.v - a.v)
  }, [monthTxs, cats])

  const shownTxs = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return monthTxs
    return monthTxs.filter(t =>
      (t.note ?? '').toLowerCase().includes(s) ||
      (cats.find(c => c.id === t.category_id)?.name ?? '').toLowerCase().includes(s) ||
      (accounts.find(a => a.id === t.account_id)?.name ?? '').toLowerCase().includes(s))
  }, [monthTxs, q, cats, accounts])

  async function delTx(id: string) {
    if (!window.confirm('Hapus transaksi ini?')) return
    const { error } = await createClient().from('fin_transactions').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setTxs(p => p.filter(t => t.id !== id))
    toast.success('Transaksi dihapus')
  }

  if (sub.loading || !sub.isAdmin) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7]"><Loader2 className="animate-spin text-indigo-500" /></div>
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-slate-900" style={{ fontFeatureSettings: '"tnum"' }}>
      <div className="max-w-5xl mx-auto px-4 pb-28 md:pb-12">

        {/* header */}
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-3">
            <Link href="/hub" className="flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm hover:shadow transition-shadow"><ArrowLeft size={18} /></Link>
            <div>
              <h1 className="text-lg font-black tracking-tight">Keuangan Pribadi</h1>
              <p className="text-[11px] text-slate-400">khusus admin · terpisah dari data trading</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCat(true)} className="flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm hover:shadow transition-shadow" title="Kelola kategori"><Settings2 size={17} /></button>
            <button onClick={() => setShowAcc(true)} className="flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm hover:shadow transition-shadow" title="Kelola rekening"><Wallet size={17} /></button>
          </div>
        </header>

        {needsMigration ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <p className="font-black text-lg mb-2">Tabel belum dibuat</p>
            <p className="text-sm text-slate-500 leading-relaxed">Jalankan <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[12px]">supabase-personal-finance.sql</code> di Supabase → SQL Editor, lalu muat ulang halaman ini.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-indigo-500" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* ── kolom kiri ── */}
            <div className="space-y-4">
              {/* hero saldo — lime ala referensi */}
              <div className="rounded-3xl p-6 shadow-sm relative overflow-hidden" style={{ background: '#E3F84E' }}>
                <p className="text-[12px] font-semibold text-lime-900/60 mb-1">Total Saldo</p>
                <p className="text-4xl font-black tracking-tight text-slate-900 tabular-nums">{rp(totalBalance)}</p>
                <p className="text-[12px] text-lime-900/60 mt-1">{accounts.length} rekening</p>
                {/* aksi cepat */}
                <div className="grid grid-cols-3 gap-2 mt-5">
                  <button onClick={() => accounts.length ? setShowTx('income') : toast.error('Buat rekening dulu')} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/70 backdrop-blur px-2 py-3 hover:bg-white transition-colors">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-white"><Plus size={16} /></span>
                    <span className="text-[11px] font-bold">Pemasukan</span>
                  </button>
                  <button onClick={() => accounts.length ? setShowTx('expense') : toast.error('Buat rekening dulu')} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/70 backdrop-blur px-2 py-3 hover:bg-white transition-colors">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-rose-500 text-white"><Minus size={16} /></span>
                    <span className="text-[11px] font-bold">Pengeluaran</span>
                  </button>
                  <button onClick={() => accounts.length >= 2 ? setShowTx('transfer') : toast.error('Butuh minimal 2 rekening')} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/70 backdrop-blur px-2 py-3 hover:bg-white transition-colors">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 text-white"><ArrowLeftRight size={16} /></span>
                    <span className="text-[11px] font-bold">Transfer</span>
                  </button>
                </div>
              </div>

              {/* rekening */}
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-black">Rekening</p>
                  <button onClick={() => setShowAcc(true)} className="text-[12px] font-bold text-indigo-500 hover:text-indigo-600">Kelola</button>
                </div>
                {accounts.length === 0 ? (
                  <button onClick={() => setShowAcc(true)} className="w-full rounded-2xl border-2 border-dashed border-slate-200 py-6 text-sm font-semibold text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors">+ Tambah rekening pertama</button>
                ) : (
                  <div className="space-y-2">
                    {accounts.map(a => {
                      const Icon = (KIND_META[a.kind] ?? KIND_META.lainnya).icon
                      return (
                        <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-[#F7F7FA] px-4 py-3">
                          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 text-indigo-600"><Icon size={16} /></span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold truncate">{a.name}</p>
                            <p className="text-[11px] text-slate-400">{(KIND_META[a.kind] ?? KIND_META.lainnya).label}</p>
                          </div>
                          <p className="text-[14px] font-black tabular-nums">{rpShort(balances.get(a.id) ?? 0)}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ringkasan bulan */}
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setYm(p => p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 })} className="w-8 h-8 rounded-full bg-[#F7F7FA] flex items-center justify-center hover:bg-slate-100"><ChevronLeft size={16} /></button>
                  <p className="text-[13px] font-black">{BLN[ym.m]} {ym.y}</p>
                  <button onClick={() => setYm(p => p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 })} className="w-8 h-8 rounded-full bg-[#F7F7FA] flex items-center justify-center hover:bg-slate-100"><ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="rounded-2xl bg-emerald-50 p-3.5">
                    <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1"><TrendingUp size={12} /> Masuk</p>
                    <p className="text-[16px] font-black text-emerald-700 tabular-nums mt-0.5">{rpShort(monthIncome)}</p>
                  </div>
                  <div className="rounded-2xl bg-rose-50 p-3.5">
                    <p className="text-[11px] font-semibold text-rose-500 flex items-center gap-1"><TrendingDown size={12} /> Keluar</p>
                    <p className="text-[16px] font-black text-rose-600 tabular-nums mt-0.5">{rpShort(monthExpense)}</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-[#F7F7FA] p-3.5 flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-slate-500">Selisih bulan ini</p>
                  <p className={`text-[15px] font-black tabular-nums ${monthIncome - monthExpense >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{monthIncome - monthExpense >= 0 ? '+' : ''}{rpShort(monthIncome - monthExpense)}</p>
                </div>

                {/* breakdown kategori */}
                {catBreakdown.length > 0 && (
                  <div className="mt-4 space-y-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pengeluaran per Kategori</p>
                    {catBreakdown.slice(0, 6).map(({ cat, v }, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between text-[12px] mb-1">
                          <span className="font-semibold flex items-center gap-1.5">
                            {cat?.is_business && <Briefcase size={11} className="text-indigo-400" />}
                            {cat?.name ?? 'Tanpa kategori'}
                          </span>
                          <span className="font-bold tabular-nums">{rpShort(v)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F0F0F4] overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-400" style={{ width: `${monthExpense > 0 ? (v / monthExpense) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── kolom kanan: riwayat ── */}
            <div className="rounded-3xl bg-white p-5 shadow-sm h-fit">
              <p className="text-[13px] font-black mb-3">Riwayat · {BLN[ym.m]}</p>
              <div className="relative mb-3">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari catatan, kategori, rekening…"
                  className="w-full h-11 pl-10 pr-4 rounded-2xl bg-[#F7F7FA] text-[13px] outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-300" />
              </div>
              {shownTxs.length === 0 ? (
                <p className="text-center text-[13px] text-slate-300 py-10">Belum ada transaksi bulan ini.</p>
              ) : (
                <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
                  {shownTxs.map(t => {
                    const cat = cats.find(c => c.id === t.category_id)
                    const acc = accounts.find(a => a.id === t.account_id)
                    const to = t.to_account_id ? accounts.find(a => a.id === t.to_account_id) : null
                    const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''
                    const color = t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : 'text-indigo-500'
                    const bg = t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : t.type === 'expense' ? 'bg-rose-100 text-rose-500' : 'bg-indigo-100 text-indigo-500'
                    const Icon = t.type === 'income' ? Plus : t.type === 'expense' ? Minus : ArrowLeftRight
                    return (
                      <div key={t.id} className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-[#F7F7FA] transition-colors">
                        <span className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${bg}`}><Icon size={15} /></span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold truncate">
                            {t.type === 'transfer' ? `${acc?.name ?? '?'} → ${to?.name ?? '?'}` : (cat?.name ?? 'Tanpa kategori')}
                            {cat?.is_business && t.type !== 'transfer' && <Briefcase size={11} className="inline ml-1.5 -mt-0.5 text-indigo-400" />}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {new Date(t.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            {t.type !== 'transfer' && acc ? ` · ${acc.name}` : ''}{t.note ? ` · ${t.note}` : ''}
                          </p>
                        </div>
                        {t.receipt_url && (
                          <a href={t.receipt_url} target="_blank" rel="noopener noreferrer" title="Lihat struk"
                            className="shrink-0 w-9 h-9 rounded-xl overflow-hidden border border-slate-100 hover:ring-2 hover:ring-indigo-200">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={t.receipt_url} alt="struk" className="w-full h-full object-cover" />
                          </a>
                        )}
                        <p className={`text-[13px] font-black tabular-nums shrink-0 ${color}`}>{sign}{rpShort(Number(t.amount))}</p>
                        <button onClick={() => delTx(t.id)} className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-opacity"><Trash2 size={14} /></button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* tombol tambah mengambang (mobile) */}
      {!loading && !needsMigration && (
        <button onClick={() => accounts.length ? setShowTx('expense') : setShowAcc(true)}
          className="md:hidden fixed bottom-6 right-5 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 active:scale-95 transition-transform">
          <Plus size={24} />
        </button>
      )}

      {showTx && <TxSheet kind={showTx} accounts={accounts} cats={cats} userId={sub.userId!} onClose={() => setShowTx(null)} onSaved={tx => { setTxs(p => [tx, ...p]); setShowTx(null) }} />}
      {showAcc && <AccSheet accounts={accounts} balances={balances} userId={sub.userId!} onClose={() => setShowAcc(false)} onChanged={loadAll} />}
      {showCat && <CatSheet cats={cats} userId={sub.userId!} onClose={() => setShowCat(false)} onChanged={loadAll} />}
    </div>
  )
}

// ── sheet dasar (bottom-sheet di mobile, modal di desktop) ──
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/30 backdrop-blur-sm p-0 md:p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 pt-5 pb-3 rounded-t-3xl">
          <p className="text-[15px] font-black">{title}</p>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-[#F7F7FA] flex items-center justify-center hover:bg-slate-100"><XIcon size={16} /></button>
        </div>
        <div className="px-5 pb-8">{children}</div>
      </div>
    </div>
  )
}

const inputCls = 'w-full h-12 px-4 rounded-2xl bg-[#F7F7FA] text-[14px] font-semibold outline-none focus:ring-2 focus:ring-indigo-200'
const btnPrimary = 'w-full h-12 rounded-2xl bg-indigo-500 text-white text-[14px] font-black hover:bg-indigo-600 active:scale-[0.99] transition disabled:opacity-50'

// ── form transaksi ──
function TxSheet({ kind, accounts, cats, userId, onClose, onSaved }: {
  kind: 'income' | 'expense' | 'transfer'
  accounts: FinAccount[]; cats: FinCategory[]; userId: string
  onClose: () => void; onSaved: (t: FinTx) => void
}) {
  const [type, setType] = useState(kind)
  const [amount, setAmount] = useState('')
  const [accId, setAccId] = useState(accounts[0]?.id ?? '')
  const [toId, setToId] = useState(accounts[1]?.id ?? '')
  const relevantCats = cats.filter(c => c.type === (type === 'income' ? 'income' : 'expense'))
  const [catId, setCatId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setCatId(relevantCats[0]?.id ?? '') /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [type])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const num = Number(amount.replace(/[^\d]/g, ''))
  const setAmountFmt = (v: string) => {
    const n = v.replace(/[^\d]/g, '')
    setAmount(n ? Number(n).toLocaleString('id-ID') : '')
  }

  async function save() {
    if (!num) { toast.error('Isi nominal dulu'); return }
    if (!accId) { toast.error('Pilih rekening'); return }
    if (type === 'transfer' && (!toId || toId === accId)) { toast.error('Rekening tujuan harus beda'); return }
    setBusy(true)
    try {
      const sb = createClient()
      let receipt_url: string | null = null
      if (file) {
        // Path pakai suffix acak — bucket publik, jangan sampai URL bisa ditebak.
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
        const rand = crypto.randomUUID().slice(0, 8)
        const path = `fin-receipts/${userId}-${Date.now()}-${rand}.${ext}`
        const up = await sb.storage.from('trade-screenshots').upload(path, file)
        if (up.error) { toast.error('Upload struk gagal: ' + up.error.message); setBusy(false); return }
        receipt_url = sb.storage.from('trade-screenshots').getPublicUrl(path).data.publicUrl
      }
      const { data, error } = await sb.from('fin_transactions').insert({
        user_id: userId, account_id: accId,
        to_account_id: type === 'transfer' ? toId : null,
        category_id: type === 'transfer' ? null : (catId || null),
        type, amount: num, note: note.trim() || null, date, receipt_url,
      }).select('*').single()
      if (error) { toast.error(error.message); setBusy(false); return }
      toast.success('Transaksi tersimpan')
      onSaved(data as FinTx)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
      setBusy(false)
    }
  }

  const TYPES = [
    { id: 'income' as const, label: 'Masuk', cls: 'data-[on=true]:bg-emerald-500' },
    { id: 'expense' as const, label: 'Keluar', cls: 'data-[on=true]:bg-rose-500' },
    { id: 'transfer' as const, label: 'Transfer', cls: 'data-[on=true]:bg-indigo-500' },
  ]

  return (
    <Sheet title="Tambah Transaksi" onClose={onClose}>
      {/* toggle jenis */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#F7F7FA] mb-5">
        {TYPES.map(t => (
          <button key={t.id} data-on={type === t.id} onClick={() => setType(t.id)}
            className={`h-10 rounded-xl text-[13px] font-black transition-colors text-slate-500 data-[on=true]:text-white ${t.cls}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* nominal besar */}
      <div className="text-center mb-5">
        <p className="text-[11px] font-semibold text-slate-400 mb-1">Nominal</p>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-xl font-black text-slate-400">Rp</span>
          <input value={amount} onChange={e => setAmountFmt(e.target.value)} inputMode="numeric" placeholder="0" autoFocus
            className="text-4xl font-black tracking-tight bg-transparent outline-none w-56 text-center tabular-nums placeholder:text-slate-200" />
        </div>
        <div className="flex justify-center gap-1.5 mt-3">
          {[50_000, 100_000, 500_000, 1_000_000].map(v => (
            <button key={v} onClick={() => setAmount(v.toLocaleString('id-ID'))}
              className="px-3 py-1.5 rounded-full bg-[#F7F7FA] text-[12px] font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
              {v >= 1e6 ? `${v / 1e6} jt` : `${v / 1e3} rb`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-bold text-slate-400 block mb-1.5">{type === 'transfer' ? 'Dari rekening' : 'Rekening'}</label>
          <select value={accId} onChange={e => setAccId(e.target.value)} className={inputCls}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {type === 'transfer' ? (
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1.5">Ke rekening</label>
            <select value={toId} onChange={e => setToId(e.target.value)} className={inputCls}>
              {accounts.filter(a => a.id !== accId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1.5">Kategori</label>
            <select value={catId} onChange={e => setCatId(e.target.value)} className={inputCls}>
              {relevantCats.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_business ? ' · bisnis' : ''}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1.5">Tanggal</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1.5">Catatan</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="opsional" className={inputCls} />
          </div>
        </div>

        {/* upload struk */}
        <div>
          <label className="text-[11px] font-bold text-slate-400 block mb-1.5">Struk / Bukti (opsional)</label>
          {preview ? (
            <div className="relative rounded-2xl overflow-hidden border border-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="pratinjau struk" className="w-full max-h-44 object-cover" />
              <button onClick={() => { setFile(null); setPreview(null) }}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-900/60 text-white flex items-center justify-center"><XIcon size={14} /></button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 h-20 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 text-[13px] font-semibold cursor-pointer hover:border-indigo-300 hover:text-indigo-500 transition-colors">
              <Camera size={17} /> Foto / upload struk
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return
                  if (f.size > 5_000_000) { toast.error('Maksimal 5 MB'); return }
                  setFile(f); setPreview(URL.createObjectURL(f))
                }} />
            </label>
          )}
        </div>

        <button onClick={save} disabled={busy} className={btnPrimary}>
          {busy ? <Loader2 size={16} className="animate-spin inline" /> : 'Simpan Transaksi'}
        </button>
      </div>
    </Sheet>
  )
}

// ── kelola rekening ──
function AccSheet({ accounts, balances, userId, onClose, onChanged }: {
  accounts: FinAccount[]; balances: Map<string, number>; userId: string
  onClose: () => void; onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('bank')
  const [init, setInit] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!name.trim()) { toast.error('Isi nama rekening'); return }
    setBusy(true)
    const { error } = await createClient().from('fin_accounts').insert({
      user_id: userId, name: name.trim(), kind,
      initial_balance: Number(init.replace(/[^\d-]/g, '')) || 0,
    })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Rekening ditambahkan'); setName(''); setInit(''); onChanged()
  }
  async function del(id: string) {
    if (!window.confirm('Hapus rekening ini? SEMUA transaksinya ikut terhapus.')) return
    const { error } = await createClient().from('fin_accounts').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Rekening dihapus'); onChanged()
  }

  return (
    <Sheet title="Kelola Rekening" onClose={onClose}>
      <div className="space-y-2 mb-5">
        {accounts.map(a => (
          <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-[#F7F7FA] px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold truncate">{a.name}</p>
              <p className="text-[11px] text-slate-400">{(KIND_META[a.kind] ?? KIND_META.lainnya).label} · saldo {rp(balances.get(a.id) ?? 0)}</p>
            </div>
            <button onClick={() => del(a.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button>
          </div>
        ))}
        {accounts.length === 0 && <p className="text-center text-[13px] text-slate-300 py-4">Belum ada rekening.</p>}
      </div>
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <p className="text-[12px] font-black text-slate-500">Tambah Rekening</p>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama — mis. BCA, Tunai, GoPay" className={inputCls} />
        <div className="grid grid-cols-2 gap-3">
          <select value={kind} onChange={e => setKind(e.target.value)} className={inputCls}>
            {Object.entries(KIND_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
          <input value={init} onChange={e => setInit(e.target.value.replace(/[^\d]/g, '') ? Number(e.target.value.replace(/[^\d]/g, '')).toLocaleString('id-ID') : '')} inputMode="numeric" placeholder="Saldo awal (Rp)" className={inputCls} />
        </div>
        <button onClick={add} disabled={busy} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin inline" /> : 'Tambah'}</button>
      </div>
    </Sheet>
  )
}

// ── kelola kategori ──
function CatSheet({ cats, userId, onClose, onChanged }: {
  cats: FinCategory[]; userId: string; onClose: () => void; onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [isBiz, setIsBiz] = useState(false)
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!name.trim()) { toast.error('Isi nama kategori'); return }
    setBusy(true)
    const { error } = await createClient().from('fin_categories').insert({ user_id: userId, name: name.trim(), type, is_business: isBiz })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Kategori ditambahkan'); setName(''); onChanged()
  }
  async function del(id: string) {
    if (!window.confirm('Hapus kategori ini? Transaksi lama tetap ada (jadi tanpa kategori).')) return
    const { error } = await createClient().from('fin_categories').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    onChanged()
  }

  const Group = ({ t, label }: { t: 'income' | 'expense'; label: string }) => (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {cats.filter(c => c.type === t).map(c => (
          <span key={c.id} className="group inline-flex items-center gap-1.5 rounded-full bg-[#F7F7FA] pl-3 pr-2 py-1.5 text-[12px] font-semibold">
            {c.is_business && <Briefcase size={11} className="text-indigo-400" />}
            {c.name}
            <button onClick={() => del(c.id)} className="text-slate-300 hover:text-rose-500"><XIcon size={12} /></button>
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <Sheet title="Kelola Kategori" onClose={onClose}>
      <div className="space-y-4 mb-5">
        <Group t="income" label="Pemasukan" />
        <Group t="expense" label="Pengeluaran" />
      </div>
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <p className="text-[12px] font-black text-slate-500">Tambah Kategori</p>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama kategori" className={inputCls} />
        <div className="grid grid-cols-2 gap-3">
          <select value={type} onChange={e => setType(e.target.value as 'income' | 'expense')} className={inputCls}>
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </select>
          <label className="flex items-center gap-2 h-12 px-4 rounded-2xl bg-[#F7F7FA] cursor-pointer">
            <input type="checkbox" checked={isBiz} onChange={e => setIsBiz(e.target.checked)} className="accent-indigo-500" />
            <span className="text-[13px] font-semibold">Bisnis</span>
          </label>
        </div>
        <button onClick={add} disabled={busy} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin inline" /> : 'Tambah'}</button>
      </div>
    </Sheet>
  )
}
