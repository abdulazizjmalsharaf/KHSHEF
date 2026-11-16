create table if not exists public.supplier_price_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  supplier_name text not null,
  supplier_key text not null,
  item_name text not null,
  item_key text not null,
  unit text,
  unit_price numeric(16, 6) not null check (unit_price >= 0),
  currency text not null default 'KWD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, supplier_key, item_key, currency)
);

create index if not exists supplier_price_agreements_user_supplier_idx
  on public.supplier_price_agreements (user_id, supplier_key, item_key);

alter table public.supplier_price_agreements enable row level security;

drop policy if exists "Users manage their own supplier price agreements"
  on public.supplier_price_agreements;
create policy "Users manage their own supplier price agreements"
  on public.supplier_price_agreements for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
