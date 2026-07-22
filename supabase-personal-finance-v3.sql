-- ════════════════════════════════════════════════════════════════════════
--  PERSONAL FINANCE v3 — anggaran bebas: banyak amplop, nama sendiri,
--  banyak kategori per amplop, dan periode (mingguan/bulanan/tahunan).
--
--  Jalankan SETELAH supabase-personal-finance-v2.sql. Aman dijalankan berulang.
--
--  Perubahan konsep: dulu 1 anggaran = 1 kategori (dikunci unique), namanya
--  ikut nama kategori. Sekarang 1 anggaran = 1 amplop bernama yang mencakup
--  SATU ATAU BANYAK kategori. Satu kategori boleh masuk ke lebih dari satu
--  amplop (mis. "Makan" ada di "Belanja Harian" dan juga di "Total Hidup").
-- ════════════════════════════════════════════════════════════════════════

alter table fin_budgets add column if not exists name   text;
alter table fin_budgets add column if not exists color  text;
alter table fin_budgets add column if not exists period text not null default 'monthly';  -- weekly | monthly | yearly

-- Kunci lama membatasi 1 anggaran per kategori — justru itu yang dibuka.
alter table fin_budgets drop constraint if exists fin_budgets_user_id_category_id_key;

-- category_id jadi kolom warisan: relasinya pindah ke tabel jembatan di bawah.
alter table fin_budgets alter column category_id drop not null;

create table if not exists fin_budget_categories (
  budget_id   uuid references fin_budgets(id)    on delete cascade not null,
  category_id uuid references fin_categories(id) on delete cascade not null,
  -- user_id diduplikasi di sini semata supaya RLS bisa memfilter tanpa join.
  user_id     uuid references auth.users(id)     on delete cascade not null,
  primary key (budget_id, category_id)
);

create index if not exists fin_budget_cat_budget_idx on fin_budget_categories (budget_id);

alter table fin_budget_categories enable row level security;

drop policy if exists "own fin_budget_categories" on fin_budget_categories;
create policy "own fin_budget_categories" on fin_budget_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Migrasi data lama ────────────────────────────────────────────────────
-- Anggaran yang sudah ada dipindah ke bentuk baru: namanya diambil dari
-- kategori yang dulu mengikatnya, lalu kategori itu dimasukkan ke jembatan.
update fin_budgets b
   set name = c.name
  from fin_categories c
 where b.category_id = c.id
   and b.name is null;

insert into fin_budget_categories (budget_id, category_id, user_id)
select b.id, b.category_id, b.user_id
  from fin_budgets b
 where b.category_id is not null
on conflict do nothing;

-- Sisa yang tetap tanpa nama (kategorinya sudah dihapus) diberi nama netral
-- supaya tidak muncul sebagai kartu kosong di UI.
update fin_budgets set name = 'Anggaran' where name is null or btrim(name) = '';
