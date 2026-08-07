export type Account = {
  id: string
  name: string
  broker?: string
  currency: string
  initial_balance: number   // saldo awal broker (real/prop/funded/demo)
  created_at: string
}

// deposit/withdraw = arus modal (amount selalu positif, arah dari jenisnya).
// adjust_* = rekonsiliasi dengan saldo asli broker (amount BOLEH negatif):
//   adjust_cost  → biaya trading tak tercatat (swap/komisi). Ikut mengurangi
//                  hasil trading bersih & ROI, karena ini kerugian nyata dari
//                  aktivitas trading — bukan setoran modal.
//   adjust_other → koreksi netral (bonus, rebate, salah input). Menggeser
//                  saldo tanpa menyentuh statistik performa.
export type TransferType = 'deposit' | 'withdraw' | 'adjust_cost' | 'adjust_other'

export const isAdjustment = (t: TransferType) => t === 'adjust_cost' || t === 'adjust_other'

// Log dana satu-akun (deposit masuk / withdraw keluar dari satu akun broker)
export type Transfer = {
  id: string
  account_id: string
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
  language?: 'id' | 'en'
  strategies: string[]
  defaultAccountId?: string
  targetHarian?: number
  targetMingguan?: number
  targetBulanan?: number
  displayName?: string
  defaultPair?: string
  weekStartsMonday?: boolean
  onboarded?: boolean
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
  trading_capital: number   // saldo sekarang = starting_balance + deposit − withdraw + pnl + penyesuaian
  starting_balance: number  // total saldo awal semua akun
  total_deposited: number
  total_withdrawn: number
  // Rekonsiliasi dengan saldo asli broker (lihat catatan di TransferType).
  adjust_cost: number       // biaya tak tercatat (swap/komisi) — biasanya negatif
  adjust_other: number      // koreksi netral (bonus/rebate/salah input)
  net_pnl: number           // total_pnl + adjust_cost = hasil trading SEBENARNYA
  win_streak: number
  loss_streak: number
  current_streak: number
  current_streak_type: 'win' | 'loss' | 'none'
}
