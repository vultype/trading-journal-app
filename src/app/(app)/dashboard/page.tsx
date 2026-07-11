'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { calcStats, buildEquityCurve, formatCurrency } from '@/lib/calculations'
import { useT } from '@/lib/i18n'
import { EquityCurve } from '@/components/charts/EquityCurve'
import { ScoreRadar, NetDailyPnL, DrawdownChart } from '@/components/charts/DashboardWidgets'
import { TradeTimeScatter, DaySummaryTable, InsightsCard } from '@/components/charts/AnalyticsWidgets'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { InfoTip } from '@/components/ui/info-tip'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Wallet, Target, Activity, Sparkles, Check } from 'lucide-react'

function FirstTradeCard({ accountId }: { accountId?: string }) {
  const { addTrade, settings } = useStore()
  const t = useT()
  const [pair, setPair]         = useState(settings.defaultPair || 'XAUUSD')
  const [direction, setDir]     = useState<'long' | 'short'>('long')
  const [result, setResult]     = useState<'win' | 'loss' | 'breakeven'>('win')
  const [pnl, setPnl]           = useState<number | ''>('')
  const [date, setDate]         = useState(new Date().toISOString().split('T')[0])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!accountId || pnl === '' || Number(pnl) <= 0) return
    addTrade({
      account_id: accountId,
      date, pair, direction, result,
      pnl: result === 'loss' ? -Math.abs(Number(pnl)) : Math.abs(Number(pnl)),
    })
  }

  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles size={14} className="text-primary" /> Catat Trade Pertama Kamu
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          Menu lain akan terbuka otomatis setelah kamu mencatat trade pertama.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pair</Label>
              <Input value={pair} onChange={e => setPair(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('Tanggal')}</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Arah</Label>
            <div className="flex gap-2">
              {(['long', 'short'] as const).map(d => (
                <button key={d} type="button" onClick={() => setDir(d)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-all ${direction === d ? (d === 'long' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400') : 'border-border/50 text-muted-foreground'}`}>
                  {d === 'long' ? '↑ Long' : '↓ Short'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Hasil</Label>
            <div className="flex gap-2">
              {(['win', 'loss', 'breakeven'] as const).map(r => (
                <button key={r} type="button" onClick={() => setResult(r)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-all ${result === r ? (r === 'win' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : r === 'loss' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400') : 'border-border/50 text-muted-foreground'}`}>
                  {r === 'win' ? '✓ Win' : r === 'loss' ? '✗ Loss' : '= BE'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">P&L ({settings.currency})</Label>
            <CurrencyInput value={pnl} onChange={setPnl} placeholder="0" />
            <p className="text-[10px] text-muted-foreground">Masukkan angka positif — tanda +/− otomatis dari Hasil</p>
          </div>

          <Button type="submit" className="w-full" disabled={!accountId || !pnl || Number(pnl) <= 0}>
            Simpan Trade Pertama
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function StatCard({ label, value, sub, positive, icon: Icon, accent, tip }: {
  label: string; value: string; sub?: string; positive?: boolean | null; icon?: React.ElementType
  accent?: 'primary' | 'emerald' | 'red' | 'violet'; tip?: string
}) {
  const accentMap = {
    primary: { icon: 'bg-primary/15 text-primary', grad: 'from-primary/8' },
    emerald: { icon: 'bg-emerald-500/15 text-emerald-400', grad: 'from-emerald-500/8' },
    red:     { icon: 'bg-red-500/15 text-red-400', grad: 'from-red-500/8' },
    violet:  { icon: 'bg-violet-500/15 text-violet-400', grad: 'from-violet-500/8' },
  }
  const a = accent ? accentMap[accent] : { icon: 'bg-muted text-muted-foreground', grad: 'from-muted/40' }
  return (
    <Card className={`relative overflow-hidden transition-all hover:border-border hover:shadow-md bg-gradient-to-br ${a.grad} via-transparent to-transparent`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1">
              {label}{tip && <InfoTip text={tip} />}
            </p>
            <p className={`text-2xl font-black tracking-tight truncate ${positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : ''}`}>
              {value}
            </p>
            {sub && <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
          </div>
          {Icon && <div className={`p-2 rounded-lg shrink-0 ${a.icon}`}><Icon size={16} /></div>}
        </div>
      </CardContent>
    </Card>
  )
}

function OnboardingChecklist({ steps }: { steps: { done: boolean; label: string; href: string }[] }) {
  const doneCount = steps.filter(s => s.done).length
  if (doneCount === steps.length) return null
  const pct = Math.round(doneCount / steps.length * 100)
  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/8 to-transparent">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold flex items-center gap-2"><Sparkles size={14} className="text-primary" /> Langkah Awal</p>
          <span className="text-xs text-muted-foreground">{doneCount}/{steps.length} selesai</span>
        </div>
        <Progress value={pct} className="h-1.5 mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {steps.map((s, i) => (
            <Link key={i} href={s.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${s.done ? 'text-muted-foreground/60' : 'hover:bg-muted/50'}`}>
              <span className={`flex items-center justify-center w-4 h-4 rounded-full shrink-0 ${s.done ? 'bg-emerald-500 text-white' : 'border border-border'}`}>
                {s.done && <Check size={10} />}
              </span>
              <span className={s.done ? 'line-through' : 'font-medium'}>{s.label}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { trades, transfers, accounts, journalNotes, settings } = useStore()
  const stats = calcStats(trades, transfers, accounts)
  const fmt = (n: number) => formatCurrency(n, settings.currency)
  const t = useT()
  const startBalance = stats.trading_capital - stats.total_pnl
  const equityBase = stats.starting_balance + stats.total_deposited - stats.total_withdrawn
  const curve = buildEquityCurve([...trades].sort((a, b) => a.date.localeCompare(b.date)), startBalance)
  const recentTrades = [...trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 11) return t('Selamat pagi')
    if (h < 15) return t('Selamat siang')
    if (h < 19) return t('Selamat sore')
    return t('Selamat malam')
  })()
  const name = settings.displayName || 'Trader'

  const onboardSteps = [
    { done: !!settings.displayName,      label: 'Lengkapi profil',       href: '/settings' },
    { done: accounts.length > 0,         label: 'Tambah akun broker',    href: '/settings' },
    { done: trades.length > 0,           label: 'Catat trade pertama',   href: '/dashboard' },
    { done: (settings.targetBulanan ?? 0) > 0, label: 'Set target bulanan', href: '/settings' },
    { done: journalNotes.length > 0,     label: 'Tulis jurnal pertama',  href: '/journal' },
  ]

  // Reminder/notifikasi sederhana
  const todayStr = new Date().toISOString().split('T')[0]
  const tradedToday = trades.some(t => t.date === todayStr)
  const journaledToday = journalNotes.some(n => n.date === todayStr)
  const showJournalReminder = tradedToday && !journaledToday

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{greeting}, {name} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('Ringkasan performa trading kamu')}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString(settings.language === 'en' ? 'en-US' : 'id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {trades.length === 0 ? (
        <FirstTradeCard accountId={accounts[0]?.id} />
      ) : (
        <>
          <OnboardingChecklist steps={onboardSteps} />

          {showJournalReminder && (
            <Link href="/journal" className="block">
              <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 hover:bg-amber-500/15 transition-colors">
                <span className="text-lg">🔔</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-400">Kamu trading hari ini — belum menulis jurnal</p>
                  <p className="text-xs text-muted-foreground">Refleksikan trade hari ini selagi masih segar. Klik untuk menulis.</p>
                </div>
                <span className="text-amber-400 text-xs font-semibold shrink-0">Tulis →</span>
              </div>
            </Link>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label={t('Saldo Trading')} value={fmt(stats.trading_capital)} sub={t('Saldo di broker saat ini')} icon={Wallet} accent="primary" />
            <StatCard label={t('Total Deposit')} value={fmt(stats.total_deposited)} sub={`${t('Withdraw')} ${fmt(stats.total_withdrawn)}`} icon={TrendingUp} accent="violet" />
            <StatCard label={t('Profit Trading')} value={fmt(stats.total_pnl)} positive={stats.total_pnl >= 0} icon={Activity} accent={stats.total_pnl >= 0 ? 'emerald' : 'red'} />
            <StatCard label={t('Win Rate')} value={`${stats.win_rate.toFixed(1)}%`} sub={`${stats.total_trades} ${t('trade')}`} positive={stats.win_rate >= 50} icon={Target} accent={stats.win_rate >= 50 ? 'emerald' : 'red'} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Profit Factor" value={stats.profit_factor === Infinity ? '∞' : stats.profit_factor.toFixed(2)} positive={stats.profit_factor >= 1.5} tip="Total profit dibagi total loss. Di atas 1 = untung, di atas 2 = sangat sehat." />
            <StatCard label="Avg Win" value={fmt(stats.avg_win)} positive={true} tip="Rata-rata keuntungan per trade yang menang." />
            <StatCard label="Max Drawdown" value={fmt(stats.max_drawdown)} positive={false} tip="Penurunan terbesar equity dari puncak ke lembah. Makin kecil makin baik." />
            <StatCard label="Expectancy" value={fmt(stats.expectancy)} sub="per trade" positive={stats.expectancy > 0} tip="Perkiraan profit rata-rata yang kamu hasilkan per trade dalam jangka panjang." />
          </div>

          {/* Score + Equity Curve (equity ditukar ke sini) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <ScoreRadar stats={stats} trades={trades} equityBase={equityBase} />
            <Card className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  {t('Equity Curve')} <InfoTip text="Perkembangan total saldo trading dari waktu ke waktu. Hover untuk lihat nominal & % perubahan." />
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center">
                {curve.length > 1
                  ? <EquityCurve data={curve} fmt={fmt} startBalance={startBalance} />
                  : <p className="text-sm text-muted-foreground text-center py-8">{t('Butuh minimal 2 trade untuk tampilkan grafik')}</p>
                }
              </CardContent>
            </Card>
          </div>

          {/* Insight Otomatis + Net P&L Harian (insight ditukar ke sini) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <InsightsCard trades={trades} stats={stats} fmt={fmt} />
            <NetDailyPnL trades={trades} fmt={fmt} />
          </div>

          {/* Trade time performance + day summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <TradeTimeScatter trades={trades} fmt={fmt} />
            <DaySummaryTable trades={trades} fmt={fmt} />
          </div>

          {/* Drawdown */}
          <DrawdownChart trades={trades} fmt={fmt} />
        </>
      )}
    </div>
  )
}
