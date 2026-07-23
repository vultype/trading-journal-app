import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseBcaEmail } from '@/lib/bca-parser'

// Terima satu notifikasi email bank dan simpan sebagai DRAF di fin_inbox.
//
//   POST { token, messageId, subject?, from?, text?, html? }
//
// Dipanggil oleh Google Apps Script yang berjalan di akun Gmail pemilik. Skrip
// itu tidak memegang kredensial Supabase apa pun — hanya token acak yang bisa
// dicabut kapan saja dari UI.
//
// Endpoint ini TIDAK PERNAH menulis ke fin_transactions. Notifikasi bank tidak
// memuat kategori, dan menebaknya lalu menulis langsung berarti satu tebakan
// salah ikut mencemari analitik tanpa pernah terlihat. Pemindahan ke transaksi
// hanya terjadi setelah manusia menyetujui.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Pengirim yang boleh diterima. Apps Script sudah memfilter, tapi lapisan ini
// tetap perlu: tanpa itu, siapa pun yang mengetahui token bisa menyuntikkan
// "transaksi" berisi apa pun.
const ALLOWED_FROM = /(^|[<@.\s])bca\.co\.id>?$|bca@bca\.co\.id/i

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const token = String(b.token || '')
  // Bentuk token diperiksa SEBELUM konfigurasi server: pemanggil tanpa token
  // yang sah tidak perlu tahu apa pun tentang keadaan server.
  if (!/^[a-f0-9]{40,128}$/i.test(token)) {
    return NextResponse.json({ error: 'Token tidak valid.' }, { status: 401 })
  }
  if (!SERVICE || !SUPA_URL) {
    return NextResponse.json({ error: 'Server belum dikonfigurasi.' }, { status: 500 })
  }

  const svc = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })
  const { data: tok } = await svc.from('fin_ingest_tokens').select('user_id').eq('token', token).maybeSingle()
  if (!tok) return NextResponse.json({ error: 'Token tidak dikenal.' }, { status: 401 })
  const userId = tok.user_id as string

  const from = String(b.from || '')
  if (from && !ALLOWED_FROM.test(from)) {
    return NextResponse.json({ error: 'Pengirim tidak diizinkan.', from }, { status: 400 })
  }

  const messageId = String(b.messageId || '').slice(0, 200)
  const text = typeof b.text === 'string' ? b.text : undefined
  const html = typeof b.html === 'string' ? b.html : undefined
  const raw = (text || html || '').slice(0, 20_000)

  const parsed = parseBcaEmail({ text, html })

  // Gagal parsing tetap disimpan — lihat catatan di supabase-…-inbox.sql.
  if (!parsed.ok) {
    if (!messageId) return NextResponse.json({ error: 'messageId wajib saat parsing gagal.' }, { status: 400 })
    const { error } = await svc.from('fin_inbox').upsert({
      user_id: userId, ext_ref: `msg:${messageId}`, status: 'gagal',
      parse_error: parsed.reason, raw, source: 'bca-email',
    }, { onConflict: 'user_id,ext_ref', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'gagal', reason: parsed.reason })
  }

  // Transaksi gagal/pending di sisi bank bukan pengeluaran — jangan diusulkan.
  const status = parsed.successful ? 'draft' : 'ignored'

  // Tebakan kategori dari aturan yang sudah dipelajari. Dicocokkan sebagai
  // substring case-insensitive terhadap merchant DAN jenis transaksi, karena
  // sebagian notifikasi hanya punya salah satunya.
  const { data: rules } = await svc.from('fin_rules')
    .select('match,type,category_id,account_id').eq('user_id', userId)
  const hay = `${parsed.merchant ?? ''} ${parsed.transferType ?? ''}`.toLowerCase()
  const rule = (rules ?? []).find(r => hay.includes(String(r.match).toLowerCase()))

  const { error } = await svc.from('fin_inbox').upsert({
    user_id: userId,
    ext_ref: parsed.ref,
    status,
    source: 'bca-email',
    tx_date: parsed.date,
    amount: parsed.amount,
    fee: parsed.fee,
    merchant: parsed.merchant,
    transfer_type: parsed.transferType,
    source_fund: parsed.sourceOfFund,
    suggested_type: rule?.type ?? 'expense',
    suggested_category_id: rule?.category_id ?? null,
    suggested_account_id: rule?.account_id ?? null,
    raw,
    parse_error: null,
  }, { onConflict: 'user_id,ext_ref', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await svc.from('fin_ingest_tokens').update({ last_used: new Date().toISOString() }).eq('token', token)

  return NextResponse.json({
    ok: true, status, ref: parsed.ref, amount: parsed.amount,
    merchant: parsed.merchant, matched: !!rule,
  })
}
