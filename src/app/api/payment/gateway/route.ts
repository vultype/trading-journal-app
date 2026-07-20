import { NextResponse } from 'next/server'
import { getPaymentConfig, gatewayReady } from '@/lib/payment-config'

// Endpoint PUBLIK — halaman checkout perlu tahu gateway mana yang aktif.
// AMAN: hanya mengembalikan nama gateway + flag siap/tidak. TIDAK ADA nilai secret.
// clientKey Midtrans memang publik (dipakai Snap.js di browser), jadi boleh ikut.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const c = await getPaymentConfig()
    const ready = gatewayReady(c)
    const active = c.activeGateway
    return NextResponse.json({
      gateway: active !== 'none' && ready[active as keyof typeof ready] ? active : 'none',
      ready,
      midtransClientKey: active === 'midtrans' ? c.midtrans.clientKey : '',
      midtransProduction: c.midtrans.production,
    })
  } catch {
    return NextResponse.json({ gateway: 'none', ready: { doku: false, ipaymu: false, midtrans: false, mayar: false, manual: true, none: false }, midtransClientKey: '', midtransProduction: false })
  }
}
