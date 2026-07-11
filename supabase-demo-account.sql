-- ════════════════════════════════════════════════════════════════════════
--  DEMO ACCOUNT — Datalitiq
--  Email    : demo@datalitiq.app
--  Password : DemoDatalitiq25
--
--  Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
--  Membuat user demo + akun (saldo awal Rp600.000.000) + 60 trade dummy
--  (win rate 40%, hasil net PROFIT) dengan screenshot chart TradingView.
--
--  Kalau login gagal: buat akun lewat tombol "Daftar" di app pakai email
--  di atas, lalu jalankan ULANG bagian "SEED DATA" saja (blok DO kedua).
-- ════════════════════════════════════════════════════════════════════════

-- pgcrypto untuk hashing password
create extension if not exists pgcrypto;

-- ── 1. Buat user auth (jika belum ada) ──────────────────────────────────
do $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = 'demo@datalitiq.app';
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      'demo@datalitiq.app', crypt('DemoDatalitiq25', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}',
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text,
      json_build_object('sub', v_id::text, 'email', 'demo@datalitiq.app')::jsonb,
      'email', now(), now(), now());
  end if;
end $$;

-- ── 2. SEED DATA (akun + settings + trades) ─────────────────────────────
do $$
declare
  v_uid uuid;
  v_acc uuid;
  i int;
  v_win boolean;
  v_pnl numeric;
  v_date date;
  v_time text;
  v_dir text;
  v_shot text := 'https://s3.tradingview.com/snapshots/0/0q6n8AOP.png';
begin
  select id into v_uid from auth.users where email = 'demo@datalitiq.app';
  if v_uid is null then raise exception 'Demo user belum ada'; end if;

  -- bersihkan data lama demo
  delete from trades       where user_id = v_uid;
  delete from transfers    where user_id = v_uid;
  delete from journal_notes where user_id = v_uid;
  delete from accounts     where user_id = v_uid;

  -- akun demo, saldo awal 600 juta
  v_acc := gen_random_uuid();
  insert into accounts (id, user_id, name, type, broker, currency, initial_balance, created_at)
  values (v_acc, v_uid, 'Akun Demo', 'trading', 'Exness', 'IDR', 600000000, now());

  -- settings
  insert into user_settings (user_id, currency, language, strategies, display_name, default_pair, onboarded, updated_at)
  values (v_uid, 'IDR', 'id',
    '["CM 20:00","Breakout","Retest","Trend Follow","Reversal"]'::jsonb,
    'Demo Trader', 'XAUUSD', true, now())
  on conflict (user_id) do update set onboarded = true, display_name = 'Demo Trader', currency = 'IDR';

  -- 60 trade dummy: 40% win, net profit
  for i in 1..60 loop
    v_win  := (i % 5) < 2;                                   -- 2 dari 5 = 40%
    v_dir  := case when i % 2 = 0 then 'long' else 'short' end;
    v_date := current_date - (60 - i);                       -- 60 hari terakhir
    if v_win then
      v_pnl  := 3000000 + (i % 5) * 1300000;                 -- +3.0jt .. +8.2jt
      v_time := '20:' || lpad(((i * 7) % 6 * 10)::text, 2, '0');  -- jam menang: 20:xx
    else
      v_pnl  := -(1500000 + (i % 4) * 700000);               -- -1.5jt .. -3.6jt
      v_time := '0' || (8 + (i % 2))::text || ':' || lpad(((i * 5) % 6 * 10)::text, 2, '0'); -- jam rugi: 08/09
    end if;

    insert into trades (
      id, user_id, account_id, date, entry_time, pair, direction, result, pnl,
      strategy, market_structure, followed_plan, screenshot_url, note, is_overtrade, created_at
    ) values (
      gen_random_uuid(), v_uid, v_acc, v_date, v_time, 'XAUUSD', v_dir,
      case when v_win then 'win' else 'loss' end, v_pnl,
      'CM 20:00',
      case when v_dir = 'long' then 'bullish' else 'bearish' end,
      v_win,                                                  -- ikut plan saat menang
      v_shot,
      case when v_win then 'Setup clean, entry sesuai plan.' else 'FOMO, entry di luar plan.' end,
      false, now()
    );
  end loop;

  -- beberapa jurnal contoh
  insert into journal_notes (id, user_id, date, content, mood, created_at) values
    (gen_random_uuid(), v_uid, current_date - 1, 'Disiplin bagus hari ini, ikut plan semua. Profit konsisten.', 5, now()),
    (gen_random_uuid(), v_uid, current_date - 3, 'Sempat FOMO di sesi Asia, harus lebih sabar tunggu jam London.', 2, now()),
    (gen_random_uuid(), v_uid, current_date - 6, 'Evaluasi: 70% loss saya di jam 08-09. Fokus entry jam 20:00.', 3, now())
  on conflict (user_id, date) do nothing;
end $$;
