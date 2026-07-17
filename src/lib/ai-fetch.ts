'use client'

// Helper POST ke endpoint AI: lampirkan Supabase access_token (untuk metering kredit)
// dan kembalikan status agar caller bisa menangani 402 (kredit habis) secara khusus.
import { createClient } from '@/lib/supabase'

export type AiFetchResult<T = Record<string, unknown>> = {
  ok: boolean
  status: number
  data: T
  /** true bila server menolak karena kredit tidak cukup (HTTP 402) */
  insufficient: boolean
}

export async function aiFetch<T = Record<string, unknown>>(url: string, body: unknown): Promise<AiFetchResult<T>> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, data, insufficient: res.status === 402 }
}
