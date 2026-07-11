'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Account, Trade, Transfer, JournalNote, AppSettings } from '@/types'
import { createClient } from '@/lib/supabase'
import { toast } from '@/lib/toast'

const DEFAULT_SETTINGS: AppSettings = {
  currency: 'IDR',
  strategies: ['Breakout', 'Retest', 'Trend Follow', 'Reversal', 'Scalping'],
}

function uid() { return crypto.randomUUID() }

export const ADMIN_EMAIL = 'vultype@gmail.com'

type Store = {
  loading: boolean
  userId: string | null
  userEmail: string | null
  isAdmin: boolean
  logoUrl: string | null
  updateLogo: (url: string | null) => void
  syncError: string | null
  accounts: Account[]
  trades: Trade[]
  transfers: Transfer[]
  journalNotes: JournalNote[]
  settings: AppSettings
  addAccount: (a: Omit<Account, 'id' | 'created_at'>) => Account
  updateAccount: (id: string, a: Partial<Account>) => void
  deleteAccount: (id: string) => void
  addTrade: (t: Omit<Trade, 'id' | 'created_at'>) => void
  updateTrade: (id: string, t: Partial<Trade>) => void
  deleteTrade: (id: string) => void
  addTransfer: (t: Omit<Transfer, 'id' | 'created_at'>) => void
  deleteTransfer: (id: string) => void
  saveJournal: (note: Omit<JournalNote, 'id' | 'created_at'>) => void
  deleteJournal: (date: string) => void
  saveSettings: (s: Partial<AppSettings>) => void
  clearSyncError: () => void
  refetch: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [loading,      setLoading]      = useState(true)
  const [userId,       setUserId]       = useState<string | null>(null)
  const [userEmail,    setUserEmail]    = useState<string | null>(null)
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null)
  const [syncError,    setSyncError]    = useState<string | null>(null)
  const [fetchKey,     setFetchKey]     = useState(0)
  const [accounts,     setAccounts]     = useState<Account[]>([])
  const [trades,       setTrades]       = useState<Trade[]>([])
  const [transfers,    setTransfers]    = useState<Transfer[]>([])
  const [journalNotes, setJournalNotes] = useState<JournalNote[]>([])
  const [settings,     setSettings]     = useState<AppSettings>(DEFAULT_SETTINGS)

  // ── Auth state listener ──────────────────────────────────────────────
  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user.id ?? null
      setUserId(uid)
      setUserEmail(session?.user.email ?? null)
      if (!uid) setLoading(false)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => {
      const uid = session?.user.id ?? null
      setUserId(uid)
      setUserEmail(session?.user.email ?? null)
      if (!uid) {
        setLoading(false)
        setAccounts([]); setTrades([]); setTransfers([])
        setJournalNotes([]); setSettings(DEFAULT_SETTINGS)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Load data when user logs in (also re-runs on manual refetch) ──────
  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setSyncError(null)
    const sb = createClient()

    Promise.all([
      sb.from('accounts').select('*').eq('user_id', userId).order('created_at'),
      sb.from('trades').select('*').eq('user_id', userId).order('date'),
      sb.from('transfers').select('*').eq('user_id', userId).order('date'),
      sb.from('journal_notes').select('*').eq('user_id', userId).order('date'),
      sb.from('user_settings').select('*').eq('user_id', userId).single(),
      sb.from('app_config').select('logo_url').eq('id', 1).maybeSingle(),
    ]).then(async ([a, t, x, j, s, cfg]) => {
      if (a.error && a.error.code === '42P01') {
        console.error('Tabel belum dibuat. Jalankan SQL schema di Supabase.')
        setLoading(false)
        return
      }
      // Tidak lagi membuat akun default — user setup lewat wizard onboarding
      setAccounts((a.data ?? []) as Account[])
      setTrades((t.data ?? []) as Trade[])
      setTransfers((x.data ?? []) as Transfer[])
      setJournalNotes((j.data ?? []) as JournalNote[])
      setLogoUrl((cfg?.data?.logo_url as string | null) ?? null)

      if (s.data) {
        setSettings({
          currency:       (s.data.currency as AppSettings['currency']) ?? 'IDR',
          language:       (s.data.language as AppSettings['language']) ?? 'id',
          strategies:     (s.data.strategies as string[]) ?? DEFAULT_SETTINGS.strategies,
          targetHarian:   s.data.target_harian ?? undefined,
          targetMingguan: s.data.target_mingguan ?? undefined,
          targetBulanan:  s.data.target_bulanan ?? undefined,
          displayName:    s.data.display_name ?? undefined,
          defaultPair:    s.data.default_pair ?? undefined,
          weekStartsMonday: s.data.week_starts_monday ?? undefined,
          onboarded:      s.data.onboarded ?? false,
        })
      }
      setLoading(false)
    }).catch(err => {
      console.error('[store] load error:', err)
      setSyncError('Failed to load data from Supabase. Check your connection.')
      setLoading(false)
    })
  }, [userId, fetchKey])

  // ── Helpers ───────────────────────────────────────────────────────────
  function sb() { return createClient() }

  // Surface Supabase save errors so the user knows data wasn't persisted
  function onSaveError(label: string, error: { message?: string; code?: string } | null) {
    if (!error) return
    console.error(`[${label}]`, error)
    const msg = error.message ?? 'Unknown error'
    // RLS violation → most common root cause of silent data loss
    const hint = error.code === '42501' || msg.includes('row-level security')
      ? ' (RLS policy issue — re-run the SQL schema in Supabase)'
      : ''
    setSyncError(`Failed to save (${label}): ${msg}${hint}`)
  }

  function refetch() { setFetchKey(k => k + 1) }

  // ── Account actions ───────────────────────────────────────────────────
  const addAccount = useCallback((a: Omit<Account, 'id' | 'created_at'>): Account => {
    const id = uid(); const created_at = new Date().toISOString()
    const row: Account = { ...a, id, created_at }
    if (!userId) return row
    setAccounts(p => [...p, row])
    toast.success('Akun berhasil ditambahkan')
    sb().from('accounts').insert({ ...a, id, user_id: userId, created_at })
      .then(({ error }) => onSaveError('addAccount', error))
    return row
  }, [userId])

  const updateAccount = useCallback((id: string, a: Partial<Account>) => {
    if (!userId) return
    setAccounts(p => p.map(x => x.id === id ? { ...x, ...a } : x))
    sb().from('accounts').update(a).eq('id', id).eq('user_id', userId)
      .then(({ error }) => onSaveError('updateAccount', error))
  }, [userId])

  const deleteAccount = useCallback((id: string) => {
    if (!userId) return
    setAccounts(p => p.filter(a => a.id !== id))
    toast.success('Akun dihapus')
    sb().from('accounts').delete().eq('id', id).eq('user_id', userId)
      .then(({ error }) => onSaveError('deleteAccount', error))
  }, [userId])

  // ── Trade actions ─────────────────────────────────────────────────────
  const addTrade = useCallback((t: Omit<Trade, 'id' | 'created_at'>) => {
    if (!userId) return
    const id = uid(); const created_at = new Date().toISOString()
    setTrades(p => [...p, { ...t, id, created_at }])
    toast.success('Trade berhasil dicatat')
    sb().from('trades').insert({
      id, user_id: userId, created_at,
      account_id:     t.account_id,
      date:           t.date,
      entry_time:     t.entry_time,
      pair:           t.pair,
      direction:      t.direction,
      result:         t.result,
      pnl:            t.pnl,
      strategy:       t.strategy,
      followed_plan:    t.followed_plan,
      know_direction:   t.know_direction,
      screenshot_url:   t.screenshot_url,
      note:             t.note,
      market_structure: t.market_structure,
      is_overtrade:     t.is_overtrade ?? false,
    }).then(({ error }) => onSaveError('addTrade', error))
  }, [userId])

  const updateTrade = useCallback((id: string, t: Partial<Trade>) => {
    if (!userId) return
    setTrades(p => p.map(x => x.id === id ? { ...x, ...t } : x))
    toast.success('Trade diperbarui')
    sb().from('trades').update(t).eq('id', id).eq('user_id', userId)
      .then(({ error }) => onSaveError('updateTrade', error))
  }, [userId])

  const deleteTrade = useCallback((id: string) => {
    if (!userId) return
    setTrades(p => p.filter(x => x.id !== id))
    toast.success('Trade dihapus')
    sb().from('trades').delete().eq('id', id).eq('user_id', userId)
      .then(({ error }) => onSaveError('deleteTrade', error))
  }, [userId])

  // ── Transfer actions ──────────────────────────────────────────────────
  const addTransfer = useCallback((t: Omit<Transfer, 'id' | 'created_at'>) => {
    if (!userId) return
    const id = uid(); const created_at = new Date().toISOString()
    setTransfers(p => [...p, { ...t, id, created_at }])
    toast.success(t.type === 'deposit' ? 'Deposit dicatat' : 'Withdraw dicatat')
    sb().from('transfers').insert({
      id, user_id: userId, created_at,
      account_id: t.account_id,
      type:       t.type,
      amount:     t.amount,
      note:       t.note,
      date:       t.date,
    }).then(({ error }) => onSaveError('addTransfer', error))
  }, [userId])

  const deleteTransfer = useCallback((id: string) => {
    if (!userId) return
    setTransfers(p => p.filter(x => x.id !== id))
    toast.success('Transfer dihapus')
    sb().from('transfers').delete().eq('id', id).eq('user_id', userId)
      .then(({ error }) => onSaveError('deleteTransfer', error))
  }, [userId])

  // ── Journal actions ───────────────────────────────────────────────────
  const saveJournal = useCallback((note: Omit<JournalNote, 'id' | 'created_at'>) => {
    if (!userId) return
    setJournalNotes(p => {
      const ex = p.find(n => n.date === note.date)
      if (ex) {
        sb().from('journal_notes').update({ content: note.content, mood: note.mood })
          .eq('user_id', userId).eq('date', note.date)
          .then(({ error }) => onSaveError('saveJournal update', error))
        toast.success('Jurnal diperbarui')
        return p.map(n => n.date === note.date ? { ...n, ...note } : n)
      }
      const id = uid(); const created_at = new Date().toISOString()
      sb().from('journal_notes').insert({ id, user_id: userId, created_at, ...note })
        .then(({ error }) => onSaveError('saveJournal insert', error))
      toast.success('Jurnal tersimpan')
      return [{ ...note, id, created_at }, ...p]
    })
  }, [userId])

  const deleteJournal = useCallback((date: string) => {
    if (!userId) return
    setJournalNotes(p => p.filter(n => n.date !== date))
    toast.success('Jurnal dihapus')
    sb().from('journal_notes').delete().eq('user_id', userId).eq('date', date)
      .then(({ error }) => onSaveError('deleteJournal', error))
  }, [userId])

  // ── Settings actions ──────────────────────────────────────────────────
  const saveSettings = useCallback((s: Partial<AppSettings>) => {
    if (!userId) return
    setSettings(p => {
      const next = { ...p, ...s }
      toast.success('Pengaturan disimpan')
      sb().from('user_settings').upsert({
        user_id:            userId,
        currency:           next.currency,
        language:           next.language ?? 'id',
        strategies:         next.strategies,
        target_harian:      next.targetHarian ?? null,
        target_mingguan:    next.targetMingguan ?? null,
        target_bulanan:     next.targetBulanan ?? null,
        display_name:       next.displayName ?? null,
        default_pair:       next.defaultPair ?? null,
        week_starts_monday: next.weekStartsMonday ?? null,
        onboarded:          next.onboarded ?? false,
        updated_at:         new Date().toISOString(),
      }, { onConflict: 'user_id' })
        .then(({ error }) => onSaveError('saveSettings', error))
      return next
    })
  }, [userId])

  const updateLogo = useCallback((url: string | null) => {
    setLogoUrl(url)
    sb().from('app_config').upsert({ id: 1, logo_url: url, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .then(({ error }) => onSaveError('updateLogo', error))
  }, [])

  const clearSyncError = useCallback(() => setSyncError(null), [])

  return (
    <Ctx.Provider value={{
      loading, userId, userEmail, isAdmin: userEmail === ADMIN_EMAIL, logoUrl, updateLogo, syncError,
      accounts, trades, transfers, journalNotes, settings,
      addAccount, updateAccount, deleteAccount, addTrade, updateTrade, deleteTrade,
      addTransfer, deleteTransfer, saveJournal, deleteJournal, saveSettings,
      clearSyncError, refetch,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be inside StoreProvider')
  return ctx
}
