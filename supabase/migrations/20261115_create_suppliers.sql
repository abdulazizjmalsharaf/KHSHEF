-- This first step only accepts supplier names. There is no public read access.
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (
    name = btrim(name) and char_length(name) between 1 and 80
  ),
  created_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;
revoke all on public.suppliers from anon, authenticated;
grant insert (name) on public.suppliers to anon;

create policy "Visitors can submit supplier names"
  on public.suppliers
  for insert
  to anon
  with check (char_length(btrim(name)) between 1 and 80);

-- No SELECT, UPDATE or DELETE grant/policy for visitors.
-- Add authenticated ownership before offering private supplier lists.
