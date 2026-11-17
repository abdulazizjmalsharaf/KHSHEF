-- Supplier contact details and an explicit ownership-safe relationship from
-- agreed prices to suppliers. Existing supplier and price rows are retained.

create or replace function public.normalize_supplier_key(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      translate(
        lower(normalize(coalesce(p_value, ''), NFKC)),
        'ًٌٍَُِّْٰٕٓٔ',
        ''
      ),
      '[[:space:][:punct:]،؛؟٫٬]+',
      ' ',
      'g'
    )
  );
$$;

revoke all on function public.normalize_supplier_key(text) from public, anon;
grant execute on function public.normalize_supplier_key(text) to authenticated;

alter table public.suppliers
  add column if not exists contact_phone text,
  add column if not exists supplier_key text,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'suppliers_contact_phone_length_check'
      and conrelid = 'public.suppliers'::regclass
  ) then
    alter table public.suppliers
      add constraint suppliers_contact_phone_length_check
      check (contact_phone is null or char_length(btrim(contact_phone)) between 3 and 32);
  end if;
end;
$$;

alter table public.supplier_price_agreements
  add column if not exists supplier_id uuid;

with normalized_suppliers as (
  select
    id,
    user_id,
    public.normalize_supplier_key(name) as supplier_key,
    count(*) over (
      partition by user_id, public.normalize_supplier_key(name)
    ) as matching_names
  from public.suppliers
  where user_id is not null
)
update public.suppliers as existing
set supplier_key = normalized.supplier_key
from normalized_suppliers as normalized
where existing.id = normalized.id
  and existing.supplier_key is null
  and normalized.supplier_key <> ''
  and normalized.matching_names = 1;

create unique index if not exists suppliers_id_user_id_unique
  on public.suppliers (id, user_id);

create index if not exists suppliers_owner_name_idx
  on public.suppliers (user_id, lower(btrim(name)))
  where user_id is not null;

create unique index if not exists suppliers_owner_key_unique
  on public.suppliers (user_id, supplier_key)
  where user_id is not null and supplier_key is not null;

create index if not exists supplier_price_agreements_supplier_id_idx
  on public.supplier_price_agreements (supplier_id)
  where supplier_id is not null;

alter table public.supplier_price_agreements
  drop constraint if exists supplier_price_agreements_supplier_owner_fk;
alter table public.supplier_price_agreements
  add constraint supplier_price_agreements_supplier_owner_fk
  foreign key (supplier_id, user_id)
  references public.suppliers (id, user_id)
  on delete set null (supplier_id);

with unique_supplier_names as (
  select user_id, public.normalize_supplier_key(name) as normalized_name, min(id::text)::uuid as supplier_id
  from public.suppliers
  where user_id is not null
    and public.normalize_supplier_key(name) <> ''
  group by user_id, public.normalize_supplier_key(name)
  having count(*) = 1
)
update public.supplier_price_agreements as prices
set supplier_id = suppliers.supplier_id
from unique_supplier_names as suppliers
where prices.supplier_id is null
  and prices.user_id = suppliers.user_id
  and public.normalize_supplier_key(prices.supplier_name) = suppliers.normalized_name;

alter table public.suppliers enable row level security;
revoke all on public.suppliers from public, anon, authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;

drop policy if exists "Owners manage their own suppliers" on public.suppliers;
create policy "Owners manage their own suppliers"
  on public.suppliers for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.supplier_price_agreements enable row level security;
revoke all on public.supplier_price_agreements from public, anon, authenticated;
grant select, insert, update, delete on public.supplier_price_agreements to authenticated;

drop policy if exists "Users manage their own supplier price agreements"
  on public.supplier_price_agreements;
create policy "Users manage their own supplier price agreements"
  on public.supplier_price_agreements for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.set_supplier_key_from_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.supplier_key = public.normalize_supplier_key(new.name);
  return new;
end;
$$;

revoke all on function public.set_supplier_key_from_name() from public, anon, authenticated;
drop trigger if exists suppliers_set_key_from_name on public.suppliers;
create trigger suppliers_set_key_from_name
  before insert or update of name on public.suppliers
  for each row execute function public.set_supplier_key_from_name();

create or replace function public.set_supplier_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_supplier_updated_at() from public, anon, authenticated;
drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_supplier_updated_at();

drop trigger if exists supplier_prices_set_updated_at on public.supplier_price_agreements;
create trigger supplier_prices_set_updated_at
  before update on public.supplier_price_agreements
  for each row execute function public.set_supplier_updated_at();

create or replace function public.sync_supplier_reference_prices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.name is distinct from new.name
    or old.supplier_key is distinct from new.supplier_key then
    update public.supplier_price_agreements
    set supplier_name = new.name,
        supplier_key = new.supplier_key
    where supplier_id = new.id
      and user_id = new.user_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_supplier_reference_prices() from public, anon, authenticated;
drop trigger if exists suppliers_sync_reference_prices on public.suppliers;
create trigger suppliers_sync_reference_prices
  after update of name, supplier_key on public.suppliers
  for each row execute function public.sync_supplier_reference_prices();

-- Keep uploaded price sheets private and scoped to the owning user's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplier-price-imports',
  'supplier-price-imports',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners read their supplier price imports" on storage.objects;
create policy "Owners read their supplier price imports"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'supplier-price-imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Owners upload their supplier price imports" on storage.objects;
create policy "Owners upload their supplier price imports"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'supplier-price-imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Owners delete their supplier price imports" on storage.objects;
create policy "Owners delete their supplier price imports"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'supplier-price-imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Import acceptance is one transaction: nothing is written until the owner
-- confirms the reviewed rows and confirms the values are in KWD.
create or replace function public.save_supplier_price_import(
  p_supplier_id uuid,
  p_items jsonb,
  p_confirmed_kwd boolean
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_supplier_name text;
  v_supplier_key text;
  v_saved_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_confirmed_kwd is distinct from true then
    raise exception 'kwd_confirmation_required' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_import_rows' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 500 then
    raise exception 'invalid_import_rows' using errcode = '22023';
  end if;

  select name, coalesce(supplier_key, public.normalize_supplier_key(name))
    into v_supplier_name, v_supplier_key
    from public.suppliers
    where id = p_supplier_id
      and user_id = v_user_id;
  if not found then
    raise exception 'supplier_not_found' using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      item_name text,
      unit text,
      unit_price numeric
    )
    where item_name is null
      or char_length(btrim(item_name)) not between 1 and 160
      or public.normalize_supplier_key(item_name) = ''
      or char_length(public.normalize_supplier_key(item_name)) > 200
      or char_length(coalesce(unit, '')) > 80
      or char_length(public.normalize_supplier_key(coalesce(unit, ''))) > 100
      or unit_price is null
      or item.unit_price::text in ('NaN', 'Infinity', '-Infinity')
      or unit_price > 9999999999.999999
      or unit_price < 0
  ) then
    raise exception 'invalid_import_rows' using errcode = '22023';
  end if;

  if exists (
    select
      public.normalize_supplier_key(item.item_name),
      public.normalize_supplier_key(coalesce(item.unit, ''))
    from jsonb_to_recordset(p_items) as item(
      item_name text,
      unit text,
      unit_price numeric
    )
    group by
      public.normalize_supplier_key(item.item_name),
      public.normalize_supplier_key(coalesce(item.unit, ''))
    having count(*) > 1
  ) then
    raise exception 'duplicate_import_rows' using errcode = '22023';
  end if;

  insert into public.supplier_price_agreements (
    user_id,
    supplier_id,
    supplier_name,
    supplier_key,
    item_name,
    item_key,
    unit,
    unit_key,
    unit_price,
    currency
  )
  select
    v_user_id,
    p_supplier_id,
    v_supplier_name,
    v_supplier_key,
    btrim(item.item_name),
    public.normalize_supplier_key(item.item_name),
    nullif(btrim(item.unit), ''),
    public.normalize_supplier_key(coalesce(item.unit, '')),
    item.unit_price,
    'KWD'
  from jsonb_to_recordset(p_items) as item(
    item_name text,
    unit text,
    unit_price numeric
  )
  on conflict (user_id, supplier_key, item_key, unit_key, currency)
  do update set
    supplier_id = excluded.supplier_id,
    supplier_name = excluded.supplier_name,
    item_name = excluded.item_name,
    unit = excluded.unit,
    unit_price = excluded.unit_price;

  get diagnostics v_saved_count = row_count;
  return v_saved_count;
end;
$$;

revoke all on function public.save_supplier_price_import(uuid, jsonb, boolean) from public, anon;
grant execute on function public.save_supplier_price_import(uuid, jsonb, boolean) to authenticated;
