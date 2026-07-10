-- ════════════════════════════════════════════════════════════════════════
--  MIGRASI v3: multi-bahasa, onboarding wizard, broker
--  Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
--  Data TRADE tidak disentuh.
-- ════════════════════════════════════════════════════════════════════════

-- Bahasa & status onboarding di pengaturan user
alter table user_settings add column if not exists language  text default 'id';
alter table user_settings add column if not exists onboarded  boolean default false;

-- (Opsional) hapus akun placeholder default lama yang belum punya trade,
-- supaya user bisa mulai dari wizard. Akun yang SUDAH punya trade dibiarkan
-- (akan di-rename lewat wizard, bukan dihapus).
delete from accounts a
where not exists (select 1 from trades t where t.account_id = a.id)
  and not exists (select 1 from transfers f where f.account_id = a.id);
