'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQS: { group: string; items: { q: string; a: string }[] }[] = [
  {
    group: 'Umum',
    items: [
      { q: 'Apa itu Datalitiq?', a: 'Datalitiq adalah penyedia dua layanan: Datalitiq AI Terminal (analisa pasar emas XAU/USD berbasis AI, real-time) dan Datalitiq Jurnal Trading (jurnal & analitik performa trading). Keduanya bisa diakses dari satu akun yang sama.' },
      { q: 'Apa bedanya AI Terminal dan Jurnal Trading?', a: 'AI Terminal membantu Anda MEMBACA PASAR sebelum entry — arah, tingkat keyakinan, konteks makro & sentimen. Jurnal Trading membantu Anda MENGEVALUASI hasil trading yang sudah dilakukan — skor performa, equity curve, insight AI dari histori trade Anda.' },
      { q: 'Apakah saya bisa pakai keduanya sekaligus?', a: 'Bisa. Setelah login, Anda akan diarahkan ke halaman pemilihan tools tempat Anda bisa membuka Terminal atau Jurnal, dan berpindah kapan saja.' },
    ],
  },
  {
    group: 'Datalitiq AI Terminal',
    items: [
      { q: 'Apakah ini sinyal trading otomatis?', a: 'Bukan. Datalitiq AI Terminal memberikan analisa dan kesimpulan untuk membantu pengambilan keputusan — bukan mengeksekusi transaksi secara otomatis. Keputusan akhir tetap sepenuhnya di tangan Anda.' },
      { q: 'Apakah datanya benar-benar real-time?', a: 'Ya. Harga diperbarui setiap 8 detik, data makro dari FRED, posisi institusi dari CFTC, dan berita dari berbagai sumber publik — semuanya data real, bukan simulasi.' },
      { q: 'Berapa harganya?', a: 'Rp179.000/bulan, akses penuh tanpa batas penggunaan, bisa berhenti kapan saja.' },
      { q: 'Kenapa fokus hanya pada emas (XAU/USD)?', a: 'Fokus pada satu instrumen memungkinkan analisa yang lebih dalam dan akurat, dibanding mencakup banyak instrumen sekaligus secara dangkal.' },
    ],
  },
  {
    group: 'Datalitiq Jurnal Trading',
    items: [
      { q: 'Broker apa saja yang didukung?', a: 'Semua broker — Anda mencatat trade secara manual, mendukung Forex, Crypto, Saham, dan Prop Firm.' },
      { q: 'Apakah data trading saya aman?', a: 'Ya. Data disimpan di Supabase dengan Row-Level Security — hanya Anda yang bisa mengakses data trading Anda sendiri.' },
    ],
  },
  {
    group: 'Pembayaran & Akun',
    items: [
      { q: 'Metode pembayaran apa yang didukung?', a: 'Transfer bank manual (Mandiri). Setelah transfer, tim kami memverifikasi dan mengaktifkan akses secara manual.' },
      { q: 'Berapa lama aktivasi setelah bayar?', a: 'Maksimal 1×24 jam pada hari kerja setelah pembayaran diverifikasi.' },
      { q: 'Bisa berhenti berlangganan kapan saja?', a: 'Bisa. Tidak ada kontrak jangka panjang — cukup tidak melakukan pembayaran untuk periode berikutnya. Lihat juga halaman Kebijakan Refund.' },
      { q: 'Bagaimana cara login?', a: 'Menggunakan email & password, atau lewat akun Google (Masuk dengan Google) di halaman login.' },
      { q: 'Bagaimana cara menghubungi support?', a: 'Lewat halaman Kontak — email, telepon/WhatsApp, atau alamat kami tersedia di sana.' },
    ],
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="text-sm font-semibold text-white">{q}</span>
        <ChevronDown size={16} className={`text-white/50 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-5 pb-4 text-sm text-white/60 leading-relaxed">{a}</p>}
    </div>
  )
}

export function FaqAccordion() {
  return (
    <div className="space-y-8">
      {FAQS.map(g => (
        <div key={g.group}>
          <h2 className="text-base font-bold text-white mb-3">{g.group}</h2>
          <div className="space-y-2.5">{g.items.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}</div>
        </div>
      ))}
    </div>
  )
}
