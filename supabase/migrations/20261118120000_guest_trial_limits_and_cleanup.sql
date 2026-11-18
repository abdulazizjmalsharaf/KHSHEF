-- Guest accounts use the authenticated role, but have a bounded invoice trial.
create or replace function public.can_create_invoice_for_current_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false
    or (
      select count(*) < 5
      from public.invoices
      where user_id = auth.uid()
    );
$$;

revoke all on function public.can_create_invoice_for_current_user() from public, anon;
grant execute on function public.can_create_invoice_for_current_user() to authenticated;

drop policy if exists "Guests may create up to five invoices" on public.invoices;
create policy "Guests may create up to five invoices"
  on public.invoices as restrictive for insert to authenticated
  with check (public.can_create_invoice_for_current_user());

-- Guests may upload invoice and supplier-price images up to 5 MiB.
drop policy if exists "Guest uploads are limited to 5 MiB" on storage.objects;
create policy "Guest uploads are limited to 5 MiB"
  on storage.objects as restrictive for insert to authenticated
  with check (
    (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
    or bucket_id not in ('invoice-documents', 'supplier-price-imports')
    or coalesce((metadata ->> 'size')::bigint, 0) <= 5242880
  );

-- Track recent activity so only genuinely abandoned trial accounts expire.
create table if not exists public.anonymous_account_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create index if not exists anonymous_account_activity_last_seen_idx
  on public.anonymous_account_activity (last_seen_at);

alter table public.anonymous_account_activity enable row level security;
revoke all on public.anonymous_account_activity from public, anon, authenticated;
grant select, insert, update on public.anonymous_account_activity to authenticated;

drop policy if exists "Guests read their own activity" on public.anonymous_account_activity;
create policy "Guests read their own activity"
  on public.anonymous_account_activity for select to authenticated
  using (
    user_id = (select auth.uid())
    and (select auth.jwt() ->> 'is_anonymous') = 'true'
  );

drop policy if exists "Guests record their own activity" on public.anonymous_account_activity;
create policy "Guests record their own activity"
  on public.anonymous_account_activity for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select auth.jwt() ->> 'is_anonymous') = 'true'
  );

drop policy if exists "Guests update their own activity" on public.anonymous_account_activity;
create policy "Guests update their own activity"
  on public.anonymous_account_activity for update to authenticated
  using (
    user_id = (select auth.uid())
    and (select auth.jwt() ->> 'is_anonymous') = 'true'
  )
  with check (
    user_id = (select auth.uid())
    and (select auth.jwt() ->> 'is_anonymous') = 'true'
  );

-- The scheduled Edge Function verifies a random Vault token before deleting
-- old guest accounts and their private Storage objects through the Storage API.
create or replace function public.verify_guest_cleanup_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_token is not null and exists (
    select 1
    from vault.decrypted_secrets
    where name = 'kashef_guest_cleanup_token'
      and decrypted_secret = p_token
  );
$$;

revoke all on function public.verify_guest_cleanup_token(text) from public, anon, authenticated;
grant execute on function public.verify_guest_cleanup_token(text) to service_role;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'kashef_guest_cleanup_token'
  ) then
    perform vault.create_secret(
      gen_random_uuid()::text || gen_random_uuid()::text,
      'kashef_guest_cleanup_token',
      'Authorization token for the daily cleanup of abandoned Kashef trial accounts',
      null
    );
  end if;
end;
$$;

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'kashef-cleanup-abandoned-guests',
  '15 3 * * *',
  $job$
    select net.http_post(
      url := 'https://sfbuioynrtqcpnzszwre.supabase.co/functions/v1/cleanup-guest-accounts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-kashef-cleanup-token',
        (select decrypted_secret from vault.decrypted_secrets where name = 'kashef_guest_cleanup_token')
      ),
      body := '{}'::jsonb
    );
  $job$
);
