'use client'

// Kalkulator Lot & Saran Lot Aman — tool Pro, standalone (dark, konsisten /hub /upgrade).
// Multi-pair (metal/forex/kripto/indeks) + akun USD/IDR. Sizing berbasis risiko + fitur pro:
// R:R & potensi profit, leverage & margin, risiko %/nominal, insight drawdown loss beruntun.
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import {
  Calculator, ArrowLeft, Loader2, Lock, Crown, ShieldCheck, AlertTriangle, TrendingDown, Info, Gauge, Target, Layers,
} from 'lucide-react'

type Quote = 'USD' | 'JPY' | 'CHF' | 'CAD'
type Instrument = { sym: string; label: string; cat: string; contract: number; pip: number; quote: Quote; price: number; dec: number }

// contract = unit per 1.00 lot · pip = perubahan harga 1 pip · price = perkiraan harga
// (untuk notional & konversi pair non-USD). Konvensi umum MT4/MT5.
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
const LEVERAGES = [50, 100, 200, 300, 500, 1000]

const num = (s: string) => { const n = parseFloat(String(s).replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
const fmt = (n: number, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtLot = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function LotCalculatorPage() {
  const router = useRouter()
  const sub = useSubscription()

  const [symbol, setSymbol] = useState('XAU/USD')
  const [ccy, setCcy] = useState<'USD' | 'IDR'>('USD')
  const [usdIdr, setUsdIdr] = useState('16000')
  const [balance, setBalance] = useState('1000')
  const [riskMode, setRiskMode] = useState<'persen' | 'nominal'>('persen')
  const [risk, setRisk] = useState('1')
  const [sl, setSl] = useState('300')
  const [slUnit, setSlUnit] = useState<'pips' | 'harga'>('pips')
  const [rr, setRr] = useState('2')
  const [lev, setLev] = useState('500')
  const inst = useMemo(() => INSTRUMENTS.find(i => i.sym === symbol)!, [symbol])

  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace('/login?next=%2Flot-calculator')
  }, [sub.loading, sub.userId, router])

  // Semua hitungan internal dalam USD; tampilan dikonversi ke mata uang akun.
  const rate = num(usdIdr) || 16000
  const toUsd = (v: number) => ccy === 'IDR' ? v / rate : v
  const money = (usd: number, d = 2) => ccy === 'IDR' ? 'Rp ' + fmt(usd * rate, 0) : '$' + fmt(usd, d)
  const sym = ccy === 'IDR' ? 'Rp' : '$'

  const calc = useMemo(() => {
    const balUSD = toUsd(num(balance))
    const slv = num(sl), pr = inst.price
    const priceDist = slUnit === 'pips' ? slv * inst.pip : slv
    const pips = inst.pip > 0 ? priceDist / inst.pip : 0
    const quoteFactor = inst.quote === 'USD' ? 1 : (pr > 0 ? 1 / pr : 0)
    const pipValuePerLot = inst.pip * inst.contract * quoteFactor
    const lossPerLot = priceDist * inst.contract * quoteFactor
    const riskAmtUSD = riskMode === 'nominal' ? toUsd(num(risk)) : balUSD * num(risk) / 100
    const effRiskPct = balUSD > 0 ? riskAmtUSD / balUSD * 100 : 0
    const lotFor = (pct: number) => lossPerLot > 0 ? (balUSD * pct / 100) / lossPerLot : 0
    const lot = lossPerLot > 0 ? riskAmtUSD / lossPerLot : 0
    const notional = inst.quote === 'USD' ? lot * inst.contract * pr : lot * inst.contract
    const rrN = num(rr)
    const profitUSD = riskAmtUSD * rrN
    const levN = num(lev) || 1
    const marginUSD = notional / levN
    const marginPct = balUSD > 0 ? marginUSD / balUSD * 100 : 0
    const dd = (n: number) => (1 - Math.pow(1 - effRiskPct / 100, n)) * 100
    const valid = balUSD > 0 && riskAmtUSD > 0 && priceDist > 0 && lossPerLot > 0
    return { balUSD, priceDist, pips, pipValuePerLot, lossPerLot, riskAmtUSD, effRiskPct, lot, notional, profitUSD, marginUSD, marginPct, dd, lotFor, valid, rrN }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, risk, riskMode, sl, slUnit, rr, lev, ccy, usdIdr, inst])

  const verdict = useMemo(() => {
    const r = calc.effRiskPct
    if (r <= 0) return null
    if (r <= 1) return { t: 'Konservatif — aman', c: 'emerald', ic: ShieldCheck }
    if (r <= 2) return { t: 'Moderat — masih wajar', c: 'emerald', ic: ShieldCheck }
    if (r <= 3) return { t: 'Agak agresif — hati-hati', c: 'amber', ic: AlertTriangle }
    if (r <= 5) return { t: 'Agresif — berisiko tinggi', c: 'amber', ic: AlertTriangle }
    return { t: 'Sangat berisiko — hindari', c: 'red', ic: TrendingDown }
  }, [calc.effRiskPct])

  if (sub.loading || !sub.userId) return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>

  if (!sub.isPro) return (
    <div className="min-h-screen bg-[#060a09] text-white flex flex-col items-center justify-center px-5 text-center">
      <span className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/12 ring-1 ring-primary/25 mb-5"><Lock size={26} className="text-primary" /></span>
      <h1 className="text-2xl font-black tracking-tight">Kalkulator Lot — Khusus Pro</h1>
      <p className="text-sm text-white/55 mt-2 max-w-sm leading-relaxed">Hitung ukuran lot berbasis risiko, R:R, margin & saran lot aman untuk XAU/USD, forex, kripto & indeks. Buka dengan langganan Pro.</p>
      <div className="flex gap-2.5 mt-6">
        <Link href="/hub" className="inline-flex items-center gap-1.5 border border-white/15 text-white/80 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-white/5 transition-colors"><ArrowLeft size={15} /> Ke Hub</Link>
        <Link href="/upgrade" className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"><Crown size={15} /> Upgrade Pro</Link>
      </div>
    </div>
  )

  const vc = (c: string) => c === 'emerald' ? 'text-emerald-400 bg-emerald-500/12 border-emerald-500/25' : c === 'amber' ? 'text-amber-400 bg-amber-500/12 border-amber-500/25' : 'text-red-400 bg-red-500/12 border-red-500/25'
  const lotFloor = calc.lot > 0 && calc.lot < 0.01
  const seg = (on: boolean) => `rounded-md px-2.5 py-1 text-[10px] font-bold transition-colors ${on ? 'bg-primary text-primary-foreground' : 'text-white/45 hover:text-white/70'}`

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
            <p className="text-sm text-white/50">Sizing berbasis risiko + R:R, margin & drawdown — multi-pair.</p>
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

            {/* Mata uang akun */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Mata Uang Akun</label>
                <div className="flex gap-0.5 rounded-lg bg-black/30 p-0.5 border border-white/10">
                  {(['USD', 'IDR'] as const).map(c => <button key={c} onClick={() => setCcy(c)} className={seg(ccy === c)}>{c}</button>)}
                </div>
              </div>
              {ccy === 'IDR' && (
                <div className="mt-2 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[11px]">USD/IDR</span>
                  <input value={usdIdr} onChange={e => setUsdIdr(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-white/10 bg-black/30 pl-[68px] pr-3 py-2 text-sm font-bold tabular-nums outline-none focus:border-primary/50" />
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Saldo / Ekuitas Akun ({ccy})</label>
              <div className="mt-1.5 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">{sym}</span>
                <input value={balance} onChange={e => setBalance(e.target.value)} inputMode="decimal" className={`w-full rounded-xl border border-white/10 bg-black/30 ${ccy === 'IDR' ? 'pl-9' : 'pl-7'} pr-3 py-2.5 text-sm font-bold tabular-nums outline-none focus:border-primary/50`} />
              </div>
            </div>

            {/* Risiko: persen / nominal */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Risiko per Transaksi</label>
                <div className="flex gap-0.5 rounded-lg bg-black/30 p-0.5 border border-white/10">
                  {(['persen', 'nominal'] as const).map(m => <button key={m} onClick={() => setRiskMode(m)} className={seg(riskMode === m)}>{m === 'persen' ? '%' : sym}</button>)}
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="relative flex-1">
                  {riskMode === 'nominal' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">{sym}</span>}
                  <input value={risk} onChange={e => setRisk(e.target.value)} inputMode="decimal" className={`w-full rounded-xl border border-white/10 bg-black/30 ${riskMode === 'nominal' ? (ccy === 'IDR' ? 'pl-9' : 'pl-7') : 'pl-3'} pr-8 py-2.5 text-sm font-bold tabular-nums outline-none focus:border-primary/50`} />
                  {riskMode === 'persen' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">%</span>}
                </div>
                {riskMode === 'persen' && (
                  <div className="flex gap-1">{['0.5', '1', '2'].map(r => <button key={r} onClick={() => setRisk(r)} className={`rounded-md px-2 py-1.5 text-[10px] font-bold transition-colors ${risk === r ? 'bg-primary/25 text-primary' : 'bg-white/5 text-white/40 hover:text-white/70'}`}>{r}%</button>)}</div>
                )}
              </div>
              {riskMode === 'nominal' && calc.balUSD > 0 && <p className="text-[10px] text-white/40 mt-1.5">≈ {calc.effRiskPct.toFixed(2)}% dari saldo</p>}
            </div>

            {/* Stop Loss */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Stop Loss</label>
                <div className="flex gap-0.5 rounded-lg bg-black/30 p-0.5 border border-white/10">
                  {(['pips', 'harga'] as const).map(u => <button key={u} onClick={() => setSlUnit(u)} className={seg(slUnit === u)}>{u === 'harga' ? 'Jarak Harga' : 'Pips'}</button>)}
                </div>
              </div>
              <input value={sl} onChange={e => setSl(e.target.value)} inputMode="decimal" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm font-bold tabular-nums outline-none focus:border-primary/50" />
              <p className="text-[10px] text-white/40 mt-1.5">{slUnit === 'pips' ? `≈ jarak harga ${calc.priceDist.toFixed(inst.dec)}` : `≈ ${calc.pips.toLocaleString('en-US', { maximumFractionDigits: 1 })} pips`} · 1 pip = {inst.pip} harga</p>
            </div>

            {/* Pro: R:R + Leverage */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1"><Target size={11} /> Target (R:R)</label>
                <div className="mt-1.5 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">1:</span>
                  <input value={rr} onChange={e => setRr(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-white/10 bg-black/30 pl-8 pr-3 py-2.5 text-sm font-bold tabular-nums outline-none focus:border-primary/50" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1"><Layers size={11} /> Leverage</label>
                <select value={lev} onChange={e => setLev(e.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm font-bold outline-none focus:border-primary/50">
                  {LEVERAGES.map(l => <option key={l} value={l}>1:{l}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <Info size={13} className="text-white/40 shrink-0 mt-0.5" />
              <p className="text-[10px] text-white/45 leading-relaxed">Spesifikasi kontrak/pip mengikuti standar umum MT4/MT5. Nilai pip pair non-USD & notional pakai perkiraan harga bawaan — hasil bersifat estimasi, sesuaikan dengan brokermu.</p>
            </div>
          </div>

          {/* HASIL */}
          <div className="space-y-4">
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
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px]">
                      <span className="text-white/50">Rugi @ SL: <b className="text-red-400">{money(calc.riskAmtUSD)}</b></span>
                      <span className="text-white/50">Profit @ TP: <b className="text-emerald-400">{money(calc.profitUSD)}</b></span>
                      <span className="text-white/40">({calc.effRiskPct.toFixed(1)}% · R:R 1:{fmt(calc.rrN, calc.rrN % 1 ? 1 : 0)})</span>
                    </div>
                  </>
                ) : <p className="text-white/40 text-sm py-3">Lengkapi saldo, risiko & stop loss untuk melihat hasil.</p>}
              </div>
            </div>

            {verdict && (
              <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 ${vc(verdict.c)}`}>
                <verdict.ic size={16} className="shrink-0" />
                <p className="text-[12px] font-bold">Risiko {calc.effRiskPct.toFixed(1)}%: {verdict.t}</p>
              </div>
            )}

            {calc.valid && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 grid grid-cols-2 gap-3">
                {[
                  { l: 'Nilai per pip / lot', v: money(calc.pipValuePerLot) },
                  { l: 'Rugi per 1.0 lot @ SL', v: money(calc.lossPerLot) },
                  { l: 'Jarak SL', v: `${calc.pips.toLocaleString('en-US', { maximumFractionDigits: 1 })} pips` },
                  { l: 'Ukuran posisi (notional)', v: '$' + fmt(calc.notional, 0) },
                  { l: 'Margin dibutuhkan', v: money(calc.marginUSD, 0), warn: calc.marginPct > 30, extra: `${calc.marginPct.toFixed(1)}% saldo` },
                  { l: 'Potensi profit @ TP', v: money(calc.profitUSD), good: true },
                ].map(s => (
                  <div key={s.l} className="rounded-lg bg-black/20 p-2.5">
                    <p className="text-[9px] text-white/40 uppercase tracking-wider">{s.l}</p>
                    <p className={`text-sm font-black tabular-nums mt-0.5 ${s.good ? 'text-emerald-400' : s.warn ? 'text-amber-400' : ''}`}>{s.v}</p>
                    {s.extra && <p className={`text-[9px] mt-0.5 ${s.warn ? 'text-amber-400/80' : 'text-white/35'}`}>{s.extra}{s.warn ? ' · margin besar' : ''}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Saran lot aman */}
            {calc.valid && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
                  <Gauge size={14} className="text-primary" />
                  <p className="text-[12px] font-bold">Saran Lot Aman</p>
                  <span className="ml-auto text-[9px] text-white/35">per SL {calc.pips.toFixed(0)} pips</span>
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {[{ p: 0.5, t: 'Konservatif' }, { p: 1, t: 'Moderat' }, { p: 2, t: 'Agresif' }].map(row => {
                    const active = riskMode === 'persen' && Math.abs(num(risk) - row.p) < 0.001
                    return (
                      <div key={row.p} className={`flex items-center justify-between px-4 py-2.5 ${active ? 'bg-primary/[0.06]' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold tabular-nums ${row.p <= 1 ? 'text-emerald-400' : 'text-amber-400'}`}>{row.p}%</span>
                          <span className="text-[11px] text-white/50">{row.t}</span>
                          {active && <span className="text-[8px] font-bold uppercase rounded-full bg-primary/20 text-primary px-1.5 py-0.5">pilihanmu</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-white/40 tabular-nums">{money(calc.balUSD * row.p / 100)}</span>
                          <span className="text-[13px] font-black tabular-nums w-14 text-right">{fmtLot(calc.lotFor(row.p))}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Insight drawdown loss beruntun */}
            {calc.valid && calc.effRiskPct > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-[12px] font-bold flex items-center gap-1.5 mb-2.5"><TrendingDown size={14} className="text-red-400" /> Kalau Kena Loss Beruntun</p>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 5, 10].map(n => {
                    const d = calc.dd(n)
                    return (
                      <div key={n} className="rounded-lg bg-black/20 p-2.5 text-center">
                        <p className="text-[9px] text-white/40">{n}x rugi</p>
                        <p className={`text-lg font-black tabular-nums ${d > 30 ? 'text-red-400' : d > 15 ? 'text-amber-400' : 'text-white/80'}`}>−{d.toFixed(1)}%</p>
                        <p className="text-[9px] text-white/35">ekuitas</p>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-white/35 mt-2.5 leading-relaxed">Rekomendasi umum: risiko <b className="text-white/60">≤1–2%</b> per transaksi agar tahan rentetan rugi. Makin besar risiko, makin cepat akun terkuras.</p>
              </div>
            )}
          </div>
        </div>

        <p className="text-[10px] text-white/25 mt-6 text-center max-w-lg mx-auto leading-relaxed">Alat bantu hitung, bukan nasihat keuangan. Ukuran lot final selalu sesuaikan dengan spesifikasi & lot minimum brokermu.</p>
      </main>
    </div>
  )
}
