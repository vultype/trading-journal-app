// Kredit AI — logika server-side (metering, saldo, charge). HANYA dipakai di route
// (butuh SUPABASE_SERVICE_ROLE_KEY untuk menulis ledger, bypass RLS).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { CREDIT_COST, MONTHLY_ALLOWANCE, type AiAction } from './ai-credits'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
// Admin = akses AI tak terbatas (tak di-meter). Samakan dgn ADMIN_EMAIL di store.tsx.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'vultype@gmail.com'

export function creditsConfigured() {
  return !!(SUPA_URL && SERVICE)
}

// Service client (bypass RLS) — untuk baca/tulis ledger.
export function svc(): SupabaseClient {
  return createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })
}

export type AuthedUser = { id: string; email: string | null; isAdmin: boolean }

// Verifikasi user dari header Authorization: Bearer <supabase access_token>.
export async function getUserFromReq(req: Request): Promise<AuthedUser | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token || !SUPA_URL || !ANON) return null
  const sb = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data, error } = await sb.auth.getUser()
  if (error || !data.user) return null
  const email = data.user.email ?? null
  return { id: data.user.id, email, isAdmin: email === ADMIN_EMAIL }
}

function addMonths(d: Date, m: number) { const x = new Date(d); x.setMonth(x.getMonth() + m); return x }

// Order terminal aktif terbaru → tanggal mulai (untuk hitung siklus) + durasi bulan.
async function activeSub(sb: SupabaseClient, userId: string): Promise<{ base: Date; months: number } | null> {
  const { data } = await sb.from('payment_orders')
    .select('months, created_at, updated_at')
    .eq('user_id', userId).eq('plan', 'terminal').eq('status', 'aktif')
    .order('updated_at', { ascending: false }).limit(1)
  if (!data || !data.length) return null
  const o = data[0] as { months: number | null; created_at: string; updated_at: string | null }
  return { base: new Date(o.updated_at || o.created_at), months: o.months || 1 }
}

export type AllowanceCtx = { cycleStart: string; expiry: Date }

// Konteks allowance BERJALAN: siklus bulanan (anniversary tanggal mulai) yang sedang
// aktif, selama belum melewati kadaluarsa langganan. null = tak ada allowance aktif.
export async function allowanceContext(sb: SupabaseClient, userId: string): Promise<AllowanceCtx | null> {
  const sub = await activeSub(sb, userId)
  if (!sub) return null
  const now = new Date()
  const expiry = addMonths(sub.base, sub.months)
  if (now >= expiry) return null // langganan sudah lewat masa
  // k = jumlah bulan penuh sejak mulai
  let k = (now.getFullYear() - sub.base.getFullYear()) * 12 + (now.getMonth() - sub.base.getMonth())
  if (addMonths(sub.base, k) > now) k--
  if (k < 0) k = 0
  const cycleStartDate = addMonths(sub.base, k)
  if (cycleStartDate >= expiry) return null
  return { cycleStart: cycleStartDate.toISOString(), expiry }
}

// True bila error Postgres = pelanggaran unique (duplikat) → aman diabaikan.
const isDuplicate = (err: { code?: string } | null) => err?.code === '23505'

// Grant allowance untuk siklus berjalan bila belum ada. Idempoten: cek dulu, lalu insert;
// kalau ada race, partial unique index (user_id, cycle_start where reason='grant') menahan
// dgn error 23505 yang kita abaikan. (upsert onConflict TIDAK dipakai — tak cocok utk partial index.)
export async function ensureAllowance(sb: SupabaseClient, userId: string, ctx: AllowanceCtx | null) {
  if (!ctx) return
  const { data } = await sb.from('ai_credit_ledger').select('id')
    .eq('user_id', userId).eq('reason', 'grant').eq('cycle_start', ctx.cycleStart).limit(1)
  if (data && data.length) return
  const { error } = await sb.from('ai_credit_ledger').insert(
    { user_id: userId, bucket: 'allowance', delta: MONTHLY_ALLOWANCE, reason: 'grant', cycle_start: ctx.cycleStart },
  )
  if (error && !isDuplicate(error)) throw error
}

export type Balances = { allowance: number; topup: number; total: number }

// Hitung saldo dari ledger. allowance = hanya siklus berjalan; topup = semua (permanen).
export async function computeBalances(sb: SupabaseClient, userId: string, ctx: AllowanceCtx | null): Promise<Balances> {
  const { data } = await sb.from('ai_credit_ledger')
    .select('bucket, delta, cycle_start').eq('user_id', userId)
  let allowance = 0, topup = 0
  for (const r of (data || []) as { bucket: string; delta: number; cycle_start: string | null }[]) {
    if (r.bucket === 'topup') topup += r.delta
    else if (r.bucket === 'allowance' && ctx && r.cycle_start === ctx.cycleStart) allowance += r.delta
  }
  if (allowance < 0) allowance = 0
  if (topup < 0) topup = 0
  return { allowance, topup, total: allowance + topup }
}

// Potong kredit untuk 1 aksi: allowance dulu, sisanya topup. Catat baris debit per bucket.
export async function charge(sb: SupabaseClient, userId: string, action: AiAction, ctx: AllowanceCtx | null) {
  const cost = CREDIT_COST[action]
  const { allowance } = await computeBalances(sb, userId, ctx)
  const fromAllow = Math.min(allowance, cost)
  const fromTopup = cost - fromAllow
  const rows: Record<string, unknown>[] = []
  if (fromAllow > 0) rows.push({ user_id: userId, bucket: 'allowance', delta: -fromAllow, reason: 'debit', action, cycle_start: ctx?.cycleStart ?? null })
  if (fromTopup > 0) rows.push({ user_id: userId, bucket: 'topup', delta: -fromTopup, reason: 'debit', action })
  if (rows.length) await sb.from('ai_credit_ledger').insert(rows)
}

// Ringkasan saldo lengkap untuk API /credits/balance & UI.
// Catatan: admin TIDAK dikecualikan — ikut di-meter seperti user biasa.
export async function getBalanceSummary(userId: string, isAdmin: boolean) {
  const sb = svc()
  const ctx = await allowanceContext(sb, userId)
  // Grant allowance best-effort — jangan gagalkan pembacaan saldo kalau grant error transien.
  try { await ensureAllowance(sb, userId, ctx) } catch { /* saldo tetap dihitung dari ledger yang ada */ }
  const bal = await computeBalances(sb, userId, ctx)
  return {
    isAdmin, unlimited: false,
    allowance: bal.allowance, allowanceCap: ctx ? MONTHLY_ALLOWANCE : 0,
    topup: bal.topup, total: bal.total,
    cycleStart: ctx?.cycleStart ?? null,
    expiry: ctx ? ctx.expiry.toISOString() : null,
  }
}

// ── Gate untuk endpoint AI ────────────────────────────────────────────────
// Pakai di awal route: cek auth + saldo. Kalau lolos, kembalikan commit() untuk
// dipanggil SETELAH panggilan AI sukses (debit). Kalau gagal, kembalikan response siap-kirim.
type GateResult =
  | { ok: false; response: NextResponse }
  | { ok: true; commit: () => Promise<void> }

export async function beginAiCharge(req: Request, action: AiAction): Promise<GateResult> {
  if (!creditsConfigured()) {
    // Tanpa service key, jangan blokir fitur — jalan tanpa metering (fail-open).
    return { ok: true, commit: async () => {} }
  }
  const user = await getUserFromReq(req)
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Tidak terautentikasi — login ulang', code: 'unauthenticated' }, { status: 401 }) }
  }
  // Admin ikut di-meter seperti user biasa (tidak dikecualikan).
  const sb = svc()
  let bal: Balances
  let ctx: AllowanceCtx | null
  try {
    ctx = await allowanceContext(sb, user.id)
    await ensureAllowance(sb, user.id, ctx)
    bal = await computeBalances(sb, user.id, ctx)
  } catch {
    // Error transien saat baca saldo → fail-open (izinkan, tanpa debit) agar fitur tak mati.
    return { ok: true, commit: async () => {} }
  }
  const cost = CREDIT_COST[action]
  if (bal.total < cost) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Kredit AI tidak cukup. Butuh ${cost} kredit, saldo kamu ${bal.total}. Silakan top up.`, code: 'insufficient_credits', balance: bal.total, cost },
        { status: 402 },
      ),
    }
  }
  return { ok: true, commit: () => charge(sb, user.id, action, ctx) }
}

// Grant kredit topup (dipanggil dari webhook saat order topup lunas). Idempoten: cek
// dulu apakah order ini sudah pernah di-grant; kalau race, partial unique index
// (ref_order_id where reason='topup') menahan dgn 23505 yang diabaikan.
export async function grantTopup(sb: SupabaseClient, userId: string, credits: number, orderId: string) {
  const { data } = await sb.from('ai_credit_ledger').select('id')
    .eq('reason', 'topup').eq('ref_order_id', orderId).limit(1)
  if (data && data.length) return
  const { error } = await sb.from('ai_credit_ledger').insert(
    { user_id: userId, bucket: 'topup', delta: credits, reason: 'topup', ref_order_id: orderId, note: 'Topup pembayaran' },
  )
  if (error && !isDuplicate(error)) throw error
}

// Grant kredit MANUAL (oleh admin) ke saldo topup user tertentu. Tanpa ref_order_id
// (bukan dari pembayaran) sehingga bisa berulang. delta boleh negatif untuk koreksi.
export async function grantManualCredit(userId: string, delta: number, note: string) {
  const sb = svc()
  const { error } = await sb.from('ai_credit_ledger').insert(
    { user_id: userId, bucket: 'topup', delta: Math.trunc(delta), reason: 'topup', note: note || 'Kredit manual (admin)' },
  )
  if (error) throw error
}
