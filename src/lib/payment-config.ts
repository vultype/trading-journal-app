// Konfigurasi payment gateway — dibaca SERVER-SIDE saja (service_role, bypass RLS).
// Tabel payment_config berisi SECRET; RLS-nya tanpa policy sehingga anon/authenticated
// tak bisa membacanya. JANGAN pernah kirim nilai secret ini ke client.
//
// Fallback ke ENV: kalau tabel belum dimigrasi / kolom kosong, dipakai env lama
// (DOKU_*, MIDTRANS_*) supaya integrasi yang sudah berjalan tidak putus.
import { createClient } from '@supabase/supabase-js'

export type Gateway = 'none' | 'doku' | 'ipaymu' | 'midtrans'

export type PaymentConfig = {
  activeGateway: Gateway
  doku: { clientId: string; secretKey: string; production: boolean }
  ipaymu: { va: string; apiKey: string; production: boolean }
  midtrans: { serverKey: string; clientKey: string; production: boolean }
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function svc() {
  if (!SUPA_URL || !SERVICE) return null
  return createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })
}

// Fallback env (perilaku lama) — dipakai bila DB belum diisi.
function envFallback(): PaymentConfig {
  const dokuOn = !!(process.env.DOKU_CLIENT_ID && process.env.DOKU_SECRET_KEY)
  const midOn = !!(process.env.MIDTRANS_SERVER_KEY && process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY)
  return {
    activeGateway: process.env.NEXT_PUBLIC_DOKU_ENABLED === 'true' && dokuOn ? 'doku' : midOn ? 'midtrans' : 'none',
    doku: { clientId: process.env.DOKU_CLIENT_ID || '', secretKey: process.env.DOKU_SECRET_KEY || '', production: process.env.DOKU_ENV === 'production' },
    ipaymu: { va: process.env.IPAYMU_VA || '', apiKey: process.env.IPAYMU_API_KEY || '', production: process.env.IPAYMU_ENV === 'production' },
    midtrans: { serverKey: process.env.MIDTRANS_SERVER_KEY || '', clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '', production: process.env.MIDTRANS_IS_PRODUCTION === 'true' },
  }
}

type Row = {
  active_gateway: string
  doku_client_id: string | null; doku_secret_key: string | null; doku_production: boolean
  ipaymu_va: string | null; ipaymu_api_key: string | null; ipaymu_production: boolean
  midtrans_server_key: string | null; midtrans_client_key: string | null; midtrans_production: boolean
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const env = envFallback()
  const sb = svc()
  if (!sb) return env
  try {
    const { data, error } = await sb.from('payment_config').select('*').eq('id', 1).maybeSingle()
    if (error || !data) return env
    const r = data as Row
    const s = (v: string | null, fb: string) => (v && v.trim() ? v.trim() : fb)
    const g = (r.active_gateway || 'none') as Gateway
    return {
      activeGateway: ['doku', 'ipaymu', 'midtrans', 'none'].includes(g) ? g : 'none',
      doku: { clientId: s(r.doku_client_id, env.doku.clientId), secretKey: s(r.doku_secret_key, env.doku.secretKey), production: !!r.doku_production },
      ipaymu: { va: s(r.ipaymu_va, env.ipaymu.va), apiKey: s(r.ipaymu_api_key, env.ipaymu.apiKey), production: !!r.ipaymu_production },
      midtrans: { serverKey: s(r.midtrans_server_key, env.midtrans.serverKey), clientKey: s(r.midtrans_client_key, env.midtrans.clientKey), production: !!r.midtrans_production },
    }
  } catch { return env }
}

// Status "siap dipakai" per gateway — AMAN dikirim ke client (tanpa nilai secret).
export function gatewayReady(c: PaymentConfig) {
  return {
    doku: !!(c.doku.clientId && c.doku.secretKey),
    ipaymu: !!(c.ipaymu.va && c.ipaymu.apiKey),
    midtrans: !!(c.midtrans.serverKey && c.midtrans.clientKey),
  }
}
