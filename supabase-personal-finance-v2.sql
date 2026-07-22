-- ════════════════════════════════════════════════════════════════════════
--  PERSONAL FINANCE v2 — target tabungan, anggaran, kustomisasi warna.
--  Jalankan SETELAH supabase-personal-finance.sql. Aman dijalankan berulang.
-- ════════════════════════════════════════════════════════════════════════

-- Kustomisasi warna (dipakai chart & kartu)
alter table fin_accounts   add column if not exists color text;
alter table fin_categories add column if not exists color text;

-- Target tabungan. Progres TIDAK disimpan — dihitung dari fin_goal_entries,
-- prinsip yang sama dengan saldo rekening (mustahil tidak sinkron).
create table if not exists fin_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  target_amount numeric(16,2) not null check (target_amount > 0),
  deadline      date,
  color         text,
  created_at    timestamptz default now()
);

create table if not exists fin_goal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  goal_id    uuid references fin_goals(id) on delete cascade not null,
  amount     numeric(16,2) not null,            -- boleh negatif = tarik dana
  date       date not null default current_date,
  note       text,
  created_at timestamptz default now()
);

-- Anggaran bulanan per kategori pengeluaran (berlaku tiap bulan).
create table if not exists fin_budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  category_id   uuid references fin_categories(id) on delete cascade not null,
  monthly_limit numeric(16,2) not null check (monthly_limit > 0),
  created_at    timestamptz default now(),
  unique (user_id, category_id)
);

alter table fin_goals        enable row level security;
alter table fin_goal_entries enable row level security;
alter table fin_budgets      enable row level security;

drop policy if exists "own fin_goals" on fin_goals;
create policy "own fin_goals" on fin_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own fin_goal_entries" on fin_goal_entries;
create policy "own fin_goal_entries" on fin_goal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own fin_budgets" on fin_budgets;
create policy "own fin_budgets" on fin_budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
