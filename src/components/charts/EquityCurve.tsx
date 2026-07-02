'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type Point = { date: string; balance: number }

export function EquityCurve({
  data,
  fmt,
  startBalance = 0,
}: {
  data: Point[]
  fmt?: (n: number) => string
  startBalance?: number
}) {
  const lastBal = data[data.length - 1]?.balance ?? 0
  const isProfit = lastBal >= startBalance
  const color = isProfit ? '#10b981' : '#ef4444'
  const fmtVal = fmt ?? ((v: number) => v.toLocaleString())

  const renderDot = (props: any) => {
    if (props.index !== data.length - 1) return <g key={props.index} />
    return (
      <circle
        key={props.index}
        cx={props.cx}
        cy={props.cy}
        r={4}
        fill={color}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={1.5}
      />
    )
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #05100a 0%, #020806 100%)' }}
    >
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 24, right: 12, bottom: 8, left: 0 }}>
          <defs>
            <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              background: 'rgba(5,15,10,0.95)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: '#e2e8f0',
            }}
            labelStyle={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginBottom: 2 }}
            formatter={(v: any) => [fmtVal(Number(v)), 'Equity']}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={color}
            strokeWidth={1.5}
            fill="url(#eq-fill)"
            dot={renderDot as any}
            activeDot={{ r: 4, fill: color, stroke: 'rgba(255,255,255,0.7)', strokeWidth: 1.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
