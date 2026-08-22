'use client'

// Analisa performa trading — komponen BERSAMA.
//
// Dipakai jurnal prop firm, dan siap dipakai jurnal utama. Menerima Trade[] apa
// adanya plus satu pemformat mata uang, jadi tidak tahu-menahu soal store,
// Supabase, maupun aturan prop firm. Itu yang membuatnya bisa dipakai dua
// tempat tanpa salah satunya menyeret aturan yang tidak berlaku di tempat lain.
//
// Seluruh angkanya berasal dari calcStats() & pnlByGroup() yang sama dengan
// jurnal utama — bukan rumus salinan yang lama-lama berbeda.
import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  AreaChart, Area, CartesianGrid, ReferenceLine, PieChart, Pie,
} from 'recharts'
import {
  TrendingUp, Target, Activity, Clock, Layers,
  ShieldCheck, Compass, BarChart3, AlertTriangle,
} from 'lucide-react'
import { calcStats, pnlByGroup } from '@/lib/calculations'
import type { Trade } from '@/types'

const TIP = { background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BLN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

type Fmt = (n: number) => string

export function TradeAnalytics({ trades, fmt, startBalance = 0 }: {
  trades: Trade[]
  fmt: Fmt
  /** Saldo awal untuk kurva equity. 0 = kurva menampilkan P&L kumulatif. */
  startBalance?: number
}) {
  const stats = useMemo(() => calcStats(trades, [], []), [trades])

  // Trade "overtrade" sengaja dikeluarkan dari metrik performa (sama seperti
  // calcStats), karena itu memang bukan eksekusi rencana.
  const normal = useMemo(() => trades.filter(t => !t.is_overtrade), [trades])
  const jumlahMenang = useMemo(() => normal.filter(t => t.result === 'win').length, [normal])
  const jumlahKalah = useMemo(() => normal.filter(t => t.result === 'loss').length, [normal])

  const equity = useMemo(() => {
    const urut = [...trades].sort((a, b) =>
      a.date.localeCompare(b.date) || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    // reduce, bukan map dengan akumulator di luar: menulis ke variabel luar dari
    // dalam map membuat hasilnya bergantung pada BERAPA KALI map dijalankan —
    // dan React boleh menjalankan render lebih dari sekali.
    return urut.reduce(
      (acc, t, i) => [...acc, { i: i + 1, bal: acc[acc.length - 1].bal + t.pnl, date: t.date }],
      [{ i: 0, bal: startBalance, date: '' }],
    )
  }, [trades, startBalance])

  const perBulan = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of trades) {
      const k = t.date.slice(0, 7)
      m.set(k, (m.get(k) ?? 0) + t.pnl)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ label: `${BLN3[+k.slice(5, 7) - 1]} ${k.slice(2, 4)}`, pnl: v }))
  }, [trades])

  const perHari = useMemo(() => {
    const m = new Map<number, { pnl: number; w: number; n: number }>()
    for (const t of normal) {
      const d = new Date(t.date + 'T00:00:00').getDay()
      const g = m.get(d) ?? { pnl: 0, w: 0, n: 0 }
      g.pnl += t.pnl; g.n++; if (t.result === 'win') g.w++
      m.set(d, g)
    }
    return [1, 2, 3, 4, 5, 6, 0].filter(d => m.has(d)).map(d => {
      const g = m.get(d)!
      return { label: HARI[d].slice(0, 3), pnl: g.pnl, wr: g.n ? g.w / g.n * 100 : 0, n: g.n }
    })
  }, [normal])

  const perJam = useMemo(() => {
    const m = new Map<number, { pnl: number; w: number; n: number }>()
    for (const t of normal) {
      if (!t.entry_time) continue
      const h = parseInt(t.entry_time.slice(0, 2), 10)
      if (!Number.isFinite(h)) continue
      const g = m.get(h) ?? { pnl: 0, w: 0, n: 0 }
      g.pnl += t.pnl; g.n++; if (t.result === 'win') g.w++
      m.set(h, g)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
      .map(([h, g]) => ({ label: `${String(h).padStart(2, '0')}:00`, pnl: g.pnl, wr: g.n ? g.w / g.n * 100 : 0, n: g.n }))
  }, [normal])

  const byPair = useMemo(() => grup(pnlByGroup(normal, t => t.pair || '—')), [normal])
  const byStrategi = useMemo(() => grup(pnlByGroup(normal, t => t.strategy || 'Tanpa strategi')), [normal])
  const byArah = useMemo(() => grup(pnlByGroup(normal, t => t.direction === 'short' ? 'Short' : 'Long')), [normal])
  const byStruktur = useMemo(() => grup(pnlByGroup(normal.filter(t => t.market_structure), t => t.market_structure!)), [normal])

  // Disiplin: apakah mengikuti plan & tahu arah benar-benar berpengaruh?
  const disiplin = useMemo(() => bandingkan(normal, t => t.followed_plan === true, 'Ikut plan', 'Tidak ikut plan'), [normal])
  const arahTahu = useMemo(() => bandingkan(normal, t => t.know_direction === true, 'Tahu arah', 'Tidak yakin arah'), [normal])
  const overtrade = useMemo(() => {
    const ot = trades.filter(t => t.is_overtrade)
    return { n: ot.length, pnl: ot.reduce((s, t) => s + t.pnl, 0) }
  }, [trades])

  if (trades.length === 0) return (
    <Card className="border-dashed">
      <CardContent className="py-16 text-center">
        <BarChart3 size={28} className="mx-auto text-muted-foreground/40 mb-3" />
        <p className="font-bold text-sm mb-1">Belum ada data untuk dianalisa</p>
        <p className="text-xs text-muted-foreground">Catat beberapa trade dulu, analisanya muncul otomatis di sini.</p>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4">
      {/* ── Metrik utama ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metrik label="Total Trade" nilai={String(stats.total_trades)} sub={overtrade.n ? `+${overtrade.n} overtrade` : 'semua sesuai plan'} />
        <Metrik label="Win Rate" nilai={`${stats.win_rate.toFixed(1)}%`} sub={`${jumlahMenang}W / ${jumlahKalah}L`} warna={stats.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'} />
        <Metrik label="Profit Factor" nilai={stats.profit_factor === Infinity ? '∞' : stats.profit_factor.toFixed(2)}
          sub={stats.profit_factor >= 1.5 ? 'sehat' : stats.profit_factor >= 1 ? 'tipis' : 'merugi'}
          warna={stats.profit_factor >= 1.5 ? 'text-emerald-400' : stats.profit_factor >= 1 ? 'text-amber-400' : 'text-red-400'} />
        <Metrik label="Expectancy" nilai={fmt(stats.expectancy)} sub="per trade"
          warna={stats.expectancy >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <Metrik label="Max Drawdown" nilai={fmt(stats.max_drawdown)} sub="dari puncak" warna="text-red-400" />
        <Metrik label="Streak Terpanjang" nilai={`${stats.win_streak}W / ${stats.loss_streak}L`}
          sub={stats.current_streak > 0 ? `sekarang ${stats.current_streak}${stats.current_streak_type === 'win' ? 'W' : stats.current_streak_type === 'loss' ? 'L' : ''}` : '—'} />
      </div>

      {/* ── Kurva equity ── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity size={13} /> Kurva Equity</CardTitle></CardHeader>
        <CardContent>
          <div className="h-52 w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equity} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="eqA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={stats.total_pnl >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.32} />
                    <stop offset="95%" stopColor={stats.total_pnl >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3} />
                <XAxis dataKey="i" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={72} tickFormatter={v => fmt(v)} />
                <Tooltip contentStyle={TIP} formatter={(v: unknown) => [fmt(Number(v ?? 0)), 'Equity']} />
                {startBalance > 0 && <ReferenceLine y={startBalance} stroke="var(--border)" strokeDasharray="4 4" />}
                <Area type="monotone" dataKey="bal" stroke={stats.total_pnl >= 0 ? '#10b981' : '#ef4444'} strokeWidth={2} fill="url(#eqA)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── P&L per bulan ── */}
        {perBulan.length > 0 && (
          <ChartCard icon={BarChart3} title="P&L per Bulan">
            <BarChart data={perBulan} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={72} tickFormatter={v => fmt(v)} />
              <Tooltip contentStyle={TIP} formatter={(v: unknown) => [fmt(Number(v ?? 0)), 'P&L']} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {perBulan.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ChartCard>
        )}

        {/* ── Distribusi hasil ── */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target size={13} /> Distribusi Hasil</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 shrink-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={hasilPie(normal)} dataKey="value" innerRadius={38} outerRadius={60} paddingAngle={2} strokeWidth={0} isAnimationActive={false}>
                      {hasilPie(normal).map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={TIP} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                {hasilPie(normal).map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="flex-1 text-muted-foreground">{d.name}</span>
                    <span className="font-bold tabular-nums">{d.value}</span>
                    <span className="text-muted-foreground tabular-nums w-10 text-right">
                      {normal.length ? Math.round(d.value / normal.length * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Per hari ── */}
        {perHari.length > 0 && (
          <ChartCard icon={Clock} title="P&L per Hari">
            <BarChart data={perHari} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={72} tickFormatter={v => fmt(v)} />
              <Tooltip contentStyle={TIP} formatter={(v: unknown, _n, p) => [`${fmt(Number(v ?? 0))} · WR ${(p?.payload?.wr ?? 0).toFixed(0)}% · ${p?.payload?.n ?? 0} trade`, 'P&L']} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {perHari.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ChartCard>
        )}

        {/* ── Per jam ── */}
        {perJam.length > 0 && (
          <ChartCard icon={Clock} title="P&L per Jam Entry">
            <BarChart data={perJam} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={72} tickFormatter={v => fmt(v)} />
              <Tooltip contentStyle={TIP} formatter={(v: unknown, _n, p) => [`${fmt(Number(v ?? 0))} · WR ${(p?.payload?.wr ?? 0).toFixed(0)}% · ${p?.payload?.n ?? 0} trade`, 'P&L']} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {perJam.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ChartCard>
        )}
      </div>

      {/* ── Tabel kelompok ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TabelGrup icon={Layers} title="Per Pair" rows={byPair} fmt={fmt} />
        <TabelGrup icon={Compass} title="Per Strategi" rows={byStrategi} fmt={fmt} />
        <TabelGrup icon={TrendingUp} title="Long vs Short" rows={byArah} fmt={fmt} />
        {byStruktur.length > 0 && <TabelGrup icon={Activity} title="Per Struktur Market" rows={byStruktur} fmt={fmt} />}
      </div>

      {/* ── Disiplin ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Disiplin icon={ShieldCheck} title="Disiplin Trading Plan" data={disiplin} fmt={fmt}
          catatan="Kalau 'ikut plan' tidak lebih baik dari 'tidak ikut plan', yang perlu diperiksa adalah plannya — bukan disiplinnya." />
        <Disiplin icon={Compass} title="Keyakinan Arah" data={arahTahu} fmt={fmt}
          catatan="Selisih yang besar berarti menunggu kejelasan arah benar-benar terbayar." />
      </div>

      {overtrade.n > 0 && (
        <Card className={overtrade.pnl < 0 ? 'border-red-500/30 bg-red-500/[0.04]' : 'border-amber-500/25'}>
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">{overtrade.n} trade ditandai overtrade</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                Total dampaknya ke saldo: <b className={overtrade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{overtrade.pnl >= 0 ? '+' : ''}{fmt(overtrade.pnl)}</b>.
                Trade ini tidak ikut dihitung di win rate & profit factor, tapi uangnya tetap nyata.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── util ──
// pnlByGroup() sudah mengembalikan bentuk siap pakai; di sini hanya diurutkan
// dari yang paling menguntungkan supaya yang terpenting muncul lebih dulu.
type GrupRow = ReturnType<typeof pnlByGroup>
function grup(rows: GrupRow): GrupRow {
  return [...rows].sort((a, b) => b.pnl - a.pnl)
}

function bandingkan(trades: Trade[], pred: (t: Trade) => boolean, labelYa: string, labelTidak: string) {
  const hitung = (list: Trade[]) => {
    const w = list.filter(t => t.result === 'win').length
    return { n: list.length, wr: list.length ? w / list.length * 100 : 0, pnl: list.reduce((s, t) => s + t.pnl, 0) }
  }
  // Hanya trade yang field-nya BENAR-BENAR diisi yang dibandingkan. Menganggap
  // yang kosong sebagai "tidak" akan mengarang data yang tidak pernah dicatat.
  const terisi = trades.filter(t => pred(t) || pred(t) === false)
  const ya = terisi.filter(pred), tidak = terisi.filter(t => !pred(t))
  return { labelYa, labelTidak, ya: hitung(ya), tidak: hitung(tidak), ada: ya.length > 0 || tidak.length > 0 }
}

function hasilPie(trades: Trade[]) {
  const c = { win: 0, loss: 0, breakeven: 0 }
  for (const t of trades) c[t.result] = (c[t.result] ?? 0) + 1
  return [
    { name: 'Win', value: c.win, color: '#10b981' },
    { name: 'Loss', value: c.loss, color: '#ef4444' },
    { name: 'Breakeven', value: c.breakeven, color: '#94a3b8' },
  ].filter(d => d.value > 0)
}

function Metrik({ label, nilai, sub, warna }: { label: string; nilai: string; sub?: string; warna?: string }) {
  return (
    <Card className="border-border/40">
      <CardContent className="pt-3.5 pb-3.5 px-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
        <p className={`text-base font-black tabular-nums leading-tight mt-1 truncate ${warna ?? ''}`}>{nilai}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function ChartCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Icon size={13} /> {title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-44 w-full min-w-0 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function TabelGrup({ icon: Icon, title, rows, fmt }: { icon: React.ElementType; title: string; rows: GrupRow; fmt: Fmt }) {
  const [semua, setSemua] = useState(false)
  if (rows.length === 0) return null
  const tampil = semua ? rows : rows.slice(0, 6)
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Icon size={13} /> {title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-xs">
          <thead className="border-b border-border/50 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Nama</th>
              <th className="text-right px-2 py-2 font-medium">Trade</th>
              <th className="text-right px-2 py-2 font-medium">WR</th>
              <th className="text-right px-4 py-2 font-medium">P&amp;L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {tampil.map(r => (
              <tr key={r.name} className="hover:bg-muted/20">
                <td className="px-4 py-2 max-w-[140px] truncate">{r.name}</td>
                <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">{r.total}</td>
                <td className={`px-2 py-2 text-right tabular-nums ${r.winRate >= 50 ? 'text-emerald-400' : 'text-muted-foreground'}`}>{r.winRate}%</td>
                <td className={`px-4 py-2 text-right font-bold tabular-nums ${r.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r.pnl >= 0 ? '+' : ''}{fmt(r.pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 6 && (
          <button onClick={() => setSemua(v => !v)} className="w-full py-2 text-[11px] font-bold text-muted-foreground hover:text-foreground border-t border-border/40">
            {semua ? 'Ringkas' : `Lihat ${rows.length - 6} lainnya`}
          </button>
        )}
      </CardContent>
    </Card>
  )
}

function Disiplin({ icon: Icon, title, data, fmt, catatan }: {
  icon: React.ElementType; title: string; fmt: Fmt; catatan: string
  data: ReturnType<typeof bandingkan>
}) {
  if (!data.ada) return null
  const baris = [
    { label: data.labelYa, ...data.ya, baik: true },
    { label: data.labelTidak, ...data.tidak, baik: false },
  ].filter(b => b.n > 0)
  const selisih = data.ya.n > 0 && data.tidak.n > 0 ? data.ya.wr - data.tidak.wr : null
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Icon size={13} /> {title}</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {baris.map(b => (
            <div key={b.label}>
              <div className="flex items-center justify-between gap-2 text-xs mb-1">
                <span className={b.baik ? 'font-medium' : 'text-muted-foreground'}>{b.label}</span>
                <span className="tabular-nums">
                  <b className={b.wr >= 50 ? 'text-emerald-400' : 'text-red-400'}>{b.wr.toFixed(0)}%</b>
                  <span className="text-muted-foreground"> · {b.n} trade · </span>
                  <b className={b.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{b.pnl >= 0 ? '+' : ''}{fmt(b.pnl)}</b>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${b.wr >= 50 ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ width: `${Math.min(100, b.wr)}%` }} />
              </div>
            </div>
          ))}
        </div>
        {selisih !== null && (
          <p className={`text-[11px] leading-relaxed mt-2.5 pt-2 border-t border-border/40 ${Math.abs(selisih) < 5 ? 'text-muted-foreground' : selisih > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {Math.abs(selisih) < 5
              ? `Selisih win rate hanya ${Math.abs(selisih).toFixed(0)} poin — terlalu kecil untuk disimpulkan.`
              : selisih > 0
                ? `${data.labelYa} unggul ${selisih.toFixed(0)} poin win rate.`
                : `${data.labelTidak} justru unggul ${Math.abs(selisih).toFixed(0)} poin. ${catatan}`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
