import { InfoPageShell } from '@/components/legal/InfoPageShell'

export const metadata = { title: 'Kebijakan Refund — Datalitiq' }

export default function KebijakanRefundPage() {
  return (
    <InfoPageShell title="Kebijakan Refund" updated="16 Juli 2026">
      <section>
        <p>Kebijakan ini menjelaskan kapan dan bagaimana Anda dapat mengajukan pengembalian dana (refund) untuk langganan Datalitiq AI Terminal maupun Datalitiq Jurnal Trading.</p>
      </section>

      <section>
        <h2>Ketentuan Umum</h2>
        <p>Layanan kami bersifat akses digital berbasis langganan yang aktif segera setelah pembayaran diverifikasi. Karena sifatnya yang langsung dapat digunakan, secara umum <b>pembayaran yang sudah diverifikasi dan akun sudah aktif tidak dapat direfund</b> — kecuali termasuk kondisi khusus di bawah ini.</p>
      </section>

      <section>
        <h2>Kapan Refund Diberikan</h2>
        <ul>
          <li><b>Pembayaran ganda</b> — Anda tidak sengaja membayar dua kali untuk periode langganan yang sama.</li>
          <li><b>Kesalahan penagihan</b> — jumlah yang terverifikasi tidak sesuai dengan harga paket yang berlaku.</li>
          <li><b>Layanan tidak dapat diakses</b> — akses gagal dibuka akibat kesalahan sistem dari pihak kami, dan tidak dapat kami perbaiki dalam waktu wajar (maksimal 3 hari kerja) setelah dilaporkan.</li>
        </ul>
      </section>

      <section>
        <h2>Kapan Refund Tidak Diberikan</h2>
        <ul>
          <li>Sudah menggunakan layanan lalu berubah pikiran (tidak jadi butuh).</li>
          <li>Kerugian trading akibat keputusan pribadi Anda — seluruh analisa & keluaran AI adalah alat bantu, bukan jaminan hasil (lihat <a href="/syarat-ketentuan">Syarat & Ketentuan</a>).</li>
          <li>Lupa berhenti berlangganan sebelum periode berikutnya dimulai.</li>
          <li>Akun ditangguhkan/dihentikan karena pelanggaran syarat & ketentuan.</li>
        </ul>
      </section>

      <section>
        <h2>Cara Mengajukan Refund</h2>
        <p>Hubungi kami melalui <a href="/kontak">halaman Kontak</a> atau langsung ke <a href="mailto:support@datalitiq.com">support@datalitiq.com</a>, sertakan:</p>
        <ul>
          <li>Email akun yang terdaftar</li>
          <li>Bukti transfer pembayaran</li>
          <li>Alasan pengajuan refund</li>
        </ul>
        <p>Pengajuan yang memenuhi kriteria di atas akan kami proses maksimal <b>7 hari kerja</b> setelah diverifikasi, dikembalikan ke rekening bank yang sama dengan sumber pembayaran.</p>
      </section>

      <section>
        <h2>Pembatalan Langganan</h2>
        <p>Anda dapat berhenti berlangganan kapan saja dengan tidak melakukan pembayaran untuk periode berikutnya. Akses tetap aktif hingga akhir periode yang sudah dibayar — tidak ada pengembalian dana proporsional (prorata) untuk sisa hari yang tidak digunakan.</p>
      </section>
    </InfoPageShell>
  )
}
