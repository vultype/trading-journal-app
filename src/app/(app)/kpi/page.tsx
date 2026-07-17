'use client'

import { useCurrency } from '@/hooks/useCurrency'
import { KpiProjector } from '@/app/(app)/simulator/page'
import { LineChart } from 'lucide-react'

// KPI Projection — dipisah dari Strategy Backtesting, jadi tool tersendiri (diakses dari Hub).
export default function KpiPage() {
  const fmt = useCurrency()
  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10"><LineChart size={20} className="text-primary" /></div>
        <div>
          <h1 className="text-xl font-bold">KPI Projection Tools</h1>
          <p className="text-sm text-muted-foreground">Proyeksikan pertumbuhan equity dari target & KPI trading kamu</p>
        </div>
      </div>
      <KpiProjector fmt={fmt} />
    </div>
  )
}
