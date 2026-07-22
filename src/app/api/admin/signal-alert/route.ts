import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyAdmin, ADMIN_EMAIL } from '@/lib/notify-admin'

// Alert email sinyal terminal (ADMIN-ONLY) — dipanggil dari terminal saat
// Regime / Momentum / Signal Meter berubah, atau saat ketiganya sejalan
// (opportunity).
//
// Deteksinya berjalan di browser (di situlah data live berada), route ini hanya
// meneruskan ke email. Tapi gerbang admin tetap wajib: tanpa itu siapa pun yang
// tahu URL-nya bisa membanjiri inbox.
//
// Anti-banjir dua lapis:
//  1. Klien hanya mengirim saat terjadi PERUBAHAN label (bukan tiap tick).
//  2. Server menahan kunci yang sama selama MIN_GAP_MS. Memori serverless bisa
//     ter-reset antar-invocation — itu diterima, klien tetap lapisan utamanya.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const lastSent = new Map<string, number>()
const MIN_GAP_MS = 90_000

const KINDS = ['regime', 'momentum', 'signal', 'opportunity'] as const
type Kind = (typeof KINDS)[number]

const ICON: Record<Kind, string> = {
  regime: '🔄', momentum: '⚡', signal: '📊', opportunity: '🎯',
}
const JUDUL: Record<Kind, string> = {
  regime: 'Regime Pasar berubah',
  momentum: 'Momentum berubah',
  signal: 'Signal Meter berubah',
  opportunity: 'PELUANG — sinyal sejalan',
}

export async function POST(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token || !SUPA_URL) return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 })
  const authed = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: { user } } = await authed.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Akses ditolak — khusus admin.' }, { status: 403 })

  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const kind = String(b.kind || '') as Kind
  if (!(KINDS as readonly string[]).includes(kind)) return NextResponse.json({ error: 'Jenis alert tidak dikenal.' }, { status: 400 })

  const label = String(b.label || '').slice(0, 60)
  const price = Number(b.price) || 0
  const detail: string[] = Array.isArray(b.detail)
    ? (b.detail as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 10)
    : []

  const key = `${kind}:${label}`
  const now = Date.now()
  if ((lastSent.get(key) ?? 0) > now - MIN_GAP_MS) return NextResponse.json({ ok: true, throttled: true })
  lastSent.set(key, now)

  after(() => notifyAdmin(`${ICON[kind]} ${JUDUL[kind]}: ${label}`, [
    `Harga XAU/USD: $${price.toFixed(2)}`,
    ...detail,
    `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
  ]))
  return NextResponse.json({ ok: true })
}
