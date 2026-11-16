alter table public.supplier_price_agreements
  add column if not exists unit_key text not null default '';

update public.supplier_price_agreements
set unit_key = lower(trim(coalesce(unit, '')))
where unit_key = '';

alter table public.supplier_price_agreements
  drop constraint if exists supplier_price_agreements_user_id_supplier_key_item_key_currency_key;

alter table public.supplier_price_agreements
  drop constraint if exists supplier_price_agreements_user_id_supplier_key_item_key_cur_key;

create unique index if not exists supplier_price_agreements_owner_item_unit_currency_idx
  on public.supplier_price_agreements (user_id, supplier_key, item_key, unit_key, currency);
