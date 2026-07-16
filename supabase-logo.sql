-- ════════════════════════════════════════════════════════════════════════
--  SETUP: Logo aplikasi (branding) — dikelola admin
--  Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
--  Prasyarat: bucket "trade-screenshots" sudah ada (supabase-storage.sql)
-- ════════════════════════════════════════════════════════════════════════

-- Tabel config global (1 baris)
create table if not exists app_config (
  id         int primary key default 1,
  logo_url   text,
  updated_at timestamptz default now()
);
insert into app_config (id) values (1) on conflict (id) do nothing;

-- Gambar fitur showcase homepage (jsonb: { "gauge": "url", "decision": "url", ... })
-- Untuk instalasi lama yang tabelnya sudah ada tanpa kolom ini:
alter table app_config add column if not exists feature_images jsonb not null default '{}'::jsonb;

-- Logo broker/partner untuk slider "Dipakai trader dari berbagai broker" (jsonb array of url)
alter table app_config add column if not exists client_logos jsonb not null default '[]'::jsonb;

alter table app_config enable row level security;

-- Semua orang boleh baca (termasuk halaman login yang belum login)
drop policy if exists "read app_config" on app_config;
create policy "read app_config" on app_config for select using (true);

-- Hanya admin yang boleh ubah (butuh fungsi is_admin() dari supabase-admin.sql)
drop policy if exists "admin write app_config" on app_config;
create policy "admin write app_config" on app_config for all
  using (is_admin()) with check (is_admin());

-- Izinkan role anon (login page) membaca
grant select on app_config to anon;
