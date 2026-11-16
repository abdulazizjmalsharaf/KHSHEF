create index if not exists invoice_items_invoice_owner_idx
  on public.invoice_items (invoice_id, user_id);
