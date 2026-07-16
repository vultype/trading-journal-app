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

// ─────────────────────────── #8 Kalibrasi ke depan (akurasi kesimpulan) ───────────────────────────
// Simpan tiap kesimpulan, lalu setelah HORIZON jam bandingkan dengan harga saat itu.
// Butuh 1 tabel (jalankan sekali di Supabase SQL editor):
//   create table if not exists terminal_predictions (
//     id uuid primary key default gen_random_uuid(),
//     created_at timestamptz not null default now(),
//     dir text not null, confidence int, price numeric not null, regime text,
//     evaluated boolean not null default false, correct boolean, price_after numeric, evaluated_at timestamptz
//   );
// Semua operasi GAGAL-DIAM (tabel belum ada → skip), tidak pernah menggagalkan cron.
const HORIZON_MS = 2 * 3600_000  // evaluasi kesimpulan setelah 2 jam
const MOVE_MIN = 0.5             // gerak minimal (poin) supaya dihitung benar/salah, bukan noise

export async function logPrediction(p: { dir: string; confidence: number; price: number; regime: string }): Promise<void> {
  const c = client(); if (!c) return
  try { await c.from('terminal_predictions').insert({ dir: p.dir, confidence: p.confidence, price: p.price, regime: p.regime }) } catch { /* tabel belum ada → skip */ }
}

export async function evaluateDuePredictions(priceNow: number): Promise<number> {
  const c = client(); if (!c) return 0
  try {
    const cutoff = new Date(Date.now() - HORIZON_MS).toISOString()
    const { data, error } = await c.from('terminal_predictions').select('id,dir,price').eq('evaluated', false).lte('created_at', cutoff).limit(200)
    if (error || !data) return 0
    let done = 0
    for (const row of data as { id: string; dir: string; price: number }[]) {
      const diff = priceNow - row.price
      const correct = row.dir === 'BULLISH' ? diff > MOVE_MIN : row.dir === 'BEARISH' ? diff < -MOVE_MIN : null
      await c.from('terminal_predictions').update({ evaluated: true, correct, price_after: priceNow, evaluated_at: new Date().toISOString() }).eq('id', row.id)
      done++
    }
    return done
  } catch { return 0 }
}

export type RegimeAccuracy = { regime: string; total: number; correct: number; pct: number }
export type AccuracyReport = { total: number; correct: number; pct: number | null; window: number; byRegime: RegimeAccuracy[] }
// Fase regime dari label (label mengandung arah, mis. "Trending Bullish" → "Trending")
const regimePhaseOf = (label: string) => label.includes('Trending') ? 'Trending' : label.includes('Konfirmasi') ? 'Konfirmasi Arah' : label.includes('Ranging') ? 'Ranging' : 'Lainnya'

export async function getAccuracy(days = 30): Promise<AccuracyReport | null> {
  const c = client(); if (!c) return null
  try {
    const since = new Date(Date.now() - days * 86_400_000).toISOString()
    const { data, error } = await c.from('terminal_predictions').select('correct,regime').eq('evaluated', true).not('correct', 'is', null).gte('created_at', since).limit(5000)
    if (error || !data) return null
    const rows = data as { correct: boolean; regime: string | null }[]
    const total = rows.length
    const correct = rows.filter(r => r.correct).length
    const byMap = new Map<string, { total: number; correct: number }>()
    for (const r of rows) {
      const k = regimePhaseOf(r.regime ?? '')
      const v = byMap.get(k) ?? { total: 0, correct: 0 }
      v.total++; if (r.correct) v.correct++
      byMap.set(k, v)
    }
    const byRegime: RegimeAccuracy[] = [...byMap.entries()].map(([regime, v]) => ({ regime, total: v.total, correct: v.correct, pct: Math.round((v.correct / v.total) * 100) })).sort((a, b) => b.total - a.total)
    return { total, correct, pct: total ? Math.round((correct / total) * 100) : null, window: days, byRegime }
  } catch { return null }
}

export type PredictionRow = { created_at: string; dir: string; confidence: number | null; price: number; regime: string | null; evaluated: boolean; correct: boolean | null; price_after: number | null }
export async function getRecentPredictions(limit = 10): Promise<PredictionRow[]> {
  const c = client(); if (!c) return []
  try {
    const { data, error } = await c.from('terminal_predictions').select('created_at,dir,confidence,price,regime,evaluated,correct,price_after').order('created_at', { ascending: false }).limit(limit)
    if (error || !data) return []
    return data as PredictionRow[]
  } catch { return [] }
}

// ── Memori post-mortem analisa AI (dipakai ai-analysis route) ──
// Disimpan di tabel terminal_alert_state dengan id berbeda — tanpa tabel baru.
export type LastAiAnalysis = { verdict: string; confidence: number; keputusan: string; price: number; at: number }
const AI_ROW_ID = 'ai_postmortem'
export async function getLastAiAnalysis(): Promise<LastAiAnalysis | null> {
  const c = client(); if (!c) return null
  try {
    const { data } = await c.from('terminal_alert_state').select('state').eq('id', AI_ROW_ID).maybeSingle()
    return (data?.state as LastAiAnalysis) ?? null
  } catch { return null }
}
export async function setLastAiAnalysis(v: LastAiAnalysis): Promise<void> {
  const c = client(); if (!c) return
  try { await c.from('terminal_alert_state').upsert({ id: AI_ROW_ID, state: v, updated_at: new Date().toISOString() }) } catch { /* gagal-diam */ }
}
