'use client'

// ═══════════════════════════════════════════════════════════════════════════
// KEUANGAN PRIBADI (khusus admin) — SaaS personal finance, tema TERANG.
//
// 4 tab: Ringkasan · Analitik (chart arus kas 6 bulan, donut kategori,
// pengeluaran harian) · Target (tabungan dengan ledger kontribusi) ·
// Anggaran (limit bulanan per kategori).
//
// Prinsip data (konsisten di semua fitur):
//  - Nilai turunan TIDAK PERNAH disimpan: saldo = initial + transaksi;
//    progres target = jumlah entri kontribusi. Mustahil tidak sinkron.
//  - Transfer antar-rekening bukan pengeluaran.
//  - Warna kategori/rekening bisa dikustom — dipakai konsisten di chart.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSubscription } from '@/hooks/useSubscription'
import { toast } from '@/lib/toast'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart as RePieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import {
  ArrowLeft, Plus, Minus, ArrowLeftRight, Wallet, Landmark, Smartphone, Coins,
  Loader2, Trash2, X as XIcon, ChevronLeft, ChevronRight, Search,
  TrendingUp, TrendingDown, Camera, Briefcase, Settings2, LayoutDashboard,
  ChartPie, PiggyBank, SlidersHorizontal, CalendarClock, Sparkles, Pencil,
} from 'lucide-react'

// ── tipe ──
type FinAccount = { id: string; name: string; kind: string; initial_balance: number; color: string | null }
type FinCategory = { id: string; name: string; type: 'income' | 'expense'; is_business: boolean; color: string | null }
type FinTx = {
  id: string; account_id: string; to_account_id: string | null; category_id: string | null
  type: 'income' | 'expense' | 'transfer'; amount: number; note: string | null
  date: string; receipt_url: string | null
}
type FinGoal = { id: string; name: string; target_amount: number; deadline: string | null; color: string | null }
type FinGoalEntry = { id: string; goal_id: string; amount: number; date: string; note: string | null }
type FinBudget = { id: string; category_id: string; monthly_limit: number }

const rp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`
const rpShort = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1e9) return `Rp${(n / 1e9).toFixed(1)} M`
  if (a >= 1e6) return `Rp${(n / 1e6).toFixed(1)} jt`
  if (a >= 1e3) return `Rp${Math.round(n / 1e3)} rb`
  return rp(n)
}
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const BLN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const todayStr = () => new Date().toISOString().slice(0, 10)

// Palet kustomisasi — dipakai kartu, chip, dan chart secara konsisten.
const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']
const colorAt = (i: number) => PALETTE[i % PALETTE.length]

const KIND_META: Record<string, { label: string; icon: React.ElementType }> = {
  bank: { label: 'Bank', icon: Landmark },
  cash: { label: 'Tunai', icon: Coins },
  ewallet: { label: 'E-Wallet', icon: Smartphone },
  lainnya: { label: 'Lainnya', icon: Wallet },
}

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

type TabId = 'home' | 'analytics' | 'goals' | 'budget'
const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'analytics', label: 'Analitik', icon: ChartPie },
  { id: 'goals', label: 'Target', icon: PiggyBank },
  { id: 'budget', label: 'Anggaran', icon: SlidersHorizontal },
]

export default function KeuanganPage() {
  const sub = useSubscription()
  const router = useRouter()

  const [tab, setTab] = useState<TabId>('home')
  const [accounts, setAccounts] = useState<FinAccount[]>([])
  const [cats, setCats] = useState<FinCategory[]>([])
  const [txs, setTxs] = useState<FinTx[]>([])
  const [goals, setGoals] = useState<FinGoal[]>([])
  const [goalEntries, setGoalEntries] = useState<FinGoalEntry[]>([])
  const [budgets, setBudgets] = useState<FinBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [needsV2, setNeedsV2] = useState(false)

  const now = new Date()
  const [ym, setYm] = useState<{ y: number; m: number }>({ y: now.getFullYear(), m: now.getMonth() })

  const [showTx, setShowTx] = useState<null | 'income' | 'expense' | 'transfer'>(null)
  const [showAcc, setShowAcc] = useState(false)
  const [showCat, setShowCat] = useState(false)
  const [showGoal, setShowGoal] = useState(false)
  const [goalDetail, setGoalDetail] = useState<FinGoal | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace('/login?next=%2Fkeuangan')
    else if (!sub.loading && sub.userId && !sub.isAdmin) router.replace('/hub')
  }, [sub.loading, sub.userId, sub.isAdmin, router])

  async function loadAll() {
    const sb = createClient()
    const [a, c, t] = await Promise.all([
      sb.from('fin_accounts').select('*').order('created_at'),
      sb.from('fin_categories').select('*').order('created_at'),
      sb.from('fin_transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(2000),
    ])
    if (a.error || c.error || t.error) {
      const msg = a.error?.message || c.error?.message || t.error?.message || ''
      if (/relation|does not exist|schema cache/i.test(msg)) { setNeedsMigration(true); setLoading(false); return }
      toast.error('Gagal memuat: ' + msg); setLoading(false); return
    }
    setAccounts((a.data ?? []) as FinAccount[])
    setTxs((t.data ?? []) as FinTx[])
    let catRows = (c.data ?? []) as FinCategory[]
    if (!catRows.length && sub.userId) {
      const { data: seeded } = await sb.from('fin_categories')
        .insert(SEED_CATS.map(s => ({ user_id: sub.userId, name: s.name, type: s.type, is_business: !!s.is_business })))
        .select('*')
      catRows = (seeded ?? []) as FinCategory[]
    }
    setCats(catRows)

    // v2 (target/anggaran) — tabel bisa belum ada; tahap-1 tetap jalan.
    const [g, ge, b] = await Promise.all([
      sb.from('fin_goals').select('*').order('created_at'),
      sb.from('fin_goal_entries').select('*').order('date', { ascending: false }),
      sb.from('fin_budgets').select('*'),
    ])
    if (g.error || ge.error || b.error) {
      const msg2 = g.error?.message || ge.error?.message || b.error?.message || ''
      if (/relation|does not exist|schema cache/i.test(msg2)) setNeedsV2(true)
    } else {
      setGoals((g.data ?? []) as FinGoal[])
      setGoalEntries((ge.data ?? []) as FinGoalEntry[])
      setBudgets((b.data ?? []) as FinBudget[])
      setNeedsV2(false)
    }
    setLoading(false)
  }
  useEffect(() => { if (sub.isAdmin) loadAll() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sub.isAdmin])

  // ── derived: saldo ──
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

  // ── derived: bulan terpilih ──
  const monthTxs = useMemo(() => {
    const pre = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`
    return txs.filter(t => t.date.startsWith(pre))
  }, [txs, ym])
  const monthIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const monthExpense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  const catColor = (c: FinCategory | undefined, i: number) => c?.color || colorAt(i)

  const catBreakdown = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of monthTxs) if (t.type === 'expense') m.set(t.category_id ?? '-', (m.get(t.category_id ?? '-') ?? 0) + Number(t.amount))
    return [...m.entries()]
      .map(([cid, v]) => ({ cid, cat: cats.find(c => c.id === cid), v }))
      .sort((a, b) => b.v - a.v)
  }, [monthTxs, cats])

  // ── derived: analitik ──
  // Tren 6 bulan terakhir (sampai bulan berjalan nyata, bukan bulan terpilih)
  const cashflow6m = useMemo(() => {
    const out: { label: string; masuk: number; keluar: number; selisih: number }[] = []
    const base = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
      const pre = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const rows = txs.filter(t => t.date.startsWith(pre))
      const masuk = rows.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const keluar = rows.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      out.push({ label: BLN3[d.getMonth()], masuk, keluar, selisih: masuk - keluar })
    }
    return out
  }, [txs])

  // Pengeluaran per hari (bulan terpilih)
  const dailyExpense = useMemo(() => {
    const days = new Date(ym.y, ym.m + 1, 0).getDate()
    const arr = Array.from({ length: days }, (_, i) => ({ d: i + 1, v: 0 }))
    for (const t of monthTxs) if (t.type === 'expense') {
      const day = Number(t.date.slice(8, 10))
      if (arr[day - 1]) arr[day - 1].v += Number(t.amount)
    }
    return arr
  }, [monthTxs, ym])

  const savingsRate = monthIncome > 0 ? ((monthIncome - monthExpense) / monthIncome) * 100 : null
  const daysPassed = ym.y === now.getFullYear() && ym.m === now.getMonth() ? now.getDate() : new Date(ym.y, ym.m + 1, 0).getDate()
  const avgDaily = daysPassed > 0 ? monthExpense / daysPassed : 0

  // ── derived: target ──
  const goalProgress = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of goalEntries) m.set(e.goal_id, (m.get(e.goal_id) ?? 0) + Number(e.amount))
    return m
  }, [goalEntries])
  const totalSaved = useMemo(() => [...goalProgress.values()].reduce((a, b) => a + b, 0), [goalProgress])

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

  const MonthNav = (
    <div className="flex items-center gap-2">
      <button onClick={() => setYm(p => p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 })} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center hover:shadow"><ChevronLeft size={15} /></button>
      <span className="text-[12px] font-black min-w-[90px] text-center">{BLN3[ym.m]} {ym.y}</span>
      <button onClick={() => setYm(p => p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 })} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center hover:shadow"><ChevronRight size={15} /></button>
    </div>
  )

  const V2Banner = needsV2 ? (
    <div className="rounded-3xl bg-amber-50 border border-amber-200 p-5 text-center">
      <p className="font-black text-[14px] text-amber-800 mb-1">Fitur ini butuh migrasi v2</p>
      <p className="text-[12px] text-amber-700/80 leading-relaxed">Jalankan <code className="px-1.5 py-0.5 rounded bg-amber-100 text-[11px]">supabase-personal-finance-v2.sql</code> di Supabase → SQL Editor, lalu muat ulang.</p>
    </div>
  ) : null

  const tooltipStyle = { borderRadius: 14, border: '1px solid #E2E8F0', fontSize: 12, fontWeight: 700, background: '#fff' }

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-slate-900" style={{ fontFeatureSettings: '"tnum"' }}>
      <div className="max-w-5xl mx-auto px-4 pb-32 md:pb-12">

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

        {/* tab pills (desktop) */}
        <nav className="hidden md:flex gap-1.5 p-1 rounded-2xl bg-white shadow-sm w-fit mb-5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 h-10 rounded-xl text-[13px] font-black transition-colors ${tab === t.id ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </nav>

        {needsMigration ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <p className="font-black text-lg mb-2">Tabel belum dibuat</p>
            <p className="text-sm text-slate-500 leading-relaxed">Jalankan <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[12px]">supabase-personal-finance.sql</code> lalu <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[12px]">-v2.sql</code> di Supabase → SQL Editor, lalu muat ulang.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-indigo-500" /></div>
        ) : (
          <>
            {/* ════════ TAB: RINGKASAN ════════ */}
            {tab === 'home' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="rounded-3xl p-6 shadow-sm relative overflow-hidden" style={{ background: '#E3F84E' }}>
                    <p className="text-[12px] font-semibold text-lime-900/60 mb-1">Total Saldo</p>
                    <p className="text-4xl font-black tracking-tight text-slate-900 tabular-nums">{rp(totalBalance)}</p>
                    <p className="text-[12px] text-lime-900/60 mt-1">{accounts.length} rekening{goals.length ? ` · ${goals.length} target aktif` : ''}</p>
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

                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[13px] font-black">Rekening</p>
                      <button onClick={() => setShowAcc(true)} className="text-[12px] font-bold text-indigo-500 hover:text-indigo-600">Kelola</button>
                    </div>
                    {accounts.length === 0 ? (
                      <button onClick={() => setShowAcc(true)} className="w-full rounded-2xl border-2 border-dashed border-slate-200 py-6 text-sm font-semibold text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors">+ Tambah rekening pertama</button>
                    ) : (
                      <div className="space-y-2">
                        {accounts.map((a, i) => {
                          const Icon = (KIND_META[a.kind] ?? KIND_META.lainnya).icon
                          const clr = a.color || colorAt(i)
                          return (
                            <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-[#F7F7FA] px-4 py-3">
                              <span className="flex items-center justify-center w-9 h-9 rounded-full" style={{ background: `${clr}1f`, color: clr }}><Icon size={16} /></span>
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
                  </div>
                </div>

                {/* riwayat */}
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

            {/* ════════ TAB: ANALITIK ════════ */}
            {tab === 'analytics' && (
              <div className="space-y-4">
                {/* stat tiles */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-3xl bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-400">Rasio Tabungan</p>
                    <p className={`text-xl font-black tabular-nums mt-1 ${savingsRate != null && savingsRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{savingsRate == null ? '—' : `${Math.round(savingsRate)}%`}</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">dari pemasukan {BLN3[ym.m]}</p>
                  </div>
                  <div className="rounded-3xl bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-400">Rata-rata Harian</p>
                    <p className="text-xl font-black tabular-nums mt-1">{rpShort(avgDaily)}</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">pengeluaran / hari</p>
                  </div>
                  <div className="rounded-3xl bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-400">Kategori Terbesar</p>
                    <p className="text-[15px] font-black mt-1 truncate">{catBreakdown[0]?.cat?.name ?? '—'}</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">{catBreakdown[0] ? rpShort(catBreakdown[0].v) : 'belum ada data'}</p>
                  </div>
                  <div className="rounded-3xl bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-400">Total Ditabung</p>
                    <p className="text-xl font-black tabular-nums mt-1 text-indigo-600">{rpShort(totalSaved)}</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">di semua target</p>
                  </div>
                </div>

                {/* arus kas 6 bulan */}
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[13px] font-black">Arus Kas · 6 Bulan Terakhir</p>
                    <span className="flex items-center gap-3 text-[10px] font-bold">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Masuk</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Keluar</span>
                    </span>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cashflow6m} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.35} /><stop offset="100%" stopColor="#34d399" stopOpacity={0.02} /></linearGradient>
                          <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" stopOpacity={0.35} /><stop offset="100%" stopColor="#fb7185" stopOpacity={0.02} /></linearGradient>
                        </defs>
                        <CartesianGrid stroke="#F1F5F9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v: number) => rpShort(v)} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={58} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown, name: unknown) => [rp(Number(v ?? 0)), name === 'masuk' ? 'Masuk' : 'Keluar']} />
                        <Area type="monotone" dataKey="masuk" stroke="#10b981" strokeWidth={2.5} fill="url(#gIn)" />
                        <Area type="monotone" dataKey="keluar" stroke="#f43f5e" strokeWidth={2.5} fill="url(#gOut)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* donut kategori */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[13px] font-black">Pengeluaran per Kategori</p>
                      {MonthNav}
                    </div>
                    {catBreakdown.length === 0 ? (
                      <p className="text-center text-[13px] text-slate-300 py-14">Belum ada pengeluaran bulan ini.</p>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="w-40 h-40 shrink-0 relative">
                          <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                              <Pie data={catBreakdown.map(b => ({ name: b.cat?.name ?? 'Lainnya', value: b.v }))}
                                dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2} strokeWidth={0} isAnimationActive={false}>
                                {catBreakdown.map((b, i) => <Cell key={b.cid} fill={catColor(b.cat, i)} />)}
                              </Pie>
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => rp(Number(v ?? 0))} />
                            </RePieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <p className="text-[10px] text-slate-400 font-semibold">Total</p>
                            <p className="text-[13px] font-black tabular-nums">{rpShort(monthExpense)}</p>
                          </div>
                        </div>
                        <div className="flex-1 space-y-2 min-w-0">
                          {catBreakdown.slice(0, 6).map((b, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: catColor(b.cat, i) }} />
                              <span className="text-[12px] font-semibold truncate flex-1">{b.cat?.name ?? 'Tanpa kategori'}</span>
                              <span className="text-[12px] font-black tabular-nums">{monthExpense > 0 ? Math.round((b.v / monthExpense) * 100) : 0}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* harian */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <p className="text-[13px] font-black mb-2">Pengeluaran Harian · {BLN[ym.m]}</p>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyExpense} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                          <CartesianGrid stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={4} />
                          <YAxis tickFormatter={(v: number) => rpShort(v)} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={54} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [rp(Number(v ?? 0)), 'Pengeluaran']} labelFormatter={(d: unknown) => `Tanggal ${d}`} />
                          <Bar dataKey="v" fill="#818cf8" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-slate-300 mt-1">Batang tinggi menonjol = hari boros — klik tab Ringkasan untuk melihat rinciannya.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ════════ TAB: TARGET ════════ */}
            {tab === 'goals' && (
              <div className="space-y-4">
                {V2Banner ?? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[15px] font-black flex items-center gap-2"><PiggyBank size={18} className="text-indigo-500" /> Target Tabungan</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Total ditabung: <b className="text-slate-700">{rp(totalSaved)}</b></p>
                      </div>
                      <button onClick={() => setShowGoal(true)} className="flex items-center gap-1.5 px-4 h-10 rounded-full bg-indigo-500 text-white text-[13px] font-black hover:bg-indigo-600"><Plus size={15} /> Target Baru</button>
                    </div>
                    {goals.length === 0 ? (
                      <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
                        <Sparkles size={28} className="mx-auto text-indigo-300 mb-3" />
                        <p className="font-black text-[15px] mb-1">Belum ada target</p>
                        <p className="text-[13px] text-slate-400">Buat target pertama — dana darurat, gadget, liburan, apa pun.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {goals.map((g, i) => {
                          const saved = goalProgress.get(g.id) ?? 0
                          const pct = Math.min(100, (saved / Number(g.target_amount)) * 100)
                          const clr = g.color || colorAt(i)
                          const sisaHari = g.deadline ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86_400_000) : null
                          return (
                            <button key={g.id} onClick={() => setGoalDetail(g)} className="text-left rounded-3xl bg-white p-5 shadow-sm hover:shadow transition-shadow">
                              <div className="flex items-center justify-between mb-3">
                                <span className="flex items-center justify-center w-10 h-10 rounded-2xl" style={{ background: `${clr}1f`, color: clr }}><PiggyBank size={18} /></span>
                                {g.deadline && (
                                  <span className={`flex items-center gap-1 text-[11px] font-bold ${sisaHari != null && sisaHari < 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                                    <CalendarClock size={12} /> {sisaHari != null && sisaHari > 0 ? `${sisaHari} hari lagi` : 'lewat tenggat'}
                                  </span>
                                )}
                              </div>
                              <p className="text-[14px] font-black">{g.name}</p>
                              <p className="text-[12px] text-slate-400 mt-0.5 tabular-nums">{rp(saved)} <span className="text-slate-300">dari {rp(Number(g.target_amount))}</span></p>
                              <div className="mt-3 h-2.5 rounded-full bg-[#F0F0F4] overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: clr }} />
                              </div>
                              <p className="text-[11px] font-black mt-1.5" style={{ color: clr }}>{Math.round(pct)}%{pct >= 100 ? ' · tercapai 🎉' : ''}</p>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ════════ TAB: ANGGARAN ════════ */}
            {tab === 'budget' && (
              <div className="space-y-4">
                {V2Banner ?? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[15px] font-black flex items-center gap-2"><SlidersHorizontal size={17} className="text-indigo-500" /> Anggaran Bulanan</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Batas pengeluaran per kategori — berlaku setiap bulan.</p>
                      </div>
                      {MonthNav}
                    </div>
                    <BudgetList cats={cats} budgets={budgets} monthTxs={monthTxs} userId={sub.userId!} onChanged={loadAll} />
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* bottom nav (mobile) */}
      {!needsMigration && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-100 pb-[max(env(safe-area-inset-bottom),8px)]">
          <div className="grid grid-cols-5 items-center px-2 pt-2">
            {TABS.slice(0, 2).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-0.5 py-1 ${tab === t.id ? 'text-indigo-500' : 'text-slate-400'}`}>
                <t.icon size={20} /><span className="text-[9px] font-bold">{t.label}</span>
              </button>
            ))}
            <div className="flex justify-center -mt-6">
              <button onClick={() => accounts.length ? setShowTx('expense') : setShowAcc(true)}
                className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 active:scale-95 transition-transform">
                <Plus size={24} />
              </button>
            </div>
            {TABS.slice(2).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-0.5 py-1 ${tab === t.id ? 'text-indigo-500' : 'text-slate-400'}`}>
                <t.icon size={20} /><span className="text-[9px] font-bold">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {showTx && <TxSheet kind={showTx} accounts={accounts} cats={cats} userId={sub.userId!} onClose={() => setShowTx(null)} onSaved={tx => { setTxs(p => [tx, ...p]); setShowTx(null) }} />}
      {showAcc && <AccSheet accounts={accounts} balances={balances} userId={sub.userId!} onClose={() => setShowAcc(false)} onChanged={loadAll} />}
      {showCat && <CatSheet cats={cats} userId={sub.userId!} onClose={() => setShowCat(false)} onChanged={loadAll} />}
      {showGoal && <GoalSheet userId={sub.userId!} onClose={() => setShowGoal(false)} onChanged={() => { setShowGoal(false); loadAll() }} />}
      {goalDetail && <GoalDetailSheet goal={goalDetail} entries={goalEntries.filter(e => e.goal_id === goalDetail.id)} saved={goalProgress.get(goalDetail.id) ?? 0} userId={sub.userId!} onClose={() => setGoalDetail(null)} onChanged={loadAll} />}
    </div>
  )
}

// ── UI dasar ──
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/30 backdrop-blur-sm p-0 md:p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 pt-5 pb-3 rounded-t-3xl z-10">
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

function ColorPicker({ value, onChange }: { value: string | null; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PALETTE.map(c => (
        <button key={c} type="button" onClick={() => onChange(c)}
          className={`w-8 h-8 rounded-full transition-transform ${value === c ? 'ring-2 ring-offset-2 ring-slate-300 scale-110' : 'hover:scale-105'}`}
          style={{ background: c }} />
      ))}
    </div>
  )
}

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
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#F7F7FA] mb-5">
        {TYPES.map(t => (
          <button key={t.id} data-on={type === t.id} onClick={() => setType(t.id)}
            className={`h-10 rounded-xl text-[13px] font-black transition-colors text-slate-500 data-[on=true]:text-white ${t.cls}`}>
            {t.label}
          </button>
        ))}
      </div>

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

// ── kelola rekening (dengan warna) ──
function AccSheet({ accounts, balances, userId, onClose, onChanged }: {
  accounts: FinAccount[]; balances: Map<string, number>; userId: string
  onClose: () => void; onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('bank')
  const [init, setInit] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!name.trim()) { toast.error('Isi nama rekening'); return }
    setBusy(true)
    const { error } = await createClient().from('fin_accounts').insert({
      user_id: userId, name: name.trim(), kind, color,
      initial_balance: Number(init.replace(/[^\d-]/g, '')) || 0,
    })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Rekening ditambahkan'); setName(''); setInit(''); setColor(null); onChanged()
  }
  async function setAccColor(id: string, c: string) {
    const { error } = await createClient().from('fin_accounts').update({ color: c }).eq('id', id)
    if (error) { toast.error(error.message); return }
    onChanged()
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
        {accounts.map((a, i) => (
          <div key={a.id} className="rounded-2xl bg-[#F7F7FA] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: a.color || colorAt(i) }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold truncate">{a.name}</p>
                <p className="text-[11px] text-slate-400">{(KIND_META[a.kind] ?? KIND_META.lainnya).label} · saldo {rp(balances.get(a.id) ?? 0)}</p>
              </div>
              <button onClick={() => del(a.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button>
            </div>
            <div className="flex gap-1.5 mt-2">
              {PALETTE.map(c => (
                <button key={c} onClick={() => setAccColor(a.id, c)}
                  className={`w-5 h-5 rounded-full ${a.color === c ? 'ring-2 ring-offset-1 ring-slate-300' : ''}`} style={{ background: c }} />
              ))}
            </div>
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
        <ColorPicker value={color} onChange={setColor} />
        <button onClick={add} disabled={busy} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin inline" /> : 'Tambah'}</button>
      </div>
    </Sheet>
  )
}

// ── kelola kategori (dengan warna) ──
function CatSheet({ cats, userId, onClose, onChanged }: {
  cats: FinCategory[]; userId: string; onClose: () => void; onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [isBiz, setIsBiz] = useState(false)
  const [color, setColor] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!name.trim()) { toast.error('Isi nama kategori'); return }
    setBusy(true)
    const { error } = await createClient().from('fin_categories').insert({ user_id: userId, name: name.trim(), type, is_business: isBiz, color })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Kategori ditambahkan'); setName(''); setColor(null); onChanged()
  }
  async function setCatColor(id: string, c: string) {
    const { error } = await createClient().from('fin_categories').update({ color: c }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setEditId(null); onChanged()
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
        {cats.filter(c => c.type === t).map((c, i) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#F7F7FA] pl-2.5 pr-2 py-1.5 text-[12px] font-semibold">
            <button onClick={() => setEditId(editId === c.id ? null : c.id)} title="Ganti warna"
              className="w-3 h-3 rounded-full shrink-0 ring-offset-1 hover:ring-2 hover:ring-slate-200" style={{ background: c.color || colorAt(i) }} />
            {c.is_business && <Briefcase size={11} className="text-indigo-400" />}
            {c.name}
            <button onClick={() => del(c.id)} className="text-slate-300 hover:text-rose-500"><XIcon size={12} /></button>
            {editId === c.id && (
              <span className="flex gap-1 ml-1">
                {PALETTE.map(p => <button key={p} onClick={() => setCatColor(c.id, p)} className="w-4 h-4 rounded-full" style={{ background: p }} />)}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <Sheet title="Kelola Kategori" onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-4 flex items-center gap-1.5"><Pencil size={12} /> Klik bulatan warna untuk mengganti warna kategori (dipakai di chart).</p>
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
        <ColorPicker value={color} onChange={setColor} />
        <button onClick={add} disabled={busy} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin inline" /> : 'Tambah'}</button>
      </div>
    </Sheet>
  )
}

// ── target: buat baru ──
function GoalSheet({ userId, onClose, onChanged }: { userId: string; onClose: () => void; onChanged: () => void }) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [color, setColor] = useState<string | null>(PALETTE[0])
  const [busy, setBusy] = useState(false)

  async function add() {
    const num = Number(target.replace(/[^\d]/g, ''))
    if (!name.trim()) { toast.error('Isi nama target'); return }
    if (!num) { toast.error('Isi nominal target'); return }
    setBusy(true)
    const { error } = await createClient().from('fin_goals').insert({
      user_id: userId, name: name.trim(), target_amount: num, deadline: deadline || null, color,
    })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Target dibuat 🎯'); onChanged()
  }

  return (
    <Sheet title="Target Baru" onClose={onClose}>
      <div className="space-y-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama — mis. Dana Darurat, Liburan" className={inputCls} autoFocus />
        <div>
          <label className="text-[11px] font-bold text-slate-400 block mb-1.5">Nominal target (Rp)</label>
          <input value={target} onChange={e => setTarget(e.target.value.replace(/[^\d]/g, '') ? Number(e.target.value.replace(/[^\d]/g, '')).toLocaleString('id-ID') : '')} inputMode="numeric" placeholder="mis. 10.000.000" className={inputCls} />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-400 block mb-1.5">Tenggat (opsional)</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls} />
        </div>
        <ColorPicker value={color} onChange={setColor} />
        <button onClick={add} disabled={busy} className={btnPrimary}>{busy ? <Loader2 size={16} className="animate-spin inline" /> : 'Buat Target'}</button>
      </div>
    </Sheet>
  )
}

// ── target: detail + setor/tarik dana ──
function GoalDetailSheet({ goal, entries, saved, userId, onClose, onChanged }: {
  goal: FinGoal; entries: FinGoalEntry[]; saved: number; userId: string
  onClose: () => void; onChanged: () => void
}) {
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const pct = Math.min(100, (saved / Number(goal.target_amount)) * 100)
  const clr = goal.color || PALETTE[0]

  async function addEntry(sign: 1 | -1) {
    const num = Number(amount.replace(/[^\d]/g, '')) * sign
    if (!num) { toast.error('Isi nominal'); return }
    if (sign === -1 && saved + num < 0) { toast.error('Melebihi dana yang tersimpan'); return }
    setBusy(true)
    const { error } = await createClient().from('fin_goal_entries').insert({ user_id: userId, goal_id: goal.id, amount: num, date: todayStr() })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success(sign === 1 ? 'Dana ditambahkan' : 'Dana ditarik'); setAmount(''); onChanged()
  }
  async function delGoal() {
    if (!window.confirm('Hapus target ini beserta seluruh riwayat setorannya?')) return
    const { error } = await createClient().from('fin_goals').delete().eq('id', goal.id)
    if (error) { toast.error(error.message); return }
    toast.success('Target dihapus'); onClose(); onChanged()
  }

  return (
    <Sheet title={goal.name} onClose={onClose}>
      <div className="rounded-3xl p-5 mb-4" style={{ background: `${clr}12`, border: `1px solid ${clr}33` }}>
        <p className="text-3xl font-black tabular-nums" style={{ color: clr }}>{rp(saved)}</p>
        <p className="text-[12px] text-slate-500 mt-0.5">dari target {rp(Number(goal.target_amount))}</p>
        <div className="mt-3 h-3 rounded-full bg-white overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: clr }} />
        </div>
        <p className="text-[12px] font-black mt-1.5" style={{ color: clr }}>{Math.round(pct)}%{pct >= 100 ? ' — tercapai! 🎉' : ''}</p>
      </div>

      <div className="flex gap-2 mb-4">
        <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, '') ? Number(e.target.value.replace(/[^\d]/g, '')).toLocaleString('id-ID') : '')}
          inputMode="numeric" placeholder="Nominal (Rp)" className={inputCls + ' flex-1'} />
        <button onClick={() => addEntry(1)} disabled={busy} className="px-4 h-12 rounded-2xl bg-emerald-500 text-white font-black text-[13px] hover:bg-emerald-600 disabled:opacity-50">Setor</button>
        <button onClick={() => addEntry(-1)} disabled={busy} className="px-4 h-12 rounded-2xl bg-slate-200 text-slate-600 font-black text-[13px] hover:bg-slate-300 disabled:opacity-50">Tarik</button>
      </div>

      {entries.length > 0 && (
        <div className="space-y-1.5 mb-4 max-h-56 overflow-y-auto">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Riwayat</p>
          {entries.map(e => (
            <div key={e.id} className="flex items-center justify-between rounded-xl bg-[#F7F7FA] px-3.5 py-2.5">
              <span className="text-[12px] text-slate-500">{new Date(e.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span className={`text-[13px] font-black tabular-nums ${Number(e.amount) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{Number(e.amount) >= 0 ? '+' : ''}{rpShort(Number(e.amount))}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={delGoal} className="w-full h-11 rounded-2xl border border-rose-200 text-rose-500 text-[13px] font-black hover:bg-rose-50 transition-colors">Hapus Target</button>
    </Sheet>
  )
}

// ── anggaran ──
function BudgetList({ cats, budgets, monthTxs, userId, onChanged }: {
  cats: FinCategory[]; budgets: FinBudget[]; monthTxs: FinTx[]; userId: string; onChanged: () => void
}) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const expenseCats = cats.filter(c => c.type === 'expense')

  const spentOf = (cid: string) => monthTxs.filter(t => t.type === 'expense' && t.category_id === cid).reduce((s, t) => s + Number(t.amount), 0)

  async function saveBudget(cid: string) {
    const raw = draft[cid] ?? ''
    const num = Number(raw.replace(/[^\d]/g, ''))
    const sb = createClient()
    if (!num) {
      // kosong = hapus anggaran
      const ex = budgets.find(b => b.category_id === cid)
      if (ex) { await sb.from('fin_budgets').delete().eq('id', ex.id); toast.success('Anggaran dihapus'); onChanged() }
      return
    }
    const { error } = await sb.from('fin_budgets').upsert({ user_id: userId, category_id: cid, monthly_limit: num }, { onConflict: 'user_id,category_id' })
    if (error) { toast.error(error.message); return }
    toast.success('Anggaran disimpan'); onChanged()
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {expenseCats.map((c, i) => {
        const b = budgets.find(x => x.category_id === c.id)
        const spent = spentOf(c.id)
        const limit = b ? Number(b.monthly_limit) : 0
        const pct = limit > 0 ? (spent / limit) * 100 : 0
        const clr = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : (c.color || colorAt(i))
        return (
          <div key={c.id} className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[13px] font-black flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color || colorAt(i) }} />
                <span className="truncate">{c.name}</span>
                {c.is_business && <Briefcase size={11} className="text-indigo-400 shrink-0" />}
              </p>
              {limit > 0 && (
                <span className="text-[11px] font-black shrink-0" style={{ color: clr }}>
                  {Math.round(pct)}%{pct >= 100 ? ' · LEWAT!' : pct >= 80 ? ' · hampir' : ''}
                </span>
              )}
            </div>
            {limit > 0 ? (
              <>
                <div className="h-2.5 rounded-full bg-[#F0F0F4] overflow-hidden mb-1.5">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: clr }} />
                </div>
                <p className="text-[11px] text-slate-400 tabular-nums">{rpShort(spent)} dari {rpShort(limit)}</p>
              </>
            ) : (
              <p className="text-[11px] text-slate-300 mb-1.5">Belum ada batas — pengeluaran {rpShort(spent)}</p>
            )}
            <div className="flex gap-2 mt-2.5">
              <input
                value={draft[c.id] ?? (b ? Number(b.monthly_limit).toLocaleString('id-ID') : '')}
                onChange={e => setDraft(p => ({ ...p, [c.id]: e.target.value.replace(/[^\d]/g, '') ? Number(e.target.value.replace(/[^\d]/g, '')).toLocaleString('id-ID') : '' }))}
                inputMode="numeric" placeholder="Batas / bulan (Rp)"
                className="flex-1 h-10 px-3.5 rounded-xl bg-[#F7F7FA] text-[12px] font-semibold outline-none focus:ring-2 focus:ring-indigo-200" />
              <button onClick={() => saveBudget(c.id)} className="px-3.5 h-10 rounded-xl bg-indigo-500 text-white text-[12px] font-black hover:bg-indigo-600">Simpan</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
