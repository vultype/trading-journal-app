-- ============================================================================
-- Datalitiq — Sistem Kredit AI (token pay-per-use)
-- Jalankan di Supabase SQL Editor. Idempoten (aman dijalankan ulang).
--
-- Model saldo: dua bucket per user, dihitung dari LEDGER (tidak ada kolom balance
-- terpisah yang bisa desync).
--   • allowance : jatah bulanan dari subscription Pro. Reset tiap siklus →
--                 hanya baris dgn cycle_start = siklus BERJALAN yang dihitung.
--   • topup     : hasil beli paket kredit. PERMANEN (tak pernah hangus).
-- Debit (pemakaian AI) memotong allowance dulu, lalu topup — dicatat sbg baris
-- terpisah per bucket dengan delta negatif.
-- ============================================================================

-- 1) Kolom credits di payment_orders (dipakai order topup: plan = 'topup')
alter table public.payment_orders add column if not exists credits integer;

-- 2) Tabel ledger kredit AI
create table if not exists public.ai_credit_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  bucket       text not null check (bucket in ('allowance','topup')),
  delta        integer not null,                        -- + grant/topup, - debit
  reason       text not null check (reason in ('grant','topup','debit')),
  action       text,                                    -- analysis|scope|news (untuk debit)
  cycle_start  timestamptz,                             -- untuk baris allowance (grant & debit)
  ref_order_id uuid references public.payment_orders(id) on delete set null, -- untuk topup
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists ai_credit_ledger_user_idx on public.ai_credit_ledger(user_id);
create index if not exists ai_credit_ledger_user_bucket_idx on public.ai_credit_ledger(user_id, bucket);

-- 3) Idempotensi:
--    a) allowance hanya boleh di-grant SEKALI per (user, siklus)
create unique index if not exists ai_credit_grant_once
  on public.ai_credit_ledger(user_id, cycle_start)
  where reason = 'grant';
--    b) topup dari 1 order hanya boleh di-grant SEKALI (webhook DOKU bisa berulang)
create unique index if not exists ai_credit_topup_once
  on public.ai_credit_ledger(ref_order_id)
  where reason = 'topup';

-- 4) RLS: user hanya bisa MEMBACA ledger miliknya. Semua tulisan lewat service_role
--    (server-side) yang bypass RLS — user tak bisa menambah/mengubah saldo sendiri.
alter table public.ai_credit_ledger enable row level security;

drop policy if exists "ledger_select_own" on public.ai_credit_ledger;
create policy "ledger_select_own" on public.ai_credit_ledger
  for select using (auth.uid() = user_id);

-- (sengaja TIDAK ada policy insert/update/delete untuk anon/authenticated)
