'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

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
      <circle key={props.index} cx={props.cx} cy={props.cy} r={4}
        fill={color} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
    )
  }

  // Custom tooltip: tanggal + nominal + % change dari saldo awal
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const bal = Number(payload[0].value)
    const change = bal - startBalance
    const pct = startBalance !== 0 ? (change / Math.abs(startBalance)) * 100 : 0
    const up = change >= 0
    const c = up ? '#34d399' : '#f87171'
    return (
      <div className="rounded-xl px-3 py-2 shadow-xl" style={{ background: 'rgba(5,15,10,0.96)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 4 }}>{label}</p>
        <p style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>{fmtVal(bal)}</p>
        <p style={{ color: c, fontSize: 11, fontWeight: 600, marginTop: 2 }}>
          {up ? '▲' : '▼'} {up ? '+' : ''}{fmtVal(change)} ({up ? '+' : ''}{pct.toFixed(2)}%)
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(180deg, #05100a 0%, #020806 100%)' }}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 24, right: 16, bottom: 4, left: 8 }}>
          <defs>
            <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
            tickFormatter={(v) => String(v).slice(5)}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => fmtVal(Number(v))}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeDasharray: '3 3' }} />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={color}
            strokeWidth={2}
            fill="url(#eq-fill)"
            dot={renderDot as any}
            activeDot={{ r: 5, fill: color, stroke: 'rgba(255,255,255,0.8)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
