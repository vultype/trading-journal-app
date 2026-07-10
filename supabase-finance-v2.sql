-- ════════════════════════════════════════════════════════════════════════
--  MIGRASI: Sistem Keuangan v2 — Pure Broker Tracking
--  Hapus konsep "akun personal". Deposit/withdraw = log dana per akun broker.
--  Tiap akun punya saldo awal (real / prop firm / funded / demo).
--
--  Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
--  CATATAN: data TRADE & JURNAL tidak disentuh. Hanya deposit/withdraw
--  dan akun personal yang di-reset bersih.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Saldo awal per akun broker
alter table accounts add column if not exists initial_balance numeric(14,2) default 0;

-- 2. Semua akun sekarang bertipe trading (kolom type lama tidak dipakai app)
alter table accounts alter column type set default 'trading';

-- 3. Deposit/withdraw kini terikat ke satu akun broker
alter table transfers add column if not exists account_id uuid references accounts(id) on delete cascade;

-- 4. Reset bersih dana + akun personal (TRADE tetap aman)
delete from transfers;
delete from accounts where type = 'personal';
