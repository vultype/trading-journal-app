import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { SharePayload } from '@/lib/finance-share'
import ShareView from './ShareView'

// Halaman publik untuk tautan berbagi ringkasan keuangan. TANPA login.
//
// Dibaca lewat service_role di server, satu baris, dicari berdasarkan slug —
// tabel fin_shares sendiri tidak punya policy untuk anon, jadi tidak ada jalan
// bagi siapa pun untuk memanen snapshot orang lain (lihat catatan di
// supabase-personal-finance-share.sql).
//
// Seluruh tampilan ada di ShareView (client component). Batas ini disengaja:
// yang menyentuh service_role hanya file ini, dan yang dikirim ke browser hanya
// payload yang sudah jadi.
export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

type Row = { id: string; title: string; payload: SharePayload; expires_at: string | null; revoked: boolean; views: number }

async function getShare(slug: string): Promise<Row | null> {
  if (!SUPA_URL || !SERVICE || !/^[A-Za-z0-9]{6,32}$/.test(slug)) return null
  const svc = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })
  const { data } = await svc.from('fin_shares')
    .select('id,title,payload,expires_at,revoked,views').eq('slug', slug).maybeSingle()
  if (!data) return null
  const row = data as Row
  if (row.revoked) return null
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null
  return row
}

// Tautan pribadi tidak boleh masuk indeks mesin pencari — itu mengubah "hanya
// yang dikirimi tautan" menjadi "siapa pun yang mencari".
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const row = await getShare(slug)
  if (!row) notFound()

  // Penghitung tampilan: gagal menaikkannya bukan alasan menolak menampilkan
  // halamannya.
  try {
    const svc = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })
    await svc.from('fin_shares').update({ views: row.views + 1 }).eq('id', row.id)
  } catch { /* diamkan */ }

  return <ShareView p={row.payload} title={row.title} expiresAt={row.expires_at} />
}
