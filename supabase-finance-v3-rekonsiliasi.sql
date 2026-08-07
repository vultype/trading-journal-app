-- ════════════════════════════════════════════════════════════════════════
--  REKONSILIASI SALDO BROKER — samakan saldo aplikasi dengan saldo asli.
--
--  Jalankan SETELAH supabase-finance-v2.sql. Aman dijalankan berulang.
--
--  MASALAHNYA: saldo di aplikasi dihitung
--      saldo awal + deposit − withdraw + P&L
--  sedangkan saldo asli di broker hampir selalu berbeda sedikit, karena swap,
--  komisi, slippage, rebate, atau transaksi yang lupa dicatat.
--
--  KENAPA TIDAK CUKUP SATU JENIS "PENYESUAIAN":
--  Selisih itu punya SEBAB yang berbeda-beda, dan sebabnya menentukan angka
--  mana yang harus ikut berubah:
--
--    · Biaya trading (swap/komisi)  → ini KERUGIAN NYATA dari aktivitas
--      trading. Kalau dicatat sebagai deposit, hasil trading Anda terlihat
--      lebih bagus dari kenyataan — persis kesalahan yang paling mahal.
--    · Deposit/withdraw yang lupa   → arus modal, bukan performa. Cukup pakai
--      jenis deposit/withdraw yang sudah ada.
--    · Bonus/rebate/salah input     → tidak mencerminkan performa maupun
--      modal; harus netral terhadap keduanya.
--
--  Karena itu ada DUA jenis baru, bukan satu:
--    adjust_cost  → ikut mengurangi hasil trading bersih & ROI
--    adjust_other → hanya menggeser saldo, tidak menyentuh statistik performa
--
--  amount SENGAJA boleh negatif untuk kedua jenis ini: biaya bisa dikembalikan
--  (rebate swap), dan koreksi bisa ke dua arah. Deposit/withdraw tetap positif
--  seperti sebelumnya karena arahnya sudah ditentukan oleh jenisnya.
-- ════════════════════════════════════════════════════════════════════════

alter table transfers drop constraint if exists transfers_type_check;
alter table transfers add constraint transfers_type_check
  check (type in ('deposit', 'withdraw', 'adjust_cost', 'adjust_other'));
