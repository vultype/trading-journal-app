import type { Metadata } from 'next'
import { IndicatorMarket } from '@/components/indicators/IndicatorMarket'

export const metadata: Metadata = {
  title: 'Indikator Trading Premium — Datalitiq',
  description: 'Koleksi indikator no-repaint untuk TradingView — sinyal entry, deteksi tren, smart money concepts & alert real-time. Aktivasi invite-only.',
}

export default function IndikatorPage() {
  return <IndicatorMarket />
}
