'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ADMIN_EMAIL } from '@/lib/store'
import { TradingTerminal } from '@/components/terminal/TradingTerminal'
import { Loader2 } from 'lucide-react'

export default function TerminalPage() {
  const router = useRouter()
  // Free (login tanpa langganan) TETAP boleh masuk — akses terbatas + panel di-blur.
  // Pro (admin / langganan aktif) mendapat akses penuh.
  const [state, setState] = useState<'loading' | 'free' | 'pro'>('loading')

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) { router.replace('/login?next=%2Fterminal'); return }
      if (user.email === ADMIN_EMAIL) { setState('pro'); return }
      // Pro juga untuk pelanggan dengan langganan Terminal AI yang aktif.
      const { data: orders } = await sb.from('payment_orders').select('plan,status').eq('user_id', user.id).eq('plan', 'terminal').eq('status', 'aktif').limit(1)
      setState(orders && orders.length > 0 ? 'pro' : 'free')
    })
  }, [router])

  if (state === 'loading') {
    return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>
  }
  return <TradingTerminal plan={state} />
}
