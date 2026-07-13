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
    createClient().auth.getUser().then(({ data }) => {
      const email = data.user?.email
      if (!data.user) { router.replace('/login?next=%2Fterminal'); return }
      setState(email === ADMIN_EMAIL ? 'ok' : 'denied')
    })
  }, [router])

  if (state === 'loading') {
    return <div className="min-h-screen flex items-center justify-center bg-[#060a09]"><Loader2 className="animate-spin text-primary" /></div>
  }
  if (state === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#060a09] text-white px-6 text-center">
        <ShieldAlert size={40} className="text-red-400" />
        <h1 className="text-lg font-bold">Akses khusus admin</h1>
        <p className="text-sm text-white/50 max-w-sm">Terminal XAUUSD hanya bisa diakses oleh admin.</p>
        <button onClick={() => router.replace('/dashboard')} className="mt-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg px-4 py-2">Ke Dashboard</button>
      </div>
    )
  }
  return <TradingTerminal />
}
