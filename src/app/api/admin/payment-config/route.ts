import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Kelola kredensial payment gateway (ADMIN). Baca/tulis pakai SERVICE ROLE (bypass RLS)
// karena tabel payment_config sengaja tanpa policy — anon/authenticated tak bisa akses.
//
// ⚠️ GET TIDAK PERNAH mengembalikan nilai secret asli — hanya MASK (•••• + 4 karakter
// terakhir) supaya admin bisa memastikan key mana yang tersimpan tanpa membocorkannya.
// POST: field secret yang dikirim KOSONG berarti "jangan ubah" (biar tak perlu ketik ulang).
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ADMIN_EMAIL = 'vultype@gmail.com'
const GATEWAYS = ['none', 'doku', 'ipaymu', 'midtrans']

const mask = (v: string | null) => { const s = (v || '').trim(); return s ? '••••' + s.slice(-4) : '' }

async function requireAdmin(req: Request) {
  // Auth DULU, baru cek konfigurasi server — supaya pemanggil anonim tidak bisa
  // menyimpulkan status konfigurasi server dari perbedaan pesan error.
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token || !SUPA_URL) return { err: NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 }) }
  const authed = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: { user } } = await authed.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return { err: NextResponse.json({ error: 'Akses ditolak — khusus admin.' }, { status: 403 }) }
  if (!SERVICE) return { err: NextResponse.json({ error: 'Server belum dikonfigurasi (SERVICE_ROLE_KEY).' }, { status: 503 }) }
  return { sb: createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } }) }
}

export async function GET(req: Request) {
  const g = await requireAdmin(req); if (g.err) return g.err
  const { data, error } = await g.sb!.from('payment_config').select('*').eq('id', 1).maybeSingle()
  if (error) return NextResponse.json({ error: error.message, needsMigration: /relation|does not exist|schema cache/i.test(error.message) }, { status: 500 })
  const r = data ?? {}
  return NextResponse.json({
    activeGateway: r.active_gateway ?? 'none',
    doku: { clientId: r.doku_client_id ?? '', secretKeyMask: mask(r.doku_secret_key), production: !!r.doku_production },
    ipaymu: { va: r.ipaymu_va ?? '', apiKeyMask: mask(r.ipaymu_api_key), production: !!r.ipaymu_production },
    midtrans: { clientKey: r.midtrans_client_key ?? '', serverKeyMask: mask(r.midtrans_server_key), production: !!r.midtrans_production },
  })
}

export async function POST(req: Request) {
  const g = await requireAdmin(req); if (g.err) return g.err
  const b = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() }

  if (typeof b.activeGateway === 'string') {
    if (!GATEWAYS.includes(b.activeGateway)) return NextResponse.json({ error: 'Gateway tidak dikenal.' }, { status: 400 })
    patch.active_gateway = b.activeGateway
  }
  // Field non-secret: selalu ditimpa. Field secret: hanya ditimpa bila diisi.
  const setStr = (col: string, v: unknown) => { if (typeof v === 'string') patch[col] = v.trim() || null }
  const setSecret = (col: string, v: unknown) => { if (typeof v === 'string' && v.trim()) patch[col] = v.trim() }
  const setBool = (col: string, v: unknown) => { if (typeof v === 'boolean') patch[col] = v }

  setStr('doku_client_id', b.doku?.clientId); setSecret('doku_secret_key', b.doku?.secretKey); setBool('doku_production', b.doku?.production)
  setStr('ipaymu_va', b.ipaymu?.va); setSecret('ipaymu_api_key', b.ipaymu?.apiKey); setBool('ipaymu_production', b.ipaymu?.production)
  setStr('midtrans_client_key', b.midtrans?.clientKey); setSecret('midtrans_server_key', b.midtrans?.serverKey); setBool('midtrans_production', b.midtrans?.production)

  const { error } = await g.sb!.from('payment_config').upsert(patch, { onConflict: 'id' })
  if (error) return NextResponse.json({ error: error.message, needsMigration: /relation|does not exist|schema cache/i.test(error.message) }, { status: 500 })
  return NextResponse.json({ ok: true })
}
