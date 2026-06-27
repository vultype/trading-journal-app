'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, TrendingUp, Wallet, BookOpen, Settings, BarChart3, FlaskConical, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'

const nav = [
  { href: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/trades',    label: 'Trade',       icon: TrendingUp },
  { href: '/analisis',  label: 'Analisis',    icon: BarChart3 },
  { href: '/simulator', label: 'Simulator',   icon: FlaskConical },
  { href: '/finance',   label: 'Keuangan',    icon: Wallet },
  { href: '/journal',   label: 'Jurnal',      icon: BookOpen },
  { href: '/settings',  label: 'Setting',     icon: Settings },
]

export function Sidebar() {
  const path   = usePathname()
  const router = useRouter()

  async function logout() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  return (
    <aside className="w-52 shrink-0 border-r border-border/50 bg-sidebar flex flex-col py-5 px-3">
      <div className="px-3 mb-5">
        <p className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground uppercase">Trading Jurnal</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">Versi 2.0</p>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
              path.startsWith(href)
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
            )}
          >
            <Icon size={15}/>
            {label}
          </Link>
        ))}
      </nav>

      <button
        onClick={logout}
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all border border-transparent mt-2"
      >
        <LogOut size={15}/>
        Keluar
      </button>
    </aside>
  )
}
