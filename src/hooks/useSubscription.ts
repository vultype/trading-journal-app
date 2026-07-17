'use client'

// Status langganan Terminal (Pro) — dipakai bersama oleh sidebar, hub, /account.
// Self-contained (tak butuh StoreProvider): baca user + payment_orders langsung.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { ADMIN_EMAIL } from '@/lib/store'

export type SubOrder = {
  id: string; plan: string; months: number; total: number; status: string
  method: string | null; invoice_number: string | null; created_at: string; updated_at: string | null
  expires_at: string | null
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
      // Ambil SEMUA order terminal aktif, lalu pilih yang kadaluarsanya PALING JAUH
      // (robust terhadap perpanjangan menumpuk & order lama tanpa expires_at).
      const { data: orders } = await sb.from('payment_orders')
        .select('id, plan, months, total, status, method, invoice_number, created_at, updated_at, expires_at')
        .eq('user_id', user.id).eq('plan', 'terminal').eq('status', 'aktif')
      const expiryOf = (o: SubOrder) => o.expires_at
        ? new Date(o.expires_at)
        : addMonths(new Date(o.updated_at || o.created_at), o.months || 1)
      let order: SubOrder | null = null, expiresAt: Date | null = null
      for (const o of (orders || []) as SubOrder[]) {
        const exp = expiryOf(o)
        if (!expiresAt || exp.getTime() > expiresAt.getTime()) { expiresAt = exp; order = o }
      }
      const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000) : null
      // isPro HANYA true bila langganan masih berlaku (belum kadaluarsa). Admin selalu Pro.
      const active = !!order && !!expiresAt && expiresAt.getTime() > Date.now()
      if (!stop) setState({
        loading: false, isAdmin, isPro: isAdmin || active, order, expiresAt, daysLeft,
        email: user.email ?? null, userId: user.id,
      })
    })
    return () => { stop = true }
  }, [])

  return state
}
