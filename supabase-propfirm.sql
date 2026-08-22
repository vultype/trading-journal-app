-- ════════════════════════════════════════════════════════════════════════
--  JURNAL PROP FIRM — per akun, mata uang USD.
--
--  Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
--  Aman dijalankan berulang.
--
--  KENAPA TABEL SENDIRI, BUKAN MENUMPANG accounts/trades:
--  Akun prop firm punya aturan yang tidak ada padanannya di akun broker biasa —
--  batas rugi harian, batas rugi total, target profit, bagi hasil, aturan
--  konsistensi. Menumpangkannya ke tabel trades berarti setiap perhitungan
--  jurnal biasa harus tahu-diri soal aturan prop firm, dan sebaliknya. Dua
--  domain yang aturannya berbeda lebih aman dipisah.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists pf_accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  firm            text,                                   -- FTMO, MyForexFunds, dst
  phase           text not null default 'challenge',      -- challenge | verifikasi | funded
  initial_balance numeric(14,2) not null,                 -- USD

  -- Semua batas disimpan sebagai PERSEN, bukan nominal. Prop firm menyatakannya
  -- begitu, dan menyimpan nominal membuat angkanya salah begitu ukuran akun
  -- diubah.
  daily_loss_pct  numeric(6,3) not null default 5,        -- batas rugi harian
  max_loss_pct    numeric(6,3) not null default 10,       -- batas rugi total
  profit_target_pct numeric(6,3) not null default 8,

  -- STATIC  = batas total dihitung dari saldo awal, tidak pernah bergerak.
  -- TRAILING = dihitung dari saldo tertinggi yang pernah dicapai; ikut naik saat
  --            profit, dan TIDAK pernah turun lagi.
  -- Ini bukan detail kecil: pada akun yang sudah profit, keduanya memberi angka
  -- batas yang jauh berbeda. Salah pilih = merasa aman padahal sudah dekat.
  drawdown_type   text not null default 'static',         -- static | trailing

  payout_share_pct numeric(6,3) not null default 80,
  usd_idr         numeric(12,2) not null default 16000,   -- kurs untuk tampilan Rupiah

  -- Aturan konsistensi: profit satu hari tidak boleh melebihi X% dari total
  -- profit. Tidak semua firm memakainya, jadi bisa dimatikan.
  consistency_on  boolean not null default false,
  consistency_pct numeric(6,3) not null default 30,

  note            text,
  archived        boolean not null default false,
  created_at      timestamptz default now()
);

create table if not exists pf_trades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  account_id  uuid references pf_accounts(id) on delete cascade not null,
  date        date not null default current_date,
  pair        text,
  direction   text,                                       -- long | short
  -- P&L dalam USD, boleh negatif. Disimpan apa adanya (bukan dihitung dari
  -- lot/pip) supaya cocok dengan angka yang benar-benar tertera di dashboard
  -- prop firm — itulah angka yang menentukan lolos atau breach.
  pnl         numeric(14,2) not null,
  rr          numeric(8,2),
  note        text,
  created_at  timestamptz default now()
);

create index if not exists pf_trades_acc_date_idx on pf_trades (account_id, date);
create index if not exists pf_accounts_user_idx on pf_accounts (user_id, created_at desc);

alter table pf_accounts enable row level security;
alter table pf_trades   enable row level security;

drop policy if exists "own pf_accounts" on pf_accounts;
create policy "own pf_accounts" on pf_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own pf_trades" on pf_trades;
create policy "own pf_trades" on pf_trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
