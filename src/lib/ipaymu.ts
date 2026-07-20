// Integrasi iPaymu API v2 (redirect payment) — server-side. Secret HANYA server-side.
// Signature (per dok resmi iPaymu v2):
//   payload      = JSON.stringify(body) — slash TIDAK di-escape (JSON_UNESCAPED_SLASHES)
//   bodyHash     = lowercase( sha256( payload ) )
//   stringToSign = METHOD(UPPER) + ':' + va + ':' + bodyHash + ':' + apiKey
//   signature    = hex( HMAC-SHA256( stringToSign, apiKey ) )
//   timestamp    = YYYYMMDDHHmmss (WIB)
// Header: va, signature, timestamp, Content-Type: application/json
import crypto from 'crypto'

const BASE_PROD = 'https://my.ipaymu.com/api/v2'
const BASE_SANDBOX = 'https://sandbox.ipaymu.com/api/v2'

export function ipaymuBase(production: boolean) {
  return production ? BASE_PROD : BASE_SANDBOX
}

// Timestamp WIB (Asia/Jakarta) — server Vercel jalan UTC, iPaymu layanan Indonesia.
// Digeser +7 jam lalu dibaca pakai getter UTC agar hasilnya tak bergantung TZ server.
export function ipaymuTimestamp(d = new Date()) {
  const j = new Date(d.getTime() + 7 * 3_600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${j.getUTCFullYear()}${p(j.getUTCMonth() + 1)}${p(j.getUTCDate())}${p(j.getUTCHours())}${p(j.getUTCMinutes())}${p(j.getUTCSeconds())}`
}

// Serialisasi body. iPaymu memakai json_encode($body, JSON_UNESCAPED_SLASHES) di contoh
// resminya → '/' TIDAK di-escape, persis seperti JSON.stringify bawaan JS.
// DIVERIFIKASI langsung ke API sandbox iPaymu memakai kredensial demo publik:
//   tanpa escape '/' → 200 Success ; dengan escape '\/' → 401 unauthorized signature.
// Fungsi ini jadi SATU sumber string: dipakai untuk hash DAN sebagai body request,
// sehingga keduanya mustahil berbeda.
export function ipaymuPayload(body: unknown): string {
  return JSON.stringify(body ?? {})
}

export function ipaymuSignature(method: string, va: string, apiKey: string, payload: string) {
  const bodyHash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex').toLowerCase()
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
  const payload = ipaymuPayload(body)
  const signature = ipaymuSignature('POST', p.va, p.apiKey, payload)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      va: p.va,
      signature,
      timestamp: ipaymuTimestamp(),
    },
    body: payload,   // WAJIB string yang SAMA PERSIS dengan yang di-hash
    cache: 'no-store',
  })
  const j = await res.json().catch(() => ({}))
  // iPaymu: { Status: 200, Message, Data: { SessionID, Url } }
  const status = Number(j?.Status ?? j?.status ?? 0)
  const data = j?.Data ?? j?.data
  const payUrl = data?.Url ?? data?.url
  if (status !== 200 || !payUrl) {
    const msg = j?.Message || j?.message || `status ${status || res.status}`
    const mode = p.production ? 'PRODUKSI (my.ipaymu.com)' : 'SANDBOX (sandbox.ipaymu.com)'
    // Sertakan mode + VA di pesan: penyebab tersering "unauthorized signature" adalah
    // kredensial sandbox dipakai ke endpoint produksi (atau sebaliknya), atau VA salah.
    throw new Error(`iPaymu: ${msg} — mode ${mode}, VA ${p.va}. Pastikan VA & API Key cocok dengan mode ini (Admin → Pembayaran).`)
  }
  return { paymentUrl: String(payUrl), sessionId: data?.SessionID ?? data?.sessionId }
}

// Tes kredensial (VA + API Key + mode) TANPA membuat transaksi: panggil payment-channels
// yang sifatnya baca-saja. Dipakai tombol "Test Koneksi" di Admin → Pembayaran.
export async function testIpaymuCredentials(va: string, apiKey: string, production: boolean): Promise<{ ok: boolean; message: string; channels?: number }> {
  if (!va || !apiKey) return { ok: false, message: 'VA / API Key belum diisi' }
  try {
    const payload = ipaymuPayload({})   // '{}' — sesuai contoh resmi utk GET
    const signature = ipaymuSignature('GET', va, apiKey, payload)
    const res = await fetch(`${ipaymuBase(production)}/payment-channels`, {
      method: 'GET',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', va, signature, timestamp: ipaymuTimestamp() },
      cache: 'no-store',
    })
    const j = await res.json().catch(() => ({}))
    const status = Number(j?.Status ?? j?.status ?? res.status)
    const msg = j?.Message || j?.message || `HTTP ${res.status}`
    if (status === 200) return { ok: true, message: 'Kredensial valid', channels: Array.isArray(j?.Data) ? j.Data.length : undefined }
    return { ok: false, message: msg }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'gagal menghubungi iPaymu' }
  }
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
