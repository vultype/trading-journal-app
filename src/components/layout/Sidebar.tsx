'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard, TrendingUp, Wallet, BookOpen, Settings, BarChart3,
  FlaskConical, LogOut, Sun, Moon, Grid2x2, HelpCircle, Shield,
  CreditCard, Receipt, Lock, ChevronDown, ArrowLeftRight, PieChart, Crown,
} from 'lucide-react'

// Plan mock — semua user Free untuk saat ini
const PLAN: 'free' | 'pro' = 'free'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { BrandLogo } from '@/components/layout/BrandLogo'

type NavItem = { href: string; label: string; icon: React.ElementType; children?: NavItem[] }
type NavGroup = { label: string; items: NavItem[] }

const dashboard: NavItem  = { href: '/dashboard',    label: 'Dashboard', icon: LayoutDashboard }
const trades: NavItem     = { href: '/trades',       label: 'Trade',     icon: TrendingUp }
const simulator: NavItem  = { href: '/simulator',    label: 'Simulator', icon: FlaskConical }
const finance: NavItem    = { href: '/finance', label: 'Keuangan', icon: Wallet, children: [
  { href: '/finance',      label: 'Ringkasan',          icon: PieChart },
  { href: '/transactions', label: 'Deposit & Withdraw', icon: ArrowLeftRight },
] }
const analisis: NavItem    = { href: '/analisis',    label: 'Analisis',  icon: BarChart3 }
const journal: NavItem    = { href: '/journal',      label: 'Jurnal',    icon: BookOpen }
const subscription: NavItem = { href: '/subscription', label: 'Langganan', icon: CreditCard }
const billing: NavItem    = { href: '/billing',      label: 'Tagihan',   icon: Receipt }
const settings: NavItem   = { href: '/settings',     label: 'Setting',   icon: Settings }
const panduan: NavItem    = { href: '/panduan',      label: 'Panduan',   icon: HelpCircle }
const adminItem: NavItem  = { href: '/admin',        label: 'Admin',     icon: Shield }

// Menu yang tetap terbuka sebelum user mencatat trade pertama
export const ALWAYS_UNLOCKED = ['/dashboard', '/panduan']

function useGroups(): NavGroup[] {
  const { isAdmin } = useStore()
  const account: NavItem[] = [subscription, billing, settings, ...(isAdmin ? [adminItem] : [])]
  return [
    { label: 'Ringkasan',       items: [dashboard] },
    { label: 'Trading',         items: [trades, finance] },
    { label: 'Jurnal & Analisa', items: [analisis, journal] },
    { label: 'Tools',           items: [simulator] },
    { label: 'Akun',            items: account },
    { label: 'Bantuan',         items: [panduan] },
  ]
}

// flatten in display order for the mobile bottom bar (expand children)
function useFlat(): NavItem[] {
  return useGroups().flatMap(g => g.items).flatMap(i => i.children ? i.children : [i])
}

function useMenuLock() {
  // Lock dinonaktifkan — semua menu bisa diakses langsung
  return { hasTrades: true, isLocked: (_href: string) => false }
}

const LOCK_MSG = ''

export function Sidebar() {
  const path   = usePathname()
  const groups = useGroups()
  const t = useT()
  const { isLocked } = useMenuLock()
  const { logoUrl } = useStore()
  const [openMenu, setOpenMenu] = useState<string | null>('/finance')

  return (
    <aside className="hidden md:flex w-56 shrink-0 border-r border-border/50 bg-sidebar flex-col py-5 px-3">
      <div className="px-3 mb-5">
        <BrandLogo url={logoUrl} />
        {!logoUrl && <p className="text-[10px] text-muted-foreground/60 mt-0.5 uppercase tracking-widest">Trading Analytics</p>}
      </div>

      <nav className="flex-1 flex flex-col gap-4 overflow-y-auto">
        {groups.map(group => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">{t(group.label)}</p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const { href, label, icon: Icon, children } = item
                const locked = isLocked(href)

                // Dropdown parent (mis. Keuangan)
                if (children && !locked) {
                  const expanded = openMenu === href || children.some(c => path.startsWith(c.href) && c.href !== '/')
                  const parentActive = children.some(c => path === c.href)
                  return (
                    <div key={href}>
                      <button type="button" onClick={() => setOpenMenu(openMenu === href ? null : href)}
                        className={cn('w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all border border-transparent',
                          parentActive ? 'text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                        <Icon size={15}/> {t(label)}
                        <ChevronDown size={13} className={`ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                      {expanded && (
                        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border/50 pl-2">
                          {children.map(c => (
                            <Link key={c.href} href={c.href}
                              className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all',
                                path === c.href ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                              <c.icon size={13}/> {t(c.label)}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }

                if (locked) {
                  return (
                    <button key={href} type="button" onClick={() => toast.error(LOCK_MSG)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/40 cursor-not-allowed border border-transparent text-left">
                      <Icon size={15}/> {t(label)}
                      <Lock size={11} className="ml-auto"/>
                    </button>
                  )
                }
                return (
                  <Link key={href} href={href}
                    className={cn('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                      path.startsWith(href)
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent')}>
                    <Icon size={15}/> {t(label)}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Upgrade card (khusus Standar) */}
      {PLAN === 'free' && (
        <Link href="/subscription"
          className="mt-3 block rounded-2xl p-[1px] bg-gradient-to-br from-primary/60 via-primary/20 to-transparent">
          <div className="rounded-2xl bg-sidebar/80 p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/15 ring-1 ring-primary/25">
                <Crown size={13} className="text-primary" />
              </span>
              <p className="text-sm font-bold">Upgrade ke Professional</p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug mb-2.5">Buka multi-akun, analisa jam & sesi, export data, dan lainnya.</p>
            <span className="flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold py-1.5">
              Upgrade Sekarang
            </span>
          </div>
        </Link>
      )}
    </aside>
  )
}

// ── Mobile bottom navigation ──────────────────────────────────────────────────

export function BottomNav() {
  const path = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [moreOpen, setMoreOpen] = useState(false)
  const flat = useFlat()
  const t = useT()
  const { isLocked } = useMenuLock()

  // 4 utama untuk bar bawah; sisanya masuk sheet "Lainnya"
  const primaryHrefs = ['/dashboard', '/trades', '/analisis', '/finance']
  const primary = primaryHrefs.map(h => flat.find(n => n.href === h)!).filter(Boolean)
  const more    = flat.filter(n => !primaryHrefs.includes(n.href))

  async function logout() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      {moreOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setMoreOpen(false)} />
          <div className="relative z-50 bg-sidebar border-t border-border/50 px-4 pt-4 pb-2">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 mb-3">{t('Menu lainnya')}</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {more.map(({ href, label, icon: Icon }) => {
                const locked = isLocked(href)
                if (locked) {
                  return (
                    <button
                      key={href}
                      type="button"
                      onClick={() => toast.error(LOCK_MSG)}
                      className="relative flex flex-col items-center gap-1.5 rounded-xl py-3 border border-border/40 text-muted-foreground/40 cursor-not-allowed"
                    >
                      <Icon size={18}/>
                      <span className="text-[10px] font-medium">{t(label)}</span>
                      <Lock size={9} className="absolute top-1.5 right-1.5"/>
                    </button>
                  )
                }
                return (
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
                    <span className="text-[10px] font-medium">{t(label)}</span>
                  </Link>
                )
              })}
            </div>
            <div className="flex gap-2 pb-1">
              <button
                onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setMoreOpen(false) }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border/40 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                {theme === 'dark' ? <Sun size={14}/> : <Moon size={14}/>}
                {theme === 'dark' ? t('Light Mode') : t('Dark Mode')}
              </button>
              <button
                onClick={() => { logout(); setMoreOpen(false) }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-red-500/30 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={14}/>
                {t('Keluar')}
              </button>
            </div>
          </div>
        </>
      )}

      <nav className="bg-sidebar border-t border-border/50 flex h-14 pb-[env(safe-area-inset-bottom)]">
        {primary.map(({ href, label, icon: Icon }) => {
          const locked = isLocked(href)
          if (locked) {
            return (
              <button
                key={href}
                type="button"
                onClick={() => toast.error(LOCK_MSG)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground/35"
              >
                <Icon size={19}/>
                <span className="text-[9px] font-semibold leading-none mt-0.5">{t(label)}</span>
              </button>
            )
          }
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
                path.startsWith(href) ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon size={19}/>
              <span className="text-[9px] font-semibold leading-none mt-0.5">{t(label)}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setMoreOpen(v => !v)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
            moreOpen ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <Grid2x2 size={19}/>
          <span className="text-[9px] font-semibold leading-none mt-0.5">{t('Lainnya')}</span>
        </button>
      </nav>
    </div>
  )
}
