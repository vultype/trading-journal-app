'use client'

// Jurnal Prop Firm — per akun, USD. Batas rugi harian & total, target profit,
// bagi hasil (USD + Rupiah), dan aturan konsistensi.
//
// Terpisah dari jurnal broker biasa: aturan prop firm tidak punya padanan di
// sana, dan mencampurnya membuat kedua perhitungan harus saling tahu-diri.
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  ShieldAlert, Target, Landmark, Plus, Trash2, Settings2, TrendingUp, TrendingDown,
  Loader2, X as XIcon, CalendarDays, Scale, CheckCircle2, Archive,
} from 'lucide-react'
import {
  hitungStatus, usd, idr, PHASE_LABEL,
  type PfAccount, type PfTrade,
} from '@/lib/propfirm'

const DEF_ACC = {
  name: '', firm: '', phase: 'challenge' as const, initial_balance: 100000,
  daily_loss_pct: 5, max_loss_pct: 10, profit_target_pct: 8,
  drawdown_type: 'static' as const, payout_share_pct: 80, usd_idr: 16000,
  consistency_on: false, consistency_pct: 30, note: '',
}

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Batang progres yang warnanya ikut MAKNA, bukan selalu warna primer.
//
// Komponen Progress bawaan mengunci indikatornya ke bg-primary (hijau). Untuk
// batang RISIKO itu menyesatkan: batas yang sudah terlampaui tampil hijau penuh
// dan terbaca sebagai kabar baik — persis kebalikan dari yang terjadi.
//
// mode 'risiko' : makin penuh makin buruk (abu → amber → merah)
// mode 'capaian': makin penuh makin baik (hijau)
function Bar({ pct, mode = 'risiko' }: { pct: number; mode?: 'risiko' | 'capaian' }) {
  const v = Math.min(100, Math.max(0, pct))
  const warna = mode === 'capaian'
    ? (v >= 100 ? 'bg-emerald-400' : 'bg-primary')
    : v >= 100 ? 'bg-red-400' : v >= 70 ? 'bg-amber-400' : 'bg-muted-foreground/50'
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${warna}`} style={{ width: `${v}%` }} />
    </div>
  )
}

const fmtTgl = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

export default function PropFirmPage() {
  const { userId } = useStore()
  const [accounts, setAccounts] = useState<PfAccount[]>([])
  const [trades, setTrades] = useState<PfTrade[]>([])
  const [sel, setSel] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [showAcc, setShowAcc] = useState<null | 'new' | PfAccount>(null)

  // form trade
  const [tDate, setTDate] = useState(todayISO())
  const [tPnl, setTPnl] = useState('')
  const [tPair, setTPair] = useState('XAU/USD')
  const [tDir, setTDir] = useState<'long' | 'short'>('long')
  const [tRr, setTRr] = useState('')
  const [tNote, setTNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const sb = createClient()
    const [a, t] = await Promise.all([
      sb.from('pf_accounts').select('*').order('created_at', { ascending: false }),
      sb.from('pf_trades').select('*').order('date', { ascending: false }).limit(2000),
    ])
    if (a.error || t.error) {
      const msg = a.error?.message || t.error?.message || ''
      if (/relation|does not exist|schema cache/i.test(msg)) { setNeedsMigration(true); setLoading(false); return }
      toast.error('Gagal memuat: ' + msg); setLoading(false); return
    }
    const accs = (a.data ?? []) as PfAccount[]
    setAccounts(accs)
    setTrades((t.data ?? []) as PfTrade[])
    // Punya lebih dari satu akun → buka ringkasan semua akun. Membuka satu akun
    // tertentu saat ada beberapa membuat akun lain tak terlihat, padahal justru
    // itu yang perlu dipantau.
    const aktif = accs.filter(x => !x.archived)
    setSel(s => (s === 'ALL' || (s && accs.some(x => x.id === s)))
      ? s
      : aktif.length > 1 ? 'ALL' : (aktif[0]?.id ?? accs[0]?.id ?? ''))
    setLoading(false)
  }
  useEffect(() => { if (userId) load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId])

  // 'ALL' = ringkasan seluruh akun. Dibutuhkan begitu akun lebih dari satu:
  // tanpa ini, satu-satunya cara tahu ada akun yang mendekati batas adalah
  // membukanya satu per satu — dan yang paling perlu diketahui justru yang
  // sedang tidak dibuka.
  const isAll = sel === 'ALL'
  const acc = accounts.find(a => a.id === sel) ?? null

  // Status tiap akun aktif, untuk kartu ringkasan.
  const semua = useMemo(() =>
    accounts.filter(a => !a.archived).map(a => ({
      a, st: hitungStatus(a, trades.filter(t => t.account_id === a.id)),
    })), [accounts, trades])
  const accTrades = useMemo(() => trades.filter(t => t.account_id === sel), [trades, sel])
  const st = useMemo(() => acc ? hitungStatus(acc, accTrades) : null, [acc, accTrades])

  async function addTrade(e: React.FormEvent) {
    e.preventDefault()
    if (!acc) return
    const n = parseFloat(tPnl.replace(',', '.'))
    if (!Number.isFinite(n) || n === 0) { toast.error('Isi P&L (boleh negatif, mis. -250)'); return }
    setBusy(true)
    const { data, error } = await createClient().from('pf_trades').insert({
      user_id: userId, account_id: acc.id, date: tDate, pair: tPair.trim() || null,
      direction: tDir, pnl: n, rr: tRr.trim() ? parseFloat(tRr.replace(',', '.')) : null,
      note: tNote.trim() || null,
    }).select('*').single()
    setBusy(false)
    if (error || !data) { toast.error(error?.message ?? 'Gagal menyimpan'); return }
    setTrades(p => [data as PfTrade, ...p])
    setTPnl(''); setTRr(''); setTNote('')
    toast.success(n >= 0 ? `Profit ${usd(n)} dicatat` : `Rugi ${usd(n)} dicatat`)
  }

  async function delTrade(id: string) {
    const { error } = await createClient().from('pf_trades').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setTrades(p => p.filter(t => t.id !== id))
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-primary" /></div>

  if (needsMigration) return (
    <Card className="border-amber-500/30 bg-amber-500/[0.05] max-w-xl">
      <CardContent className="pt-5 pb-5 text-center">
        <p className="font-bold text-sm text-amber-500 mb-1">Fitur ini butuh migrasi database</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Jalankan <code className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[11px]">supabase-propfirm.sql</code> di
          Supabase → SQL Editor, lalu muat ulang halaman ini.
        </p>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Jurnal Prop Firm</h1>
          <p className="text-sm text-muted-foreground">Batas rugi, target, & bagi hasil per akun — dalam USD</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {accounts.length > 0 && (
            <Select value={sel} onValueChange={v => v && setSel(v)}>
              <SelectTrigger className="w-56"><SelectValue>{isAll ? `Semua Akun (${semua.length})` : acc ? `${acc.name}${acc.archived ? ' (arsip)' : ''}` : 'Pilih akun'}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Akun ({semua.length})</SelectItem>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} · {PHASE_LABEL[a.phase]}{a.archived ? ' (arsip)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {acc && !isAll && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAcc(acc)}>
              <Settings2 size={13} /> Setting Akun
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => setShowAcc('new')}>
            <Plus size={14} /> Akun Baru
          </Button>
        </div>
      </div>

      {isAll ? (
        <SemuaAkun rows={semua} onPick={id => setSel(id)} onNew={() => setShowAcc('new')} />
      ) : !acc ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Landmark size={28} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-bold text-sm mb-1">Belum ada akun prop firm</p>
            <p className="text-xs text-muted-foreground mb-4">Tambahkan akun beserta aturan firm-nya untuk mulai memantau batas.</p>
            <Button size="sm" className="gap-1.5" onClick={() => setShowAcc('new')}><Plus size={14} /> Buat Akun Pertama</Button>
          </CardContent>
        </Card>
      ) : st && (
        <>
          {/* ── Peringatan breach ── */}
          {(st.harianBreach || st.totalBreach) && (
            <Card className="border-red-500/40 bg-red-500/[0.07]">
              <CardContent className="pt-4 pb-4 flex items-start gap-3">
                <ShieldAlert size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-400">
                    {st.totalBreach ? 'Batas rugi TOTAL terlampaui' : 'Batas rugi HARIAN terlampaui'}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                    {st.totalBreach
                      ? `Saldo ${usd(st.saldo)} sudah di bawah lantai ${usd(st.lantaiUsd)}. Di sebagian besar firm ini berarti akun hangus.`
                      : `Rugi hari ini ${usd(st.rugiHariIni)} mencapai batas ${usd(st.batasHarianUsd)}. Berhenti trading hari ini.`}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── 4 kartu ringkas ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className={st.totalPnl >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Saldo</p>
                <p className="text-xl font-black tabular-nums">{usd(st.saldo)}</p>
                <p className={`text-[11px] mt-0.5 font-medium ${st.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {st.totalPnl >= 0 ? '+' : ''}{usd(st.totalPnl)}
                </p>
              </CardContent>
            </Card>

            <Card className={st.harianBreach ? 'border-red-500/40' : st.harianTerpakaiPct >= 70 ? 'border-amber-500/30' : 'border-border/40'}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Sisa Batas Harian</p>
                <p className={`text-xl font-black tabular-nums ${st.harianBreach ? 'text-red-400' : st.harianTerpakaiPct >= 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {usd(st.sisaHarianUsd)}
                </p>
                <div className="mt-1.5"><Bar pct={st.harianTerpakaiPct} /></div>
                <p className="text-[11px] text-muted-foreground mt-1">dari {usd(st.batasHarianUsd)} · {acc.daily_loss_pct}%</p>
              </CardContent>
            </Card>

            <Card className={st.totalBreach ? 'border-red-500/40' : st.totalTerpakaiPct >= 70 ? 'border-amber-500/30' : 'border-border/40'}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Jarak ke Lantai</p>
                <p className={`text-xl font-black tabular-nums ${st.totalBreach ? 'text-red-400' : st.totalTerpakaiPct >= 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {usd(st.jarakLantaiUsd)}
                </p>
                <div className="mt-1.5"><Bar pct={st.totalTerpakaiPct} /></div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  lantai {usd(st.lantaiUsd)} · {acc.drawdown_type === 'trailing' ? 'trailing' : 'static'}
                </p>
              </CardContent>
            </Card>

            <Card className={st.targetTercapai ? 'border-emerald-500/40 bg-emerald-500/[0.05]' : 'border-border/40'}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Target size={11} /> Target Profit</p>
                <p className={`text-xl font-black tabular-nums ${st.targetTercapai ? 'text-emerald-400' : ''}`}>
                  {st.targetProgressPct.toFixed(0)}%
                </p>
                <div className="mt-1.5"><Bar pct={st.targetProgressPct} mode="capaian" /></div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {st.targetTercapai ? 'tercapai 🎉' : `perlu ${usd(Math.max(0, st.targetUsd - st.saldo))} lagi`}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* ── Kiri: input trade ── */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Plus size={13} /> Catat Trade</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={addTrade} className="space-y-3">
                    <div>
                      <Label className="text-xs">Tanggal</Label>
                      <Input type="date" value={tDate} onChange={e => setTDate(e.target.value)} className="mt-1" required />
                    </div>
                    <div>
                      <Label className="text-xs">P&amp;L (USD)</Label>
                      {/* Sengaja input bebas bertanda, bukan tombol Win/Lose: yang
                          dipakai prop firm adalah nominal persis dari dashboard
                          mereka, dan itu yang menentukan lolos atau breach. */}
                      <Input value={tPnl} onChange={e => setTPnl(e.target.value)} inputMode="decimal"
                        placeholder="mis. 450 atau -250" className="mt-1 tabular-nums" />
                      <p className="text-[11px] text-muted-foreground mt-1">Positif = profit, negatif = rugi. Salin dari dashboard firm.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Pair</Label>
                        <Input value={tPair} onChange={e => setTPair(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Arah</Label>
                        <div className="mt-1 grid grid-cols-2 gap-1">
                          <Button type="button" size="sm" variant={tDir === 'long' ? 'default' : 'outline'} className="h-9 text-xs gap-1" onClick={() => setTDir('long')}><TrendingUp size={12} /> Long</Button>
                          <Button type="button" size="sm" variant={tDir === 'short' ? 'default' : 'outline'} className="h-9 text-xs gap-1" onClick={() => setTDir('short')}><TrendingDown size={12} /> Short</Button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">RR (opsional)</Label>
                      <Input value={tRr} onChange={e => setTRr(e.target.value)} inputMode="decimal" placeholder="2" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Catatan (opsional)</Label>
                      <Textarea value={tNote} onChange={e => setTNote(e.target.value)} rows={2} className="mt-1" placeholder="setup, alasan entry…" />
                    </div>
                    <Button type="submit" disabled={busy} className="w-full gap-1.5">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Catat
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* ── Payout ── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><Landmark size={13} /> Estimasi Payout</span>
                    <span className="text-[10px] font-normal text-muted-foreground">share {acc.payout_share_pct}%</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {st.profitBagiHasil <= 0 ? (
                    <p className="text-xs text-muted-foreground py-1 leading-relaxed">
                      Belum ada profit untuk dibagi — akun masih di bawah modal awal.
                    </p>
                  ) : (
                    <>
                      <p className="text-2xl font-black text-emerald-400 tabular-nums leading-tight">{usd(st.payoutUsd)}</p>
                      <p className="text-sm font-bold text-muted-foreground tabular-nums">≈ {idr(st.payoutIdr)}</p>
                      <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
                        <div className="flex justify-between"><span>Profit dibagi</span><span className="tabular-nums">{usd(st.profitBagiHasil)}</span></div>
                        <div className="flex justify-between"><span>Bagian firm</span><span className="tabular-nums">{usd(st.bagianFirmUsd)}</span></div>
                        <div className="flex justify-between"><span>Kurs dipakai</span><span className="tabular-nums">{idr(acc.usd_idr)} / USD</span></div>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed mt-2.5 pt-2 border-t border-border/50">
                        Estimasi kotor. Belum memperhitungkan minimum hari trading, biaya transfer, maupun pajak.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* ── Konsistensi ── */}
              {acc.consistency_on && (
                <Card className={st.konsistensi && !st.konsistensi.lolos ? 'border-amber-500/40 bg-amber-500/[0.05]' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Scale size={13} /> Aturan Konsistensi</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!st.konsistensi ? (
                      <p className="text-xs text-muted-foreground">Belum ada hari profit untuk dinilai.</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted-foreground">Porsi hari terbesar</span>
                          <span className={`text-sm font-black tabular-nums ${st.konsistensi.lolos ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {st.konsistensi.porsiPct.toFixed(1)}%
                          </span>
                        </div>
                        <Bar pct={st.konsistensi.porsiPct} />
                        <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                          {fmtTgl(st.konsistensi.hariTerbesar)} menyumbang {usd(st.konsistensi.profitHariTerbesar)} dari
                          total {usd(st.profitBagiHasil)}. Batas firm {st.konsistensi.batasPct}%.
                        </p>
                        {st.konsistensi.lolos ? (
                          <p className="text-[11px] text-emerald-400 font-medium mt-1.5 flex items-center gap-1"><CheckCircle2 size={11} /> Memenuhi syarat</p>
                        ) : (
                          <p className="text-[11px] text-amber-400 leading-relaxed mt-1.5">
                            Belum memenuhi. Perlu tambahan profit ±{usd(st.konsistensi.butuhProfitTambahanUsd)} dari
                            hari-hari lain agar porsinya turun ke {st.konsistensi.batasPct}%.
                          </p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── Kanan: harian + riwayat ── */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CalendarDays size={13} /> Ringkasan Harian</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {st.hari.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-10">Belum ada trade.</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-card border-b border-border/50 z-10">
                          <tr className="text-muted-foreground">
                            <th className="text-left px-4 py-2 font-medium">Tanggal</th>
                            <th className="text-right px-3 py-2 font-medium">Trade</th>
                            <th className="text-right px-3 py-2 font-medium">P&amp;L</th>
                            <th className="text-right px-3 py-2 font-medium">Batas harian</th>
                            <th className="text-right px-4 py-2 font-medium">Saldo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {[...st.hari].reverse().map(h => {
                            const batas = h.saldoAwal * Number(acc.daily_loss_pct) / 100
                            const rugi = Math.max(0, -h.pnl)
                            const pakai = batas > 0 ? rugi / batas * 100 : 0
                            return (
                              <tr key={h.date} className="hover:bg-muted/20">
                                <td className="px-4 py-2">{fmtTgl(h.date)}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground">{h.trades}</td>
                                <td className={`px-3 py-2 text-right font-bold tabular-nums ${h.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {h.pnl >= 0 ? '+' : ''}{usd(h.pnl)}
                                </td>
                                <td className={`px-3 py-2 text-right tabular-nums ${pakai >= 100 ? 'text-red-400 font-bold' : pakai >= 70 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                                  {rugi > 0 ? `${pakai.toFixed(0)}%` : '—'}
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums font-medium">{usd(h.saldoAkhir)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Riwayat Trade</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {accTrades.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-10">Belum ada trade di akun ini.</p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-card border-b border-border/50 z-10">
                          <tr className="text-muted-foreground">
                            <th className="text-left px-4 py-2 font-medium">Tanggal</th>
                            <th className="text-left px-3 py-2 font-medium">Pair</th>
                            <th className="text-left px-3 py-2 font-medium">Arah</th>
                            <th className="text-right px-3 py-2 font-medium">RR</th>
                            <th className="text-right px-3 py-2 font-medium">P&amp;L</th>
                            <th className="w-8 px-2 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {accTrades.map(t => (
                            <tr key={t.id} className="hover:bg-muted/20 group">
                              <td className="px-4 py-2">
                                <div>{fmtTgl(t.date)}</div>
                                {t.note && <div className="text-[10px] text-muted-foreground/60 max-w-[180px] truncate">{t.note}</div>}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{t.pair ?? '—'}</td>
                              <td className="px-3 py-2">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.direction === 'short' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                  {t.direction === 'short' ? 'SHORT' : 'LONG'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{t.rr ? `1:${t.rr}` : '—'}</td>
                              <td className={`px-3 py-2 text-right font-bold tabular-nums ${Number(t.pnl) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {Number(t.pnl) >= 0 ? '+' : ''}{usd(Number(t.pnl))}
                              </td>
                              <td className="px-2 py-2 text-right">
                                <button onClick={() => delTrade(t.id)} aria-label="Hapus trade"
                                  className="text-muted-foreground/40 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all">
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {showAcc && (
        <AccSheet
          edit={showAcc === 'new' ? null : showAcc}
          userId={userId!}
          onClose={() => setShowAcc(null)}
          onSaved={() => { setShowAcc(null); load() }} />
      )}
    </div>
  )
}

// ── Ringkasan semua akun ──
//
// Yang paling perlu diketahui adalah akun yang TIDAK sedang dibuka: satu akun
// bisa mendekati batas tanpa disadari selama perhatian tertuju ke akun lain.
// Karena itu daftar diurutkan dari yang paling berisiko, bukan dari yang
// terbaru.
function SemuaAkun({ rows, onPick, onNew }: {
  rows: { a: PfAccount; st: ReturnType<typeof hitungStatus> }[]
  onPick: (id: string) => void
  onNew: () => void
}) {
  if (rows.length === 0) return (
    <Card className="border-dashed">
      <CardContent className="py-16 text-center">
        <Landmark size={28} className="mx-auto text-muted-foreground/40 mb-3" />
        <p className="font-bold text-sm mb-1">Belum ada akun aktif</p>
        <p className="text-xs text-muted-foreground mb-4">Tiap akun punya modal, batas risiko, target, dan aturan sendiri.</p>
        <Button size="sm" className="gap-1.5" onClick={onNew}><Plus size={14} /> Buat Akun Pertama</Button>
      </CardContent>
    </Card>
  )

  // Skor risiko = yang paling dekat kena batas, harian atau total.
  const risiko = (r: typeof rows[number]) =>
    r.st.totalBreach || r.st.harianBreach ? 1000 : Math.max(r.st.harianTerpakaiPct, r.st.totalTerpakaiPct)
  const urut = [...rows].sort((x, y) => risiko(y) - risiko(x))

  const totModal = rows.reduce((s, r) => s + Number(r.a.initial_balance), 0)
  const totSaldo = rows.reduce((s, r) => s + r.st.saldo, 0)
  const totPnl = totSaldo - totModal
  const totPayout = rows.reduce((s, r) => s + r.st.payoutUsd, 0)
  const totPayoutIdr = rows.reduce((s, r) => s + r.st.payoutIdr, 0)
  const bermasalah = rows.filter(r => r.st.harianBreach || r.st.totalBreach).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Total Modal Dikelola</p>
          <p className="text-xl font-black tabular-nums">{usd(totModal)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{rows.length} akun aktif</p>
        </CardContent></Card>
        <Card className={totPnl >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}><CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Total Saldo</p>
          <p className="text-xl font-black tabular-nums">{usd(totSaldo)}</p>
          <p className={`text-[11px] mt-0.5 font-medium ${totPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{totPnl >= 0 ? '+' : ''}{usd(totPnl)}</p>
        </CardContent></Card>
        <Card className="border-emerald-500/20"><CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Total Payout</p>
          <p className="text-xl font-black tabular-nums text-emerald-400">{usd(totPayout)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">≈ {idr(totPayoutIdr)}</p>
        </CardContent></Card>
        <Card className={bermasalah > 0 ? 'border-red-500/40 bg-red-500/[0.05]' : 'border-border/40'}><CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground mb-1">Akun Kena Batas</p>
          <p className={`text-xl font-black tabular-nums ${bermasalah > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{bermasalah}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{bermasalah > 0 ? 'perlu diperiksa' : 'semua aman'}</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {urut.map(({ a, st }) => {
          const kena = st.harianBreach || st.totalBreach
          const waspada = !kena && Math.max(st.harianTerpakaiPct, st.totalTerpakaiPct) >= 70
          return (
            <button key={a.id} onClick={() => onPick(a.id)} className="text-left">
              <Card className={`h-full transition-colors hover:border-primary/40 ${kena ? 'border-red-500/40 bg-red-500/[0.05]' : waspada ? 'border-amber-500/30' : 'border-border/40'}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{a.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.firm ? `${a.firm} · ` : ''}{PHASE_LABEL[a.phase]} · {usd(Number(a.initial_balance))}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black tabular-nums">{usd(st.saldo)}</p>
                      <p className={`text-[11px] font-medium tabular-nums ${st.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {st.totalPnl >= 0 ? '+' : ''}{usd(st.totalPnl)}
                      </p>
                    </div>
                  </div>

                  {kena && (
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-red-400 mb-2">
                      <ShieldAlert size={12} /> {st.totalBreach ? 'Batas total terlampaui' : 'Batas harian terlampaui'}
                    </p>
                  )}

                  <div className="space-y-2">
                    <BarRow label="Batas harian" pct={st.harianTerpakaiPct} sisa={`sisa ${usd(st.sisaHarianUsd)}`} />
                    <BarRow label={`Batas total (${a.drawdown_type === 'trailing' ? 'trailing' : 'static'})`} pct={st.totalTerpakaiPct} sisa={`jarak ${usd(st.jarakLantaiUsd)}`} />
                    <BarRow label="Target profit" pct={st.targetProgressPct} sisa={st.targetTercapai ? 'tercapai' : `perlu ${usd(Math.max(0, st.targetUsd - st.saldo))}`} baik />
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-border/40 text-[11px]">
                    <span className="text-muted-foreground">Payout {a.payout_share_pct}%</span>
                    <span className="font-bold tabular-nums text-emerald-400">
                      {usd(st.payoutUsd)} <span className="text-muted-foreground font-normal">· {idr(st.payoutIdr)}</span>
                    </span>
                  </div>
                  {a.consistency_on && st.konsistensi && !st.konsistensi.lolos && (
                    <p className="text-[10px] text-amber-400 mt-1.5 flex items-center gap-1">
                      <Scale size={10} /> Konsistensi belum memenuhi ({st.konsistensi.porsiPct.toFixed(0)}% dari batas {st.konsistensi.batasPct}%)
                    </p>
                  )}
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Baris progres kecil. `baik` membalik warna: untuk target, penuh itu bagus.
function BarRow({ label, pct, sisa, baik }: { label: string; pct: number; sisa: string; baik?: boolean }) {
  const warna = baik
    ? (pct >= 100 ? 'text-emerald-400' : 'text-muted-foreground')
    : (pct >= 100 ? 'text-red-400' : pct >= 70 ? 'text-amber-400' : 'text-muted-foreground')
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[11px] mb-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className={`tabular-nums font-medium ${warna}`}>{sisa}</span>
      </div>
      <Bar pct={pct} mode={baik ? 'capaian' : 'risiko'} />
    </div>
  )
}

// ── Form akun ──
function AccSheet({ edit, userId, onClose, onSaved }: {
  edit: PfAccount | null; userId: string; onClose: () => void; onSaved: () => void
}) {
  const [f, setF] = useState(() => edit ? {
    name: edit.name, firm: edit.firm ?? '', phase: edit.phase,
    initial_balance: Number(edit.initial_balance),
    daily_loss_pct: Number(edit.daily_loss_pct), max_loss_pct: Number(edit.max_loss_pct),
    profit_target_pct: Number(edit.profit_target_pct), drawdown_type: edit.drawdown_type,
    payout_share_pct: Number(edit.payout_share_pct), usd_idr: Number(edit.usd_idr),
    consistency_on: edit.consistency_on, consistency_pct: Number(edit.consistency_pct),
    note: edit.note ?? '',
  } : { ...DEF_ACC })
  const [busy, setBusy] = useState(false)
  const set = (p: Partial<typeof f>) => setF(c => ({ ...c, ...p }))
  const num = (s: string) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : 0 }

  async function save() {
    if (!f.name.trim()) { toast.error('Isi nama akun'); return }
    if (f.initial_balance <= 0) { toast.error('Modal awal harus lebih dari 0'); return }
    setBusy(true)
    const payload = { ...f, name: f.name.trim(), firm: f.firm.trim() || null, note: f.note.trim() || null }
    const sb = createClient()
    const { error } = edit
      ? await sb.from('pf_accounts').update(payload).eq('id', edit.id)
      : await sb.from('pf_accounts').insert({ ...payload, user_id: userId })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success(edit ? 'Akun diperbarui' : 'Akun dibuat'); onSaved()
  }

  async function toggleArsip() {
    if (!edit) return
    const { error } = await createClient().from('pf_accounts').update({ archived: !edit.archived }).eq('id', edit.id)
    if (error) { toast.error(error.message); return }
    toast.success(edit.archived ? 'Akun diaktifkan' : 'Akun diarsipkan'); onSaved()
  }

  async function hapus() {
    if (!edit) return
    if (!window.confirm(`Hapus akun "${edit.name}" beserta SELURUH tradenya? Tidak bisa dibatalkan.`)) return
    const { error } = await createClient().from('pf_accounts').delete().eq('id', edit.id)
    if (error) { toast.error(error.message); return }
    toast.success('Akun dihapus'); onSaved()
  }

  const F = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{hint}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full md:max-w-lg bg-card border border-border rounded-t-2xl md:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/50 z-10">
          <p className="text-sm font-bold">{edit ? 'Setting Akun' : 'Akun Prop Firm Baru'}</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"><XIcon size={15} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <F label="Nama Akun"><Input value={f.name} onChange={e => set({ name: e.target.value })} className="mt-1" placeholder="FTMO 100k #1" autoFocus /></F>
            <F label="Prop Firm"><Input value={f.firm} onChange={e => set({ firm: e.target.value })} className="mt-1" placeholder="FTMO" /></F>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <F label="Fase">
              <Select value={f.phase} onValueChange={v => v && set({ phase: v as typeof f.phase })}>
                <SelectTrigger className="mt-1"><SelectValue>{PHASE_LABEL[f.phase]}</SelectValue></SelectTrigger>
                <SelectContent>
                  {(['challenge', 'verifikasi', 'funded'] as const).map(p => <SelectItem key={p} value={p}>{PHASE_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Modal Awal (USD)">
              <Input value={f.initial_balance} onChange={e => set({ initial_balance: num(e.target.value) })} inputMode="decimal" className="mt-1 tabular-nums" />
            </F>
          </div>

          <div className="border-t border-border/50 pt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Batas Risiko</p>
            <div className="grid grid-cols-3 gap-3">
              <F label="Rugi Harian (%)"><Input value={f.daily_loss_pct} onChange={e => set({ daily_loss_pct: num(e.target.value) })} inputMode="decimal" className="mt-1 tabular-nums" /></F>
              <F label="Rugi Total (%)"><Input value={f.max_loss_pct} onChange={e => set({ max_loss_pct: num(e.target.value) })} inputMode="decimal" className="mt-1 tabular-nums" /></F>
              <F label="Target Profit (%)"><Input value={f.profit_target_pct} onChange={e => set({ profit_target_pct: num(e.target.value) })} inputMode="decimal" className="mt-1 tabular-nums" /></F>
            </div>

            <div className="mt-3">
              <Label className="text-xs">Jenis Drawdown Total</Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {([['static', 'Static'], ['trailing', 'Trailing']] as const).map(([v, l]) => (
                  <Button key={v} type="button" size="sm" variant={f.drawdown_type === v ? 'default' : 'outline'}
                    className="h-9 text-xs" onClick={() => set({ drawdown_type: v })}>{l}</Button>
                ))}
              </div>
              {/* Perbedaan ini besar akibatnya begitu akun sudah profit, dan salah
                  pilih membuat trader merasa aman padahal lantainya sudah naik. */}
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                {f.drawdown_type === 'static'
                  ? 'Lantai dihitung dari modal awal dan tidak pernah bergerak.'
                  : 'Lantai mengikuti saldo tertinggi yang pernah dicapai — ikut naik saat profit dan tidak pernah turun lagi. Lebih ketat.'}
                {' '}Cek aturan firm-mu; salah pilih membuat jarak ke lantai terlihat lebih longgar dari kenyataan.
              </p>
            </div>
          </div>

          <div className="border-t border-border/50 pt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Bagi Hasil</p>
            <div className="grid grid-cols-2 gap-3">
              <F label="Profit Share (%)"><Input value={f.payout_share_pct} onChange={e => set({ payout_share_pct: num(e.target.value) })} inputMode="decimal" className="mt-1 tabular-nums" /></F>
              <F label="Kurs USD → IDR" hint="Dipakai hanya untuk tampilan Rupiah.">
                <Input value={f.usd_idr} onChange={e => set({ usd_idr: num(e.target.value) })} inputMode="decimal" className="mt-1 tabular-nums" />
              </F>
            </div>
          </div>

          <div className="border-t border-border/50 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold">Aturan Konsistensi</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">
                  Profit satu hari tidak boleh melebihi porsi tertentu dari total profit. Tidak semua firm memakainya.
                </p>
              </div>
              <Button type="button" size="sm" variant={f.consistency_on ? 'default' : 'outline'} className="h-8 text-xs shrink-0"
                onClick={() => set({ consistency_on: !f.consistency_on })}>
                {f.consistency_on ? 'ON' : 'OFF'}
              </Button>
            </div>
            {f.consistency_on && (
              <div className="mt-3">
                <F label="Batas Porsi Hari Terbesar (%)" hint="Umumnya 30–50%. Cek aturan firm-mu.">
                  <Input value={f.consistency_pct} onChange={e => set({ consistency_pct: num(e.target.value) })} inputMode="decimal" className="mt-1 tabular-nums" />
                </F>
              </div>
            )}
          </div>

          <F label="Catatan (opsional)">
            <Textarea value={f.note} onChange={e => set({ note: e.target.value })} rows={2} className="mt-1" placeholder="nomor akun, tanggal mulai…" />
          </F>

          <div className="flex gap-2 pt-1">
            <Button onClick={save} disabled={busy} className="flex-1 gap-1.5">
              {busy ? <Loader2 size={14} className="animate-spin" /> : null} {edit ? 'Simpan' : 'Buat Akun'}
            </Button>
            {edit && (
              <Button variant="outline" onClick={toggleArsip} className="gap-1.5" title={edit.archived ? 'Aktifkan' : 'Arsipkan'}>
                <Archive size={14} />
              </Button>
            )}
          </div>
          {edit && (
            <Button variant="ghost" onClick={hapus} className="w-full text-red-400 hover:text-red-400 hover:bg-red-500/10 gap-1.5 text-xs">
              <Trash2 size={13} /> Hapus Akun & Semua Tradenya
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
