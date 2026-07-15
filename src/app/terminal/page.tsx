'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ADMIN_EMAIL } from '@/lib/store'
import { TradingTerminal } from '@/components/terminal/TradingTerminal'
import { Loader2, ShieldAlert } from 'lucide-react'

export default function TerminalPage() {
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) { router.replace('/login?next=%2Fterminal'); return }
      if (user.email === ADMIN_EMAIL) { setState('ok'); return }
      // Akses juga terbuka untuk pelanggan dengan langganan Terminal AI yang aktif.
      const { data: orders } = await sb.from('payment_orders').select('plan,status').eq('user_id', user.id).eq('plan', 'terminal').eq('status', 'aktif').limit(1)
      setState(orders && orders.length > 0 ? 'ok' : 'denied')
    })
  }, [router])

  if (state === 'loading') {
    return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>
  }
  if (state === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#060a09] text-white px-6 text-center">
        <ShieldAlert size={40} className="text-amber-400" />
        <h1 className="text-lg font-bold">Langganan Terminal belum aktif</h1>
        <p className="text-sm text-white/50 max-w-sm">Datalitiq AI Terminal memerlukan langganan aktif. Setelah pembayaran diverifikasi, akses terbuka otomatis.</p>
        <div className="mt-2 flex items-center gap-2">
          <button onClick={() => router.replace('/checkout?plan=terminal&months=1')} className="text-sm font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2">Langganan Sekarang</button>
          <button onClick={() => router.replace('/dashboard')} className="text-sm font-semibold bg-white/10 text-white rounded-lg px-4 py-2">Ke Dashboard</button>
        </div>
      </div>
    )
  }
  return <TradingTerminal />
}
