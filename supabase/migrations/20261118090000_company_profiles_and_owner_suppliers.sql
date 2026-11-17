-- Each current account represents one company owner. Keep the profile and
-- supplier table changes additive so existing rows are not deleted.

create table if not exists public.business_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_profiles_business_name_check check (
    business_name is null
    or (
      business_name = btrim(business_name)
      and char_length(business_name) between 2 and 120
    )
  )
);

alter table public.business_profiles enable row level security;
revoke all on public.business_profiles from anon, authenticated;
grant select, insert, update on public.business_profiles to authenticated;

drop policy if exists "Owners read their business profile" on public.business_profiles;
create policy "Owners read their business profile"
  on public.business_profiles for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Owners create their business profile" on public.business_profiles;
create policy "Owners create their business profile"
  on public.business_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Owners update their business profile" on public.business_profiles;
create policy "Owners update their business profile"
  on public.business_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.create_business_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_profiles (user_id, business_name)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'business_name', '')), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_business_profile_for_auth_user() from public, anon, authenticated;

create or replace function public.set_business_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_business_profile_updated_at() from public, anon, authenticated;

drop trigger if exists set_business_profiles_updated_at on public.business_profiles;
create trigger set_business_profiles_updated_at
  before update on public.business_profiles
  for each row execute function public.set_business_profile_updated_at();

drop trigger if exists on_auth_user_created_business_profile on auth.users;
create trigger on_auth_user_created_business_profile
  after insert on auth.users
  for each row execute function public.create_business_profile_for_auth_user();

-- Existing Google accounts get a private profile row. Their company name can
-- remain null until supplied; no personal Google name is guessed as a company.
insert into public.business_profiles (user_id, business_name)
select
  id,
  nullif(btrim(coalesce(raw_user_meta_data ->> 'business_name', '')), '')
from auth.users
on conflict (user_id) do nothing;

-- Legacy public supplier-name submissions have no reliable owner. Preserve
-- those rows, but keep them invisible until they can be explicitly assigned.
alter table public.suppliers
  add column if not exists user_id uuid default auth.uid()
  references auth.users(id) on delete set null;

alter table public.suppliers
  alter column user_id set default auth.uid();

alter table public.suppliers enable row level security;
revoke all on public.suppliers from anon, authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;

drop policy if exists "Visitors can submit supplier names" on public.suppliers;
drop policy if exists "Owners manage their own suppliers" on public.suppliers;
create policy "Owners manage their own suppliers"
  on public.suppliers for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
