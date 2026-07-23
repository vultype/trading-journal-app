'use client'

// ═══════════════════════════════════════════════════════════════════════════
// KEUANGAN PRIBADI (khusus admin) — SaaS personal finance, tema TERANG.
//
// 5 tab: Ringkasan · Transaksi · Analitik · Target · Anggaran
// Filter periode GLOBAL (hari ini / minggu / bulan / 3 bulan / tahun / kustom)
// berlaku di seluruh tab, jadi angka di semua tempat selalu konsisten.
//
// Prinsip data (konsisten di semua fitur):
//  - Nilai turunan TIDAK PERNAH disimpan: saldo = initial + transaksi;
//    progres target = jumlah entri kontribusi. Mustahil tidak sinkron.
//  - Transfer antar-rekening bukan pemasukan/pengeluaran — dikecualikan dari
//    seluruh statistik arus kas.
//  - Warna kategori/rekening bisa dikustom, dipakai konsisten di chart.
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
  Camera, Briefcase, Settings2, LayoutDashboard,
  ChartPie, PiggyBank, SlidersHorizontal, CalendarClock, Sparkles, Pencil,
  ArrowUpRight, ArrowDownRight, ReceiptText, ListFilter, User, HeartPulse,
  TriangleAlert, Info, CircleCheck, Lightbulb, Share2, Copy,
} from 'lucide-react'
import { SHARE_V, type SharePayload } from '@/lib/finance-share'

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
type HealthPillar = { key: string; label: string; weight: number; score: number; detail: string; hint: string }
type Health = {
  score: number; band: { label: string; color: string }
  pillars: HealthPillar[]; weakest: HealthPillar | undefined
  mInc: number; mExp: number
}

type ShareOpts = { score: boolean; insights: boolean; cats: boolean; charts: boolean; txs: boolean; balance: boolean; masked: boolean }
type ShareRow = { id: string; slug: string; masked: boolean; expires_at: string | null; views: number }

type Insight = { key: string; tone: 'good' | 'warn' | 'bad' | 'info'; title: string; text: string }
const TONE: Record<Insight['tone'], { bg: string; fg: string; icon: React.ElementType }> = {
  bad:  { bg: '#fef2f2', fg: '#ef4444', icon: TriangleAlert },
  warn: { bg: '#fffbeb', fg: '#f59e0b', icon: Info },
  good: { bg: '#ecfdf5', fg: '#10b981', icon: CircleCheck },
  info: { bg: '#F7F7FA', fg: '#6366f1', icon: Lightbulb },
}

type BudgetPeriod = 'weekly' | 'monthly' | 'yearly'
type FinBudget = { id: string; name: string; monthly_limit: number; period: BudgetPeriod; color: string | null }
type FinBudgetCat = { budget_id: string; category_id: string }

// Nominal SELALU ditulis penuh: Rp1.300.000, bukan "Rp1,3 jt". Angka yang
// dibulatkan menyembunyikan selisih ratusan ribu — persis ukuran yang bikin
// saldo tidak cocok saat dicek ke m-banking.
const rp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`
// Sumbu chart: format sama, tanpa prefiks "Rp" supaya label tidak memakan
// lebar plot. Satuannya sudah jelas dari judul kartunya.
const TOOLTIP_STYLE = { borderRadius: 14, border: '1px solid #E2E8F0', fontSize: 12, fontWeight: 700, background: '#fff' }
const rpAxis = (n: number) => Math.round(n).toLocaleString('id-ID')
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const BLN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayStr = () => iso(new Date())
const fmtTgl = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTglPendek = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

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

type TabId = 'home' | 'tx' | 'analytics' | 'goals' | 'budget'
const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'tx', label: 'Transaksi', icon: ReceiptText },
  { id: 'analytics', label: 'Analitik', icon: ChartPie },
  { id: 'goals', label: 'Target', icon: PiggyBank },
  { id: 'budget', label: 'Anggaran', icon: SlidersHorizontal },
]

type Preset = 'today' | 'week' | 'month' | '3m' | 'year' | 'custom'
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Hari ini' },
  { id: 'week', label: 'Minggu ini' },
  { id: 'month', label: 'Bulanan' },
  { id: '3m', label: '3 Bulan' },
  { id: 'year', label: 'Tahun ini' },
  { id: 'custom', label: 'Kustom' },
]

const sumBy = (rows: FinTx[], type: 'income' | 'expense') =>
  rows.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0)

const PERIODS: { id: BudgetPeriod; label: string; per: string }[] = [
  { id: 'weekly', label: 'Mingguan', per: '/minggu' },
  { id: 'monthly', label: 'Bulanan', per: '/bulan' },
  { id: 'yearly', label: 'Tahunan', per: '/tahun' },
]

// Jendela waktu sebuah anggaran, di-anchor ke satu tanggal.
//
// Ini sengaja TIDAK memakai filter periode global. Membandingkan batas bulanan
// dengan pengeluaran "3 bulan terakhir" atau "tahun ini" menghasilkan angka yang
// selalu terlihat jebol — bukan karena boros, tapi karena satuannya beda. Yang
// dibandingkan harus periode milik anggaran itu sendiri.
function budgetWindow(period: BudgetPeriod, anchorISO: string) {
  const d = new Date(anchorISO + 'T00:00:00')
  if (period === 'weekly') {
    const day = d.getDay() || 7               // Minggu(0) diperlakukan sebagai hari ke-7
    const mon = new Date(d); mon.setDate(d.getDate() - day + 1)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { from: iso(mon), to: iso(sun), label: `${fmtTglPendek(iso(mon))} – ${fmtTglPendek(iso(sun))}` }
  }
  if (period === 'yearly') {
    return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31`, label: `Tahun ${d.getFullYear()}` }
  }
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return {
    from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
    to: iso(last),
    label: `${BLN[d.getMonth()]} ${d.getFullYear()}`,
  }
}

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
  const [budgetCats, setBudgetCats] = useState<FinBudgetCat[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [needsV2, setNeedsV2] = useState(false)
  const [needsV3, setNeedsV3] = useState(false)

  // ── filter periode global ──
  const now = new Date()
  const [preset, setPreset] = useState<Preset>('month')
  const [ym, setYm] = useState<{ y: number; m: number }>({ y: now.getFullYear(), m: now.getMonth() })
  const [cFrom, setCFrom] = useState(todayStr())
  const [cTo, setCTo] = useState(todayStr())

  // ── filter tab transaksi ──
  const [fType, setFType] = useState<'all' | 'income' | 'expense' | 'transfer'>('all')
  const [fCat, setFCat] = useState('')
  const [fAcc, setFAcc] = useState('')
  const [q, setQ] = useState('')

  const [showTx, setShowTx] = useState<null | 'income' | 'expense' | 'transfer'>(null)
  const [editTx, setEditTx] = useState<FinTx | null>(null)
  const [detailTx, setDetailTx] = useState<FinTx | null>(null)
  const [showAcc, setShowAcc] = useState(false)
  // rekening yang langsung dibuka dalam mode edit saat sheet terbuka
  const [accFocus, setAccFocus] = useState<string | null>(null)
  const [showCat, setShowCat] = useState(false)
  const [showGoal, setShowGoal] = useState(false)
  const [goalDetail, setGoalDetail] = useState<FinGoal | null>(null)
  // null = tertutup · 'new' = buat baru · FinBudget = sedang diedit
  const [budgetSheet, setBudgetSheet] = useState<null | 'new' | FinBudget>(null)
  const [catInsight, setCatInsight] = useState<{ cid: string; kind: 'income' | 'expense' } | null>(null)
  const [showShare, setShowShare] = useState(false)

  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace('/login?next=%2Fkeuangan')
    else if (!sub.loading && sub.userId && !sub.isAdmin) router.replace('/hub')
  }, [sub.loading, sub.userId, sub.isAdmin, router])

  async function loadAll() {
    const sb = createClient()
    const [a, c, t] = await Promise.all([
      sb.from('fin_accounts').select('*').order('created_at'),
      sb.from('fin_categories').select('*').order('created_at'),
      sb.from('fin_transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(5000),
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

    const [g, ge, b, bc] = await Promise.all([
      sb.from('fin_goals').select('*').order('created_at'),
      sb.from('fin_goal_entries').select('*').order('date', { ascending: false }),
      sb.from('fin_budgets').select('*').order('created_at'),
      sb.from('fin_budget_categories').select('budget_id,category_id'),
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
    // v3 terpisah dari v2: tabel jembatan kategori-anggaran baru ada di v3, dan
    // Target sudah bisa dipakai walau anggaran belum dimigrasi.
    if (bc.error) setNeedsV3(true)
    else { setBudgetCats((bc.data ?? []) as FinBudgetCat[]); setNeedsV3(false) }
    setLoading(false)
  }
  useEffect(() => { if (sub.isAdmin) loadAll() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sub.isAdmin])

  // ── saldo: dari SELURUH transaksi, bukan periode terfilter ──
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

  // ── rentang tanggal aktif ──
  const range = useMemo(() => {
    const d = new Date()
    if (preset === 'today') return { from: todayStr(), to: todayStr(), label: 'Hari ini' }
    if (preset === 'week') {
      const day = d.getDay() || 7            // Minggu(0) diperlakukan sebagai hari ke-7
      const mon = new Date(d); mon.setDate(d.getDate() - day + 1)
      return { from: iso(mon), to: todayStr(), label: 'Minggu ini' }
    }
    if (preset === 'month') {
      const last = new Date(ym.y, ym.m + 1, 0)
      return { from: `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-01`, to: iso(last), label: `${BLN[ym.m]} ${ym.y}` }
    }
    if (preset === '3m') {
      const s = new Date(d.getFullYear(), d.getMonth() - 2, 1)
      return { from: iso(s), to: todayStr(), label: '3 bulan terakhir' }
    }
    if (preset === 'year') return { from: `${d.getFullYear()}-01-01`, to: todayStr(), label: `Tahun ${d.getFullYear()}` }
    // kustom: jaga agar from <= to walau user membalik urutannya
    const from = cFrom <= cTo ? cFrom : cTo, to = cFrom <= cTo ? cTo : cFrom
    return { from, to, label: `${fmtTglPendek(from)} – ${fmtTglPendek(to)}` }
  }, [preset, ym, cFrom, cTo])

  const periodTxs = useMemo(
    () => txs.filter(t => t.date >= range.from && t.date <= range.to),
    [txs, range])

  // Periode SEBELUMNYA, panjang sama — pembanding naik/turun.
  const prevPeriodTxs = useMemo(() => {
    const from = new Date(range.from + 'T00:00:00'), to = new Date(range.to + 'T00:00:00')
    const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1)
    const pTo = new Date(from); pTo.setDate(from.getDate() - 1)
    const pFrom = new Date(pTo); pFrom.setDate(pTo.getDate() - days + 1)
    const a = iso(pFrom), b = iso(pTo)
    return txs.filter(t => t.date >= a && t.date <= b)
  }, [txs, range])

  const income = sumBy(periodTxs, 'income')
  const expense = sumBy(periodTxs, 'expense')
  const prevIncome = sumBy(prevPeriodTxs, 'income')
  const prevExpense = sumBy(prevPeriodTxs, 'expense')
  const pctChange = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : null

  const catColor = (c: FinCategory | undefined, i: number) => c?.color || colorAt(i)

  const expBreakdown = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of periodTxs) if (t.type === 'expense') m.set(t.category_id ?? '-', (m.get(t.category_id ?? '-') ?? 0) + Number(t.amount))
    return [...m.entries()].map(([cid, v]) => ({ cid, cat: cats.find(c => c.id === cid), v })).sort((a, b) => b.v - a.v)
  }, [periodTxs, cats])
  const incBreakdown = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of periodTxs) if (t.type === 'income') m.set(t.category_id ?? '-', (m.get(t.category_id ?? '-') ?? 0) + Number(t.amount))
    return [...m.entries()].map(([cid, v]) => ({ cid, cat: cats.find(c => c.id === cid), v })).sort((a, b) => b.v - a.v)
  }, [periodTxs, cats])

  const bizSplit = useMemo(() => {
    let biz = 0, pri = 0
    for (const t of periodTxs) {
      if (t.type !== 'expense') continue
      const c = cats.find(x => x.id === t.category_id)
      if (c?.is_business) biz += Number(t.amount); else pri += Number(t.amount)
    }
    return { biz, pri }
  }, [periodTxs, cats])

  const topTxs = useMemo(() =>
    [...periodTxs].filter(t => t.type !== 'transfer').sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5),
    [periodTxs])

  // Tren 6 bulan — sengaja TIDAK ikut filter, sebagai konteks jangka panjang.
  const cashflow6m = useMemo(() => {
    const out: { label: string; masuk: number; keluar: number }[] = []
    const base = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
      const pre = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const rows = txs.filter(t => t.date.startsWith(pre))
      out.push({ label: BLN3[d.getMonth()], masuk: sumBy(rows, 'income'), keluar: sumBy(rows, 'expense') })
    }
    return out
  }, [txs])

  // Deret harian dalam periode aktif (dibatasi 120 titik agar chart tetap terbaca)
  const dailySeries = useMemo(() => {
    const from = new Date(range.from + 'T00:00:00'), to = new Date(range.to + 'T00:00:00')
    const days = Math.min(120, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1)
    const arr: { label: string; keluar: number; masuk: number }[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(from); d.setDate(from.getDate() + i)
      const key = iso(d)
      const rows = periodTxs.filter(t => t.date === key)
      arr.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, keluar: sumBy(rows, 'expense'), masuk: sumBy(rows, 'income') })
    }
    return arr
  }, [periodTxs, range])

  const periodDays = Math.max(1, Math.round((new Date(range.to + 'T00:00:00').getTime() - new Date(range.from + 'T00:00:00').getTime()) / 86_400_000) + 1)
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : null
  const avgDaily = expense / periodDays

  // ── anggaran: satu baris hitung per amplop ──
  //
  // Anchor = ujung periode yang sedang dilihat. Jadi kalau user menelusuri bulan
  // Juni lewat filter, anggaran bulanan ikut menampilkan Juni — bukan diam di
  // bulan berjalan. Anggaran mingguan/tahunan mengikuti minggu/tahun dari anchor
  // yang sama.
  const budgetRows = useMemo(() => {
    const catsOf = new Map<string, string[]>()
    for (const bc of budgetCats) catsOf.set(bc.budget_id, [...(catsOf.get(bc.budget_id) ?? []), bc.category_id])
    const today = todayStr()

    return budgets.map(b => {
      const win = budgetWindow(b.period, range.to)
      const cids = catsOf.get(b.id) ?? []
      const rows = txs.filter(t =>
        t.type === 'expense' && t.category_id && cids.includes(t.category_id)
        && t.date >= win.from && t.date <= win.to)
      const spent = rows.reduce((s, t) => s + Number(t.amount), 0)
      const limit = Number(b.monthly_limit)
      const pct = limit > 0 ? (spent / limit) * 100 : 0

      // Sisa harian hanya bermakna kalau periodenya sedang berjalan — untuk
      // periode yang sudah lewat, "boleh pakai per hari" tidak ada artinya.
      const live = today >= win.from && today <= win.to
      const daysLeft = live
        ? Math.max(1, Math.round((new Date(win.to + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000) + 1)
        : null
      const perDay = daysLeft ? Math.max(0, limit - spent) / daysLeft : null

      return {
        b, win, cids, spent, limit, pct, perDay, daysLeft, live,
        cats: cids.map(id => cats.find(c => c.id === id)).filter(Boolean) as FinCategory[],
      }
    })
  }, [budgets, budgetCats, txs, cats, range.to])

  const budgetTotals = useMemo(() => {
    // Kategori yang sama boleh masuk lebih dari satu amplop, jadi menjumlahkan
    // "terpakai" tiap amplop akan menghitungnya dua kali. Total dihitung dari
    // himpunan kategori unik supaya angkanya tidak menggelembung.
    const monthly = budgetRows.filter(r => r.b.period === 'monthly')
    const uniq = new Set(monthly.flatMap(r => r.cids))
    const win = budgetWindow('monthly', range.to)
    const spent = txs.filter(t =>
      t.type === 'expense' && t.category_id && uniq.has(t.category_id)
      && t.date >= win.from && t.date <= win.to).reduce((s, t) => s + Number(t.amount), 0)
    return { limit: monthly.reduce((s, r) => s + r.limit, 0), spent, count: monthly.length, win }
  }, [budgetRows, txs, range.to])

  // ── skor kesehatan keuangan ──
  //
  // Basisnya SENGAJA tetap 90 hari terakhir, bukan filter periode. "Dana darurat
  // 6 bulan" atau "rasio tabungan" tidak punya arti kalau dihitung atas rentang
  // "Hari ini" — dan skor yang melompat-lompat begitu filter digeser tidak bisa
  // dipercaya sebagai ukuran.
  //
  // Pilar yang datanya belum ada (belum punya anggaran, belum ada pemasukan)
  // DILEWATI, bukan diberi nilai nol. Menghukum orang karena fitur yang belum
  // dipakai membuat skornya bicara soal kelengkapan setup, bukan kesehatan uang.
  // Bobotnya dibagi ulang ke pilar yang tersisa.
  const health = useMemo(() => {
    const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
    const today = new Date()
    const start = new Date(today); start.setDate(today.getDate() - 89)
    const win = txs.filter(t => t.date >= iso(start) && t.date <= iso(today))
    const inc = sumBy(win, 'income'), exp = sumBy(win, 'expense')
    const mInc = inc / 3, mExp = exp / 3

    const pillars: HealthPillar[] = []

    if (inc > 0) {
      const sr = (inc - exp) / inc
      pillars.push({
        key: 'save', label: 'Rasio Tabungan', weight: 35, score: clamp01(sr / 0.2),
        detail: `${Math.round(sr * 100)}% dari pemasukan disisihkan`,
        hint: 'Sisihkan minimal 20% dari pemasukan untuk skor penuh.',
      })
    }
    if (mExp > 0) {
      const months = totalBalance / mExp
      pillars.push({
        key: 'buffer', label: 'Dana Darurat', weight: 30, score: clamp01(months / 6),
        detail: `saldo menutup ${months.toFixed(1)} bulan pengeluaran`,
        hint: 'Idealnya saldo setara 6 bulan pengeluaran.',
      })
    }

    // Kepatuhan anggaran: bulan BERJALAN, bukan bulan yang sedang ditelusuri.
    const catsOf = new Map<string, string[]>()
    for (const bc of budgetCats) catsOf.set(bc.budget_id, [...(catsOf.get(bc.budget_id) ?? []), bc.category_id])
    const nowWin = budgetWindow('monthly', todayStr())
    const mb = budgets.filter(b => b.period === 'monthly' && Number(b.monthly_limit) > 0).map(b => {
      const cids = catsOf.get(b.id) ?? []
      const spent = txs.filter(t => t.type === 'expense' && t.category_id && cids.includes(t.category_id)
        && t.date >= nowWin.from && t.date <= nowWin.to).reduce((s, t) => s + Number(t.amount), 0)
      return { limit: Number(b.monthly_limit), spent }
    })
    if (mb.length) {
      // Dinilai terhadap PACE, bukan batas penuh. Tanggal 5 sudah memakai 80%
      // jatah bulanan itu tidak sehat — padahal terhadap batas penuh ia masih
      // "aman" dan akan dapat nilai sempurna sampai benar-benar jebol.
      const elapsed = Math.round((new Date(todayStr() + 'T00:00:00').getTime() - new Date(nowWin.from + 'T00:00:00').getTime()) / 86_400_000) + 1
      const total = Math.round((new Date(nowWin.to + 'T00:00:00').getTime() - new Date(nowWin.from + 'T00:00:00').getTime()) / 86_400_000) + 1
      const pace = Math.max(0.05, elapsed / total)
      const tot = mb.reduce((s, r) => s + r.limit, 0)
      // Amplop besar berbobot lebih besar: jebol Rp50.000 di amplop Rp5.000.000
      // tidak sama beratnya dengan jebol Rp50.000 di amplop Rp100.000.
      const sc = mb.reduce((s, r) => {
        const cap = r.limit * pace
        return s + r.limit * (r.spent <= cap ? 1 : Math.max(0, 1 - (r.spent - cap) / cap))
      }, 0) / tot
      pillars.push({
        key: 'budget', label: 'Kepatuhan Anggaran', weight: 20, score: sc,
        detail: `${mb.filter(r => r.spent <= r.limit * pace).length} dari ${mb.length} amplop sesuai pace (hari ke-${elapsed} dari ${total})`,
        hint: 'Jaga laju belanja tiap amplop sepadan dengan sisa hari di bulan ini.',
      })
    }

    // Stabilitas: pengeluaran yang naik-turun ekstrem menyulitkan perencanaan,
    // walau rata-ratanya wajar.
    // Mulai dari i=1: bulan BERJALAN masih separuh jalan, memasukkannya membuat
    // variasi terlihat ekstrem tiap awal bulan padahal belanjanya normal.
    const per = [1, 2, 3].map(i => {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const pre = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return sumBy(txs.filter(t => t.date.startsWith(pre)), 'expense')
    }).filter(v => v > 0)
    if (per.length >= 2) {
      const mean = per.reduce((a, b) => a + b, 0) / per.length
      const sd = Math.sqrt(per.reduce((s, v) => s + (v - mean) ** 2, 0) / per.length)
      const cv = mean > 0 ? sd / mean : 0
      pillars.push({
        key: 'stable', label: 'Stabilitas Pengeluaran', weight: 15, score: clamp01((0.6 - cv) / 0.45),
        detail: `variasi ${Math.round(cv * 100)}% antar-bulan`,
        hint: 'Pengeluaran yang rata tiap bulan lebih mudah direncanakan.',
      })
    }

    if (!pillars.length) return null
    const wsum = pillars.reduce((s, p) => s + p.weight, 0)
    const score = Math.round((pillars.reduce((s, p) => s + p.weight * p.score, 0) / wsum) * 100)
    const band = score >= 80 ? { label: 'Sangat Sehat', color: '#10b981' }
      : score >= 60 ? { label: 'Sehat', color: '#6366f1' }
      : score >= 40 ? { label: 'Cukup', color: '#f59e0b' }
      : { label: 'Perlu Perhatian', color: '#ef4444' }
    // Saran diambil dari pilar terlemah yang masih punya ruang perbaikan.
    const weakest = [...pillars].filter(p => p.score < 0.95).sort((a, b) => a.score - b.score)[0]
    return { score, band, pillars, weakest, mInc, mExp }
  }, [txs, totalBalance, budgets, budgetCats])

  const goalProgress = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of goalEntries) m.set(e.goal_id, (m.get(e.goal_id) ?? 0) + Number(e.amount))
    return m
  }, [goalEntries])
  const totalSaved = useMemo(() => [...goalProgress.values()].reduce((a, b) => a + b, 0), [goalProgress])

  // ── insight otomatis ──
  //
  // Aturan yang saya pegang di sini: satu temuan hanya muncul kalau angkanya
  // cukup besar untuk pantas ditindaklanjuti. Ambang nominal (bukan cuma persen)
  // dipasang di hampir semua aturan karena "naik 300%" dari Rp5.000 ke Rp20.000
  // secara teknis benar tapi tidak berguna — dan daftar yang penuh temuan remeh
  // membuat yang penting ikut diabaikan.
  const insights = useMemo(() => {
    const out: Insight[] = []
    const nm = (id?: string | null) => cats.find(c => c.id === id)?.name ?? 'Tanpa kategori'

    // — lonjakan & penurunan kategori vs periode sebelumnya —
    const prevByCat = new Map<string, number>()
    for (const t of prevPeriodTxs) if (t.type === 'expense') prevByCat.set(t.category_id ?? '-', (prevByCat.get(t.category_id ?? '-') ?? 0) + Number(t.amount))
    const moves = expBreakdown.map(b => ({ b, p: prevByCat.get(b.cid) ?? 0 }))
      .filter(x => x.p > 0)
      .map(x => ({ ...x, d: x.b.v - x.p, r: (x.b.v - x.p) / x.p }))
    const up = moves.filter(x => x.r >= 0.3 && x.d >= 100_000).sort((a, b) => b.d - a.d)[0]
    if (up) out.push({
      key: 'up', tone: 'warn', title: `${nm(up.b.cid)} naik ${Math.round(up.r * 100)}%`,
      text: `${rp(up.p)} → ${rp(up.b.v)} dibanding periode sebelumnya, selisih ${rp(up.d)}.`,
    })
    const down = moves.filter(x => x.r <= -0.3 && -x.d >= 100_000).sort((a, b) => a.d - b.d)[0]
    if (down) out.push({
      key: 'down', tone: 'good', title: `${nm(down.b.cid)} turun ${Math.abs(Math.round(down.r * 100))}%`,
      text: `Hemat ${rp(-down.d)} dibanding periode sebelumnya.`,
    })

    // — konsentrasi pengeluaran —
    if (expense > 0 && expBreakdown[0] && expBreakdown[0].v / expense >= 0.4 && expBreakdown.length > 1) {
      out.push({
        key: 'conc', tone: 'warn', title: `${nm(expBreakdown[0].cid)} menyerap ${Math.round((expBreakdown[0].v / expense) * 100)}% pengeluaran`,
        text: 'Satu kategori mendominasi. Kalau ada yang perlu dipangkas, di sinilah dampaknya paling terasa.',
      })
    }

    // — ketergantungan sumber pemasukan —
    if (income > 0 && incBreakdown[0] && incBreakdown[0].v / income >= 0.85) {
      out.push({
        key: 'inc1', tone: incBreakdown.length === 1 ? 'warn' : 'info',
        title: `${Math.round((incBreakdown[0].v / income) * 100)}% pemasukan dari ${nm(incBreakdown[0].cid)}`,
        text: 'Nyaris seluruh pemasukan bergantung pada satu sumber — risikonya menumpuk di satu titik.',
      })
    }

    // — hari paling boros —
    const byDay = new Map<string, number>()
    for (const t of periodTxs) if (t.type === 'expense') byDay.set(t.date, (byDay.get(t.date) ?? 0) + Number(t.amount))
    const worst = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0]
    if (worst && periodDays > 1 && worst[1] >= avgDaily * 2 && worst[1] >= 200_000) {
      out.push({
        key: 'worstday', tone: 'info', title: `Hari terboros: ${fmtTgl(worst[0])}`,
        text: `${rp(worst[1])} dalam sehari — ${(worst[1] / Math.max(1, avgDaily)).toFixed(1)}× rata-rata harian Anda.`,
      })
    }

    // — hari tanpa pengeluaran —
    if (periodDays >= 7) {
      const zero = periodDays - byDay.size
      if (zero > 0) out.push({
        key: 'nospend', tone: zero >= periodDays * 0.3 ? 'good' : 'info',
        title: `${zero} hari tanpa pengeluaran`,
        text: `Dari ${periodDays} hari di periode ini. Hari tanpa belanja adalah pengungkit paling murah untuk menaikkan rasio tabungan.`,
      })
    }

    // — akhir pekan vs hari kerja —
    if (periodDays >= 14) {
      let we = 0, wd = 0, weD = 0, wdD = 0
      for (let i = 0; i < periodDays; i++) {
        const d = new Date(range.from + 'T00:00:00'); d.setDate(d.getDate() + i)
        const isWe = d.getDay() === 0 || d.getDay() === 6
        const v = byDay.get(iso(d)) ?? 0
        if (isWe) { we += v; weD++ } else { wd += v; wdD++ }
      }
      const a = weD ? we / weD : 0, b = wdD ? wd / wdD : 0
      if (b > 0 && a >= b * 1.5 && a - b >= 50_000) out.push({
        key: 'weekend', tone: 'info', title: `Akhir pekan ${(a / b).toFixed(1)}× lebih boros`,
        text: `Rata-rata ${rp(a)}/hari saat akhir pekan vs ${rp(b)}/hari di hari kerja.`,
      })
    }

    // — langganan / pengeluaran berulang —
    // Nominal yang persis sama, kategori sama, muncul di 3 bulan berbeda. Pola
    // ini hampir selalu langganan otomatis — jenis pengeluaran yang paling
    // sering lolos dari perhatian justru karena tidak pernah terasa.
    const sig = new Map<string, Set<string>>()
    for (const t of txs) {
      if (t.type !== 'expense' || !t.category_id) continue
      const k = `${t.category_id}|${Math.round(Number(t.amount))}`
      if (!sig.has(k)) sig.set(k, new Set())
      sig.get(k)!.add(t.date.slice(0, 7))
    }
    const recur = [...sig.entries()].filter(([, m]) => m.size >= 3)
      .map(([k, m]) => ({ cid: k.split('|')[0], amt: Number(k.split('|')[1]), months: m.size }))
      .filter(r => r.amt >= 50_000)     // nominal receh yang kebetulan sama bukan langganan
      .sort((a, b) => b.amt - a.amt)
    if (recur.length) {
      const totalRec = recur.reduce((s, r) => s + r.amt, 0)
      out.push({
        key: 'recur', tone: 'info', title: `${recur.length} pengeluaran berulang terdeteksi`,
        text: `Sekitar ${rp(totalRec)} per siklus — terbesar ${nm(recur[0].cid)} ${rp(recur[0].amt)}, muncul di ${recur[0].months} bulan berbeda. Nominal yang persis sama berulang biasanya berarti langganan.`,
      })
    }

    // — anggaran jebol / hampir —
    const blown = budgetRows.filter(r => r.limit > 0 && r.pct >= 100).sort((a, b) => b.spent - b.limit - (a.spent - a.limit))
    if (blown.length) out.push({
      key: 'bud-over', tone: 'bad', title: `${blown.length} anggaran terlewati`,
      text: `Terparah: ${blown[0].b.name}, ${rp(blown[0].spent)} dari batas ${rp(blown[0].limit)} (lebih ${rp(blown[0].spent - blown[0].limit)}).`,
    })
    const near = budgetRows.filter(r => r.limit > 0 && r.pct >= 80 && r.pct < 100).sort((a, b) => b.pct - a.pct)
    if (near.length) out.push({
      key: 'bud-near', tone: 'warn', title: `${near[0].b.name} sudah ${Math.round(near[0].pct)}% terpakai`,
      text: near[0].daysLeft ? `Sisa ${rp(near[0].limit - near[0].spent)} untuk ${near[0].daysLeft} hari ke depan.` : `Sisa ${rp(near[0].limit - near[0].spent)}.`,
    })

    // — saldo rekening menipis —
    if (avgDaily > 0) {
      for (const a of accounts) {
        const bal = balances.get(a.id) ?? 0
        if (bal > 0 && bal < avgDaily * 7) {
          out.push({
            key: `low-${a.id}`, tone: 'warn', title: `Saldo ${a.name} menipis`,
            text: `${rp(bal)} — sekitar ${Math.floor(bal / avgDaily)} hari dengan laju pengeluaran Anda sekarang.`,
          })
          break   // satu peringatan cukup; sisanya jadi kebisingan
        }
      }
    }

    // — target: butuh setor berapa per bulan —
    for (const g of goals) {
      if (!g.deadline) continue
      const saved = goalProgress.get(g.id) ?? 0
      const left = Number(g.target_amount) - saved
      if (left <= 0) continue
      const months = Math.max(0, (new Date(g.deadline).getTime() - Date.now()) / (30 * 86_400_000))
      if (months < 0.2) {
        out.push({ key: `goal-${g.id}`, tone: 'bad', title: `Tenggat ${g.name} hampir habis`, text: `Kurang ${rp(left)} dan tenggatnya ${fmtTgl(g.deadline)}.` })
      } else {
        out.push({ key: `goal-${g.id}`, tone: 'info', title: `${g.name}: sisihkan ${rp(left / months)}/bulan`, text: `Agar ${rp(Number(g.target_amount))} tercapai sebelum ${fmtTgl(g.deadline)}.` })
      }
      break
    }

    // — laju pengeluaran vs periode lalu —
    if (prevExpense > 0 && expense > 0) {
      const r = (expense - prevExpense) / prevExpense
      if (Math.abs(r) >= 0.15 && Math.abs(expense - prevExpense) >= 200_000) out.push({
        key: 'pace', tone: r > 0 ? 'warn' : 'good',
        title: `Total pengeluaran ${r > 0 ? 'naik' : 'turun'} ${Math.abs(Math.round(r * 100))}%`,
        text: `${rp(prevExpense)} → ${rp(expense)} dibanding periode sebelumnya yang sama panjang.`,
      })
    }

    // — pengeluaran melebihi pemasukan —
    if (income > 0 && expense > income) out.push({
      key: 'deficit', tone: 'bad', title: 'Pengeluaran melebihi pemasukan',
      text: `Defisit ${rp(expense - income)} di ${range.label}. Selisihnya diambil dari saldo yang sudah ada.`,
    })

    // — pengeluaran bisnis vs pribadi —
    if (bizSplit.biz > 0 && bizSplit.pri > 0) {
      const share = bizSplit.biz / (bizSplit.biz + bizSplit.pri)
      out.push({
        key: 'biz', tone: 'info', title: `${Math.round(share * 100)}% pengeluaran untuk bisnis`,
        text: `Bisnis ${rp(bizSplit.biz)} · pribadi ${rp(bizSplit.pri)}. Berguna saat memisahkan pembukuan.`,
      })
    }

    const ORDER: Record<Insight['tone'], number> = { bad: 0, warn: 1, good: 2, info: 3 }
    return out.sort((a, b) => ORDER[a.tone] - ORDER[b.tone])
  }, [txs, periodTxs, prevPeriodTxs, cats, accounts, balances, goals, goalProgress, budgetRows,
      expBreakdown, incBreakdown, expense, income, prevExpense, avgDaily, periodDays, range, bizSplit])


  // ── daftar transaksi terfilter ──
  const listTxs = useMemo(() => {
    const s = q.trim().toLowerCase()
    return periodTxs.filter(t => {
      if (fType !== 'all' && t.type !== fType) return false
      if (fCat && t.category_id !== fCat) return false
      if (fAcc && t.account_id !== fAcc && t.to_account_id !== fAcc) return false
      if (!s) return true
      return (t.note ?? '').toLowerCase().includes(s)
        || (cats.find(c => c.id === t.category_id)?.name ?? '').toLowerCase().includes(s)
        || (accounts.find(a => a.id === t.account_id)?.name ?? '').toLowerCase().includes(s)
        || String(t.amount).includes(s)
    })
  }, [periodTxs, fType, fCat, fAcc, q, cats, accounts])

  const grouped = useMemo(() => {
    const m = new Map<string, FinTx[]>()
    for (const t of listTxs) { const a = m.get(t.date) ?? []; a.push(t); m.set(t.date, a) }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [listTxs])

  async function delTx(id: string) {
    if (!window.confirm('Hapus transaksi ini?')) return
    const { error } = await createClient().from('fin_transactions').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setTxs(p => p.filter(t => t.id !== id))
    setDetailTx(null)
    toast.success('Transaksi dihapus')
  }

  if (sub.loading || !sub.isAdmin) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7]"><Loader2 className="animate-spin text-indigo-500" /></div>
  }


  // Payload berbagi — SELALU dirakit ulang dari angka periode aktif, tidak
  // pernah menyertakan baris transaksi, nama rekening, catatan, maupun URL
  // struk. Apa pun yang masuk ke sini otomatis ikut terbuka ke siapa pun yang
  // memegang tautannya.
  const buildShare = (o: ShareOpts): SharePayload => {
    const monthLabels: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1)
      monthLabels.push(BLN3[d.getMonth()])
    }
    // Rincian per kategori: hanya AGREGAT. Jumlah, rata-rata, terbesar, hari
    // aktif, dan bentuk tren 6 bulan — tanpa satu pun catatan, tanggal, atau
    // rekening yang bisa mengidentifikasi transaksi tertentu.
    const catRows = (bd: typeof expBreakdown, kind: 'income' | 'expense', tot: number) =>
      bd.slice(0, 8).map((b, i) => {
        const mine = periodTxs.filter(t => t.type === kind && (t.category_id ?? '-') === b.cid)
        const trend: number[] = []
        for (let k = 5; k >= 0; k--) {
          const d = new Date(new Date().getFullYear(), new Date().getMonth() - k, 1)
          const pre = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          trend.push(txs.filter(t => t.type === kind && (t.category_id ?? '-') === b.cid && t.date.startsWith(pre))
            .reduce((s, t) => s + Number(t.amount), 0))
        }
        return {
          name: b.cat?.name ?? 'Tanpa kategori', color: catColor(b.cat, i),
          v: b.v, pct: tot > 0 ? (b.v / tot) * 100 : 0,
          count: mine.length,
          avg: mine.length ? b.v / mine.length : 0,
          max: mine.reduce((m, t) => Math.max(m, Number(t.amount)), 0),
          days: new Set(mine.map(t => t.date)).size,
          trend,
          // Dibatasi 60 baris TERBESAR per kategori: payload tetap wajar, dan
          // yang terpotong adalah transaksi kecil yang paling tidak informatif.
          // UI penerima menyebut pemotongan ini eksplisit.
          txs: o.txs
            ? [...mine].sort((x, y) => Number(y.amount) - Number(x.amount)).slice(0, 60)
                .map(t => ({ d: t.date, n: t.note ?? undefined, v: Number(t.amount) }))
            : undefined,
        }
      })

    return {
      v: SHARE_V,
      period: range.label,
      createdAt: new Date().toISOString(),
      masked: o.masked,
      totals: { income, expense, net: income - expense },
      balance: o.balance ? totalBalance : undefined,
      monthLabels,
      score: o.score && health ? {
        score: health.score, band: health.band,
        pillars: health.pillars.map(p => ({ label: p.label, weight: p.weight, score: p.score, detail: p.detail })),
      } : undefined,
      expense: o.cats ? catRows(expBreakdown, 'expense', expense) : undefined,
      income: o.cats ? catRows(incBreakdown, 'income', income) : undefined,
      insights: o.insights ? insights.slice(0, 10).map(i => ({ tone: i.tone, title: i.title, text: i.text })) : undefined,
      cashflow: o.charts ? cashflow6m.map(m => ({ label: m.label, masuk: m.masuk, keluar: m.keluar })) : undefined,
      daily: o.charts ? dailySeries.map(d => ({ label: d.label, masuk: d.masuk, keluar: d.keluar })) : undefined,
    }
  }

  const V2Banner = needsV2 ? (
    <div className="rounded-3xl bg-amber-50 border border-amber-200 p-5 text-center">
      <p className="font-black text-[14px] text-amber-800 mb-1">Fitur ini butuh migrasi v2</p>
      <p className="text-[12px] text-amber-700/80 leading-relaxed">Jalankan <code className="px-1.5 py-0.5 rounded bg-amber-100 text-[11px]">supabase-personal-finance-v2.sql</code> di Supabase → SQL Editor, lalu muat ulang.</p>
    </div>
  ) : null

  const V3Banner = needsV3 ? (
    <div className="rounded-3xl bg-amber-50 border border-amber-200 p-5 text-center">
      <p className="font-black text-[14px] text-amber-800 mb-1">Anggaran baru butuh migrasi v3</p>
      <p className="text-[12px] text-amber-700/80 leading-relaxed">Jalankan <code className="px-1.5 py-0.5 rounded bg-amber-100 text-[11px]">supabase-personal-finance-v3.sql</code> di Supabase → SQL Editor, lalu muat ulang. Anggaran lama otomatis ikut dipindahkan.</p>
    </div>
  ) : null

  const PeriodBar = (
    <div className="rounded-3xl bg-white p-3 shadow-sm mb-4">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => setPreset(p.id)}
            className={`shrink-0 px-3.5 h-9 rounded-xl text-[12px] font-black transition-colors ${preset === p.id ? 'bg-indigo-500 text-white' : 'bg-[#F7F7FA] text-slate-500 hover:bg-slate-100'}`}>
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'month' && (
        <div className="flex items-center justify-center gap-3 mt-3">
          <button onClick={() => setYm(p => p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 })} className="w-8 h-8 rounded-full bg-[#F7F7FA] flex items-center justify-center hover:bg-slate-100"><ChevronLeft size={15} /></button>
          <span className="text-[13px] font-black min-w-[120px] text-center">{BLN[ym.m]} {ym.y}</span>
          <button onClick={() => setYm(p => p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 })} className="w-8 h-8 rounded-full bg-[#F7F7FA] flex items-center justify-center hover:bg-slate-100"><ChevronRight size={15} /></button>
        </div>
      )}
      {preset === 'custom' && (
        <div className="flex items-center gap-2 mt-3">
          <input type="date" value={cFrom} onChange={e => setCFrom(e.target.value)} className="flex-1 h-10 px-3 rounded-xl bg-[#F7F7FA] text-[12px] font-semibold outline-none focus:ring-2 focus:ring-indigo-200" />
          <span className="text-slate-300 text-[12px] font-bold">s/d</span>
          <input type="date" value={cTo} onChange={e => setCTo(e.target.value)} className="flex-1 h-10 px-3 rounded-xl bg-[#F7F7FA] text-[12px] font-semibold outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>
      )}
      <p className="text-[10px] text-slate-400 mt-2 text-center">{range.label} · {periodDays} hari · {periodTxs.length} transaksi</p>
    </div>
  )

  const StatTile = ({ label, value, sub: s, color, delta }: { label: string; value: string; sub?: string; color?: string; delta?: number | null }) => (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      {/* Nominal penuh jauh lebih panjang dari versi singkat — ukurannya ikut
          lebar layar supaya tidak terpotong di ponsel. */}
      <p className={`text-[15px] sm:text-lg md:text-xl font-black tabular-nums mt-1 truncate ${color ?? ''}`}>{value}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        {delta != null && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-black ${delta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(Math.round(delta))}%
          </span>
        )}
        {s && <p className="text-[10px] text-slate-300 truncate">{s}</p>}
      </div>
    </div>
  )

  const Donut = ({ rows, total, title, kind }: {
    rows: { cid: string; cat?: FinCategory; v: number }[]; total: number; title: string
    kind: 'income' | 'expense'
  }) => (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[13px] font-black">{title}</p>
        {rows.length > 0 && <span className="text-[10px] font-bold text-slate-300">ketuk untuk rincian</span>}
      </div>
      {rows.length === 0 ? (
        <p className="text-center text-[13px] text-slate-300 py-14">Belum ada data di periode ini.</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="w-36 h-36 shrink-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={rows.map(b => ({ name: b.cat?.name ?? 'Lainnya', value: b.v }))}
                  dataKey="value" innerRadius={44} outerRadius={66} paddingAngle={2} strokeWidth={0} isAnimationActive={false}
                  className="cursor-pointer"
                  onClick={(_, i) => setCatInsight({ cid: rows[i].cid, kind })}>
                  {rows.map((b, i) => <Cell key={b.cid} fill={catColor(b.cat, i)} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => rp(Number(v ?? 0))} />
              </RePieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] text-slate-400 font-semibold">Total</p>
              <p className="text-[13px] font-black tabular-nums">{rp(total)}</p>
            </div>
          </div>
          <div className="flex-1 space-y-1.5 min-w-0">
            {rows.slice(0, 6).map((b, i) => (
              <button key={b.cid} onClick={() => setCatInsight({ cid: b.cid, kind })}
                className="w-full flex items-center gap-2 rounded-lg px-1 py-0.5 -mx-1 hover:bg-slate-50 transition-colors">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: catColor(b.cat, i) }} />
                <span className="text-[12px] font-semibold truncate flex-1 text-left">{b.cat?.name ?? 'Tanpa kategori'}</span>
                <span className="text-[11px] text-slate-400 tabular-nums">{rp(b.v)}</span>
                <span className="text-[12px] font-black tabular-nums w-9 text-right">{total > 0 ? Math.round((b.v / total) * 100) : 0}%</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const TxRow = ({ t, onClick }: { t: FinTx; onClick: () => void }) => {
    const cat = cats.find(c => c.id === t.category_id)
    const acc = accounts.find(a => a.id === t.account_id)
    const to = t.to_account_id ? accounts.find(a => a.id === t.to_account_id) : null
    const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''
    const color = t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : 'text-indigo-500'
    const bg = t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : t.type === 'expense' ? 'bg-rose-100 text-rose-500' : 'bg-indigo-100 text-indigo-500'
    const Icon = t.type === 'income' ? Plus : t.type === 'expense' ? Minus : ArrowLeftRight
    return (
      <button onClick={onClick} className="w-full text-left flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-[#F7F7FA] transition-colors">
        <span className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${bg}`}><Icon size={15} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold truncate">
            {t.type === 'transfer' ? `${acc?.name ?? '?'} → ${to?.name ?? '?'}` : (cat?.name ?? 'Tanpa kategori')}
            {cat?.is_business && t.type !== 'transfer' && <Briefcase size={11} className="inline ml-1.5 -mt-0.5 text-indigo-400" />}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            {fmtTglPendek(t.date)}{t.type !== 'transfer' && acc ? ` · ${acc.name}` : ''}{t.note ? ` · ${t.note}` : ''}
          </p>
        </div>
        {t.receipt_url && <span className="shrink-0 w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400"><Camera size={12} /></span>}
        <p className={`text-[13px] font-black tabular-nums shrink-0 ${color}`}>{sign}{rp(Number(t.amount))}</p>
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-slate-900" style={{ fontFeatureSettings: '"tnum"' }}>
      <div className="max-w-5xl mx-auto px-4 pb-32 md:pb-12">

        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-3">
            <Link href="/hub" className="flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm hover:shadow transition-shadow"><ArrowLeft size={18} /></Link>
            <div>
              <h1 className="text-lg font-black tracking-tight">Keuangan Pribadi</h1>
              <p className="text-[11px] text-slate-400">khusus admin · terpisah dari data trading</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowShare(true)} className="flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm hover:shadow transition-shadow" title="Bagikan ringkasan"><Share2 size={17} /></button>
            <button onClick={() => setShowCat(true)} className="flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm hover:shadow transition-shadow" title="Kelola kategori"><Settings2 size={17} /></button>
            <button onClick={() => setShowAcc(true)} className="flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm hover:shadow transition-shadow" title="Kelola rekening"><Wallet size={17} /></button>
          </div>
        </header>

        <nav className="hidden md:flex gap-1.5 p-1 rounded-2xl bg-white shadow-sm w-fit mb-4">
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
            {tab !== 'goals' && PeriodBar}

            {/* ════════ RINGKASAN ════════ */}
            {tab === 'home' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="rounded-3xl p-6 shadow-sm" style={{ background: '#E3F84E' }}>
                    <p className="text-[12px] font-semibold text-lime-900/60 mb-1">Total Saldo</p>
                    <p className="text-4xl font-black tracking-tight text-slate-900 tabular-nums">{rp(totalBalance)}</p>
                    <p className="text-[12px] text-lime-900/60 mt-1">{accounts.length} rekening{goals.length ? ` · ${goals.length} target` : ''}</p>
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

                  <div className="grid grid-cols-2 gap-3">
                    <StatTile label="Masuk" value={rp(income)} color="text-emerald-600" delta={pctChange(income, prevIncome)} sub="vs periode lalu" />
                    <StatTile label="Keluar" value={rp(expense)} color="text-rose-600" delta={pctChange(expense, prevExpense)} sub="vs periode lalu" />
                  </div>

                  {health && <HealthCard h={health} />}

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
                            <button key={a.id} onClick={() => { setAccFocus(a.id); setShowAcc(true) }}
                              className="w-full flex items-center gap-3 rounded-2xl bg-[#F7F7FA] px-4 py-3 text-left hover:bg-slate-100 transition-colors">
                              <span className="flex items-center justify-center w-9 h-9 rounded-full" style={{ background: `${clr}1f`, color: clr }}><Icon size={16} /></span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-bold truncate">{a.name}</p>
                                <p className="text-[11px] text-slate-400">{(KIND_META[a.kind] ?? KIND_META.lainnya).label}</p>
                              </div>
                              <p className="text-[14px] font-black tabular-nums">{rp(balances.get(a.id) ?? 0)}</p>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[13px] font-black">Arus Kas · {range.label}</p>
                      <span className={`text-[13px] font-black tabular-nums ${income - expense >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{income - expense >= 0 ? '+' : ''}{rp(income - expense)}</span>
                    </div>
                    <div className="h-44 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailySeries} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                          <defs>
                            <linearGradient id="dIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.3} /><stop offset="100%" stopColor="#34d399" stopOpacity={0.02} /></linearGradient>
                            <linearGradient id="dOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" stopOpacity={0.3} /><stop offset="100%" stopColor="#fb7185" stopOpacity={0.02} /></linearGradient>
                          </defs>
                          <CartesianGrid stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                          <YAxis tickFormatter={(v: number) => rpAxis(v)} tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={74} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown, n: unknown) => [rp(Number(v ?? 0)), n === 'masuk' ? 'Masuk' : 'Keluar']} />
                          <Area type="monotone" dataKey="masuk" stroke="#10b981" strokeWidth={2} fill="url(#dIn)" />
                          <Area type="monotone" dataKey="keluar" stroke="#f43f5e" strokeWidth={2} fill="url(#dOut)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <InsightList items={insights} limit={3} title="Insight" />

                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[13px] font-black">Transaksi Terbaru</p>
                      <button onClick={() => setTab('tx')} className="text-[12px] font-bold text-indigo-500 hover:text-indigo-600">Lihat semua</button>
                    </div>
                    {periodTxs.length === 0 ? (
                      <p className="text-center text-[13px] text-slate-300 py-8">Belum ada transaksi di periode ini.</p>
                    ) : (
                      <div className="space-y-1">
                        {periodTxs.slice(0, 8).map(t => <TxRow key={t.id} t={t} onClick={() => setDetailTx(t)} />)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ════════ TRANSAKSI ════════ */}
            {tab === 'tx' && (
              <div className="space-y-4">
                <div className="rounded-3xl bg-white p-4 shadow-sm space-y-3">
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari catatan, kategori, rekening, nominal…"
                      className="w-full h-11 pl-10 pr-4 rounded-2xl bg-[#F7F7FA] text-[13px] outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-300" />
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {([['all', 'Semua'], ['income', 'Masuk'], ['expense', 'Keluar'], ['transfer', 'Transfer']] as const).map(([id, label]) => (
                      <button key={id} onClick={() => setFType(id)}
                        className={`shrink-0 px-3.5 h-9 rounded-xl text-[12px] font-black transition-colors ${fType === id ? 'bg-indigo-500 text-white' : 'bg-[#F7F7FA] text-slate-500 hover:bg-slate-100'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={fCat} onChange={e => setFCat(e.target.value)} className="h-10 px-3 rounded-xl bg-[#F7F7FA] text-[12px] font-semibold outline-none focus:ring-2 focus:ring-indigo-200">
                      <option value="">Semua kategori</option>
                      {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select value={fAcc} onChange={e => setFAcc(e.target.value)} className="h-10 px-3 rounded-xl bg-[#F7F7FA] text-[12px] font-semibold outline-none focus:ring-2 focus:ring-indigo-200">
                      <option value="">Semua rekening</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  {(fType !== 'all' || fCat || fAcc || q) && (
                    <button onClick={() => { setFType('all'); setFCat(''); setFAcc(''); setQ('') }}
                      className="flex items-center gap-1.5 text-[12px] font-bold text-slate-400 hover:text-rose-500"><XIcon size={13} /> Hapus semua filter</button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatTile label="Masuk" value={rp(sumBy(listTxs, 'income'))} color="text-emerald-600" sub={`${listTxs.filter(t => t.type === 'income').length} transaksi`} />
                  <StatTile label="Keluar" value={rp(sumBy(listTxs, 'expense'))} color="text-rose-600" sub={`${listTxs.filter(t => t.type === 'expense').length} transaksi`} />
                  <StatTile label="Selisih" value={rp(sumBy(listTxs, 'income') - sumBy(listTxs, 'expense'))} color={sumBy(listTxs, 'income') - sumBy(listTxs, 'expense') >= 0 ? 'text-emerald-600' : 'text-rose-600'} sub={`${listTxs.length} total`} />
                </div>

                {grouped.length === 0 ? (
                  <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
                    <ListFilter size={26} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-[14px] font-black mb-1">Tidak ada transaksi</p>
                    <p className="text-[12px] text-slate-400">Coba ubah periode atau hapus filter.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {grouped.map(([date, rows]) => {
                      const inD = sumBy(rows, 'income'), outD = sumBy(rows, 'expense')
                      return (
                        <div key={date} className="rounded-3xl bg-white p-4 shadow-sm">
                          <div className="flex items-center justify-between mb-2 px-1">
                            <p className="text-[12px] font-black text-slate-500">{fmtTgl(date)}</p>
                            <p className="text-[11px] font-bold tabular-nums">
                              {inD > 0 && <span className="text-emerald-600">+{rp(inD)}</span>}
                              {inD > 0 && outD > 0 && <span className="text-slate-300"> · </span>}
                              {outD > 0 && <span className="text-rose-500">−{rp(outD)}</span>}
                            </p>
                          </div>
                          <div className="space-y-1">
                            {rows.map(t => <TxRow key={t.id} t={t} onClick={() => setDetailTx(t)} />)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ════════ ANALITIK ════════ */}
            {tab === 'analytics' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatTile label="Rasio Tabungan" value={savingsRate == null ? '—' : `${Math.round(savingsRate)}%`}
                    color={savingsRate != null && savingsRate >= 0 ? 'text-emerald-600' : 'text-rose-600'} sub="dari pemasukan" />
                  <StatTile label="Rata-rata Harian" value={rp(avgDaily)} sub={`${periodDays} hari`} />
                  <StatTile label="Kategori Terbesar" value={expBreakdown[0]?.cat?.name ?? '—'} sub={expBreakdown[0] ? rp(expBreakdown[0].v) : 'belum ada'} />
                  <StatTile label="Total Ditabung" value={rp(totalSaved)} color="text-indigo-600" sub="semua target" />
                </div>

                {(bizSplit.biz > 0 || bizSplit.pri > 0) && (
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <p className="text-[13px] font-black mb-3">Pengeluaran: Pribadi vs Bisnis</p>
                    <div className="flex h-3 rounded-full overflow-hidden mb-3">
                      <div style={{ width: `${(bizSplit.pri / (bizSplit.pri + bizSplit.biz)) * 100}%`, background: '#6366f1' }} />
                      <div style={{ width: `${(bizSplit.biz / (bizSplit.pri + bizSplit.biz)) * 100}%`, background: '#f59e0b' }} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center"><User size={15} /></span>
                        <div><p className="text-[11px] text-slate-400 font-semibold">Pribadi</p><p className="text-[14px] font-black tabular-nums">{rp(bizSplit.pri)}</p></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><Briefcase size={15} /></span>
                        <div><p className="text-[11px] text-slate-400 font-semibold">Bisnis</p><p className="text-[14px] font-black tabular-nums">{rp(bizSplit.biz)}</p></div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[13px] font-black">Arus Kas · 6 Bulan Terakhir</p>
                    <span className="flex items-center gap-3 text-[10px] font-bold">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Masuk</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Keluar</span>
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 mb-2">Konteks jangka panjang — tidak terpengaruh filter periode.</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cashflow6m} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.35} /><stop offset="100%" stopColor="#34d399" stopOpacity={0.02} /></linearGradient>
                          <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" stopOpacity={0.35} /><stop offset="100%" stopColor="#fb7185" stopOpacity={0.02} /></linearGradient>
                        </defs>
                        <CartesianGrid stroke="#F1F5F9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v: number) => rpAxis(v)} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={78} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown, n: unknown) => [rp(Number(v ?? 0)), n === 'masuk' ? 'Masuk' : 'Keluar']} />
                        <Area type="monotone" dataKey="masuk" stroke="#10b981" strokeWidth={2.5} fill="url(#gIn)" />
                        <Area type="monotone" dataKey="keluar" stroke="#f43f5e" strokeWidth={2.5} fill="url(#gOut)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <InsightList items={insights} title="Insight Otomatis" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Donut rows={expBreakdown} total={expense} title={`Pengeluaran per Kategori · ${range.label}`} kind="expense" />
                  <Donut rows={incBreakdown} total={income} title={`Pemasukan per Kategori · ${range.label}`} kind="income" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <p className="text-[13px] font-black mb-2">Pengeluaran Harian · {range.label}</p>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailySeries} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                          <CartesianGrid stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
                          <YAxis tickFormatter={(v: number) => rpAxis(v)} tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={74} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [rp(Number(v ?? 0)), 'Pengeluaran']} />
                          <Bar dataKey="keluar" fill="#818cf8" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <p className="text-[13px] font-black mb-3">5 Transaksi Terbesar</p>
                    {topTxs.length === 0 ? (
                      <p className="text-center text-[13px] text-slate-300 py-10">Belum ada data.</p>
                    ) : (
                      <div className="space-y-1">{topTxs.map(t => <TxRow key={t.id} t={t} onClick={() => setDetailTx(t)} />)}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ════════ TARGET ════════ */}
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

            {/* ════════ ANGGARAN ════════ */}
            {tab === 'budget' && (
              <div className="space-y-4">
                {V2Banner ?? V3Banner ?? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-black flex items-center gap-2"><SlidersHorizontal size={17} className="text-indigo-500" /> Anggaran</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Amplop bernama — satu amplop boleh mencakup beberapa kategori.</p>
                      </div>
                      <button onClick={() => setBudgetSheet('new')} disabled={!cats.some(c => c.type === 'expense')}
                        className="shrink-0 flex items-center gap-1.5 px-4 h-10 rounded-full bg-indigo-500 text-white text-[13px] font-black hover:bg-indigo-600 disabled:opacity-40">
                        <Plus size={15} /> Anggaran Baru
                      </button>
                    </div>

                    {budgetTotals.count > 0 && (
                      <div className="rounded-3xl bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-[12px] font-black text-slate-500">Total amplop bulanan · {budgetTotals.win.label}</p>
                          <p className="text-[12px] font-black tabular-nums" style={{ color: budgetTotals.spent > budgetTotals.limit ? '#ef4444' : '#6366f1' }}>
                            {budgetTotals.limit > 0 ? Math.round((budgetTotals.spent / budgetTotals.limit) * 100) : 0}%
                          </p>
                        </div>
                        <div className="h-2.5 rounded-full bg-[#F0F0F4] overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, budgetTotals.limit > 0 ? (budgetTotals.spent / budgetTotals.limit) * 100 : 0)}%`, background: budgetTotals.spent > budgetTotals.limit ? '#ef4444' : '#6366f1' }} />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5 tabular-nums">{rp(budgetTotals.spent)} dari {rp(budgetTotals.limit)} · sisa <b className="text-slate-600">{rp(Math.max(0, budgetTotals.limit - budgetTotals.spent))}</b></p>
                      </div>
                    )}

                    {budgetRows.length === 0 ? (
                      <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
                        <SlidersHorizontal size={28} className="mx-auto text-indigo-300 mb-3" />
                        <p className="font-black text-[15px] mb-1">Belum ada anggaran</p>
                        <p className="text-[13px] text-slate-400">Buat amplop pertama — mis. &ldquo;Belanja Harian&rdquo; yang mencakup Makan &amp; Transportasi.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {budgetRows.map((r, i) => {
                          const base = r.b.color || colorAt(i)
                          const clr = r.pct >= 100 ? '#ef4444' : r.pct >= 80 ? '#f59e0b' : base
                          return (
                            <button key={r.b.id} onClick={() => setBudgetSheet(r.b)}
                              className="text-left rounded-3xl bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                  <p className="text-[14px] font-black flex items-center gap-1.5 min-w-0">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: base }} />
                                    <span className="truncate">{r.b.name}</span>
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">{PERIODS.find(p => p.id === r.b.period)?.label} · {r.win.label}</p>
                                </div>
                                <span className="text-[11px] font-black shrink-0 tabular-nums" style={{ color: clr }}>
                                  {Math.round(r.pct)}%{r.pct >= 100 ? ' · LEWAT!' : r.pct >= 80 ? ' · hampir' : ''}
                                </span>
                              </div>

                              <div className="h-2.5 rounded-full bg-[#F0F0F4] overflow-hidden mb-1.5">
                                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, r.pct)}%`, background: clr }} />
                              </div>
                              <p className="text-[11px] text-slate-400 tabular-nums">
                                {rp(r.spent)} dari {rp(r.limit)}
                                {r.spent <= r.limit
                                  ? <> · sisa <b className="text-slate-600">{rp(r.limit - r.spent)}</b></>
                                  : <> · lebih <b className="text-rose-500">{rp(r.spent - r.limit)}</b></>}
                              </p>
                              {r.perDay !== null && r.spent <= r.limit && (
                                <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">≈ {rp(r.perDay)}/hari untuk {r.daysLeft} hari tersisa</p>
                              )}

                              {r.cats.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-2.5">
                                  {r.cats.slice(0, 4).map(c => (
                                    <span key={c.id} className="px-2 py-0.5 rounded-full bg-[#F7F7FA] text-[10px] font-bold text-slate-500">{c.name}</span>
                                  ))}
                                  {r.cats.length > 4 && <span className="px-2 py-0.5 rounded-full bg-[#F7F7FA] text-[10px] font-bold text-slate-400">+{r.cats.length - 4}</span>}
                                </div>
                              ) : (
                                <p className="text-[10px] text-amber-500 font-bold mt-2.5">Belum ada kategori — ketuk untuk memilih</p>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Kategori pengeluaran yang belum tercakup amplop mana pun —
                        bagian pengeluaran yang tidak terpantau sama sekali. */}
                    {(() => {
                      const covered = new Set(budgetCats.map(bc => bc.category_id))
                      const loose = cats.filter(c => c.type === 'expense' && !covered.has(c.id))
                      if (!budgetRows.length || !loose.length) return null
                      return (
                        <div className="rounded-3xl bg-white p-4 shadow-sm">
                          <p className="text-[12px] font-black text-slate-500 mb-2">Belum masuk anggaran mana pun</p>
                          <div className="flex flex-wrap gap-1.5">
                            {loose.map(c => (
                              <span key={c.id} className="px-2.5 py-1 rounded-full bg-[#F7F7FA] text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ background: c.color || '#cbd5e1' }} />{c.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
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
          <div className="grid grid-cols-5 items-center px-1 pt-2">
            {TABS.slice(0, 2).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-0.5 py-1 ${tab === t.id ? 'text-indigo-500' : 'text-slate-400'}`}>
                <t.icon size={19} /><span className="text-[9px] font-bold">{t.label}</span>
              </button>
            ))}
            <div className="flex justify-center -mt-6">
              <button onClick={() => accounts.length ? setShowTx('expense') : setShowAcc(true)}
                className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 active:scale-95 transition-transform">
                <Plus size={24} />
              </button>
            </div>
            {TABS.slice(2, 4).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-0.5 py-1 ${tab === t.id ? 'text-indigo-500' : 'text-slate-400'}`}>
                <t.icon size={19} /><span className="text-[9px] font-bold">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {(showTx || editTx) && (
        <TxSheet
          kind={showTx ?? editTx!.type}
          edit={editTx}
          accounts={accounts} cats={cats} userId={sub.userId!}
          onClose={() => { setShowTx(null); setEditTx(null) }}
          onSaved={tx => {
            setTxs(p => editTx ? p.map(x => x.id === tx.id ? tx : x) : [tx, ...p])
            setShowTx(null); setEditTx(null); setDetailTx(null)
          }} />
      )}
      {detailTx && (
        <TxDetailSheet t={detailTx} cats={cats} accounts={accounts}
          onClose={() => setDetailTx(null)}
          onEdit={() => { setEditTx(detailTx); setDetailTx(null) }}
          onDelete={() => delTx(detailTx.id)} />
      )}
      {showAcc && <AccSheet accounts={accounts} balances={balances} focusId={accFocus} userId={sub.userId!} onClose={() => { setShowAcc(false); setAccFocus(null) }} onChanged={loadAll} />}
      {showCat && <CatSheet cats={cats} userId={sub.userId!} onClose={() => setShowCat(false)} onChanged={loadAll} />}
      {budgetSheet && (
        <BudgetSheet
          edit={budgetSheet === 'new' ? null : budgetSheet}
          initialCats={budgetSheet === 'new' ? [] : budgetCats.filter(bc => bc.budget_id === budgetSheet.id).map(bc => bc.category_id)}
          cats={cats} userId={sub.userId!}
          onClose={() => setBudgetSheet(null)}
          onChanged={() => { setBudgetSheet(null); loadAll() }} />
      )}
      {showShare && <ShareSheet build={buildShare} onClose={() => setShowShare(false)} />}
      {catInsight && (
        <CatInsightSheet
          cid={catInsight.cid} kind={catInsight.kind}
          cat={cats.find(c => c.id === catInsight.cid)}
          txs={txs} periodTxs={periodTxs} prevPeriodTxs={prevPeriodTxs}
          accounts={accounts} range={range} periodDays={periodDays}
          totalOfKind={catInsight.kind === 'expense' ? expense : income}
          onClose={() => setCatInsight(null)}
          onPickTx={t => { setCatInsight(null); setDetailTx(t) }} />
      )}
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

// ── bagikan ringkasan lewat tautan pendek ──
function ShareSheet({ build, onClose }: { build: (o: ShareOpts) => SharePayload; onClose: () => void }) {
  const [opts, setOpts] = useState<ShareOpts>({ score: true, insights: true, cats: true, charts: true, txs: true, balance: true, masked: true })
  const [ttl, setTtl] = useState(7)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState('')
  const [list, setList] = useState<ShareRow[]>([])

  const load = async () => {
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) return
    const r = await fetch('/api/keuangan/share', { headers: { Authorization: `Bearer ${session.access_token}` } })
    const j = await r.json().catch(() => ({}))
    if (r.ok) setList(j.shares ?? [])
  }
  useEffect(() => { load() }, [])

  async function create() {
    setBusy(true)
    // finally: tanpa ini, satu kegagalan saat merakit payload atau satu putus
    // jaringan meninggalkan tombol dalam keadaan berputar selamanya — tidak ada
    // pesan, dan tidak ada jalan mencoba lagi selain memuat ulang halaman.
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) { toast.error('Sesi berakhir, muat ulang halaman'); return }
      const r = await fetch('/api/keuangan/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ payload: build(opts), masked: opts.masked, ttlDays: ttl, note: note.trim() || undefined }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error ?? 'Gagal membuat tautan'); return }
      setUrl(j.url); toast.success('Tautan dibuat'); load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membuat tautan')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    if (!window.confirm('Cabut tautan ini? Tamu yang memegangnya langsung tidak bisa membuka lagi.')) return
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) return
    const r = await fetch(`/api/keuangan/share?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } })
    if (!r.ok) { toast.error('Gagal mencabut'); return }
    toast.success('Tautan dicabut'); load()
  }

  const Toggle = ({ k, label, desc }: { k: keyof ShareOpts; label: string; desc: string }) => (
    <label className="flex items-start gap-3 rounded-2xl bg-[#F7F7FA] px-4 py-3 cursor-pointer">
      <input type="checkbox" checked={opts[k]} onChange={e => setOpts(p => ({ ...p, [k]: e.target.checked }))} className="accent-indigo-500 mt-0.5" />
      <span className="min-w-0">
        <span className="block text-[13px] font-bold">{label}</span>
        <span className="block text-[11px] text-slate-400 leading-relaxed">{desc}</span>
      </span>
    </label>
  )

  return (
    <Sheet title="Bagikan Ringkasan" onClose={onClose}>
      {url ? (
        <div className="space-y-3">
          <div className="rounded-3xl bg-emerald-50 border border-emerald-200 p-5 text-center">
            <p className="text-[12px] font-black text-emerald-700 mb-2">Tautan siap dibagikan</p>
            <p className="text-[13px] font-bold break-all text-slate-700">{url}</p>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(url); toast.success('Tautan disalin') }} className={btnPrimary}>Salin Tautan</button>
          <button onClick={() => setUrl('')} className="w-full h-11 rounded-2xl bg-[#F7F7FA] text-slate-500 text-[13px] font-black hover:bg-slate-100">Buat lagi</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-slate-500 leading-relaxed">
            Tautan berisi <b>salinan tetap</b> ringkasan periode yang sedang Anda lihat — bukan sambungan ke data asli.
            Angkanya tidak ikut berubah saat transaksi bertambah, dan tamu tidak pernah bisa menembus ke transaksi Anda.
          </p>

          <Toggle k="masked" label="Sembunyikan nominal" desc="Hanya persentase, skor, dan perbandingan yang tampil. Nominal rupiah diganti Rp•••." />
          <Toggle k="score" label="Sertakan skor kesehatan" desc="Skor 0–100 beserta rincian tiap pilarnya." />
          <Toggle k="insights" label="Sertakan insight" desc="Temuan otomatis di periode ini." />
          <Toggle k="cats" label="Sertakan rincian kategori" desc="Porsi per kategori, bisa diketuk tamu untuk melihat jumlah transaksi, rata-rata, terbesar, dan tren 6 bulan." />
          <Toggle k="charts" label="Sertakan chart" desc="Arus kas 6 bulan dan pengeluaran harian di periode ini." />
          <Toggle k="txs" label="Sertakan daftar transaksi" desc="Tanggal dan catatan tiap transaksi ikut terbagi (maks 60 terbesar per kategori). Catatan adalah teks bebas — periksa dulu isinya." />
          <Toggle k="balance" label="Sertakan total saldo" desc="Total saldo seluruh rekening saat ini. Nama rekening tidak ikut." />

          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1.5">Masa berlaku</label>
            <div className="grid grid-cols-4 gap-2">
              {[{ d: 1, l: '1 hari' }, { d: 7, l: '7 hari' }, { d: 30, l: '30 hari' }, { d: 0, l: 'Selamanya' }].map(o => (
                <button key={o.d} type="button" onClick={() => setTtl(o.d)}
                  className={`h-10 rounded-xl text-[12px] font-black transition-colors ${ttl === o.d ? 'bg-indigo-500 text-white' : 'bg-[#F7F7FA] text-slate-500 hover:bg-slate-100'}`}>{o.l}</button>
              ))}
            </div>
          </div>

          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={240}
            placeholder="Catatan untuk penerima (opsional)"
            className="w-full px-4 py-3 rounded-2xl bg-[#F7F7FA] text-[13px] font-semibold outline-none focus:ring-2 focus:ring-indigo-200 resize-none" />

          <button onClick={create} disabled={busy} className={btnPrimary}>
            {busy ? <Loader2 size={16} className="animate-spin inline" /> : 'Buat Tautan'}
          </button>

          {list.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-[12px] font-black text-slate-500 mb-2">Tautan aktif ({list.length})</p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {list.map(s => (
                  <div key={s.id} className="flex items-center gap-2 rounded-xl bg-[#F7F7FA] px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold truncate">/s/{s.slug}</p>
                      <p className="text-[10px] text-slate-400">
                        {s.views}× dibuka · {s.masked ? 'nominal disembunyikan' : 'nominal terlihat'}
                        {s.expires_at ? ` · sampai ${fmtTglPendek(s.expires_at.slice(0, 10))}` : ' · tanpa batas waktu'}
                      </p>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/s/${s.slug}`); toast.success('Disalin') }}
                      className="text-slate-300 hover:text-indigo-500 shrink-0"><Copy size={14} /></button>
                    <button onClick={() => revoke(s.id)} className="text-slate-300 hover:text-rose-500 shrink-0"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

// ── daftar insight ──
function InsightList({ items, limit, title }: { items: Insight[]; limit?: number; title: string }) {
  const [all, setAll] = useState(false)
  const shown = limit && !all ? items.slice(0, limit) : items
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[13px] font-black flex items-center gap-1.5"><Lightbulb size={16} className="text-indigo-500" /> {title}</p>
        <span className="text-[10px] font-bold text-slate-300">{items.length} temuan</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[12px] text-slate-300 py-6 text-center">Belum ada yang menonjol di periode ini.</p>
      ) : (
        <>
          <div className="space-y-2">
            {shown.map(it => {
              const t = TONE[it.tone]
              return (
                <div key={it.key} className="flex gap-3 rounded-2xl px-4 py-3" style={{ background: t.bg }}>
                  <t.icon size={16} className="shrink-0 mt-0.5" style={{ color: t.fg }} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-black leading-snug" style={{ color: t.fg }}>{it.title}</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{it.text}</p>
                  </div>
                </div>
              )
            })}
          </div>
          {limit && items.length > limit && (
            <button onClick={() => setAll(v => !v)} className="w-full mt-3 h-9 rounded-xl bg-[#F7F7FA] text-[12px] font-black text-slate-500 hover:bg-slate-100 transition-colors">
              {all ? 'Ringkas' : `Lihat ${items.length - limit} lainnya`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── rincian satu kategori (dibuka dari donut) ──
function CatInsightSheet({ cid, kind, cat, txs, periodTxs, prevPeriodTxs, accounts, range, periodDays, totalOfKind, onClose, onPickTx }: {
  cid: string; kind: 'income' | 'expense'; cat?: FinCategory
  txs: FinTx[]; periodTxs: FinTx[]; prevPeriodTxs: FinTx[]; accounts: FinAccount[]
  range: { from: string; to: string; label: string }; periodDays: number; totalOfKind: number
  onClose: () => void; onPickTx: (t: FinTx) => void
}) {
  const clr = cat?.color || (kind === 'expense' ? '#ef4444' : '#10b981')
  const mine = (rows: FinTx[]) => rows.filter(t => t.type === kind && (t.category_id ?? '-') === cid)

  const rows = mine(periodTxs).sort((a, b) => b.date.localeCompare(a.date) || Number(b.amount) - Number(a.amount))
  const total = rows.reduce((s, t) => s + Number(t.amount), 0)
  const prev = mine(prevPeriodTxs).reduce((s, t) => s + Number(t.amount), 0)
  const delta = prev > 0 ? ((total - prev) / prev) * 100 : null
  const share = totalOfKind > 0 ? (total / totalOfKind) * 100 : 0
  const avg = rows.length ? total / rows.length : 0
  const biggest = rows.reduce<FinTx | null>((m, t) => !m || Number(t.amount) > Number(m.amount) ? t : m, null)
  const activeDays = new Set(rows.map(t => t.date)).size

  // Tren 6 bulan penuh — mengambil dari SELURUH transaksi, bukan periode aktif,
  // supaya arah jangka panjangnya tetap terlihat walau filter sedang sempit.
  const trend = (() => {
    const base = new Date(range.to + 'T00:00:00')
    const out: { label: string; v: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
      const pre = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      out.push({ label: BLN3[d.getMonth()], v: mine(txs.filter(t => t.date.startsWith(pre))).reduce((s, t) => s + Number(t.amount), 0) })
    }
    return out
  })()

  const byAcc = (() => {
    const m = new Map<string, number>()
    for (const t of rows) m.set(t.account_id, (m.get(t.account_id) ?? 0) + Number(t.amount))
    return [...m.entries()].map(([id, v]) => ({ id, acc: accounts.find(a => a.id === id), v })).sort((a, b) => b.v - a.v)
  })()

  const Stat = ({ k, v, sub }: { k: string; v: string; sub?: string }) => (
    <div className="rounded-2xl bg-[#F7F7FA] px-3.5 py-3">
      <p className="text-[10px] font-semibold text-slate-400">{k}</p>
      <p className="text-[14px] font-black tabular-nums mt-0.5 truncate">{v}</p>
      {sub && <p className="text-[10px] text-slate-300 truncate">{sub}</p>}
    </div>
  )

  return (
    <Sheet title={cat?.name ?? 'Tanpa kategori'} onClose={onClose}>
      <div className="rounded-3xl p-5 mb-4" style={{ background: `${clr}12`, border: `1px solid ${clr}33` }}>
        <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: clr }}>
          {kind === 'expense' ? 'Pengeluaran' : 'Pemasukan'} · {range.label}
        </p>
        <p className="text-3xl font-black tabular-nums mt-1" style={{ color: clr }}>{rp(total)}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-[12px] text-slate-500">{Math.round(share)}% dari total {kind === 'expense' ? 'pengeluaran' : 'pemasukan'}</span>
          {delta != null && (
            // Naiknya pengeluaran itu kabar buruk, naiknya pemasukan kabar baik —
            // warnanya tidak boleh ditentukan oleh arah panah saja.
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-black ${(kind === 'expense' ? delta <= 0 : delta >= 0) ? 'text-emerald-600' : 'text-rose-500'}`}>
              {delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(Math.round(delta))}% vs periode lalu
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Stat k="Jumlah transaksi" v={String(rows.length)} sub={`${activeDays} hari aktif dari ${periodDays}`} />
        <Stat k="Rata-rata / transaksi" v={rp(avg)} />
        <Stat k="Rata-rata / hari" v={rp(total / Math.max(1, periodDays))} sub={`${periodDays} hari`} />
        <Stat k="Terbesar" v={biggest ? rp(Number(biggest.amount)) : '—'} sub={biggest ? fmtTglPendek(biggest.date) : undefined} />
      </div>

      <div className="mb-4">
        <p className="text-[11px] font-bold text-slate-400 mb-1.5">Tren 6 bulan</p>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => rp(Number(v ?? 0))} />
              <Bar dataKey="v" fill={clr} radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {byAcc.length > 1 && (
        <div className="mb-4">
          <p className="text-[11px] font-bold text-slate-400 mb-1.5">Dari rekening</p>
          <div className="space-y-1.5">
            {byAcc.map(({ id, acc, v }) => (
              <div key={id} className="flex items-center justify-between rounded-xl bg-[#F7F7FA] px-3.5 py-2">
                <span className="text-[12px] font-semibold truncate">{acc?.name ?? 'Rekening dihapus'}</span>
                <span className="text-[12px] font-black tabular-nums">{rp(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[11px] font-bold text-slate-400 mb-1.5">Transaksi ({rows.length})</p>
        {rows.length === 0 ? (
          <p className="text-[12px] text-slate-300 py-4 text-center">Tidak ada transaksi di periode ini.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {rows.map(t => (
              <button key={t.id} onClick={() => onPickTx(t)}
                className="w-full flex items-center justify-between gap-3 rounded-xl bg-[#F7F7FA] px-3.5 py-2.5 hover:bg-slate-100 transition-colors text-left">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold truncate">{t.note || (cat?.name ?? 'Tanpa catatan')}</p>
                  <p className="text-[10px] text-slate-400">{fmtTgl(t.date)}</p>
                </div>
                <span className="text-[13px] font-black tabular-nums shrink-0" style={{ color: clr }}>{rp(Number(t.amount))}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  )
}

// ── skor kesehatan keuangan ──
function HealthCard({ h }: { h: Health }) {
  const R = 46, C = 2 * Math.PI * R
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[13px] font-black flex items-center gap-1.5"><HeartPulse size={16} style={{ color: h.band.color }} /> Skor Kesehatan</p>
        <span className="text-[10px] font-bold text-slate-300">90 hari terakhir</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: 108, height: 108 }}>
          <svg width="108" height="108" viewBox="0 0 108 108" className="-rotate-90">
            <circle cx="54" cy="54" r={R} fill="none" stroke="#F0F0F4" strokeWidth="10" />
            <circle cx="54" cy="54" r={R} fill="none" stroke={h.band.color} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${(h.score / 100) * C} ${C}`} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black tabular-nums leading-none" style={{ color: h.band.color }}>{h.score}</span>
            <span className="text-[9px] font-bold text-slate-300 mt-0.5">dari 100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-black" style={{ color: h.band.color }}>{h.band.label}</p>
          <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
            Rata-rata per bulan: masuk <b className="text-slate-600">{rp(h.mInc)}</b>, keluar <b className="text-slate-600">{rp(h.mExp)}</b>.
          </p>
        </div>
      </div>

      <div className="space-y-2.5 mt-4">
        {h.pillars.map(p => {
          const pct = Math.round(p.score * 100)
          const clr = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
          return (
            <div key={p.key}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-slate-600 truncate">{p.label} <span className="text-slate-300 font-semibold">· bobot {p.weight}%</span></p>
                <span className="text-[11px] font-black tabular-nums shrink-0" style={{ color: clr }}>{pct}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#F0F0F4] overflow-hidden mt-1">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: clr }} />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">{p.detail}</p>
            </div>
          )
        })}
      </div>

      {h.weakest && (
        <div className="mt-4 rounded-2xl bg-[#F7F7FA] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Paling berdampak</p>
          <p className="text-[12px] text-slate-600 leading-relaxed"><b>{h.weakest.label}</b> — {h.weakest.hint}</p>
        </div>
      )}

      {h.pillars.length < 4 && (
        <p className="text-[10px] text-slate-300 mt-2.5 leading-relaxed">
          Pilar yang datanya belum ada dilewati, bukan dinilai nol — bobotnya dibagi ke pilar lain.
        </p>
      )}
    </div>
  )
}

// ── detail transaksi ──
function TxDetailSheet({ t, cats, accounts, onClose, onEdit, onDelete }: {
  t: FinTx; cats: FinCategory[]; accounts: FinAccount[]
  onClose: () => void; onEdit: () => void; onDelete: () => void
}) {
  const cat = cats.find(c => c.id === t.category_id)
  const acc = accounts.find(a => a.id === t.account_id)
  const to = t.to_account_id ? accounts.find(a => a.id === t.to_account_id) : null
  const clr = t.type === 'income' ? '#10b981' : t.type === 'expense' ? '#ef4444' : '#6366f1'
  const label = t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer'
  const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-[12px] font-semibold text-slate-400 shrink-0">{k}</span>
      <span className="text-[13px] font-bold text-right">{v}</span>
    </div>
  )

  return (
    <Sheet title="Detail Transaksi" onClose={onClose}>
      <div className="rounded-3xl p-5 text-center mb-4" style={{ background: `${clr}12`, border: `1px solid ${clr}33` }}>
        <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: clr }}>{label}</p>
        <p className="text-3xl font-black tabular-nums mt-1" style={{ color: clr }}>{sign}{rp(Number(t.amount))}</p>
      </div>

      <div className="rounded-2xl bg-[#F7F7FA] px-4 py-1 mb-4">
        <Row k="Tanggal" v={fmtTgl(t.date)} />
        {t.type === 'transfer' ? (
          <Row k="Rekening" v={<span>{acc?.name ?? '?'} <span className="text-slate-300">→</span> {to?.name ?? '?'}</span>} />
        ) : (
          <>
            <Row k="Kategori" v={<span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: cat?.color || '#cbd5e1' }} />
              {cat?.name ?? 'Tanpa kategori'}
              {cat?.is_business && <Briefcase size={11} className="text-indigo-400" />}
            </span>} />
            <Row k="Rekening" v={acc?.name ?? '—'} />
          </>
        )}
        {t.note && <Row k="Catatan" v={t.note} />}
      </div>

      {t.receipt_url && (
        <div className="mb-4">
          <p className="text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5"><Camera size={12} /> Struk / Bukti</p>
          <a href={t.receipt_url} target="_blank" rel="noopener noreferrer" className="block rounded-2xl overflow-hidden border border-slate-100 hover:ring-2 hover:ring-indigo-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.receipt_url} alt="struk" className="w-full max-h-72 object-contain bg-slate-50" />
          </a>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onEdit} className="flex-1 h-12 rounded-2xl bg-indigo-500 text-white text-[13px] font-black hover:bg-indigo-600 flex items-center justify-center gap-1.5"><Pencil size={15} /> Edit</button>
        <button onClick={onDelete} className="px-5 h-12 rounded-2xl border border-rose-200 text-rose-500 text-[13px] font-black hover:bg-rose-50 flex items-center justify-center gap-1.5"><Trash2 size={15} /> Hapus</button>
      </div>
    </Sheet>
  )
}

// ── form transaksi (tambah + edit) ──
function TxSheet({ kind, edit, accounts, cats, userId, onClose, onSaved }: {
  kind: 'income' | 'expense' | 'transfer'
  edit?: FinTx | null
  accounts: FinAccount[]; cats: FinCategory[]; userId: string
  onClose: () => void; onSaved: (t: FinTx) => void
}) {
  const [type, setType] = useState(edit?.type ?? kind)
  const [amount, setAmount] = useState(edit ? Number(edit.amount).toLocaleString('id-ID') : '')
  const [accId, setAccId] = useState(edit?.account_id ?? accounts[0]?.id ?? '')
  const [toId, setToId] = useState(edit?.to_account_id ?? accounts[1]?.id ?? '')
  const relevantCats = cats.filter(c => c.type === (type === 'income' ? 'income' : 'expense'))
  const [catId, setCatId] = useState(edit?.category_id ?? '')
  const [date, setDate] = useState(edit?.date ?? todayStr())
  const [note, setNote] = useState(edit?.note ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(edit?.receipt_url ?? null)
  // Bedakan "struk lama dipertahankan" dari "struk dihapus" — tanpa ini, edit
  // tanpa menyentuh gambar akan menghapus struk yang sudah ada.
  const [keepReceipt, setKeepReceipt] = useState(!!edit?.receipt_url)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (edit && type === edit.type) return
    setCatId(relevantCats[0]?.id ?? '')
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [type])
  useEffect(() => () => { if (preview && file) URL.revokeObjectURL(preview) }, [preview, file])

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
      let receipt_url: string | null = keepReceipt ? (edit?.receipt_url ?? null) : null
      if (file) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
        const rand = crypto.randomUUID().slice(0, 8)
        const path = `fin-receipts/${userId}-${Date.now()}-${rand}.${ext}`
        const up = await sb.storage.from('trade-screenshots').upload(path, file)
        if (up.error) { toast.error('Upload struk gagal: ' + up.error.message); setBusy(false); return }
        receipt_url = sb.storage.from('trade-screenshots').getPublicUrl(path).data.publicUrl
      }
      const payload = {
        user_id: userId, account_id: accId,
        to_account_id: type === 'transfer' ? toId : null,
        category_id: type === 'transfer' ? null : (catId || null),
        type, amount: num, note: note.trim() || null, date, receipt_url,
      }
      const res = edit
        ? await sb.from('fin_transactions').update(payload).eq('id', edit.id).select('*').single()
        : await sb.from('fin_transactions').insert(payload).select('*').single()
      if (res.error) { toast.error(res.error.message); setBusy(false); return }
      toast.success(edit ? 'Transaksi diperbarui' : 'Transaksi tersimpan')
      onSaved(res.data as FinTx)
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
    <Sheet title={edit ? 'Edit Transaksi' : 'Tambah Transaksi'} onClose={onClose}>
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
              <button onClick={() => { setFile(null); setPreview(null); setKeepReceipt(false) }}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-900/60 text-white flex items-center justify-center"><XIcon size={14} /></button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 h-20 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 text-[13px] font-semibold cursor-pointer hover:border-indigo-300 hover:text-indigo-500 transition-colors">
              <Camera size={17} /> Foto / upload struk
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return
                  if (f.size > 5_000_000) { toast.error('Maksimal 5 MB'); return }
                  setFile(f); setPreview(URL.createObjectURL(f)); setKeepReceipt(false)
                }} />
            </label>
          )}
        </div>

        <button onClick={save} disabled={busy} className={btnPrimary}>
          {busy ? <Loader2 size={16} className="animate-spin inline" /> : edit ? 'Simpan Perubahan' : 'Simpan Transaksi'}
        </button>
      </div>
    </Sheet>
  )
}

// ── kelola rekening ──
function AccSheet({ accounts, balances, focusId, userId, onClose, onChanged }: {
  accounts: FinAccount[]; balances: Map<string, number>; focusId?: string | null; userId: string
  onClose: () => void; onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('bank')
  const [init, setInit] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // ── edit satu rekening (inline, menggantikan barisnya) ──
  // Sheet ini di-mount ulang tiap kali dibuka, jadi focusId cukup dibaca sekali
  // sebagai nilai awal — tidak perlu effect yang menyinkronkan ulang.
  const focused = focusId ? accounts.find(a => a.id === focusId) : null
  const [editId, setEditId] = useState<string | null>(focused?.id ?? null)
  const [eName, setEName] = useState(focused?.name ?? '')
  const [eKind, setEKind] = useState(focused?.kind ?? 'bank')
  const [eBal, setEBal] = useState(focused ? Math.round(balances.get(focused.id) ?? 0).toLocaleString('id-ID') : '')

  function openEdit(a: FinAccount) {
    setEditId(a.id); setEName(a.name); setEKind(a.kind)
    setEBal(Math.round(balances.get(a.id) ?? 0).toLocaleString('id-ID'))
  }

  // Saldo adalah nilai TURUNAN (saldo awal + transaksi), jadi tidak bisa ditulis
  // langsung. Yang diubah adalah saldo awalnya, digeser sebesar selisih antara
  // saldo yang diinginkan dan saldo hasil hitungan sekarang.
  //
  // Ini sengaja TIDAK dibuat sebagai transaksi penyesuaian: transaksi akan
  // terhitung sebagai pemasukan/pengeluaran dan merusak rasio tabungan,
  // rata-rata harian, serta seluruh chart arus kas — padahal uangnya tidak
  // benar-benar masuk atau keluar, hanya catatannya yang salah.
  async function saveEdit(a: FinAccount) {
    if (!eName.trim()) { toast.error('Isi nama rekening'); return }
    const target = Number(eBal.replace(/[^\d-]/g, '')) || 0
    const cur = Math.round(balances.get(a.id) ?? 0)
    const nextInit = Number(a.initial_balance) + (target - cur)
    setBusy(true)
    const { error } = await createClient().from('fin_accounts')
      .update({ name: eName.trim(), kind: eKind, initial_balance: nextInit }).eq('id', a.id)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success(target !== cur ? `Saldo disesuaikan ke ${rp(target)}` : 'Rekening diperbarui')
    setEditId(null); onChanged()
  }

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
        {accounts.map((a, i) => {
          if (editId === a.id) {
            const cur = Math.round(balances.get(a.id) ?? 0)
            const target = Number(eBal.replace(/[^\d-]/g, '')) || 0
            const delta = target - cur
            return (
              <div key={a.id} className="rounded-2xl bg-white ring-2 ring-indigo-200 px-4 py-3.5 space-y-3">
                <input value={eName} onChange={e => setEName(e.target.value)} placeholder="Nama rekening"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7FA] text-[13px] font-semibold outline-none focus:ring-2 focus:ring-indigo-200" autoFocus />
                <select value={eKind} onChange={e => setEKind(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7FA] text-[13px] font-semibold outline-none focus:ring-2 focus:ring-indigo-200">
                  {Object.entries(KIND_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                </select>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1.5">Saldo saat ini (Rp)</label>
                  {/* Minus di awal dipertahankan — kartu kredit & rekening yang
                      overdraft memang bersaldo negatif. */}
                  <input value={eBal} inputMode="numeric"
                    onChange={e => {
                      const neg = e.target.value.trimStart().startsWith('-')
                      const d = e.target.value.replace(/[^\d]/g, '')
                      setEBal((neg ? '-' : '') + (d ? Number(d).toLocaleString('id-ID') : ''))
                    }}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7FA] text-[14px] font-black tabular-nums outline-none focus:ring-2 focus:ring-indigo-200" />
                  {delta !== 0 ? (
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      Selisih <b className={delta > 0 ? 'text-emerald-600' : 'text-rose-500'}>{delta > 0 ? '+' : '−'}{rp(Math.abs(delta))}</b> diterapkan ke saldo awal
                      ({rp(Number(a.initial_balance))} → <b className="text-slate-600">{rp(Number(a.initial_balance) + delta)}</b>).
                      Riwayat transaksi tidak berubah.
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-300 mt-1.5">Saldo awal {rp(Number(a.initial_balance))} + riwayat transaksi.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => saveEdit(a)} disabled={busy}
                    className="flex-1 h-11 rounded-xl bg-indigo-500 text-white text-[13px] font-black hover:bg-indigo-600 disabled:opacity-50">
                    {busy ? <Loader2 size={15} className="animate-spin inline" /> : 'Simpan'}
                  </button>
                  <button onClick={() => setEditId(null)} className="px-4 h-11 rounded-xl bg-[#F7F7FA] text-slate-500 text-[13px] font-black hover:bg-slate-100">Batal</button>
                </div>
              </div>
            )
          }
          return (
            <div key={a.id} className="rounded-2xl bg-[#F7F7FA] px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: a.color || colorAt(i) }} />
                <button onClick={() => openEdit(a)} className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-bold truncate">{a.name}</p>
                  <p className="text-[11px] text-slate-400">{(KIND_META[a.kind] ?? KIND_META.lainnya).label} · saldo {rp(balances.get(a.id) ?? 0)}</p>
                </button>
                <button onClick={() => openEdit(a)} className="text-slate-300 hover:text-indigo-500"><Pencil size={14} /></button>
                <button onClick={() => del(a.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button>
              </div>
              <div className="flex gap-1.5 mt-2">
                {PALETTE.map(c => (
                  <button key={c} onClick={() => setAccColor(a.id, c)}
                    className={`w-5 h-5 rounded-full ${a.color === c ? 'ring-2 ring-offset-1 ring-slate-300' : ''}`} style={{ background: c }} />
                ))}
              </div>
            </div>
          )
        })}
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

// ── kelola kategori ──
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

// ── target ──
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
              <span className="text-[12px] text-slate-500">{fmtTgl(e.date)}</span>
              <span className={`text-[13px] font-black tabular-nums ${Number(e.amount) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{Number(e.amount) >= 0 ? '+' : ''}{rp(Number(e.amount))}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={delGoal} className="w-full h-11 rounded-2xl border border-rose-200 text-rose-500 text-[13px] font-black hover:bg-rose-50 transition-colors">Hapus Target</button>
    </Sheet>
  )
}

// ── anggaran: buat & edit amplop ──
function BudgetSheet({ edit, initialCats, cats, userId, onClose, onChanged }: {
  edit: FinBudget | null; initialCats: string[]
  cats: FinCategory[]; userId: string; onClose: () => void; onChanged: () => void
}) {
  const [name, setName] = useState(edit?.name ?? '')
  const [limit, setLimit] = useState(edit ? Number(edit.monthly_limit).toLocaleString('id-ID') : '')
  const [period, setPeriod] = useState<BudgetPeriod>(edit?.period ?? 'monthly')
  const [color, setColor] = useState<string | null>(edit?.color ?? PALETTE[0])
  const [picked, setPicked] = useState<string[]>(initialCats)
  const [busy, setBusy] = useState(false)

  const expenseCats = cats.filter(c => c.type === 'expense')
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  async function save() {
    const num = Number(limit.replace(/[^\d]/g, ''))
    if (!name.trim()) { toast.error('Isi nama anggaran'); return }
    if (!num) { toast.error('Isi batas nominal'); return }
    if (!picked.length) { toast.error('Pilih minimal satu kategori'); return }
    setBusy(true)
    const sb = createClient()
    const payload = { user_id: userId, name: name.trim(), monthly_limit: num, period, color }

    const { data, error } = edit
      ? await sb.from('fin_budgets').update(payload).eq('id', edit.id).select('id').single()
      : await sb.from('fin_budgets').insert(payload).select('id').single()
    if (error || !data) { setBusy(false); toast.error(error?.message ?? 'Gagal menyimpan'); return }

    // Ganti seluruh himpunan kategori, bukan menambal selisihnya: jauh lebih
    // sedikit yang bisa salah, dan jumlah barisnya selalu kecil.
    if (edit) await sb.from('fin_budget_categories').delete().eq('budget_id', data.id)
    const { error: e2 } = await sb.from('fin_budget_categories')
      .insert(picked.map(cid => ({ budget_id: data.id, category_id: cid, user_id: userId })))
    setBusy(false)
    if (e2) { toast.error(e2.message); return }
    toast.success(edit ? 'Anggaran diperbarui' : 'Anggaran dibuat'); onChanged()
  }

  async function del() {
    if (!edit) return
    if (!window.confirm(`Hapus anggaran "${edit.name}"? Transaksinya tidak ikut terhapus.`)) return
    const { error } = await createClient().from('fin_budgets').delete().eq('id', edit.id)
    if (error) { toast.error(error.message); return }
    toast.success('Anggaran dihapus'); onChanged()
  }

  return (
    <Sheet title={edit ? 'Edit Anggaran' : 'Anggaran Baru'} onClose={onClose}>
      <div className="space-y-3">
        <input value={name} onChange={e => setName(e.target.value)} autoFocus
          placeholder="Nama — mis. Belanja Harian, Operasional" className={inputCls} />

        <div>
          <label className="text-[11px] font-bold text-slate-400 block mb-1.5">Batas nominal (Rp)</label>
          <input value={limit} inputMode="numeric" placeholder="mis. 3.000.000" className={inputCls}
            onChange={e => setLimit(e.target.value.replace(/[^\d]/g, '') ? Number(e.target.value.replace(/[^\d]/g, '')).toLocaleString('id-ID') : '')} />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 block mb-1.5">Berlaku per</label>
          <div className="grid grid-cols-3 gap-2">
            {PERIODS.map(p => (
              <button key={p.id} type="button" onClick={() => setPeriod(p.id)}
                className={`h-11 rounded-2xl text-[12px] font-black transition-colors ${period === p.id ? 'bg-indigo-500 text-white' : 'bg-[#F7F7FA] text-slate-500 hover:bg-slate-100'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
            Kategori yang dihitung {picked.length > 0 && <span className="text-indigo-500">· {picked.length} dipilih</span>}
          </label>
          {expenseCats.length === 0 ? (
            <p className="text-[12px] text-slate-400">Belum ada kategori pengeluaran.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {expenseCats.map(c => {
                const on = picked.includes(c.id)
                return (
                  <button key={c.id} type="button" onClick={() => toggle(c.id)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-colors ${on ? 'bg-indigo-500 text-white' : 'bg-[#F7F7FA] text-slate-500 hover:bg-slate-100'}`}>
                    <span className="w-2 h-2 rounded-full" style={{ background: on ? '#fff' : (c.color || '#cbd5e1') }} />
                    {c.name}
                    {c.is_business && <Briefcase size={10} className={on ? 'text-white/70' : 'text-indigo-400'} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <ColorPicker value={color} onChange={setColor} />

        <button onClick={save} disabled={busy} className={btnPrimary}>
          {busy ? <Loader2 size={16} className="animate-spin inline" /> : edit ? 'Simpan Perubahan' : 'Buat Anggaran'}
        </button>
        {edit && (
          <button onClick={del} className="w-full h-11 rounded-2xl border border-rose-200 text-rose-500 text-[13px] font-black hover:bg-rose-50 transition-colors flex items-center justify-center gap-1.5">
            <Trash2 size={15} /> Hapus Anggaran
          </button>
        )}
      </div>
    </Sheet>
  )
}
