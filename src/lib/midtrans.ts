// Integrasi Midtrans (Snap) — server-side. Pakai REST API langsung (tanpa SDK) +
// node:crypto untuk verifikasi signature webhook. Server key HANYA server-side.
import crypto from 'crypto'

export function midtransConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  const apiBase = isProduction ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com'
  const snapJs = `${apiBase}/snap/snap.js`
  return { serverKey, clientKey, isProduction, apiBase, snapJs }
}

export function midtransConfigured() {
  return !!(process.env.MIDTRANS_SERVER_KEY && process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY)
}

export type SnapParams = {
  orderId: string
  grossAmount: number
  itemName: string
  customerEmail?: string
  customerName?: string
  finishUrl?: string
}

// Buat transaksi Snap → { token, redirect_url }. Lempar Error dgn pesan Midtrans bila gagal.
export async function createSnapTransaction(p: SnapParams): Promise<{ token: string; redirect_url: string }> {
  const { serverKey, apiBase } = midtransConfig()
  if (!serverKey) throw new Error('MIDTRANS_SERVER_KEY belum diset')
  const auth = Buffer.from(serverKey + ':').toString('base64')
  const body = {
    transaction_details: { order_id: p.orderId, gross_amount: Math.round(p.grossAmount) },
    item_details: [{ id: p.orderId, price: Math.round(p.grossAmount), quantity: 1, name: p.itemName.slice(0, 50) }],
    customer_details: { email: p.customerEmail, first_name: (p.customerName || 'Trader').slice(0, 40) },
    credit_card: { secure: true },
    ...(p.finishUrl ? { callbacks: { finish: p.finishUrl } } : {}),
  }
  const res = await fetch(`${apiBase}/snap/v1/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = Array.isArray(j?.error_messages) ? j.error_messages.join('; ') : (j?.status_message || `HTTP ${res.status}`)
    throw new Error(`Midtrans: ${msg}`)
  }
  return { token: j.token, redirect_url: j.redirect_url }
}

// Verifikasi signature webhook: sha512(order_id + status_code + gross_amount + serverKey)
export function verifyNotificationSignature(n: { order_id: string; status_code: string; gross_amount: string; signature_key: string }): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
  if (!serverKey) return false
  const expected = crypto.createHash('sha512').update(n.order_id + n.status_code + n.gross_amount + serverKey).digest('hex')
  // timing-safe compare
  const a = Buffer.from(expected)
  const b = Buffer.from(String(n.signature_key || ''))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Petakan status transaksi Midtrans → status order internal (dipakai billing & gating).
export function mapTransactionStatus(transactionStatus: string, fraudStatus?: string): 'aktif' | 'menunggu_pembayaran' | 'menunggu_verifikasi' | 'batal' {
  switch (transactionStatus) {
    case 'capture':
      return fraudStatus === 'challenge' ? 'menunggu_verifikasi' : 'aktif'
    case 'settlement':
      return 'aktif'
    case 'pending':
      return 'menunggu_pembayaran'
    case 'deny':
    case 'cancel':
    case 'expire':
    case 'failure':
      return 'batal'
    default:
      return 'menunggu_pembayaran'
  }
}
