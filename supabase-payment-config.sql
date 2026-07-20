-- ════════════════════════════════════════════════════════════════════════
--  PAYMENT GATEWAY CONFIG — kredensial gateway (DOKU / iPaymu / Midtrans)
--  Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
--
--  ⚠️ KEAMANAN: tabel ini menyimpan SECRET (API key / secret key).
--  RLS aktif TANPA policy apa pun → anon & authenticated TIDAK BISA baca/tulis
--  sama sekali. Hanya service_role (server, bypass RLS) yang boleh akses,
--  lewat route /api/admin/payment-config yang memverifikasi admin.
--  JANGAN taruh kredensial ini di app_config — tabel itu dibaca publik (anon).
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.payment_config (
  id             int primary key default 1 check (id = 1),  -- single row
  active_gateway text not null default 'none',              -- none|doku|ipaymu|midtrans

  -- DOKU
  doku_client_id   text,
  doku_secret_key  text,
  doku_production  boolean not null default false,

  -- iPaymu
  ipaymu_va        text,
  ipaymu_api_key   text,
  ipaymu_production boolean not null default false,

  -- Midtrans
  midtrans_server_key text,
  midtrans_client_key text,
  midtrans_production boolean not null default false,

  updated_at timestamptz not null default now()
);

insert into public.payment_config (id) values (1) on conflict (id) do nothing;

-- RLS aktif, TANPA policy → hanya service_role yang bisa akses.
alter table public.payment_config enable row level security;

-- Bersihkan policy lama bila pernah dibuat (jaga-jaga).
drop policy if exists "payment_config read"  on public.payment_config;
drop policy if exists "payment_config admin" on public.payment_config;
