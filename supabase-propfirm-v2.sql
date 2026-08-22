-- ════════════════════════════════════════════════════════════════════════
--  PROP FIRM v2 — samakan pf_trades dengan tabel trades jurnal utama,
--  + catatan jurnal harian per akun prop firm.
--
--  Jalankan SETELAH supabase-propfirm.sql. Aman dijalankan berulang.
--
--  KENAPA KOLOMNYA DISAMAKAN PERSIS:
--  Seluruh perhitungan analisa jurnal utama (calcStats, pnlByGroup, equity
--  curve) bekerja di atas bentuk Trade. Dengan menyamakan kolomnya, fungsi yang
--  sama bisa dipakai ulang apa adanya — bukan disalin lalu perlahan berbeda.
--  Satu perbaikan rumus otomatis berlaku untuk kedua jurnal.
--
--  Tabelnya TETAP terpisah: statistik prop firm tidak boleh mencemari jurnal
--  utama. Halaman analisa utama menjumlahkan SELURUH trade tanpa menyaring akun,
--  jadi menaruhnya di tabel yang sama akan diam-diam mencampur win rate & equity
--  curve dua hal yang berbeda.
-- ════════════════════════════════════════════════════════════════════════

-- Hasil trade. Kolom lama pnl tetap dipakai; result menambah win/loss/breakeven
-- yang dibutuhkan statistik (profit factor, streak, win rate).
alter table pf_trades add column if not exists result         text;
alter table pf_trades add column if not exists entry_time     text;
alter table pf_trades add column if not exists strategy       text;
alter table pf_trades add column if not exists followed_plan  boolean;
alter table pf_trades add column if not exists know_direction boolean;
alter table pf_trades add column if not exists screenshot_url text;
alter table pf_trades add column if not exists market_structure text;
alter table pf_trades add column if not exists is_overtrade   boolean default false;
alter table pf_trades add column if not exists entry_price    numeric(14,5);
alter table pf_trades add column if not exists exit_price     numeric(14,5);
alter table pf_trades add column if not exists lot_size       numeric(10,4);
alter table pf_trades add column if not exists emotion        text;

-- Baris lama belum punya result — diisi dari tanda pnl supaya statistik tidak
-- menganggapnya kosong. Hanya menyentuh yang benar-benar null.
update pf_trades
   set result = case when pnl > 0 then 'win' when pnl < 0 then 'loss' else 'breakeven' end
 where result is null;

-- Catatan jurnal harian, per AKUN (bukan per user seperti journal_notes utama):
-- satu trader bisa memegang beberapa akun prop firm sekaligus, dan catatan hari
-- yang sama untuk akun berbeda adalah dua hal yang berbeda.
create table if not exists pf_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  account_id  uuid references pf_accounts(id) on delete cascade not null,
  date        date not null,
  content     text not null,
  mood        smallint check (mood between 1 and 5),
  created_at  timestamptz default now(),
  unique (account_id, date)
);

create index if not exists pf_notes_acc_date_idx on pf_notes (account_id, date desc);

alter table pf_notes enable row level security;
drop policy if exists "own pf_notes" on pf_notes;
create policy "own pf_notes" on pf_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
