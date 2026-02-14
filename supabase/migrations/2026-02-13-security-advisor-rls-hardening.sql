-- Security Advisor hardening:
-- 1) Avoid SECURITY DEFINER behavior on public.staff_permissions view
-- 2) Enable RLS on exposed public tables
-- 3) Add explicit service_role policies for server-side operations

do $$
begin
  if exists (
    select 1
    from pg_views
    where schemaname = 'public'
      and viewname = 'staff_permissions'
  ) then
    execute 'alter view public.staff_permissions set (security_invoker = true)';
  end if;
end $$;

alter table if exists public.process_logs enable row level security;
alter table if exists public.promoters enable row level security;
alter table if exists public.table_availability enable row level security;
alter table if exists public.organizers enable row level security;

do $$
begin
  if to_regclass('public.process_logs') is not null
     and not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'process_logs'
         and policyname = 'process_logs_service_role_all'
     ) then
    create policy process_logs_service_role_all
      on public.process_logs
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if to_regclass('public.promoters') is not null
     and not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'promoters'
         and policyname = 'promoters_service_role_all'
     ) then
    create policy promoters_service_role_all
      on public.promoters
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if to_regclass('public.table_availability') is not null
     and not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'table_availability'
         and policyname = 'table_availability_service_role_all'
     ) then
    create policy table_availability_service_role_all
      on public.table_availability
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if to_regclass('public.organizers') is not null
     and not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'organizers'
         and policyname = 'organizers_service_role_all'
     ) then
    create policy organizers_service_role_all
      on public.organizers
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;
