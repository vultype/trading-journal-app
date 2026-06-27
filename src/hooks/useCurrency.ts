'use client'

import { useStore } from '@/lib/store'
import { formatCurrency } from '@/lib/calculations'

export function useCurrency() {
  const { settings } = useStore()
  return (n: number) => formatCurrency(n, settings.currency)
}
