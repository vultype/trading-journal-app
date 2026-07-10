-- ════════════════════════════════════════════════════════════════════════
--  SETUP: Storage bucket untuk upload screenshot chart
--  Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
--  (Atau buat bucket "trade-screenshots" manual di menu Storage → set Public)
-- ════════════════════════════════════════════════════════════════════════

-- 1. Buat bucket publik untuk gambar chart
insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', true)
on conflict (id) do update set public = true;

-- 2. Policy: user login boleh upload
drop policy if exists "upload screenshots" on storage.objects;
create policy "upload screenshots" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trade-screenshots');

-- 3. Policy: siapa saja boleh lihat (karena bucket publik)
drop policy if exists "read screenshots" on storage.objects;
create policy "read screenshots" on storage.objects
  for select to public
  using (bucket_id = 'trade-screenshots');

-- 4. Policy: user login boleh hapus/ubah
drop policy if exists "manage screenshots" on storage.objects;
create policy "manage screenshots" on storage.objects
  for update to authenticated
  using (bucket_id = 'trade-screenshots');
