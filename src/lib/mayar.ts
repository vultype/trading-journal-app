// Integrasi Mayar.id — https://docs.mayar.id
//
// Auth sederhana: header `Authorization: Bearer <API key>`. Tidak ada signature
// request seperti DOKU/iPaymu, sehingga API key adalah satu-satunya rahasia —
// wajib server-side saja, tidak boleh sampai ke browser.
//
// Endpoint yang dipakai (dari dokumentasi resmi):
//   POST /hl/v1/invoice/create   → buat invoice, link pembayaran ada di data.link
//   GET  /hl/v1/invoice/{id}     → status invoice (sumber kebenaran untuk webhook)

export const mayarBase = (production: boolean) =>
  production ? 'https://api.mayar.id/hl/v1' : 'https://api.mayar.club/hl/v1'

// Placeholder nomor HP — Mayar mewajibkan `mobile` tapi checkout belum
// mengumpulkannya. Format Indonesia valid (08 + 10 digit), semua nol agar tak
// pernah cocok dengan nomor WhatsApp aktif milik siapa pun.
const MAYAR_DUMMY_MOBILE = '08000000000'

export type MayarCreateArgs = {
  apiKey: string
  production: boolean
  amount: number
  itemName: string
  description?: string
  buyerName?: string
  buyerEmail?: string
  buyerPhone?: string
  redirectUrl: string
  /** invoice_number kita — dikirim di extraData agar bisa dicocokkan saat webhook. */
  referenceId: string
  /** Umur invoice dalam menit. */
  expiresInMinutes?: number
}

async function mayarFetch(url: string, apiKey: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  })
  const j = await res.json().catch(() => ({} as Record<string, unknown>))
  if (!res.ok) {
    const o = j as { messages?: string; message?: string; data?: unknown }
    // Validation error Mayar sering menaruh detail per-field di `data` (array
    // {field/name, message}). Tanpa ini yang terlihat cuma "validation error"
    // tanpa tahu field mana — persis masalah yang menyulitkan di iPaymu.
    let detail = ''
    if (Array.isArray(o.data)) {
      detail = (o.data as Array<Record<string, unknown>>)
        .map(e => `${e.field ?? e.name ?? '?'}: ${e.message ?? e.msg ?? JSON.stringify(e)}`).join('; ')
    } else if (o.data && typeof o.data === 'object') {
      detail = JSON.stringify(o.data).slice(0, 300)
    }
    const base = o.messages || o.message || `HTTP ${res.status}`
    throw new Error(`Mayar: ${base}${detail ? ` — ${detail}` : ''}`)
  }
  return j as { statusCode?: number; messages?: string; data?: Record<string, unknown> }
}

export async function createMayarInvoice(a: MayarCreateArgs): Promise<{ paymentUrl: string; invoiceId: string; transactionId: string }> {
  const mins = a.expiresInMinutes ?? 60 * 24
  // Field opsional yang KOSONG jangan dikirim sama sekali. Pelajaran dari iPaymu:
  // string kosong ("mobile":"") memicu validation error, sedangkan bila field-nya
  // dihilangkan Mayar menerimanya. Jadi mobile hanya disertakan bila ada isinya.
  const body: Record<string, unknown> = {
    name: a.buyerName || 'Pelanggan Datalitiq',
    email: a.buyerEmail || 'noreply@datalitiq.com',
    redirectUrl: a.redirectUrl,
    description: a.description || a.itemName,
    expiredAt: new Date(Date.now() + mins * 60_000).toISOString(),
    items: [{ quantity: 1, rate: Math.round(a.amount), description: a.itemName }],
    // Dipakai untuk mencocokkan webhook ke order kita. Mayar mengembalikannya apa
    // adanya, tapi nilainya TETAP TIDAK DIPERCAYA saat webhook — lihat catatan di
    // route notification.
    extraData: { noCustomer: a.referenceId, idProd: 'datalitiq-terminal' },
  }
  // Mayar MEWAJIBKAN `mobile`. Kita belum mengumpulkan nomor HP di checkout,
  // jadi dipakai placeholder dulu. Sengaja semua nol setelah prefix agar tidak
  // pernah menjadi nomor WhatsApp orang sungguhan yang bisa terkirim notifikasi.
  // TODO: kumpulkan nomor asli di halaman checkout, lalu teruskan lewat buyerPhone.
  body.mobile = (a.buyerPhone || '').trim() || MAYAR_DUMMY_MOBILE

  const j = await mayarFetch(`${mayarBase(a.production)}/invoice/create`, a.apiKey, { method: 'POST', body: JSON.stringify(body) })
  const d = j.data || {}
  const link = String(d.link || '')
  if (!link) throw new Error('Mayar tidak mengembalikan link pembayaran')
  // Sebagian respons memberi `link` berupa kode pendek, bukan URL penuh.
  const paymentUrl = /^https?:\/\//i.test(link) ? link : String(d.paymentUrl || link)
  return { paymentUrl, invoiceId: String(d.id || ''), transactionId: String(d.transactionId || '') }
}

export async function getMayarInvoice(apiKey: string, production: boolean, invoiceId: string) {
  const j = await mayarFetch(`${mayarBase(production)}/invoice/${encodeURIComponent(invoiceId)}`, apiKey)
  const d = j.data || {}
  return {
    status: String(d.status || ''),
    amount: Number(d.amount ?? 0),
    paymentUrl: String(d.paymentUrl || ''),
    extraData: (d.extraData || {}) as Record<string, unknown>,
  }
}

// Peta status Mayar → status internal payment_orders.
//
// Kasing status TIDAK konsisten antar-endpoint (terkonfirmasi dari docs):
//   - webhook payment.received memakai "SUCCESS" (huruf besar)
//   - GET invoice/{id} memakai "unpaid" (huruf kecil)
// Karena itu input di-normalisasi ke lowercase sebelum dicocokkan.
//
// Daftar lunas tetap KONSERVATIF: apa pun yang tidak dikenali TIDAK mengaktifkan
// langganan, melainkan tetap menunggu. 'success' terkonfirmasi dari dokumentasi
// webhook; sisanya (settled/completed/closed) sinonim wajar yang aman karena
// aktivasi butuh verifikasi balik ke API Mayar. Arah kegagalannya aman —
// aktivasi tertunda bisa diperbaiki manual oleh admin, aktivasi salah berarti
// akses gratis.
const PAID = ['paid', 'settled', 'success', 'completed', 'closed']
const FAILED = ['expired', 'cancelled', 'canceled', 'failed', 'refunded']

export function mapMayarStatus(status: string): 'aktif' | 'menunggu_pembayaran' | 'batal' {
  const s = (status || '').trim().toLowerCase()
  if (PAID.includes(s)) return 'aktif'
  if (FAILED.includes(s)) return 'batal'
  return 'menunggu_pembayaran'
}

export const isKnownMayarStatus = (status: string) => {
  const s = (status || '').trim().toLowerCase()
  return s === 'unpaid' || PAID.includes(s) || FAILED.includes(s)
}

// Uji kredensial tanpa efek samping: ambil daftar invoice (read-only).
export async function testMayarCredentials(apiKey: string, production: boolean) {
  try {
    const res = await fetch(`${mayarBase(production)}/invoice?page=1&pageSize=1`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }, cache: 'no-store',
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = j?.messages || j?.message || `HTTP ${res.status}`
      return { ok: false, detail: res.status === 401 ? 'API key ditolak (401) — periksa key dan mode produksi/sandbox' : String(msg) }
    }
    return { ok: true, detail: `Kredensial valid · mode ${production ? 'PRODUKSI (api.mayar.id)' : 'SANDBOX (api.mayar.club)'}` }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'gagal menghubungi Mayar' }
  }
}
