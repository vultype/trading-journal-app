'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Account, Trade, Transfer, JournalNote, AppSettings } from '@/types'
import { createClient } from '@/lib/supabase'

const DEFAULT_SETTINGS: AppSettings = {
  currency: 'IDR',
  strategies: ['Breakout', 'Retest', 'Trend Follow', 'Reversal', 'Scalping'],
}

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

type Store = {
  loading: boolean
  userId: string | null
  syncError: string | null
  accounts: Account[]
  trades: Trade[]
  transfers: Transfer[]
  journalNotes: JournalNote[]
  settings: AppSettings
  addAccount: (a: Omit<Account, 'id' | 'created_at'>) => void
  deleteAccount: (id: string) => void
  addTrade: (t: Omit<Trade, 'id' | 'created_at'>) => void
  updateTrade: (id: string, t: Partial<Trade>) => void
  deleteTrade: (id: string) => void
  addTransfer: (t: Omit<Transfer, 'id' | 'created_at'>) => void
  deleteTransfer: (id: string) => void
  saveJournal: (note: Omit<JournalNote, 'id' | 'created_at'>) => void
  saveSettings: (s: Partial<AppSettings>) => void
  clearSyncError: () => void
  refetch: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [loading,      setLoading]      = useState(true)
  const [userId,       setUserId]       = useState<string | null>(null)
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
      if (!uid) setLoading(false)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => {
      const uid = session?.user.id ?? null
      setUserId(uid)
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
    ]).then(async ([a, t, x, j, s]) => {
      if (a.error && a.error.code === '42P01') {
        console.error('Tabel belum dibuat. Jalankan SQL schema di Supabase.')
        setLoading(false)
        return
      }
      // Buat akun default jika belum ada
      let accs: Account[] = a.data ?? []
      if (accs.length === 0) {
        const defaults = [
          { user_id: userId, name: 'Rekening Personal', type: 'personal' as const, currency: 'IDR' },
          { user_id: userId, name: 'Broker Utama',      type: 'trading'  as const, broker: 'MT4/MT5', currency: 'IDR' },
        ]
        const { data: created } = await sb.from('accounts').insert(defaults).select()
        accs = created ?? []
      }
      setAccounts(accs)
      setTrades((t.data ?? []) as Trade[])
      setTransfers((x.data ?? []) as Transfer[])
      setJournalNotes((j.data ?? []) as JournalNote[])

      if (s.data) {
        setSettings({
          currency:     (s.data.currency as AppSettings['currency']) ?? 'IDR',
          strategies:   (s.data.strategies as string[]) ?? DEFAULT_SETTINGS.strategies,
          targetBulanan: s.data.target_bulanan ?? undefined,
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
  const addAccount = useCallback((a: Omit<Account, 'id' | 'created_at'>) => {
    if (!userId) return
    const id = uid(); const created_at = new Date().toISOString()
    const row: Account = { ...a, id, created_at }
    setAccounts(p => [...p, row])
    sb().from('accounts').insert({ ...a, id, user_id: userId, created_at })
      .then(({ error }) => onSaveError('addAccount', error))
  }, [userId])

  const deleteAccount = useCallback((id: string) => {
    if (!userId) return
    setAccounts(p => p.filter(a => a.id !== id))
    sb().from('accounts').delete().eq('id', id).eq('user_id', userId)
      .then(({ error }) => onSaveError('deleteAccount', error))
  }, [userId])

  // ── Trade actions ─────────────────────────────────────────────────────
  const addTrade = useCallback((t: Omit<Trade, 'id' | 'created_at'>) => {
    if (!userId) return
    const id = uid(); const created_at = new Date().toISOString()
    setTrades(p => [...p, { ...t, id, created_at }])
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
      followed_plan:  t.followed_plan,
      know_direction: t.know_direction,
      screenshot_url: t.screenshot_url,
      note:           t.note,
    }).then(({ error }) => onSaveError('addTrade', error))
  }, [userId])

  const updateTrade = useCallback((id: string, t: Partial<Trade>) => {
    if (!userId) return
    setTrades(p => p.map(x => x.id === id ? { ...x, ...t } : x))
    sb().from('trades').update(t).eq('id', id).eq('user_id', userId)
      .then(({ error }) => onSaveError('updateTrade', error))
  }, [userId])

  const deleteTrade = useCallback((id: string) => {
    if (!userId) return
    setTrades(p => p.filter(x => x.id !== id))
    sb().from('trades').delete().eq('id', id).eq('user_id', userId)
      .then(({ error }) => onSaveError('deleteTrade', error))
  }, [userId])

  // ── Transfer actions ──────────────────────────────────────────────────
  const addTransfer = useCallback((t: Omit<Transfer, 'id' | 'created_at'>) => {
    if (!userId) return
    const id = uid(); const created_at = new Date().toISOString()
    setTransfers(p => [...p, { ...t, id, created_at }])
    sb().from('transfers').insert({
      id, user_id: userId, created_at,
      from_account_id: t.from_account_id,
      to_account_id:   t.to_account_id,
      type:            t.type,
      amount:          t.amount,
      note:            t.note,
      date:            t.date,
    }).then(({ error }) => onSaveError('addTransfer', error))
  }, [userId])

  const deleteTransfer = useCallback((id: string) => {
    if (!userId) return
    setTransfers(p => p.filter(x => x.id !== id))
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
        return p.map(n => n.date === note.date ? { ...n, ...note } : n)
      }
      const id = uid(); const created_at = new Date().toISOString()
      sb().from('journal_notes').insert({ id, user_id: userId, created_at, ...note })
        .then(({ error }) => onSaveError('saveJournal insert', error))
      return [{ ...note, id, created_at }, ...p]
    })
  }, [userId])

  // ── Settings actions ──────────────────────────────────────────────────
  const saveSettings = useCallback((s: Partial<AppSettings>) => {
    if (!userId) return
    setSettings(p => {
      const next = { ...p, ...s }
      sb().from('user_settings').upsert({
        user_id:         userId,
        currency:        next.currency,
        strategies:      next.strategies,
        target_bulanan:  next.targetBulanan ?? null,
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'user_id' })
        .then(({ error }) => onSaveError('saveSettings', error))
      return next
    })
  }, [userId])

  const clearSyncError = useCallback(() => setSyncError(null), [])

  return (
    <Ctx.Provider value={{
      loading, userId, syncError, accounts, trades, transfers, journalNotes, settings,
      addAccount, deleteAccount, addTrade, updateTrade, deleteTrade,
      addTransfer, deleteTransfer, saveJournal, saveSettings,
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
