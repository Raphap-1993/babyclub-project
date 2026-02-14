-- Security Advisor: rls_enabled_no_policy remediation
-- Add explicit RLS policies for tables that already have RLS enabled.

alter table if exists public.table_reservations enable row level security;
alter table if exists public.tables enable row level security;

do $$
begin
  if to_regclass('public.table_reservations') is not null
     and not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'table_reservations'
         and policyname = 'table_reservations_service_role_all'
     ) then
    create policy table_reservations_service_role_all
      on public.table_reservations
      for all
      to service_role
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

do $$
begin
  if to_regclass('public.tables') is not null
     and not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'tables'
         and policyname = 'tables_service_role_all'
     ) then
    create policy tables_service_role_all
      on public.tables
      for all
      to service_role
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
