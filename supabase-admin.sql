-- ════════════════════════════════════════════════════════════════════════
--  MIGRATION: expanded settings + admin role
--  Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Kolom baru untuk user_settings ─────────────────────────────────────
alter table user_settings add column if not exists display_name        text;
alter table user_settings add column if not exists default_pair         text;
alter table user_settings add column if not exists week_starts_monday   boolean;

-- ── 2. Admin: siapa adminnya (berdasarkan email di JWT) ────────────────────
create or replace function is_admin()
returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() ->> 'email') = 'vultype@gmail.com', false);
$$;

-- ── 3. Policy: admin boleh SELECT semua baris di semua tabel ───────────────
drop policy if exists "admin read accounts"      on accounts;
drop policy if exists "admin read trades"        on trades;
drop policy if exists "admin read transfers"     on transfers;
drop policy if exists "admin read journal_notes" on journal_notes;
drop policy if exists "admin read settings"      on user_settings;

create policy "admin read accounts"      on accounts      for select using (is_admin());
create policy "admin read trades"        on trades        for select using (is_admin());
create policy "admin read transfers"     on transfers     for select using (is_admin());
create policy "admin read journal_notes" on journal_notes for select using (is_admin());
create policy "admin read settings"      on user_settings for select using (is_admin());

-- ── 4. Fungsi untuk ambil daftar user (email) — hanya admin ────────────────
create or replace function admin_all_users()
returns table (id uuid, email text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  return query
    select u.id, u.email::text, u.created_at
    from auth.users u
    order by u.created_at;
end;
$$;

grant execute on function admin_all_users() to authenticated;
