import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyAdmin, ADMIN_EMAIL } from '@/lib/notify-admin'

// Alert email R&D Sniper (ADMIN-ONLY) — dipanggil terminal saat fase tren
// berubah (Coiling / Ignition / Confirmed). Deteksinya berjalan di browser
// admin, jadi route ini hanya meneruskan ke email — TAPI tetap wajib
// diverifikasi admin: tanpa gerbang ini siapa pun bisa membanjiri inbox.
//
// Rate-limit dua lapis: klien hanya mengirim saat transisi fase, dan server
// menahan kunci fase yang sama minimal 90 detik (memori serverless bisa
// ter-reset antar-invocation — itu diterima; klien tetap lapisan utamanya).
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const lastSent = new Map<string, number>()
const MIN_GAP_MS = 90_000

const PHASES = ['coiling', 'ignition', 'confirmed', 'idle'] as const

export async function POST(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token || !SUPA_URL) return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 })
  const authed = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: { user } } = await authed.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Akses ditolak — khusus admin.' }, { status: 403 })

  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const phase = String(b.phase || '')
  if (!(PHASES as readonly string[]).includes(phase)) return NextResponse.json({ error: 'Fase tidak dikenal.' }, { status: 400 })
  const dir = b.dir === 'bull' || b.dir === 'bear' ? String(b.dir) : ''
  const label = String(b.label || phase).slice(0, 60)
  const score = Math.max(0, Math.min(100, Math.round(Number(b.score) || 0)))
  const price = Number(b.price) || 0
  const reasons: string[] = Array.isArray(b.reasons) ? (b.reasons as unknown[]).filter((r): r is string => typeof r === 'string').slice(0, 8) : []
  const zoneNote = typeof b.zoneNote === 'string' ? b.zoneNote.slice(0, 200) : ''

  const key = `${phase}:${dir}`
  const now = Date.now()
  if ((lastSent.get(key) ?? 0) > now - MIN_GAP_MS) return NextResponse.json({ ok: true, throttled: true })
  lastSent.set(key, now)

  const icon = phase === 'ignition' ? '🎯' : phase === 'confirmed' ? '🚀' : phase === 'coiling' ? '🌀' : '💤'
  after(() => notifyAdmin(`${icon} R&D Sniper: ${label}${dir ? ` (${dir === 'bull' ? 'BULLISH' : 'BEARISH'})` : ''}`, [
    `Fase: ${label} · skor ${score}/100`,
    `Harga XAU/USD: $${price.toFixed(2)}`,
    ...(zoneNote ? [`Zona: ${zoneNote}`] : []),
    ...reasons.map(r => `Bukti: ${r}`),
    `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
  ]))
  return NextResponse.json({ ok: true })
}
