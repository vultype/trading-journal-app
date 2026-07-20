// Integrasi iPaymu API v2 (redirect payment) — server-side. Secret HANYA server-side.
// Signature (per dok resmi iPaymu v2):
//   bodyHash     = lowercase( sha256( JSON.stringify(body) ) )
//   stringToSign = METHOD(UPPER) + ':' + va + ':' + bodyHash + ':' + apiKey
//   signature    = hex( HMAC-SHA256( stringToSign, apiKey ) )
//   timestamp    = YYYYMMDDHHmmss
// Header: va, signature, timestamp, Content-Type: application/json
import crypto from 'crypto'

const BASE_PROD = 'https://my.ipaymu.com/api/v2'
const BASE_SANDBOX = 'https://sandbox.ipaymu.com/api/v2'

export function ipaymuBase(production: boolean) {
  return production ? BASE_PROD : BASE_SANDBOX
}

function tsNow(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export function ipaymuSignature(method: string, va: string, apiKey: string, body: unknown) {
  const json = JSON.stringify(body ?? {})
  const bodyHash = crypto.createHash('sha256').update(json, 'utf8').digest('hex').toLowerCase()
  const stringToSign = `${method.toUpperCase()}:${va}:${bodyHash}:${apiKey}`
  return crypto.createHmac('sha256', apiKey).update(stringToSign, 'utf8').digest('hex')
}

export type IpaymuParams = {
  va: string
  apiKey: string
  production: boolean
  referenceId: string          // invoice_number kita
  amount: number
  itemName: string
  buyerName?: string
  buyerEmail?: string
  buyerPhone?: string
  returnUrl?: string           // user diarahkan ke sini setelah bayar
  cancelUrl?: string
  notifyUrl?: string           // webhook
}

// Buat sesi pembayaran redirect → { paymentUrl, sessionId }. Lempar Error dgn pesan iPaymu bila gagal.
export async function createIpaymuPayment(p: IpaymuParams): Promise<{ paymentUrl: string; sessionId?: string }> {
  if (!p.va || !p.apiKey) throw new Error('Kredensial iPaymu belum diatur')
  const url = `${ipaymuBase(p.production)}/payment`
  const body: Record<string, unknown> = {
    product: [p.itemName],
    qty: [1],
    price: [Math.round(p.amount)],
    referenceId: p.referenceId,
    buyerName: p.buyerName || 'Pelanggan',
    buyerEmail: p.buyerEmail || '',
    buyerPhone: p.buyerPhone || '',
    returnUrl: p.returnUrl || '',
    cancelUrl: p.cancelUrl || '',
    notifyUrl: p.notifyUrl || '',
  }
  const signature = ipaymuSignature('POST', p.va, p.apiKey, body)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      va: p.va,
      signature,
      timestamp: tsNow(),
    },
    body: JSON.stringify(body),   // WAJIB sama persis dgn yg di-hash utk signature
    cache: 'no-store',
  })
  const j = await res.json().catch(() => ({}))
  // iPaymu: { Status: 200, Message, Data: { SessionID, Url } }
  const status = Number(j?.Status ?? j?.status ?? 0)
  const data = j?.Data ?? j?.data
  const payUrl = data?.Url ?? data?.url
  if (status !== 200 || !payUrl) {
    throw new Error(j?.Message || j?.message || `iPaymu error (status ${status || res.status})`)
  }
  return { paymentUrl: String(payUrl), sessionId: data?.SessionID ?? data?.sessionId }
}

// Petakan status notifikasi iPaymu → status order internal.
// iPaymu mengirim `status` (berhasil|pending|gagal) dan/atau `status_code` (1|0|-2 dst).
export function mapIpaymuStatus(status: string, statusCode?: string | number): 'aktif' | 'menunggu_pembayaran' | 'batal' {
  const s = String(status || '').toLowerCase()
  const c = String(statusCode ?? '')
  if (s === 'berhasil' || s === 'success' || c === '1') return 'aktif'
  if (s === 'pending' || c === '0') return 'menunggu_pembayaran'
  return 'batal'
}
