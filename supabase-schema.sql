-- Trading Journal — Supabase Schema (versi lengkap)
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run All

-- ── 1. Akun (personal & trading) ──────────────────────────────────────
create table if not exists accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  type        text check (type in ('personal','trading')) not null,
  broker      text,
  currency    text default 'IDR',
  created_at  timestamptz default now()
);

-- ── 2. Trade ──────────────────────────────────────────────────────────
create table if not exists trades (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  account_id      uuid references accounts(id) not null,
  date            date not null,
  entry_time      text,
  pair            text not null,
  direction       text check (direction in ('long','short')) not null,
  result          text check (result in ('win','loss','breakeven')) not null,
  pnl             numeric(14,2) not null,
  strategy        text,
  followed_plan   boolean,
  know_direction  boolean,
  screenshot_url  text,
  note            text,
  -- legacy fields (opsional, untuk backward compat)
  entry_price     numeric(14,5),
  exit_price      numeric(14,5),
  lot_size        numeric(10,4),
  risk_amount     numeric(14,2),
  rr_ratio        numeric(6,2),
  fees            numeric(10,2) default 0,
  emotion         text,
  created_at      timestamptz default now()
);

-- ── 3. Transfer antar akun (deposit / withdraw) ───────────────────────
create table if not exists transfers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  from_account_id  uuid references accounts(id),
  to_account_id    uuid references accounts(id),
  type             text check (type in ('deposit','withdraw')) not null,
  amount           numeric(14,2) not null,
  note             text,
  date             date not null,
  created_at       timestamptz default now()
);

-- ── 4. Jurnal harian ──────────────────────────────────────────────────
create table if not exists journal_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  date        date not null,
  content     text not null,
  mood        smallint check (mood between 1 and 5),
  created_at  timestamptz default now(),
  unique (user_id, date)
);

-- ── 5. Pengaturan pengguna ────────────────────────────────────────────
create table if not exists user_settings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null unique,
  currency         text default 'IDR',
  strategies       jsonb default '["Breakout","Retest","Trend Follow","Reversal","Scalping"]'::jsonb,
  target_harian    numeric(14,2),
  target_mingguan  numeric(14,2),
  target_bulanan   numeric(14,2),
  updated_at       timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────────────
alter table accounts      enable row level security;
alter table trades        enable row level security;
alter table transfers     enable row level security;
alter table journal_notes enable row level security;
alter table user_settings enable row level security;

-- Hapus policy lama jika ada
drop policy if exists "own accounts"      on accounts;
drop policy if exists "own trades"        on trades;
drop policy if exists "own transfers"     on transfers;
drop policy if exists "own journal_notes" on journal_notes;
drop policy if exists "own settings"      on user_settings;

-- Buat policy baru
create policy "own accounts"      on accounts      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own trades"        on trades        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transfers"     on transfers     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own journal_notes" on journal_notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings"      on user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
