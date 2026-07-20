'use client'

// WAJIB 'use client': modul ini menyimpan STATE modul (_items/_listeners) yang harus
// SATU instance untuk semua pemakai. Tanpa directive ini, saat <Toaster /> dipasang dari
// root layout (server component), Next.js membuat instance modul terpisah → toast yang
// dikirim halaman masuk ke Set listener yang berbeda dari yang didengar Toaster,
// sehingga notifikasi tak pernah muncul.
type ToastType = 'success' | 'error' | 'info'
export type ToastItem = { id: string; message: string; type: ToastType }
type Listener = (items: ToastItem[]) => void

let _items: ToastItem[] = []
const _listeners = new Set<Listener>()

function _notify() { _listeners.forEach(l => l([..._items])) }

function _add(message: string, type: ToastType, duration = 3200) {
  const id = crypto.randomUUID()
  _items = [..._items, { id, message, type }]
  _notify()
  setTimeout(() => {
    _items = _items.filter(i => i.id !== id)
    _notify()
  }, duration)
}

export const toast = {
  success: (msg: string) => _add(msg, 'success'),
  error:   (msg: string) => _add(msg, 'error'),
  info:    (msg: string) => _add(msg, 'info'),
}

export function subscribeToast(fn: Listener): () => void {
  _listeners.add(fn)
  return () => { _listeners.delete(fn) }
}
