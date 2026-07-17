'use client'

// Status langganan Terminal (Pro) — dipakai bersama oleh sidebar, hub, /account.
// Self-contained (tak butuh StoreProvider): baca user + payment_orders langsung.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { ADMIN_EMAIL } from '@/lib/store'

export type SubOrder = {
  id: string; plan: string; months: number; total: number; status: string
  method: string | null; invoice_number: string | null; created_at: string; updated_at: string | null
}
export type Subscription = {
  loading: boolean
  isPro: boolean
  isAdmin: boolean
  order: SubOrder | null   // order terminal aktif terbaru
  expiresAt: Date | null   // perkiraan kadaluarsa (mulai aktif + jumlah bulan)
  daysLeft: number | null
  email: string | null
  userId: string | null
}

function addMonths(d: Date, m: number) {
  const x = new Date(d); x.setMonth(x.getMonth() + m); return x
}

export function useSubscription(): Subscription {
  const [state, setState] = useState<Subscription>({
    loading: true, isPro: false, isAdmin: false, order: null, expiresAt: null, daysLeft: null, email: null, userId: null,
  })

  useEffect(() => {
    let stop = false
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) { if (!stop) setState(s => ({ ...s, loading: false })); return }
      const isAdmin = user.email === ADMIN_EMAIL
      const { data: orders } = await sb.from('payment_orders')
        .select('id, plan, months, total, status, method, invoice_number, created_at, updated_at')
        .eq('user_id', user.id).eq('plan', 'terminal').eq('status', 'aktif')
        .order('updated_at', { ascending: false }).limit(1)
      const order = (orders && orders.length ? orders[0] : null) as SubOrder | null
      let expiresAt: Date | null = null, daysLeft: number | null = null
      if (order) {
        const base = new Date(order.updated_at || order.created_at)
        expiresAt = addMonths(base, order.months || 1)
        daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)
      }
      if (!stop) setState({
        loading: false, isAdmin, isPro: isAdmin || !!order, order, expiresAt, daysLeft,
        email: user.email ?? null, userId: user.id,
      })
    })
    return () => { stop = true }
  }, [])

  return state
}
