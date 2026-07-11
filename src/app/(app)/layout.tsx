'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { StoreProvider, useStore } from '@/lib/store'
import { Sidebar, BottomNav, ALWAYS_UNLOCKED } from '@/components/layout/Sidebar'
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

function AppContent({ children }: { children: React.ReactNode }) {
  const { loading, userId, settings, trades } = useStore()
  const router = useRouter()
  const pathname = usePathname()
  const hasTrades = trades.length > 0

  useEffect(() => {
    if (!loading && !userId) router.replace('/login')
  }, [loading, userId, router])

  // Kunci navigasi langsung via URL ke menu yang belum terbuka
  useEffect(() => {
    if (!loading && userId && settings.onboarded && !hasTrades && !ALWAYS_UNLOCKED.includes(pathname)) {
      router.replace('/dashboard')
    }
  }, [loading, userId, settings.onboarded, hasTrades, pathname, router])

  if (loading) {
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

  // Onboarding: tampilkan wizard sampai user selesai setup
  if (!settings.onboarded) return <SetupWizard />

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
