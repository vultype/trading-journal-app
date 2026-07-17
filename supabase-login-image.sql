-- ============================================================================
-- Datalitiq — Gambar samping halaman Login/Register (uploadable via Admin)
-- Jalankan di Supabase SQL Editor. Idempoten.
-- ============================================================================
alter table public.app_config add column if not exists login_image_url text;
