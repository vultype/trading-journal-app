'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard, TrendingUp, Wallet, BookOpen, Settings, BarChart3,
  FlaskConical, LogOut, Sun, Moon, ClipboardList, Grid2x2, HelpCircle, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import { useStore } from '@/lib/store'

type NavItem = { href: string; label: string; icon: React.ElementType }

const baseNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/trades',    label: 'Trade',       icon: TrendingUp },
  { href: '/analisis',  label: 'Analisis',    icon: BarChart3 },
  { href: '/laporan',   label: 'Laporan',     icon: ClipboardList },
  { href: '/simulator', label: 'Simulator',   icon: FlaskConical },
  { href: '/finance',   label: 'Keuangan',    icon: Wallet },
  { href: '/journal',   label: 'Jurnal',      icon: BookOpen },
  { href: '/panduan',   label: 'Panduan',     icon: HelpCircle },
  { href: '/settings',  label: 'Setting',     icon: Settings },
]

const adminItem: NavItem = { href: '/admin', label: 'Admin', icon: Shield }

function useNav(): NavItem[] {
  const { isAdmin } = useStore()
  return isAdmin ? [...baseNav, adminItem] : baseNav
}

export function Sidebar() {
  const path   = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const nav = useNav()

  async function logout() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  return (
    <aside className="hidden md:flex w-52 shrink-0 border-r border-border/50 bg-sidebar flex-col py-5 px-3">
      <div className="px-3 mb-5">
        <p className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground uppercase">Trading Jurnal</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">Versi 2.0</p>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
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

      <div className="flex flex-col gap-1 mt-2">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all border border-transparent"
        >
          {theme === 'dark' ? <Sun size={15}/> : <Moon size={15}/>}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        <button
          onClick={logout}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all border border-transparent"
        >
          <LogOut size={15}/>
          Keluar
        </button>
      </div>
    </aside>
  )
}

// ── Mobile bottom navigation ──────────────────────────────────────────────────

export function BottomNav() {
  const path = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [moreOpen, setMoreOpen] = useState(false)
  const nav = useNav()

  const primary = nav.slice(0, 4)   // Dashboard, Trade, Analisis, Laporan
  const more    = nav.slice(4)      // Simulator, Keuangan, Jurnal, Panduan, Setting (+ Admin)

  async function logout() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      {/* More sheet — slides up above the nav bar */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setMoreOpen(false)}
          />
          {/* Sheet */}
          <div className="relative z-50 bg-sidebar border-t border-border/50 px-4 pt-4 pb-2">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 mb-3">Menu lainnya</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {more.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl py-3 border transition-colors',
                    path.startsWith(href)
                      ? 'bg-primary/10 border-primary/20 text-primary'
                      : 'border-border/40 text-muted-foreground hover:bg-muted'
                  )}
                >
                  <Icon size={18}/>
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              ))}
            </div>
            <div className="flex gap-2 pb-1">
              <button
                onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setMoreOpen(false) }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border/40 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                {theme === 'dark' ? <Sun size={14}/> : <Moon size={14}/>}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
              <button
                onClick={() => { logout(); setMoreOpen(false) }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-red-500/30 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={14}/>
                Keluar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom bar */}
      <nav className="bg-sidebar border-t border-border/50 flex h-14 pb-[env(safe-area-inset-bottom)]">
        {primary.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
              path.startsWith(href) ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon size={19}/>
            <span className="text-[9px] font-semibold leading-none mt-0.5">{label}</span>
          </Link>
        ))}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(v => !v)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
            moreOpen ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <Grid2x2 size={19}/>
          <span className="text-[9px] font-semibold leading-none mt-0.5">Lainnya</span>
        </button>
      </nav>
    </div>
  )
}
