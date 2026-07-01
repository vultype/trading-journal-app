export type AccountType = 'personal' | 'trading'

export type Account = {
  id: string
  name: string
  type: AccountType
  broker?: string
  currency: string
  created_at: string
}

export type TransferType = 'deposit' | 'withdraw'

export type Transfer = {
  id: string
  from_account_id: string
  to_account_id: string
  type: TransferType
  amount: number
  note?: string
  date: string
  created_at: string
}

export type TradeDirection = 'long' | 'short'
export type TradeResult  = 'win' | 'loss' | 'breakeven'

export type Trade = {
  id: string
  account_id: string
  date: string
  entry_time?: string        // HH:MM
  pair: string
  direction: TradeDirection
  result: TradeResult
  pnl: number                // nominal profit/loss
  strategy?: string
  followed_plan?: boolean    // yes = ikut trading plan
  know_direction?: boolean   // yes = tahu arah pasar
  screenshot_url?: string
  note?: string
  market_structure?: 'bullish' | 'bearish' | 'ranging'
  is_overtrade?: boolean
  created_at: string
  // legacy fields (kept optional for backward compat)
  entry_price?: number
  exit_price?: number
  lot_size?: number
  risk_amount?: number
  rr_ratio?: number
  fees?: number
  emotion?: string
}

export type JournalNote = {
  id: string
  date: string
  content: string
  mood: 1 | 2 | 3 | 4 | 5
  created_at: string
}

export type AppSettings = {
  currency: 'USD' | 'IDR' | 'EUR' | 'USDT'
  strategies: string[]
  defaultAccountId?: string
  targetBulanan?: number
}

export type DashboardStats = {
  total_trades: number
  win_rate: number
  total_pnl: number
  profit_factor: number
  avg_win: number
  avg_loss: number
  max_drawdown: number
  expectancy: number
  trading_capital: number
  total_deposited: number
  total_withdrawn: number
  net_profit: number
  win_streak: number
  loss_streak: number
  current_streak: number
  current_streak_type: 'win' | 'loss' | 'none'
}
