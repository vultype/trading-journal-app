'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StoreProvider, useStore } from '@/lib/store'
import { Sidebar } from '@/components/layout/Sidebar'
import { Loader2 } from 'lucide-react'

function AppContent({ children }: { children: React.ReactNode }) {
  const { loading, userId } = useStore()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !userId) router.replace('/login')
  }, [loading, userId, router])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary"/>
          <p className="text-sm font-medium">Memuat data...</p>
        </div>
      </div>
    )
  }

  if (!userId) return null

  return (
    <div className="flex h-full">
      <Sidebar/>
      <main className="flex-1 overflow-y-auto p-6 bg-muted/30">{children}</main>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <AppContent>{children}</AppContent>
    </StoreProvider>
  )
}
