-- Ensure branding/layout settings tables exist in every environment.
-- These were previously created manually via SQL files and may be missing in local DBs.

create table if not exists public.brand_settings (
  id integer primary key default 1,
  logo_url text,
  updated_at timestamptz default now(),
  deleted_at timestamptz null,
  deleted_by uuid null,
  is_active boolean not null default true
);

create table if not exists public.layout_settings (
  id integer primary key default 1,
  layout_url text,
  updated_at timestamptz default now(),
  deleted_at timestamptz null,
  deleted_by uuid null,
  is_active boolean not null default true
);

insert into public.brand_settings (id)
values (1)
on conflict (id) do nothing;

insert into public.layout_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.brand_settings enable row level security;
alter table public.layout_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'brand_settings'
      and policyname = 'brand_settings_service_role_all'
  ) then
    create policy brand_settings_service_role_all
      on public.brand_settings
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'layout_settings'
      and policyname = 'layout_settings_service_role_all'
  ) then
    create policy layout_settings_service_role_all
      on public.layout_settings
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;
