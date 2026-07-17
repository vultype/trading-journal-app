-- ============================================================================
-- Datalitiq — Perbaikan keamanan langganan (audit temuan #1 & #3)
-- Jalankan di Supabase SQL Editor. Idempoten (aman dijalankan ulang).
--
-- #1 RLS payment_orders: policy lama "own orders" pakai `for all` + `with check`
--    hanya cek user_id → user bisa INSERT/UPDATE order status='aktif' sendiri
--    (Pro gratis). Diperbaiki: user hanya boleh BACA order miliknya & BUAT order
--    baru berstatus 'menunggu_pembayaran'. Aktivasi ('aktif') HANYA lewat webhook
--    (service_role, bypass RLS) atau admin.
-- #3 Kolom expires_at eksplisit → aktivasi/perpanjangan menumpuk sisa hari
--    (di-set oleh webhook). Backfill order aktif lama dari (updated_at + months).
-- ============================================================================

-- ── #3: kolom kadaluarsa eksplisit ─────────────────────────────────────────
alter table public.payment_orders add column if not exists expires_at timestamptz;

-- Backfill order terminal aktif yang belum punya expires_at (data lama).
update public.payment_orders
set expires_at = coalesce(updated_at, created_at) + (months || ' months')::interval
where plan = 'terminal' and status = 'aktif' and expires_at is null and months is not null;

-- ── #1: kencangkan RLS payment_orders ──────────────────────────────────────
alter table public.payment_orders enable row level security;

-- Hapus policy longgar lama.
drop policy if exists "own orders" on public.payment_orders;

-- User: hanya BOLEH membaca order miliknya.
drop policy if exists "orders_select_own" on public.payment_orders;
create policy "orders_select_own" on public.payment_orders
  for select using (auth.uid() = user_id);

-- User: boleh MEMBUAT order miliknya, TAPI wajib status awal 'menunggu_pembayaran'.
-- Ini menutup celah: user tak bisa langsung menciptakan order 'aktif'.
drop policy if exists "orders_insert_own_pending" on public.payment_orders;
create policy "orders_insert_own_pending" on public.payment_orders
  for insert with check (auth.uid() = user_id and status = 'menunggu_pembayaran');

-- User SENGAJA tidak diberi hak UPDATE/DELETE. Perubahan status (mis. → 'aktif',
-- 'batal') hanya lewat webhook (service_role) atau admin.

-- Admin: akses penuh (verifikasi/koreksi manual). Prasyarat: fungsi is_admin().
drop policy if exists "admin orders" on public.payment_orders;
create policy "admin orders" on public.payment_orders
  for all using (is_admin()) with check (is_admin());
