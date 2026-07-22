-- ════════════════════════════════════════════════════════════════════════
--  PERSONAL FINANCE (khusus admin) — terpisah TOTAL dari tabel trading.
--
--  Prefiks fin_ disengaja: tabel accounts/transfers yang sudah ada adalah
--  milik sistem tracking broker (finance-v2 dulu justru MENGHAPUS konsep akun
--  personal dari sana). Menumpang tabel lama akan mencampur dua domain yang
--  tidak boleh saling merusak.
--
--  Keamanan: RLS auth.uid() = user_id di semua tabel. Gate "khusus admin" di
--  UI hanyalah UX; RLS inilah pagar sebenarnya — user lain (kalaupun tahu
--  route-nya) tidak bisa membaca baris siapa pun selain miliknya sendiri.
--
--  Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
-- ════════════════════════════════════════════════════════════════════════

-- Rekening: bank / tunai / e-wallet. Saldo TIDAK disimpan — dihitung dari
-- initial_balance + transaksi, supaya tidak pernah tidak-sinkron.
create table if not exists fin_accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  kind            text not null default 'bank',      -- bank | cash | ewallet | lainnya
  initial_balance numeric(16,2) not null default 0,
  created_at      timestamptz default now()
);

create table if not exists fin_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  type        text not null,                          -- income | expense
  is_business boolean not null default false,         -- pemisah pribadi vs bisnis
  created_at  timestamptz default now()
);

create table if not exists fin_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  account_id    uuid references fin_accounts(id) on delete cascade not null,
  -- terisi hanya untuk type='transfer' (rekening tujuan)
  to_account_id uuid references fin_accounts(id) on delete set null,
  category_id   uuid references fin_categories(id) on delete set null,
  type          text not null,                        -- income | expense | transfer
  amount        numeric(16,2) not null check (amount > 0),
  note          text,
  date          date not null default current_date,
  receipt_url   text,                                 -- struk/bukti (upload)
  created_at    timestamptz default now()
);

create index if not exists fin_tx_user_date_idx on fin_transactions (user_id, date desc);

alter table fin_accounts     enable row level security;
alter table fin_categories   enable row level security;
alter table fin_transactions enable row level security;

drop policy if exists "own fin_accounts" on fin_accounts;
create policy "own fin_accounts" on fin_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own fin_categories" on fin_categories;
create policy "own fin_categories" on fin_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own fin_transactions" on fin_transactions;
create policy "own fin_transactions" on fin_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
