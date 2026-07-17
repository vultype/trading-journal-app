// Util pelacakan Meta Pixel (browser-side). Semua fungsi AMAN dipanggil kapan saja:
// kalau pixel belum/tidak terpasang (fbq tak ada), otomatis jadi no-op — tak pernah
// mengganggu UX. Pixel ID & status on/off dikelola dari Admin CMS (tab Marketing).
type FbqParams = Record<string, unknown>
type Fbq = (cmd: string, event: string, params?: FbqParams, opts?: { eventID?: string }) => void

function getFbq(): Fbq | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { fbq?: Fbq }
  return w.fbq ?? null
}

// Event standar Meta yang dipakai di funnel Datalitiq.
export type PixelEvent =
  | 'PageView' | 'ViewContent' | 'Lead' | 'CompleteRegistration' | 'InitiateCheckout' | 'Purchase'

export function track(event: PixelEvent, params?: FbqParams, opts?: { eventID?: string }) {
  const f = getFbq(); if (!f) return
  try { f('track', event, params, opts) } catch { /* jangan pernah lempar error karena pixel */ }
}

// Purchase gampang dobel-terkirim (user refresh halaman sukses / balik ke tab).
// Kunci per-invoice via localStorage supaya 1 transaksi = 1 konversi di Meta —
// krusial agar ROAS yang dilaporkan ke algoritma iklan akurat.
export function trackPurchaseOnce(invoice: string, value: number, currency = 'IDR') {
  if (typeof window === 'undefined' || !invoice) return
  const key = `dtq_fbq_purchase_${invoice}`
  try {
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
  } catch { /* mode privat / storage penuh → tetap lanjut kirim sekali */ }
  track('Purchase', { value, currency, content_type: 'product' }, { eventID: `purchase_${invoice}` })
}
