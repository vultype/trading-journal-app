import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPaymentConfig } from '@/lib/payment-config'
import { testIpaymuCredentials } from '@/lib/ipaymu'

// Tes kredensial gateway yang TERSIMPAN (admin-only). Memakai endpoint baca-saja
// (iPaymu payment-channels) → tidak membuat transaksi apa pun.
// Berguna memisahkan "kode salah" vs "kredensial/mode salah" tanpa menebak.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const ADMIN_EMAIL = 'vultype@gmail.com'

const mask = (v: string) => v ? v.slice(0, 2) + '••••' + v.slice(-3) : '(kosong)'

export async function POST(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token || !SUPA_URL) return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 })
  const authed = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: { user } } = await authed.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Akses ditolak — khusus admin.' }, { status: 403 })

  const { gateway } = await req.json().catch(() => ({ gateway: '' }))
  const cfg = await getPaymentConfig()

  if (gateway === 'ipaymu') {
    const r = await testIpaymuCredentials(cfg.ipaymu.va, cfg.ipaymu.apiKey, cfg.ipaymu.production)
    return NextResponse.json({
      ...r,
      mode: cfg.ipaymu.production ? 'PRODUKSI' : 'SANDBOX',
      endpoint: cfg.ipaymu.production ? 'my.ipaymu.com' : 'sandbox.ipaymu.com',
      va: cfg.ipaymu.va || '(kosong)',
      apiKey: mask(cfg.ipaymu.apiKey),
    })
  }
  return NextResponse.json({ error: 'Tes untuk gateway ini belum tersedia.' }, { status: 400 })
}
