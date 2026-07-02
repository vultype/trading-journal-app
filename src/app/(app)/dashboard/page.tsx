'use client'

import { useStore } from '@/lib/store'
import { calcStats, buildEquityCurve, formatCurrency } from '@/lib/calculations'
import { EquityCurve } from '@/components/charts/EquityCurve'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, TrendingDown, Wallet, Target, BarChart2, Activity, CalendarRange } from 'lucide-react'

function StatCard({ label, value, sub, positive, icon: Icon }: {
  label: string; value: string; sub?: string; positive?: boolean | null; icon?: React.ElementType
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
            <p className={`text-2xl font-bold ${positive === true ? 'text-emerald-600' : positive === false ? 'text-red-500' : ''}`}>
              {value}
            </p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          {Icon && <div className="p-2 rounded-lg bg-muted"><Icon size={16} className="text-muted-foreground" /></div>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { trades, transfers, settings } = useStore()
  const stats = calcStats(trades, transfers)
  const fmt = (n: number) => formatCurrency(n, settings.currency)
  const startBalance = stats.total_deposited - stats.total_withdrawn
  const curve = buildEquityCurve([...trades].sort((a, b) => a.date.localeCompare(b.date)), startBalance)
  const recentTrades = [...trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)

  // Monthly target progress
  const monthStr = new Date().toISOString().slice(0, 7)
  const monthPnl = trades.filter(t => t.date.startsWith(monthStr)).reduce((s, t) => s + t.pnl, 0)
  const { targetBulanan = 0 } = settings
  const hasTargets = targetBulanan > 0

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your trading performance overview</p>
      </div>

      {trades.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <BarChart2 size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium text-muted-foreground">No trades yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to <strong>Trades</strong> to log your first position
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Trading Capital" value={fmt(stats.trading_capital)} sub={`Deposited ${fmt(stats.total_deposited)}`} icon={Wallet} />
            <StatCard label="Net Profit" value={fmt(stats.net_profit)} sub="Withdrawn − Deposited" positive={stats.net_profit >= 0} icon={TrendingUp} />
            <StatCard label="Total P&L" value={fmt(stats.total_pnl)} positive={stats.total_pnl >= 0} icon={Activity} />
            <StatCard label="Win Rate" value={`${stats.win_rate.toFixed(1)}%`} sub={`${stats.total_trades} trades`} positive={stats.win_rate >= 50} icon={Target} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Profit Factor" value={stats.profit_factor === Infinity ? '∞' : stats.profit_factor.toFixed(2)} positive={stats.profit_factor >= 1.5} />
            <StatCard label="Avg Win" value={fmt(stats.avg_win)} positive={true} />
            <StatCard label="Max Drawdown" value={fmt(stats.max_drawdown)} positive={false} />
            <StatCard label="Expectancy" value={fmt(stats.expectancy)} sub="per trade" positive={stats.expectancy > 0} />
          </div>

          {/* Monthly Target */}
          {hasTargets && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><CalendarRange size={14}/> Monthly Target</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">This month</span>
                    <span className={monthPnl >= targetBulanan ? 'text-emerald-400 font-bold' : ''}>
                      {Math.min(100, Math.max(0, Math.round(monthPnl / targetBulanan * 100)))}%
                    </span>
                  </div>
                  <Progress value={Math.min(100, Math.max(0, monthPnl / targetBulanan * 100))} className="h-2"/>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{fmt(monthPnl)}</span>
                    <span>{fmt(targetBulanan)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Equity Curve</CardTitle>
            </CardHeader>
            <CardContent>
              {curve.length > 1
                ? <EquityCurve data={curve} fmt={fmt} startBalance={startBalance} />
                : <p className="text-sm text-muted-foreground text-center py-8">Butuh minimal 2 trade untuk tampilkan grafik</p>
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Recent Trades</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {recentTrades.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Badge variant={t.direction === 'long' ? 'default' : 'destructive'} className="text-xs gap-1">
                        {t.direction === 'long' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {t.direction.toUpperCase()}
                      </Badge>
                      <div>
                        <p className="font-semibold">{t.pair}</p>
                        <p className="text-xs text-muted-foreground">{t.date}{t.strategy ? ` · ${t.strategy}` : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${t.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(t.pnl)}</p>
                      {t.rr_ratio != null && <p className="text-xs text-muted-foreground">RR {t.rr_ratio.toFixed(1)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
