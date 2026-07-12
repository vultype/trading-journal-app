-- ════════════════════════════════════════════════════════════════════════
--  CHECKOUT / PEMBAYARAN — Datalitiq
--  Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
--  Prasyarat: fungsi is_admin() (dari supabase-admin.sql) sudah ada.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists payment_orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  plan         text not null,                 -- 'standar' | 'pro'
  months       int  not null default 1,
  base_amount  numeric(14,2) not null,        -- harga paket (sebelum kode unik)
  unique_code  int  not null,                 -- 3 digit unik
  total        numeric(14,2) not null,        -- base_amount + unique_code
  bank         text default 'Mandiri',
  account_no   text,
  status       text not null default 'menunggu_pembayaran',
    -- menunggu_pembayaran | menunggu_verifikasi | aktif | batal
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table payment_orders enable row level security;

-- User hanya bisa akses order miliknya
drop policy if exists "own orders" on payment_orders;
create policy "own orders" on payment_orders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin bisa lihat & ubah semua order (verifikasi pembayaran)
drop policy if exists "admin orders" on payment_orders;
create policy "admin orders" on payment_orders
  for all using (is_admin()) with check (is_admin());
