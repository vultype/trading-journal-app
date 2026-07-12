'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { rp, planName, type PlanId } from '@/lib/pricing'
import { Sparkles, Crown, Receipt, ArrowUpRight, Clock, Check, XCircle, Loader2 } from 'lucide-react'

type Order = { id: string; plan: PlanId; months: number; total: number; unique_code: number; status: string; created_at: string }

const STATUS: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  menunggu_pembayaran: { label: 'Menunggu Pembayaran', cls: 'text-amber-400 border-amber-500/30', icon: Clock },
  menunggu_verifikasi: { label: 'Menunggu Verifikasi', cls: 'text-blue-400 border-blue-500/30', icon: Clock },
  aktif:               { label: 'Aktif', cls: 'text-emerald-400 border-emerald-500/30', icon: Check },
  batal:               { label: 'Dibatalkan', cls: 'text-red-400 border-red-500/30', icon: XCircle },
}

export default function BillingPage() {
  const { settings, userId } = useStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    createClient().from('payment_orders').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      .then(({ data }) => { setOrders((data ?? []) as Order[]); setLoading(false) })
  }, [userId])

  const active = orders.find(o => o.status === 'aktif')
  const activePlan = active ? planName(active.plan) : 'Standar'

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold">Tagihan & Pembayaran</h1>
        <p className="text-sm text-muted-foreground">Kelola langganan dan lihat riwayat pembayaran</p>
      </div>

      {/* Paket aktif */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/8 to-transparent">
        <CardContent className="pt-5 pb-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/15">{active ? <Crown size={18} className="text-primary" /> : <Sparkles size={18} className="text-muted-foreground" />}</div>
            <div>
              <p className="text-xs text-muted-foreground">Paket Aktif</p>
              <p className="text-lg font-black">{activePlan}</p>
            </div>
            <Badge variant="secondary" className="text-[10px] ml-1">{settings.displayName || 'Trader'}</Badge>
          </div>
          <Link href="/subscription"><Button size="sm" className="gap-1.5"><ArrowUpRight size={14} /> Upgrade</Button></Link>
        </CardContent>
      </Card>

      {/* Riwayat order */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Receipt size={14} /> Riwayat Pembayaran</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-primary" size={20} /></div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center">
              <Receipt size={26} className="mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground mb-3">Belum ada pembayaran</p>
              <Link href="/subscription"><Button size="sm" variant="outline">Lihat Paket</Button></Link>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {orders.map(o => {
                const st = STATUS[o.status] ?? STATUS.menunggu_pembayaran
                return (
                  <div key={o.id} className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <p className="text-sm font-semibold">Paket {planName(o.plan)} · {o.months} bln</p>
                      <p className="text-xs text-muted-foreground">{o.created_at?.slice(0, 10)} · Kode {o.unique_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{rp(o.total)}</p>
                      <Badge variant="outline" className={`text-[9px] gap-1 ${st.cls}`}><st.icon size={9} /> {st.label}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">Pembayaran via transfer Mandiri, diverifikasi manual oleh admin.</p>
    </div>
  )
}
