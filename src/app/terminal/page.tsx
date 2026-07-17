'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSubscription } from '@/hooks/useSubscription'
import { TradingTerminal } from '@/components/terminal/TradingTerminal'
import { Loader2 } from 'lucide-react'

export default function TerminalPage() {
  const router = useRouter()
  const sub = useSubscription()

  // Belum login → arahkan ke login. (useSubscription mengembalikan userId=null bila anonim.)
  useEffect(() => {
    if (!sub.loading && !sub.userId) router.replace('/login?next=%2Fterminal')
  }, [sub.loading, sub.userId, router])

  if (sub.loading || !sub.userId) {
    return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>
  }

  // Free (login tanpa langganan aktif) TETAP boleh masuk — akses terbatas + panel di-blur.
  // Pro = admin / langganan Terminal aktif & BELUM kadaluarsa (dicek di useSubscription).
  return <TradingTerminal plan={sub.isPro ? 'pro' : 'free'} isAdmin={sub.isAdmin} />
}
