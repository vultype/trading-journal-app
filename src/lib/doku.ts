// Integrasi DOKU Checkout (non-SNAP) — server-side. REST API langsung + node:crypto.
// Secret key HANYA server-side. Referensi signature:
// https://developers.doku.com/get-started-with-doku-api/signature-component/non-snap
import crypto from 'crypto'

const CREATE_TARGET = '/checkout/v1/payment'

export function dokuConfig() {
  const clientId = process.env.DOKU_CLIENT_ID || ''
  const secretKey = process.env.DOKU_SECRET_KEY || ''
  const isProduction = process.env.DOKU_ENV === 'production'
  const apiBase = isProduction ? 'https://api.doku.com' : 'https://api-sandbox.doku.com'
  return { clientId, secretKey, isProduction, apiBase }
}

export function dokuConfigured() {
  return !!(process.env.DOKU_CLIENT_ID && process.env.DOKU_SECRET_KEY)
}

// Timestamp ISO8601 UTC tanpa milidetik: 2020-08-11T08:45:42Z
function dokuTimestamp(d = new Date()) {
  return d.toISOString().split('.')[0] + 'Z'
}

// Digest = base64( sha256( rawBody ) )
function digestOf(rawBody: string) {
  return crypto.createHash('sha256').update(rawBody, 'utf8').digest('base64')
}

// Signature = "HMACSHA256=" + base64( HMAC-SHA256(componentString, secretKey) )
// componentString = Client-Id / Request-Id / Request-Timestamp / Request-Target / Digest (newline)
function buildSignature(opts: {
  clientId: string; requestId: string; timestamp: string; requestTarget: string; digest?: string; secretKey: string
}) {
  const lines = [
    `Client-Id:${opts.clientId}`,
    `Request-Id:${opts.requestId}`,
    `Request-Timestamp:${opts.timestamp}`,
    `Request-Target:${opts.requestTarget}`,
  ]
  if (opts.digest) lines.push(`Digest:${opts.digest}`) // Digest tidak ada untuk GET/DELETE
  const component = lines.join('\n')
  const hmac = crypto.createHmac('sha256', opts.secretKey).update(component, 'utf8').digest('base64')
  return `HMACSHA256=${hmac}`
}

export type DokuCheckoutParams = {
  invoiceNumber: string
  amount: number
  itemName: string
  customerId?: string
  customerName?: string
  customerEmail?: string
  callbackUrl?: string       // user diarahkan ke sini setelah bayar
  notificationUrl?: string   // webhook (override per-transaksi)
}

// Buat sesi DOKU Checkout → { paymentUrl }. Lempar Error dgn pesan DOKU bila gagal.
export async function createDokuCheckout(p: DokuCheckoutParams): Promise<{ paymentUrl: string; tokenId?: string }> {
  const { clientId, secretKey, apiBase } = dokuConfig()
  if (!clientId || !secretKey) throw new Error('DOKU_CLIENT_ID / DOKU_SECRET_KEY belum diset')

  const body = {
    order: {
      amount: Math.round(p.amount),
      invoice_number: p.invoiceNumber,
      currency: 'IDR',
      ...(p.callbackUrl ? { callback_url: p.callbackUrl } : {}),
      line_items: [{ name: p.itemName.slice(0, 255), price: Math.round(p.amount), quantity: 1 }],
    },
    payment: { payment_due_date: 60 },
    customer: {
      ...(p.customerId ? { id: p.customerId.slice(0, 60) } : {}),
      name: (p.customerName || 'Trader').slice(0, 60),
      ...(p.customerEmail ? { email: p.customerEmail } : {}),
    },
    ...(p.notificationUrl ? { additional_info: { override_notification_url: p.notificationUrl } } : {}),
  }
  const rawBody = JSON.stringify(body)
  const requestId = crypto.randomUUID()
  const timestamp = dokuTimestamp()
  const signature = buildSignature({
    clientId, requestId, timestamp, requestTarget: CREATE_TARGET, digest: digestOf(rawBody), secretKey,
  })

  const res = await fetch(`${apiBase}${CREATE_TARGET}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': clientId,
      'Request-Id': requestId,
      'Request-Timestamp': timestamp,
      Signature: signature,
    },
    body: rawBody,
    cache: 'no-store',
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = Array.isArray(j?.error?.messages) ? j.error.messages.join('; ')
      : Array.isArray(j?.message) ? j.message.join('; ')
      : (j?.message || j?.error || `HTTP ${res.status}`)
    throw new Error(`DOKU: ${msg}`)
  }
  const url = j?.response?.payment?.url
  if (!url) throw new Error('DOKU: URL pembayaran tidak ditemukan di respons')
  return { paymentUrl: url, tokenId: j?.response?.payment?.token_id }
}

// Verifikasi signature notifikasi (webhook). requestTarget = path webhook kita.
// Digunakan bersama header yang DOKU kirim: Client-Id, Request-Id, Request-Timestamp, Signature.
export function verifyDokuNotification(opts: {
  clientId: string; requestId: string; timestamp: string; requestTarget: string; rawBody: string; signature: string
}): boolean {
  const { secretKey } = dokuConfig()
  if (!secretKey) return false
  const expected = buildSignature({
    clientId: opts.clientId, requestId: opts.requestId, timestamp: opts.timestamp,
    requestTarget: opts.requestTarget, digest: digestOf(opts.rawBody), secretKey,
  })
  const a = Buffer.from(expected)
  const b = Buffer.from(String(opts.signature || ''))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Petakan status transaksi DOKU → status order internal.
export function mapDokuStatus(status: string): 'aktif' | 'menunggu_pembayaran' | 'batal' {
  switch (String(status).toUpperCase()) {
    case 'SUCCESS':
      return 'aktif'
    case 'PENDING':
      return 'menunggu_pembayaran'
    case 'FAILED':
    case 'EXPIRED':
    case 'VOID':
    case 'REFUND':
      return 'batal'
    default:
      return 'menunggu_pembayaran'
  }
}
