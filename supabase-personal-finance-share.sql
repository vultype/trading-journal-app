-- ════════════════════════════════════════════════════════════════════════
--  PERSONAL FINANCE — tautan berbagi (short link) untuk tamu.
--
--  Jalankan SETELAH supabase-personal-finance-v3.sql. Aman dijalankan berulang.
--
--  KEAMANAN — dua keputusan yang menentukan seberapa aman fitur ini:
--
--  1. Yang disimpan adalah SNAPSHOT hasil olahan (jsonb), bukan acuan ke tabel
--     transaksi. Tautan lama karena itu tidak pernah bisa "ikut terbuka" saat
--     data bertambah, dan tidak ada jalan dari tautan publik menuju baris
--     fin_transactions mana pun.
--
--  2. TIDAK ADA policy untuk anon di sini — sengaja. Kalau tabel ini dibuat
--     bisa dibaca publik (walau hanya baris yang belum kedaluwarsa), siapa pun
--     tinggal `select *` dan memanen SELURUH snapshot orang lain tanpa perlu
--     menebak satu slug pun. Halaman publik /s/[slug] membacanya lewat
--     service_role di server, satu baris, dicari berdasarkan slug.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists fin_shares (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  slug       text unique not null,
  title      text not null,
  payload    jsonb not null,
  masked     boolean not null default true,     -- nominal disembunyikan?
  expires_at timestamptz,                       -- null = tanpa batas waktu
  revoked    boolean not null default false,
  views      integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists fin_shares_slug_idx on fin_shares (slug);
create index if not exists fin_shares_user_idx on fin_shares (user_id, created_at desc);

alter table fin_shares enable row level security;

-- Hanya pemilik. Tamu TIDAK memakai policy apa pun — lihat catatan di atas.
drop policy if exists "own fin_shares" on fin_shares;
create policy "own fin_shares" on fin_shares
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
