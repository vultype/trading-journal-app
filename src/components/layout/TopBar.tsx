'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'
import { Bell, BookOpen, ListChecks, TrendingUp, Sun, Moon, Settings, LogOut, Crown, ChevronDown } from 'lucide-react'

type Notif = { icon: React.ElementType; color: string; title: string; desc: string; href: string }

// Plan mock — semua user Free untuk saat ini (billing masih manual)
const PLAN: 'free' | 'pro' = 'free'

export function TopBar() {
  const { settings, trades, journalNotes, accounts } = useStore()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [bellOpen, setBellOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const profRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
      if (profRef.current && !profRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const name = settings.displayName || 'Trader'
  const initial = name.charAt(0).toUpperCase()

  const todayStr = new Date().toISOString().split('T')[0]
  const tradedToday = trades.some(t => t.date === todayStr)
  const journaledToday = journalNotes.some(n => n.date === todayStr)
  const notifs: Notif[] = []
  if (tradedToday && !journaledToday)
    notifs.push({ icon: BookOpen, color: 'text-amber-400', title: 'Belum menulis jurnal', desc: 'Kamu trading hari ini — refleksikan sekarang.', href: '/journal' })
  if (!settings.displayName)
    notifs.push({ icon: ListChecks, color: 'text-primary', title: 'Lengkapi profil', desc: 'Isi nama tampilan di Setting.', href: '/settings' })
  if (accounts.length === 0)
    notifs.push({ icon: TrendingUp, color: 'text-primary', title: 'Tambah akun broker', desc: 'Buat akun broker pertamamu.', href: '/settings' })

  async function logout() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  return (
    <header className="hidden md:flex items-center justify-end gap-1.5 h-14 px-6 border-b border-border/40 bg-background/60 backdrop-blur-sm shrink-0">
      {/* Plan badge */}
      <Link href="/subscription"
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-colors mr-1
          ${PLAN === 'pro' ? 'bg-primary/15 text-primary ring-1 ring-primary/25' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
        {PLAN === 'pro' ? <><Crown size={12} /> PRO</> : <>STANDAR</>}
      </Link>

      {/* Theme toggle */}
      <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Ganti tema">
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      {/* Notification bell */}
      <div className="relative" ref={bellRef}>
        <button onClick={() => { setBellOpen(v => !v); setProfileOpen(false) }}
          className="relative flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell size={17} />
          {notifs.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-background" />}
        </button>
        {bellOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-popover shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
              <p className="text-sm font-semibold">Notifikasi</p>
              {notifs.length > 0 && <span className="text-[10px] text-muted-foreground">{notifs.length} baru</span>}
            </div>
            {notifs.length === 0 ? (
              <div className="py-8 text-center">
                <Bell size={22} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">Tidak ada notifikasi</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40 max-h-80 overflow-y-auto">
                {notifs.map((n, i) => (
                  <Link key={i} href={n.href} onClick={() => setBellOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                    <n.icon size={16} className={`${n.color} shrink-0 mt-0.5`} />
                    <div>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile dropdown */}
      <div className="relative" ref={profRef}>
        <button onClick={() => { setProfileOpen(v => !v); setBellOpen(false) }}
          className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 hover:bg-muted transition-colors">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 text-primary font-bold text-sm ring-1 ring-primary/25">{initial}</span>
          <span className="text-sm font-medium max-w-[110px] truncate">{name}</span>
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
        </button>
        {profileOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-popover shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-sm font-semibold truncate">{name}</p>
              <p className="text-xs text-muted-foreground truncate">{PLAN === 'pro' ? 'Paket Professional' : 'Paket Standar'}</p>
            </div>
            <div className="p-1">
              <Link href="/settings" onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Settings size={15} /> Setting
              </Link>
              <button onClick={() => { setProfileOpen(false); logout() }}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors">
                <LogOut size={15} /> Keluar
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
