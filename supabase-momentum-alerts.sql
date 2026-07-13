-- Tabel state dedup untuk notifikasi momentum candle Telegram.
-- Tanpa data sensitif — hanya menyimpan timestamp candle terakhir yang sudah dinotifikasi
-- per (symbol, timeframe), supaya endpoint /api/terminal/momentum-alert (dipanggil
-- berkala oleh scheduler eksternal) tidak mengirim notifikasi Telegram berulang
-- untuk candle yang sama.

create table if not exists momentum_alert_state (
  id text primary key,
  last_candle_time bigint not null,
  last_alert_at timestamptz not null default now()
);

alter table momentum_alert_state enable row level security;

-- Tabel internal, tanpa data sensitif — izinkan akses penuh (dipakai server-side saja).
create policy "momentum_alert_state_all" on momentum_alert_state
  for all
  using (true)
  with check (true);
