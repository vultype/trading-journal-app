'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { StoreProvider, useStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'
import { Sidebar, BottomNav } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { SetupWizard } from '@/components/onboarding/SetupWizard'
import { Toaster } from '@/components/ui/toaster'
import { Loader2, AlertTriangle, X, RefreshCw } from 'lucide-react'

function SyncErrorBanner() {
  const { syncError, clearSyncError, refetch } = useStore()
  if (!syncError) return null

  return (
    <div className="flex items-start gap-3 bg-red-500/10 border-b border-red-500/30 px-4 py-2.5 text-xs">
      <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-red-400 font-semibold">Data failed to save to Supabase</p>
        <p className="text-red-400/70 mt-0.5 break-all">{syncError}</p>
        <p className="text-muted-foreground mt-1">
          Run the SQL schema again in the Supabase SQL Editor to fix RLS policies, then click Retry.
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => { clearSyncError(); refetch() }}
          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-medium border border-red-500/30 rounded px-2 py-1 hover:bg-red-500/10 transition-colors"
        >
          <RefreshCw size={11}/> Retry
        </button>
        <button
          onClick={clearSyncError}
          className="text-muted-foreground hover:text-foreground p-1 transition-colors"
        >
          <X size={14}/>
        </button>
      </div>
    </div>
  )
}

// Halaman yang TIDAK boleh dihalangi wizard jurnal — alur langganan/pembayaran/akun
// (mis. user Terminal baru yang mau langganan tak perlu isi setup jurnal dulu).
// Catatan: /checkout kini standalone (src/app/checkout, di luar grup (app)) jadi
// tidak pernah lewat layout ini — tidak perlu masuk daftar exempt di bawah.
const WIZARD_EXEMPT = ['/subscription', '/billing', '/settings', '/simulator']
// Halaman yang boleh diakses tier Gratis (untuk upgrade & kelola akun). Selain ini,
// seluruh tools jurnal/simulator = bonus khusus Pro → Gratis diarahkan ke /upgrade.
const PRO_EXEMPT = ['/subscription', '/billing', '/settings']

function AppContent({ children }: { children: React.ReactNode }) {
  const { loading, userId, isAdmin, settings } = useStore()
  const router = useRouter()
  const pathname = usePathname()
  const [access, setAccess] = useState<'checking' | 'pro' | 'free'>('checking')

  useEffect(() => {
    if (!loading && !userId) router.replace('/login')
  }, [loading, userId, router])

  // Cek status Pro (admin ATAU langganan terminal aktif) sekali saat user diketahui.
  useEffect(() => {
    if (!userId) return
    if (isAdmin) { setAccess('pro'); return }
    createClient().from('payment_orders').select('id').eq('user_id', userId).eq('plan', 'terminal').eq('status', 'aktif').limit(1)
      .then(({ data }) => setAccess(data && data.length ? 'pro' : 'free'))
  }, [userId, isAdmin])

  const proExempt = PRO_EXEMPT.some(p => pathname === p || pathname.startsWith(p + '/'))
  // Gratis mengakses tools bonus → arahkan upgrade.
  useEffect(() => {
    if (access === 'free' && !proExempt) router.replace('/upgrade')
  }, [access, proExempt, router])

  if (loading || (access === 'checking' && !PRO_EXEMPT.some(p => pathname === p || pathname.startsWith(p + '/')))) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary"/>
          <p className="text-sm font-medium">Loading data...</p>
        </div>
      </div>
    )
  }

  if (!userId) return null
  // Blokir render tools bonus untuk Gratis (sementara redirect berjalan).
  if (access === 'free' && !proExempt) return null

  // Onboarding: tampilkan wizard sampai user selesai setup — KECUALI di halaman
  // langganan/pembayaran/akun (biar user Terminal bisa langsung langganan).
  const exempt = WIZARD_EXEMPT.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!settings.onboarded && !exempt) return <SetupWizard />

  return (
    <div className="flex h-full">
      <Sidebar/>
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar/>
        <SyncErrorBanner/>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 bg-muted/30">{children}</main>
      </div>
      <BottomNav/>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <AppContent>{children}</AppContent>
      <Toaster />
    </StoreProvider>
  )
}
