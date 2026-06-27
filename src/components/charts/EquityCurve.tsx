'use client'

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'

type Point = { date: string; balance: number }

export function EquityCurve({ data }: { data: Point[] }) {
  const isProfit = (data[data.length - 1]?.balance ?? 0) >= 0

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity={0.15} />
            <stop offset="95%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Saldo']}
        />
        <ReferenceLine y={0} stroke="#e5e7eb" />
        <Area
          type="monotone"
          dataKey="balance"
          stroke={isProfit ? '#10b981' : '#ef4444'}
          strokeWidth={2}
          fill="url(#eq)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
