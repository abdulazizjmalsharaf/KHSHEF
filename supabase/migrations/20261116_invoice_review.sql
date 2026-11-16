create table if not exists public.invoices (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  supplier_name text,
  supplier_key text not null default '',
  invoice_number text,
  invoice_number_key text,
  invoice_date date,
  currency text not null default 'KWD',
  total_amount numeric(16, 6),
  status text not null default 'under_review'
    check (status in ('under_review', 'matched', 'discrepancy', 'approved', 'disputed')),
  invoice_path text not null,
  receipt_path text,
  extracted_data jsonb not null default '{}'::jsonb,
  checks jsonb not null default '[]'::jsonb,
  approved_at timestamptz,
  disputed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  invoice_id uuid not null,
  supplier_key text not null default '',
  item_key text not null default '',
  name text not null,
  quantity numeric(16, 6),
  unit text,
  unit_price numeric(16, 6),
  line_total numeric(16, 6),
  currency text not null default 'KWD',
  confidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint invoice_items_invoice_owner_fk
    foreign key (invoice_id, user_id)
    references public.invoices (id, user_id)
    on delete cascade
);

create index if not exists invoices_user_created_idx
  on public.invoices (user_id, created_at desc);
create index if not exists invoices_user_supplier_idx
  on public.invoices (user_id, supplier_key, created_at desc);
create index if not exists invoices_user_duplicate_idx
  on public.invoices (user_id, invoice_number_key, invoice_date, total_amount);
create index if not exists invoice_items_user_history_idx
  on public.invoice_items (user_id, supplier_key, item_key, created_at desc);

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists "Users manage their own invoices" on public.invoices;
create policy "Users manage their own invoices"
  on public.invoices for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their own invoice items" on public.invoice_items;
create policy "Users manage their own invoice items"
  on public.invoice_items for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id
        and i.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id
        and i.user_id = (select auth.uid())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoice-documents',
  'invoice-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read their invoice documents" on storage.objects;
create policy "Users read their invoice documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'invoice-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users upload their invoice documents" on storage.objects;
create policy "Users upload their invoice documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'invoice-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users update their invoice documents" on storage.objects;
create policy "Users update their invoice documents"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'invoice-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'invoice-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users delete their invoice documents" on storage.objects;
create policy "Users delete their invoice documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'invoice-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function public.save_invoice_review(
  p_invoice_id uuid,
  p_extraction jsonb,
  p_checks jsonb,
  p_status text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_supplier_key text := coalesce(p_extraction->>'supplierKey', '');
  v_currency text := coalesce(nullif(p_extraction->>'currency', ''), 'KWD');
  v_item jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_status not in ('under_review', 'matched', 'discrepancy', 'approved', 'disputed') then
    raise exception 'Invalid invoice status';
  end if;

  update public.invoices
  set supplier_name = nullif(p_extraction->>'supplierName', ''),
      supplier_key = v_supplier_key,
      invoice_number = nullif(p_extraction->>'invoiceNumber', ''),
      invoice_number_key = nullif(p_extraction->>'invoiceNumberKey', ''),
      invoice_date = nullif(p_extraction->>'invoiceDate', '')::date,
      currency = v_currency,
      total_amount = nullif(p_extraction->>'total', '')::numeric,
      extracted_data = p_extraction,
      checks = coalesce(p_checks, '[]'::jsonb),
      status = p_status,
      updated_at = now()
  where id = p_invoice_id and user_id = v_user_id;

  if not found then
    raise exception 'Invoice not found';
  end if;

  delete from public.invoice_items
  where invoice_id = p_invoice_id and user_id = v_user_id;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_extraction->'items', '[]'::jsonb))
  loop
    insert into public.invoice_items (
      user_id, invoice_id, supplier_key, item_key, name, quantity, unit,
      unit_price, line_total, currency, confidence
    ) values (
      v_user_id,
      p_invoice_id,
      v_supplier_key,
      coalesce(v_item->>'itemKey', ''),
      coalesce(nullif(v_item->>'name', ''), 'صنف غير محدد'),
      nullif(v_item->>'quantity', '')::numeric,
      nullif(v_item->>'unit', ''),
      nullif(v_item->>'unitPrice', '')::numeric,
      nullif(v_item->>'lineTotal', '')::numeric,
      v_currency,
      jsonb_build_object(
        'name', v_item->'nameConfidence',
        'quantity', v_item->'quantityConfidence',
        'unit', v_item->'unitConfidence',
        'unitPrice', v_item->'unitPriceConfidence',
        'lineTotal', v_item->'lineTotalConfidence'
      )
    );
  end loop;
end;
$$;

revoke all on function public.save_invoice_review(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.save_invoice_review(uuid, jsonb, jsonb, text) to authenticated;
