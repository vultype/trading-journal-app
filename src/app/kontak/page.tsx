import { InfoPageShell } from '@/components/legal/InfoPageShell'
import { Mail, Phone, MapPin, MessageCircle } from 'lucide-react'

export const metadata = { title: 'Kontak — Datalitiq' }

const CONTACT = {
  email: 'support@datalitiq.com',
  phoneDisplay: '0812-1212-4512',
  phoneRaw: '081212124512',
  waLink: 'https://wa.me/6281212124512',
  address: 'Jl. Susukan, Pabuaran, Bojonggede, Bogor',
}

function ContactCard({ icon: Icon, label, value, href }: { icon: React.ElementType; label: string; value: string; href?: string }) {
  const inner = (
    <div className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.02] p-5 h-full hover:border-primary/30 transition-colors">
      <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/12 ring-1 ring-primary/20 shrink-0"><Icon size={18} className="text-primary" /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">{label}</p>
        <p className="text-sm font-semibold text-white mt-1 break-words">{value}</p>
      </div>
    </div>
  )
  return href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="block">{inner}</a> : inner
}

export default function KontakPage() {
  return (
    <InfoPageShell title="Kontak">
      <p className="text-white/60 -mt-2 mb-2">Ada pertanyaan seputar Datalitiq AI Terminal atau Jurnal Trading? Tim kami siap membantu lewat kanal berikut.</p>

      <div className="grid sm:grid-cols-2 gap-4 not-prose">
        <ContactCard icon={Mail} label="Email" value={CONTACT.email} href={`mailto:${CONTACT.email}`} />
        <ContactCard icon={MessageCircle} label="WhatsApp" value={CONTACT.phoneDisplay} href={CONTACT.waLink} />
        <ContactCard icon={Phone} label="Telepon" value={CONTACT.phoneDisplay} href={`tel:${CONTACT.phoneRaw}`} />
        <ContactCard icon={MapPin} label="Alamat" value={CONTACT.address} />
      </div>

      <p className="text-xs text-white/40 pt-4">Kami biasanya merespons dalam 1×24 jam pada hari kerja. Untuk pertanyaan seputar pembayaran/langganan, sertakan email akun yang terdaftar agar lebih cepat diproses.</p>
    </InfoPageShell>
  )
}
