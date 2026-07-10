'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { useCurrency } from '@/hooks/useCurrency'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Users, TrendingUp, Activity, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import type { Trade, Transfer } from '@/types'

type AdminUser = { id: string; email: string; created_at: string }

type UserRow = {
  id: string
  email: string
  created_at: string
  trades: number
  wins: number
  losses: number
  pnl: number
  deposited: number
  withdrawn: number
  lastActive: string | null
}

export default function AdminPage() {
  const { isAdmin, loading: storeLoading } = useStore()
  const fmt = useCurrency()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [users, setUsers]     = useState<AdminUser[]>([])
  const [trades, setTrades]   = useState<Trade[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [journalCount, setJournalCount] = useState(0)

  useEffect(() => {
    if (!storeLoading && !isAdmin) router.replace('/dashboard')
  }, [storeLoading, isAdmin, router])

  async function load() {
    setLoading(true); setError(null)
    const sb = createClient()
    const [u, t, x, j] = await Promise.all([
      sb.rpc('admin_all_users'),
      sb.from('trades').select('*'),
      sb.from('transfers').select('*'),
      sb.from('journal_notes').select('id'),
    ])

    if (u.error) {
      setError(`Fungsi admin belum di-setup di Supabase. Jalankan file SQL admin (admin_all_users + admin policies). Detail: ${u.error.message}`)
      setLoading(false)
      return
    }
    setUsers((u.data ?? []) as AdminUser[])
    setTrades((t.data ?? []) as Trade[])
    setTransfers((x.data ?? []) as Transfer[])
    setJournalCount((j.data ?? []).length)
    setLoading(false)
  }

  useEffect(() => {
    if (isAdmin) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  const rows = useMemo<UserRow[]>(() => {
    return users.map(u => {
      const ut = trades.filter(t => (t as Trade & { user_id: string }).user_id === u.id)
      const norm = ut.filter(t => !t.is_overtrade)
      const wins = norm.filter(t => t.result === 'win').length
      const losses = norm.filter(t => t.result === 'loss').length
      const pnl = ut.reduce((s, t) => s + Number(t.pnl), 0)
      const ux = transfers.filter(t => (t as Transfer & { user_id: string }).user_id === u.id)
      const deposited = ux.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0)
      const withdrawn = ux.filter(t => t.type === 'withdraw').reduce((s, t) => s + Number(t.amount), 0)
      const lastActive = ut.length > 0 ? ut.map(t => t.date).sort().at(-1) ?? null : null
      return { id: u.id, email: u.email, created_at: u.created_at, trades: ut.length, wins, losses, pnl, deposited, withdrawn, lastActive }
    }).sort((a, b) => b.trades - a.trades)
  }, [users, trades, transfers])

  const totalPnl = trades.reduce((s, t) => s + Number(t.pnl), 0)

  if (storeLoading || !isAdmin) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-lg bg-red-500/10"><Shield size={18} className="text-red-400" /></span>
          <div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Aktivitas seluruh pengguna aplikasi</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/50 rounded-lg px-3 py-1.5 transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-red-400">Setup admin belum lengkap</p>
              <p className="text-muted-foreground mt-1 leading-relaxed">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
      ) : !error && (
        <>
          {/* Aggregate stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total User', value: String(users.length), icon: Users, color: 'text-blue-400' },
              { label: 'Total Trade', value: String(trades.length), icon: TrendingUp, color: 'text-emerald-400' },
              { label: 'Total Jurnal', value: String(journalCount), icon: Activity, color: 'text-purple-400' },
              { label: 'Total P&L (semua)', value: fmt(totalPnl), icon: Activity, color: totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <s.icon size={12} className={s.color} />
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* User table */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Daftar Pengguna</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-[11px] text-muted-foreground">
                      {['Email', 'Trades', 'W/L', 'P&L', 'Deposit', 'Withdraw', 'Aktivitas Terakhir'].map((h, i) => (
                        <th key={h} className={`px-3 py-3 font-semibold ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {rows.map(r => (
                      <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{r.email}</span>
                            {r.email === 'vultype@gmail.com' && <Badge className="text-[9px] bg-red-500/15 text-red-400 border-red-500/20" variant="outline">ADMIN</Badge>}
                          </div>
                          <p className="text-[10px] text-muted-foreground/50">Bergabung {r.created_at?.slice(0, 10)}</p>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">{r.trades}</td>
                        <td className="px-3 py-3 text-right text-xs">
                          <span className="text-emerald-400">{r.wins}</span>
                          <span className="text-muted-foreground/40"> / </span>
                          <span className="text-red-400">{r.losses}</span>
                        </td>
                        <td className={`px-3 py-3 text-right font-bold ${r.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.pnl >= 0 ? '+' : ''}{fmt(r.pnl)}
                        </td>
                        <td className="px-3 py-3 text-right text-indigo-400">{r.deposited > 0 ? fmt(r.deposited) : '—'}</td>
                        <td className="px-3 py-3 text-right text-violet-400">{r.withdrawn > 0 ? fmt(r.withdrawn) : '—'}</td>
                        <td className="px-3 py-3 text-right text-xs text-muted-foreground">{r.lastActive ?? '—'}</td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">Belum ada pengguna lain.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
