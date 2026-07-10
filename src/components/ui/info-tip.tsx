'use client'

import { Info } from 'lucide-react'

export function InfoTip({ text, side = 'top' }: { text: string; side?: 'top' | 'bottom' }) {
  return (
    <span className="relative inline-flex group align-middle">
      <Info size={12} className="text-muted-foreground/40 hover:text-muted-foreground cursor-help transition-colors" />
      <span
        className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-50 w-52 rounded-lg bg-popover border border-border px-3 py-2 text-[11px] font-normal text-foreground/80 leading-relaxed shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150
          ${side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
      >
        {text}
      </span>
    </span>
  )
}
