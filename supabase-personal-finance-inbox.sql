-- ════════════════════════════════════════════════════════════════════════
--  PERSONAL FINANCE — kotak masuk email bank (notifikasi BCA otomatis).
--
--  Jalankan SETELAH supabase-personal-finance-v3.sql. Aman dijalankan berulang.
--
--  PRINSIP: email TIDAK PERNAH langsung jadi fin_transactions.
--
--  Notifikasi bank hanya memuat nominal, merchant, dan referensi — tidak ada
--  kategori. Kalau ditebak lalu ditulis langsung, satu tebakan yang salah masuk
--  diam-diam dan ikut mencemari analitik, anggaran, sampai skor kesehatan tanpa
--  pernah terlihat. Jadi semuanya mendarat di sini dulu sebagai draf, dan hanya
--  pindah ke fin_transactions setelah disetujui.
--
--  Gagal parsing pun TETAP DISIMPAN (status 'gagal'), bukan dibuang. Transaksi
--  yang hilang tanpa jejak jauh lebih berbahaya daripada baris error yang
--  kelihatan dan bisa diperbaiki.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists fin_inbox (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,

  -- Kunci idempotensi. Untuk BCA ini "Reference No." dari email; kalau tidak
  -- terbaca, dipakai Message-ID Gmail. Unik per user supaya email yang terkirim
  -- dua kali (retry, forward ganda) tidak pernah jadi dua transaksi.
  ext_ref      text not null,

  source       text not null default 'bca-email',
  status       text not null default 'draft',   -- draft | approved | ignored | gagal

  -- Hasil parsing
  tx_date      date,
  amount       numeric(16,2),
  fee          numeric(16,2) default 0,
  merchant     text,
  transfer_type text,
  source_fund  text,

  -- Tebakan sistem; tetap bisa diubah saat ditinjau
  suggested_type        text,                   -- income | expense | transfer
  suggested_category_id uuid references fin_categories(id) on delete set null,
  suggested_account_id  uuid references fin_accounts(id)   on delete set null,

  -- Transaksi hasil persetujuan (null selama masih draf)
  tx_id        uuid references fin_transactions(id) on delete set null,

  raw          text,                            -- badan email apa adanya
  parse_error  text,
  received_at  timestamptz default now(),
  created_at   timestamptz default now(),

  unique (user_id, ext_ref)
);

create index if not exists fin_inbox_user_status_idx on fin_inbox (user_id, status, received_at desc);

-- Aturan pemetaan merchant → kategori. Diisi otomatis saat user menyetujui draf
-- ("ingat pilihan ini"), sehingga transaksi berikutnya dari merchant yang sama
-- langsung punya tebakan yang benar.
create table if not exists fin_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  match       text not null,                    -- dicocokkan case-insensitive sebagai substring
  type        text not null default 'expense',  -- income | expense | transfer
  category_id uuid references fin_categories(id) on delete cascade,
  account_id  uuid references fin_accounts(id)  on delete cascade,
  created_at  timestamptz default now(),
  unique (user_id, match)
);

-- Rahasia bersama untuk endpoint /api/keuangan/ingest. Disimpan per user supaya
-- bisa dicabut sendiri tanpa menyentuh env var, dan supaya skrip Gmail tidak
-- perlu memegang kredensial Supabase apa pun.
--
-- TIDAK ADA policy untuk anon di tabel ini — token dibaca server memakai
-- service_role. Kalau tabel ini bisa dibaca publik, tokennya kehilangan seluruh
-- gunanya.
create table if not exists fin_ingest_tokens (
  user_id    uuid references auth.users(id) on delete cascade primary key,
  token      text unique not null,
  last_used  timestamptz,
  created_at timestamptz default now()
);

alter table fin_inbox         enable row level security;
alter table fin_rules         enable row level security;
alter table fin_ingest_tokens enable row level security;

drop policy if exists "own fin_inbox" on fin_inbox;
create policy "own fin_inbox" on fin_inbox
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own fin_rules" on fin_rules;
create policy "own fin_rules" on fin_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Pemilik boleh melihat & memutar tokennya sendiri lewat UI.
drop policy if exists "own fin_ingest_tokens" on fin_ingest_tokens;
create policy "own fin_ingest_tokens" on fin_ingest_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
