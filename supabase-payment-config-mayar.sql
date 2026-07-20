-- Kolom kredensial Mayar.id pada payment_config.
--
-- payment_config sengaja TANPA policy RLS: hanya service_role (di route server)
-- yang boleh membacanya. API key Mayar adalah satu-satunya rahasia integrasi ini
-- — tidak ada signature request — jadi kebocorannya berarti orang lain bisa
-- membuat invoice atas nama Anda.
--
-- Jalankan di Supabase -> SQL Editor.

alter table payment_config add column if not exists mayar_api_key   text;
alter table payment_config add column if not exists mayar_production boolean default false;

-- Referensi id transaksi di sisi gateway. Untuk Mayar berisi id invoice, yang
-- dipakai webhook untuk menanyakan status sebenarnya ke API Mayar.
alter table payment_orders add column if not exists gateway_ref text;
create index if not exists payment_orders_gateway_ref_idx on payment_orders (gateway_ref);
