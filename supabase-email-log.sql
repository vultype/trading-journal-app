-- Riwayat email transaksional yang dikirim ke user.
-- Tujuan: mencegah pengiriman template yang sama berulang kali, dan menjadi
-- bukti apa yang sudah pernah dikirim ke seorang pelanggan.
--
-- Jalankan di Supabase → SQL Editor.

create table if not exists email_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  email       text not null,
  template    text not null,
  subject     text,
  provider_id text,                       -- id dari Resend, untuk menelusuri di dashboard
  sent_by     text default 'admin-manual',
  created_at  timestamptz default now()
);

create index if not exists email_log_user_idx on email_log (user_id, created_at desc);

alter table email_log enable row level security;

-- SENGAJA TANPA POLICY.
-- Tanpa policy, anon/authenticated tidak bisa membaca apa pun; hanya service_role
-- (yang bypass RLS di route server) yang boleh menulis dan membaca. Riwayat email
-- berisi alamat pelanggan, jadi tidak boleh terbaca dari browser.
