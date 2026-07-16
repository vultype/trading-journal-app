'use client'

// Bingkai bersama untuk halaman info/legal (Syarat & Ketentuan, Kebijakan Refund,
// FAQ, Kontak) — konsisten dengan gaya homepage (dark, header + footer sama).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { ArrowLeft } from 'lucide-react'

const LEGAL_NAV = [
  { href: '/syarat-ketentuan', label: 'Syarat & Ketentuan' },
  { href: '/kebijakan-refund', label: 'Kebijakan Refund' },
  { href: '/faq', label: 'FAQ' },
  { href: '/kontak', label: 'Kontak' },
]

export function InfoPageShell({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  useEffect(() => {
    createClient().from('app_config').select('logo_url').eq('id', 1).maybeSingle().then(({ data }) => setLogoUrl((data?.logo_url as string | null) ?? null))
  }, [])

  return (
    <div className="min-h-screen bg-[#060a09] text-white">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#060a09]/80 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {logoUrl ? <BrandLogo url={logoUrl} /> : <span className="text-xl font-black tracking-tight">Datalitiq</span>}
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors"><ArrowLeft size={14} /> Beranda</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-12">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">{title}</h1>
        {updated && <p className="text-xs text-white/35 mt-2">Terakhir diperbarui: {updated}</p>}
        <div className="mt-8 space-y-8 text-sm text-white/70 leading-relaxed [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-white [&_h2]:mb-2.5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:text-white/65 [&_a]:text-primary [&_a]:hover:underline [&_b]:text-white/85 [&_b]:font-semibold">
          {children}
        </div>
      </main>

      <footer className="border-t border-white/5">
        <div className="max-w-3xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {logoUrl ? <BrandLogo url={logoUrl} /> : <span className="text-sm font-black tracking-tight">Datalitiq</span>}
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-white/40">
            {LEGAL_NAV.map(l => <Link key={l.href} href={l.href} className="hover:text-white transition-colors">{l.label}</Link>)}
          </nav>
        </div>
        <p className="text-center text-[10px] text-white/20 pb-6">© {new Date().getFullYear()} PT Datalitiq Indonesia. All rights reserved.</p>
      </footer>
    </div>
  )
}
