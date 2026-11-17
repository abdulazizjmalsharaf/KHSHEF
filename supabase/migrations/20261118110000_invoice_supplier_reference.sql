-- Keep the supplier selected during upload linked to the invoice while
-- preserving historical invoices if their supplier is later removed.
alter table public.invoices
  add column if not exists supplier_id uuid;

create index if not exists invoices_user_supplier_id_idx
  on public.invoices (user_id, supplier_id, created_at desc)
  where supplier_id is not null;

alter table public.invoices
  drop constraint if exists invoices_supplier_owner_fk;
alter table public.invoices
  add constraint invoices_supplier_owner_fk
  foreign key (supplier_id, user_id)
  references public.suppliers (id, user_id)
  on delete set null (supplier_id);

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
  v_supplier_id uuid;
  v_supplier_key text;
  v_currency text := coalesce(nullif(p_extraction->>'currency', ''), 'KWD');
  v_item jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_status not in ('under_review', 'matched', 'discrepancy', 'approved', 'disputed') then
    raise exception 'Invalid invoice status';
  end if;

  select supplier_id into v_supplier_id
  from public.invoices
  where id = p_invoice_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'Invoice not found';
  end if;

  if v_supplier_id is null then
    v_supplier_key := coalesce(p_extraction->>'supplierKey', '');
  else
    select supplier_key into v_supplier_key
    from public.suppliers
    where id = v_supplier_id and user_id = v_user_id;
    if not found then
      raise exception 'Invoice supplier not found';
    end if;
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
