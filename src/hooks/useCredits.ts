'use client'

// Saldo kredit AI user — dipakai di /account & panel terminal untuk menampilkan sisa
// token dan menangani "kredit habis". Ambil dari /api/credits/balance (butuh bearer).
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { AiAction, TopupPackage } from '@/lib/ai-credits'

export type CreditBalance = {
  loading: boolean
  configured: boolean
  isAdmin: boolean
  unlimited: boolean
  allowance: number       // sisa jatah bulanan (siklus berjalan)
  allowanceCap: number    // jatah penuh per siklus (0 bila tak ada langganan aktif)
  topup: number           // saldo topup permanen
  total: number           // allowance + topup
  cost: Record<AiAction, number>
  monthlyAllowance: number
  packages: TopupPackage[]
  cycleStart: string | null
  expiry: string | null
  error: string | null
  refresh: () => void
}

const EMPTY_COST: Record<AiAction, number> = { analysis: 0, scope: 0, news: 0 }

export function useCredits(): CreditBalance {
  const [state, setState] = useState<Omit<CreditBalance, 'refresh'>>({
    loading: true, configured: false, isAdmin: false, unlimited: false,
    allowance: 0, allowanceCap: 0, topup: 0, total: 0,
    cost: EMPTY_COST, monthlyAllowance: 0, packages: [], cycleStart: null, expiry: null, error: null,
  })
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let stop = false
    ;(async () => {
      try {
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { if (!stop) setState(s => ({ ...s, loading: false })); return }
        const res = await fetch('/api/credits/balance', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
        const j = await res.json().catch(() => ({}))
        if (stop) return
        if (!res.ok) { setState(s => ({ ...s, loading: false, error: j.error || 'gagal memuat saldo' })); return }
        setState({
          loading: false, configured: !!j.configured, isAdmin: !!j.isAdmin, unlimited: !!j.unlimited,
          allowance: j.allowance ?? 0, allowanceCap: j.allowanceCap ?? 0, topup: j.topup ?? 0, total: j.total ?? 0,
          cost: j.cost ?? EMPTY_COST, monthlyAllowance: j.monthlyAllowance ?? 0, packages: j.packages ?? [],
          cycleStart: j.cycleStart ?? null, expiry: j.expiry ?? null, error: null,
        })
      } catch (e) {
        if (!stop) setState(s => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'gagal memuat saldo' }))
      }
    })()
    return () => { stop = true }
  }, [tick])

  return { ...state, refresh }
}
