'use client'

import { useMemo, useState } from 'react'
import { Clock, TrendingUp, TrendingDown, Sparkles, AlertTriangle } from 'lucide-react'
import type { Trade } from '@/types'

type HourBucket = {
  hour: number
  total: number
  wins: number
  losses: number
  pnl: number
  winRate: number
  trades: Trade[]
}

type Session = { key: string; label: string; emoji: string; from: number; to: number }
const SESSIONS: Session[] = [
  { key: 'asia',   label: 'Asia',   emoji: '🌏', from: 0,  to: 8 },
  { key: 'london', label: 'London', emoji: '🇬🇧', from: 8,  to: 15 },
  { key: 'ny',     label: 'New York', emoji: '🗽', from: 15, to: 21 },
  { key: 'late',   label: 'Late/Sydney', emoji: '🌙', from: 21, to: 24 },
]

export function HourAnalysis({ trades, fmt }: { trades: Trade[]; fmt: (n: number) => string }) {
  const [selected, setSelected] = useState<number | null>(null)

  const withTime = useMemo(() => trades.filter(t => t.entry_time && /^\d{1,2}:/.test(t.entry_time)), [trades])

  const buckets = useMemo<HourBucket[]>(() => {
    const map: Record<number, HourBucket> = {}
    for (let h = 0; h < 24; h++) map[h] = { hour: h, total: 0, wins: 0, losses: 0, pnl: 0, winRate: 0, trades: [] }
    for (const t of withTime) {
      const h = parseInt(t.entry_time!.slice(0, 2))
      if (isNaN(h) || h < 0 || h > 23) continue
      const b = map[h]
      b.total++; b.pnl += t.pnl; b.trades.push(t)
      if (t.result === 'win') b.wins++
      if (t.result === 'loss') b.losses++
    }
    Object.values(map).forEach(b => { b.winRate = b.total > 0 ? Math.round(b.wins / b.total * 100) : 0 })
    return Object.values(map)
  }, [withTime])

  const active = buckets.filter(b => b.total > 0)
  const maxAbsPnl = Math.max(1, ...active.map(b => Math.abs(b.pnl)))

  const bestHour  = active.length > 0 ? active.reduce((a, b) => b.pnl > a.pnl ? b : a) : null
  const worstHour = active.length > 0 ? active.reduce((a, b) => b.pnl < a.pnl ? b : a) : null

  const sessionStats = useMemo(() => SESSIONS.map(s => {
    const bs = buckets.filter(b => b.hour >= s.from && b.hour < s.to)
    const total  = bs.reduce((n, b) => n + b.total, 0)
    const wins   = bs.reduce((n, b) => n + b.wins, 0)
    const pnl    = bs.reduce((n, b) => n + b.pnl, 0)
    return { ...s, total, wins, pnl, winRate: total > 0 ? Math.round(wins / total * 100) : 0 }
  }), [buckets])

  const bestSession = sessionStats.filter(s => s.total > 0).sort((a, b) => b.pnl - a.pnl)[0] ?? null

  if (withTime.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
        <Clock size={28} className="opacity-40" />
        <p className="text-sm font-medium">Belum ada data jam</p>
        <p className="text-xs">Isi kolom <strong>Entry Time</strong> saat mencatat trade untuk melihat analisa jam terbaik.</p>
      </div>
    )
  }

  const sel = selected !== null ? buckets[selected] : null

  function cellColor(b: HourBucket) {
    if (b.total === 0) return 'bg-muted/20 border-transparent text-muted-foreground/30'
    const intensity = Math.min(1, Math.abs(b.pnl) / maxAbsPnl)
    const strong = intensity > 0.5
    if (b.pnl > 0) return strong ? 'bg-emerald-500/30 border-emerald-500/40 text-emerald-300' : 'bg-emerald-500/12 border-emerald-500/25 text-emerald-400'
    if (b.pnl < 0) return strong ? 'bg-red-500/30 border-red-500/40 text-red-300' : 'bg-red-500/12 border-red-500/25 text-red-400'
    return 'bg-yellow-500/12 border-yellow-500/25 text-yellow-400'
  }

  return (
    <div className="space-y-5">
      {/* Highlight cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {bestHour && bestHour.pnl > 0 && (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={13} className="text-emerald-400" />
              <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-400/70">Jam Terbaik</p>
            </div>
            <p className="text-2xl font-black text-emerald-400">{String(bestHour.hour).padStart(2, '0')}:00</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {bestHour.winRate}% WR · {bestHour.total}x · <span className="text-emerald-400 font-semibold">+{fmt(bestHour.pnl)}</span>
            </p>
          </div>
        )}
        {worstHour && worstHour.pnl < 0 && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle size={13} className="text-red-400" />
              <p className="text-[10px] uppercase tracking-widest font-bold text-red-400/70">Jam Terburuk</p>
            </div>
            <p className="text-2xl font-black text-red-400">{String(worstHour.hour).padStart(2, '0')}:00</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {worstHour.winRate}% WR · {worstHour.total}x · <span className="text-red-400 font-semibold">{fmt(worstHour.pnl)}</span>
            </p>
          </div>
        )}
        {bestSession && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={13} className="text-primary" />
              <p className="text-[10px] uppercase tracking-widest font-bold text-primary/70">Sesi Terbaik</p>
            </div>
            <p className="text-2xl font-black">{bestSession.emoji} {bestSession.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {bestSession.winRate}% WR · {bestSession.total}x · <span className={bestSession.pnl >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>{bestSession.pnl >= 0 ? '+' : ''}{fmt(bestSession.pnl)}</span>
            </p>
          </div>
        )}
      </div>

      {/* Hour heat grid */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Klik jam untuk lihat detail — warna = besarnya P&L</p>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
          {buckets.map(b => (
            <button
              key={b.hour}
              type="button"
              disabled={b.total === 0}
              onClick={() => setSelected(selected === b.hour ? null : b.hour)}
              className={[
                'aspect-square rounded-lg border flex flex-col items-center justify-center transition-all',
                cellColor(b),
                b.total > 0 ? 'cursor-pointer hover:scale-105' : 'cursor-default',
                selected === b.hour ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : '',
              ].join(' ')}
              title={`${String(b.hour).padStart(2, '0')}:00 — ${b.total} trade`}
            >
              <span className="text-[10px] font-bold leading-none">{String(b.hour).padStart(2, '0')}</span>
              {b.total > 0 && <span className="text-[8px] opacity-70 leading-none mt-0.5">{b.total}x</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Selected hour detail */}
      {sel && sel.total > 0 && (
        <div className="rounded-xl border border-border/50 bg-muted/15 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm flex items-center gap-2">
              <Clock size={14} className="text-primary" />
              Jam {String(sel.hour).padStart(2, '0')}:00 – {String((sel.hour + 1) % 24).padStart(2, '0')}:00
            </p>
            <span className={`text-lg font-black ${sel.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {sel.pnl >= 0 ? '+' : ''}{fmt(sel.pnl)}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { l: 'Trade', v: String(sel.total) },
              { l: 'Win', v: String(sel.wins), c: 'text-emerald-400' },
              { l: 'Loss', v: String(sel.losses), c: 'text-red-400' },
              { l: 'Win Rate', v: `${sel.winRate}%`, c: sel.winRate >= 50 ? 'text-emerald-400' : 'text-red-400' },
            ].map(s => (
              <div key={s.l} className="rounded-lg bg-background/50 py-2">
                <p className={`text-lg font-black ${s.c ?? ''}`}>{s.v}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.l}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sel.trades.map(t => (
              <span key={t.id} className={`text-[10px] px-2 py-1 rounded-full border font-medium ${t.pnl >= 0 ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-red-500/30 text-red-400 bg-red-500/5'}`}>
                {t.direction === 'long' ? '↑' : '↓'} {t.pair} {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Session breakdown bars */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Performa per Sesi Market</p>
        <div className="space-y-2">
          {sessionStats.filter(s => s.total > 0).map(s => (
            <div key={s.key} className="flex items-center gap-3">
              <span className="w-24 text-xs font-medium shrink-0">{s.emoji} {s.label}</span>
              <div className="flex-1 h-6 rounded-md bg-muted/30 overflow-hidden relative">
                <div
                  className={`h-full ${s.pnl >= 0 ? 'bg-emerald-500/40' : 'bg-red-500/40'} transition-all`}
                  style={{ width: `${Math.min(100, Math.abs(s.pnl) / maxAbsPnl * 50 + s.winRate / 2)}%` }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold">
                  {s.winRate}% WR · {s.total}x
                </span>
              </div>
              <span className={`w-24 text-right text-xs font-bold shrink-0 ${s.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {s.pnl >= 0 ? '+' : ''}{fmt(s.pnl)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
        <TrendingUp size={11} className="text-emerald-400/60" /> Hijau = profit
        <TrendingDown size={11} className="text-red-400/60 ml-2" /> Merah = loss ·
        Berdasarkan {withTime.length} trade yang punya jam entry.
      </p>
    </div>
  )
}
