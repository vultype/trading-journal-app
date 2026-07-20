-- Logo khusus email, terpisah dari logo aplikasi.
--
-- Kenapa terpisah dari app_config.logo_url:
-- Logo aplikasi dipakai di header terminal yang berlatar GELAP, jadi biasanya
-- berwarna putih. Header email berlatar TERANG — logo putih akan hilang total.
-- Selain itu email hanya mendukung PNG/JPG (SVG dibuang hampir semua klien),
-- sedangkan logo aplikasi boleh SVG.
--
-- Jalankan di Supabase → SQL Editor.

alter table app_config add column if not exists email_logo_url text;
