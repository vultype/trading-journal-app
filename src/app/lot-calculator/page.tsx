'use client'

// Kalkulator Lot & Saran Lot Aman — tool Pro, standalone (dark, konsisten /hub /upgrade).
// Multi-pair (metal/forex/kripto/indeks). Sizing berbasis risiko: lot = (saldo × risiko%) ÷
// (jarak SL × kontrak × faktor-quote). Tanpa API — semua input manual, robust.
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import {
  Calculator, ArrowLeft, Loader2, Lock, Crown, ShieldCheck, AlertTriangle, TrendingDown, Info, Gauge,
} from 'lucide-react'

type Quote = 'USD' | 'JPY' | 'CHF' | 'CAD'
type Instrument = { sym: string; label: string; cat: string; contract: number; pip: number; quote: Quote; price: number; dec: number }

// contract = unit per 1.00 lot · pip = perubahan harga 1 pip · price = perkiraan harga (default,
// bisa diubah user) untuk notional & konversi pair non-USD. Ikuti konvensi umum MT4/MT5.
const INSTRUMENTS: Instrument[] = [
  { sym: 'XAU/USD', label: 'Emas (XAU/USD)', cat: 'Logam', contract: 100, pip: 0.01, quote: 'USD', price: 2400, dec: 2 },
  { sym: 'XAG/USD', label: 'Perak (XAG/USD)', cat: 'Logam', contract: 5000, pip: 0.001, quote: 'USD', price: 30, dec: 3 },
  { sym: 'EUR/USD', label: 'EUR/USD', cat: 'Forex', contract: 100000, pip: 0.0001, quote: 'USD', price: 1.08, dec: 5 },
  { sym: 'GBP/USD', label: 'GBP/USD', cat: 'Forex', contract: 100000, pip: 0.0001, quote: 'USD', price: 1.27, dec: 5 },
  { sym: 'AUD/USD', label: 'AUD/USD', cat: 'Forex', contract: 100000, pip: 0.0001, quote: 'USD', price: 0.66, dec: 5 },
  { sym: 'NZD/USD', label: 'NZD/USD', cat: 'Forex', contract: 100000, pip: 0.0001, quote: 'USD', price: 0.60, dec: 5 },
  { sym: 'USD/JPY', label: 'USD/JPY', cat: 'Forex', contract: 100000, pip: 0.01, quote: 'JPY', price: 150, dec: 3 },
  { sym: 'USD/CHF', label: 'USD/CHF', cat: 'Forex', contract: 100000, pip: 0.0001, quote: 'CHF', price: 0.88, dec: 5 },
  { sym: 'USD/CAD', label: 'USD/CAD', cat: 'Forex', contract: 100000, pip: 0.0001, quote: 'CAD', price: 1.36, dec: 5 },
  { sym: 'BTC/USD', label: 'Bitcoin (BTC/USD)', cat: 'Kripto', contract: 1, pip: 1, quote: 'USD', price: 65000, dec: 1 },
  { sym: 'ETH/USD', label: 'Ethereum (ETH/USD)', cat: 'Kripto', contract: 1, pip: 0.1, quote: 'USD', price: 3200, dec: 2 },
  { sym: 'US30', label: 'US30 (Dow Jones)', cat: 'Indeks', contract: 1, pip: 1, quote: 'USD', price: 39000, dec: 1 },
  { sym: 'NAS100', label: 'NAS100 (Nasdaq)', cat: 'Indeks', contract: 1, pip: 1, quote: 'USD', price: 18000, dec: 1 },
  { sym: 'US500', label: 'US500 (S&P 500)', cat: 'Indeks', contract: 1, pip: 0.1, quote: 'USD', price: 5300, dec: 1 },
]
const CATS = ['Logam', 'Forex', 'Kripto', 'Indeks']

const num = (s: string) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : 0 }
const fmtUsd = (n: number, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtLot = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function LotCalculatorPage() {
  const router = useRouter()
  const sub = useSubscription()

  const [symbol, setSymbol] = useState('XAU/USD')
  const [balance, setBalance] = useState('1000')
  const [risk, setRisk] = useState('1')
  const [sl, setSl] = useState('300')
  const [slUnit, setSlUnit] = useState<'pips' | 'harga'>('pips')
  const inst = useMemo(() => INSTRUMENTS.find(i => i.sym === symbol)!, [symbol])
  const [price, setPrice] = useState(String(inst.price))

  // Ganti pair → reset harga default & satuan SL wajar
  useEffect(() => { setPrice(String(inst.price)) }, [inst])

  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace('/login?next=%2Flot-calculator')
  }, [sub.loading, sub.userId, router])

  const calc = useMemo(() => {
    const bal = num(balance), riskPct = num(risk), slv = num(sl), pr = num(price) || inst.price
    const priceDist = slUnit === 'pips' ? slv * inst.pip : slv           // jarak SL dalam harga
    const pips = inst.pip > 0 ? priceDist / inst.pip : 0
    const quoteFactor = inst.quote === 'USD' ? 1 : (pr > 0 ? 1 / pr : 0)  // konversi quote→USD
    const pipValuePerLot = inst.pip * inst.contract * quoteFactor         // USD/pip/lot
    const lossPerLot = priceDist * inst.contract * quoteFactor           // USD rugi per 1.0 lot di SL
    const lotFor = (pct: number) => lossPerLot > 0 ? (bal * pct / 100) / lossPerLot : 0
    const lot = lotFor(riskPct)
    const riskAmt = bal * riskPct / 100
    const notional = inst.quote === 'USD' ? lot * inst.contract * pr : lot * inst.contract
    const valid = bal > 0 && riskPct > 0 && priceDist > 0 && lossPerLot > 0
    return { priceDist, pips, pipValuePerLot, lossPerLot, lot, riskAmt, notional, lotFor, valid }
  }, [balance, risk, sl, slUnit, price, inst])

  const verdict = useMemo(() => {
    const r = num(risk)
    if (r <= 0) return null
    if (r <= 1) return { t: 'Konservatif — aman', c: 'emerald', ic: ShieldCheck }
    if (r <= 2) return { t: 'Moderat — masih wajar', c: 'emerald', ic: ShieldCheck }
    if (r <= 3) return { t: 'Agak agresif — hati-hati', c: 'amber', ic: AlertTriangle }
    if (r <= 5) return { t: 'Agresif — berisiko tinggi', c: 'amber', ic: AlertTriangle }
    return { t: 'Sangat berisiko — hindari', c: 'red', ic: TrendingDown }
  }, [risk])

  if (sub.loading || !sub.userId) return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>

  // Gate Pro
  if (!sub.isPro) return (
    <div className="min-h-screen bg-[#060a09] text-white flex flex-col items-center justify-center px-5 text-center">
      <span className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/12 ring-1 ring-primary/25 mb-5"><Lock size={26} className="text-primary" /></span>
      <h1 className="text-2xl font-black tracking-tight">Kalkulator Lot — Khusus Pro</h1>
      <p className="text-sm text-white/55 mt-2 max-w-sm leading-relaxed">Hitung ukuran lot berbasis risiko & dapat saran lot aman untuk XAU/USD, forex, kripto & indeks. Buka dengan langganan Pro.</p>
      <div className="flex gap-2.5 mt-6">
        <Link href="/hub" className="inline-flex items-center gap-1.5 border border-white/15 text-white/80 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-white/5 transition-colors"><ArrowLeft size={15} /> Ke Hub</Link>
        <Link href="/upgrade" className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"><Crown size={15} /> Upgrade Pro</Link>
      </div>
    </div>
  )

  const vc = (c: string) => c === 'emerald' ? 'text-emerald-400 bg-emerald-500/12 border-emerald-500/25' : c === 'amber' ? 'text-amber-400 bg-amber-500/12 border-amber-500/25' : 'text-red-400 bg-red-500/12 border-red-500/25'
  const lotFloor = calc.lot > 0 && calc.lot < 0.01

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[140px] rounded-full pointer-events-none" />
      <header className="relative max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/hub" className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"><ArrowLeft size={16} /> Hub</Link>
        <span className="text-lg font-black tracking-tight">Datalitiq</span>
      </header>

      <main className="relative max-w-4xl mx-auto px-5 pt-4 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-primary/15 ring-1 ring-primary/30 text-primary shrink-0"><Calculator size={20} /></span>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">Kalkulator Lot & Saran Lot Aman</h1>
            <p className="text-sm text-white/50">Ukuran lot ideal dari risiko yang kamu tentukan — multi-pair.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 items-start">
          {/* INPUT */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Instrumen</label>
              <select value={symbol} onChange={e => setSymbol(e.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary/50">
                {CATS.map(cat => (
                  <optgroup key={cat} label={cat}>
                    {INSTRUMENTS.filter(i => i.cat === cat).map(i => <option key={i.sym} value={i.sym}>{i.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Saldo / Ekuitas Akun (USD)</label>
              <div className="mt-1.5 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                <input value={balance} onChange={e => setBalance(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-white/10 bg-black/30 pl-7 pr-3 py-2.5 text-sm font-bold tabular-nums outline-none focus:border-primary/50" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Risiko per Transaksi</label>
                <div className="flex gap-1">
                  {['0.5', '1', '2'].map(r => (
                    <button key={r} onClick={() => setRisk(r)} className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors ${risk === r ? 'bg-primary/25 text-primary' : 'bg-white/5 text-white/40 hover:text-white/70'}`}>{r}%</button>
                  ))}
                </div>
              </div>
              <div className="mt-1.5 relative">
                <input value={risk} onChange={e => setRisk(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-white/10 bg-black/30 pr-8 pl-3 py-2.5 text-sm font-bold tabular-nums outline-none focus:border-primary/50" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">%</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Stop Loss</label>
                <div className="flex gap-1 rounded-lg bg-black/30 p-0.5 border border-white/10">
                  {(['pips', 'harga'] as const).map(u => (
                    <button key={u} onClick={() => setSlUnit(u)} className={`rounded-md px-2.5 py-0.5 text-[10px] font-bold capitalize transition-colors ${slUnit === u ? 'bg-primary text-primary-foreground' : 'text-white/45 hover:text-white/70'}`}>{u === 'harga' ? 'Jarak Harga' : 'Pips'}</button>
                  ))}
                </div>
              </div>
              <input value={sl} onChange={e => setSl(e.target.value)} inputMode="decimal" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm font-bold tabular-nums outline-none focus:border-primary/50" />
              <p className="text-[10px] text-white/40 mt-1.5">{slUnit === 'pips' ? `≈ jarak harga ${calc.priceDist.toFixed(inst.dec)}` : `≈ ${calc.pips.toLocaleString('en-US', { maximumFractionDigits: 1 })} pips`} · 1 pip = {inst.pip} harga</p>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Harga {inst.sym} sekarang {inst.quote === 'USD' ? '(opsional)' : ''}</label>
              <input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm font-bold tabular-nums outline-none focus:border-primary/50" />
              <p className="text-[10px] text-white/40 mt-1.5">{inst.quote === 'USD' ? 'Dipakai untuk hitung nilai posisi (notional).' : `Wajib — untuk konversi ${inst.quote}→USD (nilai pip pair ini bergantung harga).`}</p>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <Info size={13} className="text-white/40 shrink-0 mt-0.5" />
              <p className="text-[10px] text-white/45 leading-relaxed">Asumsi mata uang akun <b className="text-white/65">USD</b>. Spesifikasi kontrak/pip mengikuti standar umum MT4/MT5 — cek ke brokermu bila berbeda.</p>
            </div>
          </div>

          {/* HASIL */}
          <div className="space-y-4">
            {/* Lot disarankan */}
            <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-primary/60 via-primary/15 to-cyan-500/25">
              <div className="rounded-2xl bg-[#0a1110] p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-1">Lot yang Disarankan</p>
                {calc.valid ? (
                  <>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-black tracking-tight tabular-nums text-primary">{fmtLot(calc.lot)}</span>
                      <span className="text-sm font-bold text-white/50 mb-1">lot</span>
                    </div>
                    {lotFloor && <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1"><AlertTriangle size={11} /> Di bawah lot minimum broker (0.01). Kecilkan SL atau tambah saldo.</p>}
                    <p className="text-[11px] text-white/50 mt-2">Rugi maks bila kena SL: <b className="text-white/80">${fmtUsd(calc.riskAmt)}</b> ({num(risk)}% dari saldo)</p>
                  </>
                ) : <p className="text-white/40 text-sm py-3">Lengkapi saldo, risiko & stop loss untuk melihat hasil.</p>}
              </div>
            </div>

            {/* Verdict keamanan */}
            {verdict && (
              <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 ${vc(verdict.c)}`}>
                <verdict.ic size={16} className="shrink-0" />
                <p className="text-[12px] font-bold">Tingkat risiko {num(risk)}%: {verdict.t}</p>
              </div>
            )}

            {/* Detail perhitungan */}
            {calc.valid && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 grid grid-cols-2 gap-3">
                {[
                  { l: 'Nilai per pip / lot', v: `$${fmtUsd(calc.pipValuePerLot, 2)}` },
                  { l: 'Rugi per 1.0 lot @ SL', v: `$${fmtUsd(calc.lossPerLot, 2)}` },
                  { l: 'Jarak SL', v: `${calc.pips.toLocaleString('en-US', { maximumFractionDigits: 1 })} pips` },
                  { l: 'Ukuran posisi (notional)', v: `$${fmtUsd(calc.notional, 0)}` },
                ].map(s => (
                  <div key={s.l} className="rounded-lg bg-black/20 p-2.5">
                    <p className="text-[9px] text-white/40 uppercase tracking-wider">{s.l}</p>
                    <p className="text-sm font-black tabular-nums mt-0.5">{s.v}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Saran lot aman per tingkat risiko */}
            {calc.valid && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
                  <Gauge size={14} className="text-primary" />
                  <p className="text-[12px] font-bold">Saran Lot Aman</p>
                  <span className="ml-auto text-[9px] text-white/35">per SL {calc.pips.toFixed(0)} pips</span>
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {[{ p: 0.5, t: 'Konservatif' }, { p: 1, t: 'Moderat' }, { p: 2, t: 'Agresif' }].map(row => {
                    const active = Math.abs(num(risk) - row.p) < 0.001
                    return (
                      <div key={row.p} className={`flex items-center justify-between px-4 py-2.5 ${active ? 'bg-primary/[0.06]' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold tabular-nums ${row.p <= 1 ? 'text-emerald-400' : 'text-amber-400'}`}>{row.p}%</span>
                          <span className="text-[11px] text-white/50">{row.t}</span>
                          {active && <span className="text-[8px] font-bold uppercase rounded-full bg-primary/20 text-primary px-1.5 py-0.5">pilihanmu</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-white/40 tabular-nums">${fmtUsd(num(balance) * row.p / 100)}</span>
                          <span className="text-[13px] font-black tabular-nums w-14 text-right">{fmtLot(calc.lotFor(row.p))}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-white/35 px-4 py-2.5 border-t border-white/[0.06] leading-relaxed">Rekomendasi umum manajemen risiko: <b className="text-white/60">≤1–2% per transaksi</b>. Lebih dari itu, satu rentetan rugi bisa menguras akun dengan cepat.</p>
              </div>
            )}
          </div>
        </div>

        <p className="text-[10px] text-white/25 mt-6 text-center max-w-lg mx-auto leading-relaxed">Alat bantu hitung, bukan nasihat keuangan. Ukuran lot final selalu sesuaikan dengan spesifikasi & lot minimum brokermu.</p>
      </main>
    </div>
  )
}
