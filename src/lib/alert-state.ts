// Penyimpanan state notifikasi (server-only) di Supabase — dipakai cron untuk
// mengingat kondisi terakhir supaya notif hanya dikirim saat ADA PERUBAHAN
// (edge-triggered), bukan tiap 5 menit selama kondisi masih sama.
//
// Butuh 1 tabel (jalankan sekali di Supabase SQL editor):
//   create table if not exists terminal_alert_state (
//     id text primary key,
//     state jsonb not null,
//     updated_at timestamptz not null default now()
//   );
// Ditulis pakai SUPABASE_SERVICE_ROLE_KEY (bypass RLS), jadi tabel aman dari
// akses publik lewat anon key.
import { createClient } from '@supabase/supabase-js'

export type AlertState = {
  lastRegime?: string
  trendingActive?: boolean
  lastTrendingAt?: number
  layakActive?: boolean
  lastLayakAt?: number
  lastLayakDir?: 'BULLISH' | 'BEARISH'
  seededAt?: number
}

const ROW_ID = 'xauusd'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export function alertStateConfigured(): boolean {
  return !!((process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function getAlertState(): Promise<AlertState | null> {
  const c = client(); if (!c) return null
  const { data, error } = await c.from('terminal_alert_state').select('state').eq('id', ROW_ID).maybeSingle()
  if (error) throw new Error(`Supabase read: ${error.message}`)
  return (data?.state as AlertState) ?? null
}

export async function setAlertState(state: AlertState): Promise<void> {
  const c = client(); if (!c) throw new Error('Supabase service key belum diset')
  const { error } = await c.from('terminal_alert_state').upsert({ id: ROW_ID, state, updated_at: new Date().toISOString() })
  if (error) throw new Error(`Supabase write: ${error.message}`)
}
