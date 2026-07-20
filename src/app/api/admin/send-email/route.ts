import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_EMAIL } from '@/lib/notify-admin'
import { renderTemplate, TEMPLATES, type TemplateId, type TemplateVars } from '@/lib/email-templates'
import { planName, type PlanId } from '@/lib/pricing'

// Kirim email transaksional MANUAL ke satu user (ADMIN-ONLY).
//  POST { userId, templateId, preview? , overrides? }
//    preview: true  → kembalikan subject + html TANPA mengirim
//    preview: false → kirim via Resend, lalu catat ke email_log (best-effort)
//
// Penerima TIDAK diambil dari body — selalu di-resolve dari userId lewat
// service_role. Ini mencegah endpoint dipakai mengirim ke alamat sembarangan
// seandainya sesi admin bocor.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const FROM = process.env.RESEND_FROM || 'Datalitiq <onboarding@resend.dev>'
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://datalitiq.com').replace(/\/$/, '')

async function requireAdmin(req: Request) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token || !SUPA_URL) return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 })
  const authed = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: { user } } = await authed.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Akses ditolak — khusus admin.' }, { status: 403 })
  return null
}

// Nama sapaan: metadata dulu, kalau kosong pakai bagian depan email.
function displayName(email: string, meta: Record<string, unknown> | undefined) {
  const full = (meta?.full_name || meta?.name) as string | undefined
  if (full && full.trim()) return full.trim().split(' ')[0]
  const local = email.split('@')[0].replace(/[._\-0-9]+/g, ' ').trim()
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'Trader'
}

export async function POST(req: Request) {
  const deny = await requireAdmin(req); if (deny) return deny
  if (!SERVICE) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum diset.' }, { status: 500 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const templateId = String(body.templateId || '') as TemplateId
  const preview = body.preview === true
  const ov = (body.overrides && typeof body.overrides === 'object' ? body.overrides : {}) as Record<string, unknown>

  const tpl = TEMPLATES.find(t => t.id === templateId)
  if (!tpl) return NextResponse.json({ error: 'Template tidak dikenal.' }, { status: 400 })
  if (!userId) return NextResponse.json({ error: 'Pilih user terlebih dahulu.' }, { status: 400 })

  const svc = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })

  const { data: got, error: uErr } = await svc.auth.admin.getUserById(userId)
  if (uErr || !got?.user?.email) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 })
  const target = got.user.email

  // Logo email dari CMS. Gagal baca bukan alasan membatalkan kirim — template
  // otomatis jatuh ke wordmark teks.
  const { data: cfg } = await svc.from('app_config').select('email_logo_url').eq('id', 1).maybeSingle()

  // Order terakhir yang masih menunggu pembayaran — sumber nominal + kode unik.
  const { data: order } = await svc.from('payment_orders')
    .select('plan, total, unique_code, status, created_at')
    .eq('user_id', userId).eq('status', 'menunggu_pembayaran')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  // Tanpa order, template checkout memakai varian tanpa nominal/kode unik —
  // bukan ditolak. Banyak user membuka halaman langganan tanpa pernah membuat
  // order, dan justru merekalah yang paling perlu di-follow up.
  const hasOrder = !!order

  const vars: TemplateVars = {
    name: displayName(target, got.user.user_metadata),
    siteUrl: SITE,
    logoUrl: (cfg?.email_logo_url as string | null) || undefined,
    hasOrder,
    total: Number(order?.total ?? 0),
    uniqueCode: order?.unique_code ? Number(order.unique_code) : undefined,
    planLabel: order?.plan ? planName(order.plan as PlanId) : 'Datalitiq AI Terminal',
    expiresAt: typeof ov.expiresAt === 'string' && ov.expiresAt ? ov.expiresAt : undefined,
    daysLeft: typeof ov.daysLeft === 'number' ? ov.daysLeft : undefined,
    slaText: typeof ov.slaText === 'string' && ov.slaText ? ov.slaText : undefined,
  }

  const { subject, html } = renderTemplate(templateId, vars)
  if (preview) return NextResponse.json({ preview: true, to: target, subject, html, hasOrder })

  const key = process.env.RESEND_API_KEY
  if (!key) return NextResponse.json({ error: 'RESEND_API_KEY belum diset di environment.' }, { status: 500 })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [target], subject, html, reply_to: ADMIN_EMAIL }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json({ error: `Resend menolak — HTTP ${res.status}: ${j?.message || j?.error?.message || 'tidak diketahui'}` }, { status: 502 })
  }

  // Riwayat kirim. Best-effort: kalau tabelnya belum dibuat, email tetap terkirim.
  const { error: logErr } = await svc.from('email_log').insert({
    user_id: userId, email: target, template: templateId, subject, provider_id: j?.id ?? null, sent_by: 'admin-manual',
  })

  return NextResponse.json({
    sent: true, to: target, subject, id: j?.id ?? null, hasOrder,
    logged: !logErr,
    logNote: logErr ? 'Email terkirim, tapi gagal dicatat ke email_log (tabel belum dibuat?).' : undefined,
  })
}

// Riwayat email yang pernah dikirim ke satu user — supaya admin tidak mengirim
// template yang sama dua kali.
export async function GET(req: Request) {
  const deny = await requireAdmin(req); if (deny) return deny
  if (!SERVICE) return NextResponse.json({ log: [] })
  const userId = new URL(req.url).searchParams.get('userId') || ''
  if (!userId) return NextResponse.json({ log: [] })
  const svc = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })
  const { data } = await svc.from('email_log')
    .select('template, subject, created_at').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(20)
  return NextResponse.json({ log: data ?? [] })
}
