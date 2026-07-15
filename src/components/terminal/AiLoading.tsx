'use client'

// Animasi loading "keren" untuk Analisa AI (Datalitiq AI).
// Cincin scanner berputar + ring denyut + otak bernapas + titik mengorbit +
// langkah analisa berganti + bar shimmer. Hormati prefers-reduced-motion.
import { useEffect, useState } from 'react'
import { Brain } from 'lucide-react'

export function AiLoading({ steps, className = '' }: { steps: string[]; className?: string }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI(v => (v + 1) % steps.length), 1500)
    return () => clearInterval(id)
  }, [steps.length])

  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-9 ${className}`}>
      <div className="relative h-20 w-20 flex items-center justify-center">
        {/* cincin scanner (conic gradient) berputar */}
        <span className="dl-ai-spin absolute inset-0 rounded-full" style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, transparent 210deg, rgba(52,211,153,0.15) 280deg, rgba(52,211,153,0.9) 355deg, transparent 360deg)',
          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
        }} />
        {/* ring denyut */}
        <span className="absolute inset-2 rounded-full border border-emerald-400/25 animate-ping" style={{ animationDuration: '1.9s' }} />
        <span className="absolute inset-[18px] rounded-full border border-emerald-400/15 animate-ping" style={{ animationDuration: '1.9s', animationDelay: '0.5s' }} />
        {/* titik mengorbit */}
        <span className="dl-ai-orbit absolute inset-0">
          <span className="absolute -top-px left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 8px 2px rgba(52,211,153,0.6)' }} />
        </span>
        {/* inti: otak bernapas */}
        <span className="relative h-11 w-11 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
          <Brain size={20} className="dl-ai-breathe text-emerald-400" />
        </span>
      </div>

      {/* langkah analisa berganti */}
      <div className="h-4 text-center">
        <p key={i} className="dl-ai-fade text-xs text-white/65">{steps[i]}</p>
      </div>

      {/* bar shimmer indeterminate */}
      <div className="relative h-1 w-44 max-w-full overflow-hidden rounded-full bg-white/[0.06]">
        <span className="dl-ai-shimmer absolute inset-y-0 left-0 w-1/3 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(52,211,153,0.85), transparent)' }} />
      </div>

      <style>{`
        @keyframes dlAiSpin { to { transform: rotate(360deg) } }
        .dl-ai-spin { animation: dlAiSpin 1.15s linear infinite }
        @keyframes dlAiOrbit { to { transform: rotate(360deg) } }
        .dl-ai-orbit { animation: dlAiOrbit 2.6s linear infinite }
        @keyframes dlAiBreathe { 0%,100% { transform: scale(1); opacity:.85 } 50% { transform: scale(1.14); opacity:1 } }
        .dl-ai-breathe { animation: dlAiBreathe 1.6s ease-in-out infinite }
        @keyframes dlAiShimmer { 0% { transform: translateX(-120%) } 100% { transform: translateX(360%) } }
        .dl-ai-shimmer { animation: dlAiShimmer 1.3s ease-in-out infinite }
        @keyframes dlAiFade { from { opacity:0; transform: translateY(4px) } to { opacity:1; transform: none } }
        .dl-ai-fade { animation: dlAiFade .45s ease-out }
        @media (prefers-reduced-motion: reduce) {
          .dl-ai-spin, .dl-ai-orbit, .dl-ai-breathe, .dl-ai-shimmer, .dl-ai-fade { animation: none }
          .dl-ai-shimmer { transform: none; width: 100%; opacity: .4 }
        }
      `}</style>
    </div>
  )
}
