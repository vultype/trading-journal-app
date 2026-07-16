import { InfoPageShell } from '@/components/legal/InfoPageShell'
import { FaqAccordion } from '@/components/legal/FaqAccordion'

export const metadata = { title: 'FAQ — Datalitiq' }

export default function FaqPage() {
  return (
    <InfoPageShell title="Pertanyaan yang Sering Ditanya">
      <FaqAccordion />
      <p className="text-sm text-white/50 pt-2">Masih ada pertanyaan lain? Hubungi kami di <a href="/kontak" className="text-primary hover:underline">halaman Kontak</a>.</p>
    </InfoPageShell>
  )
}
