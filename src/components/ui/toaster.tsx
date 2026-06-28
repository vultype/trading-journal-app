'use client'

import { useEffect, useState } from 'react'
import { subscribeToast, type ToastItem } from '@/lib/toast'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => subscribeToast(setItems), [])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {items.map(item => (
        <div
          key={item.id}
          className={cn(
            'flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium pointer-events-auto max-w-xs',
            'border backdrop-blur-md',
            item.type === 'success' && 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300',
            item.type === 'error'   && 'bg-red-950/90 border-red-500/30 text-red-300',
            item.type === 'info'    && 'bg-blue-950/90 border-blue-500/30 text-blue-300',
          )}
        >
          {item.type === 'success' && <CheckCircle2 size={15} className="shrink-0" />}
          {item.type === 'error'   && <AlertCircle  size={15} className="shrink-0" />}
          {item.type === 'info'    && <Info         size={15} className="shrink-0" />}
          <span className="leading-snug">{item.message}</span>
        </div>
      ))}
    </div>
  )
}
