-- ════════════════════════════════════════════════════════════════════════
--  PENGELUARAN PRIBADI dari akun broker.
--
--  Jalankan SETELAH supabase-finance-v3-rekonsiliasi.sql. Aman diulang.
--
--  Untuk trader yang akun brokernya juga menampung uang pribadi: uang dipakai
--  untuk keperluan sehari-hari langsung dari saldo itu.
--
--  KENAPA JENIS SENDIRI, BUKAN 'withdraw':
--  Keduanya sama-sama menurunkan saldo, jadi secara angka bisa saja ditumpuk.
--  Tapi artinya berbeda, dan bedanya baru terasa saat membaca laporan:
--    · withdraw = modal dipindahkan keluar — uangnya MASIH ADA, cuma di bank.
--    · expense  = uang HABIS terpakai, tidak akan kembali.
--  Menumpuk keduanya membuat "Total Withdraw" jadi angka yang tidak bisa
--  ditafsirkan: sebagian modal yang diamankan, sebagian uang yang lenyap.
--
--  Yang TIDAK boleh terpengaruh (dijaga di calculations.ts & halaman Keuangan):
--    win rate, profit factor, expectancy, P&L, ROI, dan modal (invested).
--  Pengeluaran pribadi bukan hasil trading dan bukan modal — hanya menurunkan
--  saldo. Kalau ikut mengubah ROI, performa trading akan terlihat buruk hanya
--  karena pemiliknya belanja.
-- ════════════════════════════════════════════════════════════════════════

alter table transfers drop constraint if exists transfers_type_check;
alter table transfers add constraint transfers_type_check
  check (type in ('deposit', 'withdraw', 'adjust_cost', 'adjust_other', 'expense'));
