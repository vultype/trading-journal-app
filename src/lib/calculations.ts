import type { Trade, Transfer, Account, DashboardStats, AppSettings } from '@/types'

export function calcStats(trades: Trade[], transfers: Transfer[], accounts: Account[] = []): DashboardStats {
  // Overtrades affect equity (total_pnl) but are excluded from all performance metrics
  const normal = trades.filter(t => !t.is_overtrade)

  const total_trades = normal.length
  const wins   = normal.filter(t => t.result === 'win')
  const losses = normal.filter(t => t.result === 'loss')

  const win_rate     = total_trades > 0 ? (wins.length / total_trades) * 100 : 0
  const total_pnl    = trades.reduce((s, t) => s + t.pnl, 0)   // all trades → equity
  const gross_profit = wins.reduce((s, t) => s + t.pnl, 0)
  const gross_loss   = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const avg_win      = wins.length   > 0 ? gross_profit / wins.length   : 0
  const avg_loss     = losses.length > 0 ? gross_loss   / losses.length : 0
  const profit_factor = gross_loss > 0 ? gross_profit / gross_loss : gross_profit > 0 ? Infinity : 0
  const expectancy   = total_trades > 0 ? (win_rate / 100) * avg_win - ((100 - win_rate) / 100) * avg_loss : 0

  // Drawdown uses all trades (equity impact)
  let peak = 0, max_drawdown = 0, running = 0
  for (const t of trades) {
    running += t.pnl
    if (running > peak) peak = running
    const dd = peak - running
    if (dd > max_drawdown) max_drawdown = dd
  }

  // Streaks use only normal trades
  let win_streak = 0, loss_streak = 0, cur = 0, curType: 'win' | 'loss' | 'none' = 'none'
  const sorted = [...normal].sort((a, b) => a.date.localeCompare(b.date))
  for (const t of sorted) {
    if (t.result === 'win') {
      cur = curType === 'win' ? cur + 1 : 1; curType = 'win'
      win_streak = Math.max(win_streak, cur)
    } else if (t.result === 'loss') {
      cur = curType === 'loss' ? cur + 1 : 1; curType = 'loss'
      loss_streak = Math.max(loss_streak, cur)
    } else { cur = 0; curType = 'none' }
  }

  const current_streak      = cur
  const current_streak_type = curType

  const deposits    = transfers.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  const withdrawals = transfers.filter(t => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0)
  const starting_balance = accounts.reduce((s, a) => s + (a.initial_balance ?? 0), 0)

  return {
    total_trades, win_rate, total_pnl, profit_factor, avg_win, avg_loss,
    max_drawdown, expectancy,
    trading_capital: starting_balance + deposits - withdrawals + total_pnl,
    starting_balance,
    total_deposited: deposits,
    total_withdrawn: withdrawals,
    win_streak, loss_streak, current_streak, current_streak_type,
  }
}

export function buildEquityCurve(trades: Trade[], startBalance = 0) {
  let balance = startBalance
  return trades.map(t => ({ date: t.date, balance: (balance += t.pnl), pnl: t.pnl }))
}

export function formatCurrency(amount: number, currency: AppSettings['currency'] = 'USD') {
  if (currency === 'IDR') {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
  }
  if (currency === 'USDT') {
    return `${amount >= 0 ? '' : '-'}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
}

export function pnlByGroup(trades: Trade[], groupFn: (t: Trade) => string) {
  const map: Record<string, { wins: number; losses: number; pnl: number; total: number }> = {}
  for (const t of trades.filter(t => !t.is_overtrade)) {
    const key = groupFn(t) || '—'
    if (!map[key]) map[key] = { wins: 0, losses: 0, pnl: 0, total: 0 }
    map[key].total++
    map[key].pnl += t.pnl
    if (t.result === 'win')  map[key].wins++
    if (t.result === 'loss') map[key].losses++
  }
  return Object.entries(map).map(([name, v]) => ({
    name,
    winRate: v.total > 0 ? Math.round((v.wins / v.total) * 100) : 0,
    pnl: v.pnl,
    total: v.total,
    wins: v.wins,
  }))
}

export const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
export const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des']
