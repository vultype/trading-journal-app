-- ════════════════════════════════════════════════════════════════════════
--  PEMBAYARAN MANUAL (transfer bank) — invoice resmi + bukti transfer + Moota
--  Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
--  Prasyarat: tabel payment_orders sudah ada (supabase-checkout.sql)
-- ════════════════════════════════════════════════════════════════════════

-- Kolom baru: nomor invoice resmi, bukti transfer (URL gambar), metode pembayaran
alter table payment_orders add column if not exists invoice_number text;
alter table payment_orders add column if not exists proof_url text;
alter table payment_orders add column if not exists method text not null default 'manual';

-- Nomor invoice otomatis format INV-DTQ-000123 (urut, tanpa race condition)
create sequence if not exists payment_invoice_seq start 1000;

create or replace function set_invoice_number() returns trigger as $BODY$
begin
  if new.invoice_number is null then
    new.invoice_number := 'INV-DTQ-' || lpad(nextval('payment_invoice_seq')::text, 6, '0');
  end if;
  return new;
end;
$BODY$ language plpgsql;

drop trigger if exists trg_set_invoice_number on payment_orders;
create trigger trg_set_invoice_number before insert on payment_orders
for each row execute function set_invoice_number();

-- Isi invoice_number untuk order lama yang belum punya
update payment_orders set invoice_number = 'INV-DTQ-' || lpad(nextval('payment_invoice_seq')::text, 6, '0')
where invoice_number is null;
