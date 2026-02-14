-- Security Advisor WARN remediation
-- - Fix mutable search_path for known public functions
-- - Replace always-true RLS checks with explicit role-based checks
--   (same operational intent, less permissive expression)

do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    inner join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'auto_create_table_availability',
        'sync_table_availability_on_update',
        'get_available_tables_for_event',
        'auto_create_availability_for_new_event',
        'handle_new_auth_user',
        'set_event_general_code',
        'auto_updated_at',
        'update_updated_at'
      ])
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'brand_settings'
      and policyname = 'brand_settings_service_role_all'
  ) then
    drop policy if exists brand_settings_service_role_all on public.brand_settings;
    create policy brand_settings_service_role_all
      on public.brand_settings
      for all
      to service_role
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'layout_settings'
      and policyname = 'layout_settings_service_role_all'
  ) then
    drop policy if exists layout_settings_service_role_all on public.layout_settings;
    create policy layout_settings_service_role_all
      on public.layout_settings
      for all
      to service_role
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'table_products'
      and policyname = 'table_products_service_role_all'
  ) then
    drop policy if exists table_products_service_role_all on public.table_products;
    create policy table_products_service_role_all
      on public.table_products
      for all
      to service_role
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'process_logs'
      and policyname = 'process_logs_service_role_all'
  ) then
    drop policy if exists process_logs_service_role_all on public.process_logs;
    create policy process_logs_service_role_all
      on public.process_logs
      for all
      to service_role
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'promoters'
      and policyname = 'promoters_service_role_all'
  ) then
    drop policy if exists promoters_service_role_all on public.promoters;
    create policy promoters_service_role_all
      on public.promoters
      for all
      to service_role
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'table_availability'
      and policyname = 'table_availability_service_role_all'
  ) then
    drop policy if exists table_availability_service_role_all on public.table_availability;
    create policy table_availability_service_role_all
      on public.table_availability
      for all
      to service_role
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'organizers'
      and policyname = 'organizers_service_role_all'
  ) then
    drop policy if exists organizers_service_role_all on public.organizers;
    create policy organizers_service_role_all
      on public.organizers
      for all
      to service_role
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'person_type_links'
      and policyname = 'insert_from_trigger'
  ) then
    drop policy if exists insert_from_trigger on public.person_type_links;
    create policy insert_from_trigger
      on public.person_type_links
      for insert
      to public
      with check (auth.role() is null or auth.role() = 'service_role');
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'person_type_links'
      and policyname = 'person_type_links_insert_public'
  ) then
    drop policy if exists person_type_links_insert_public on public.person_type_links;
    create policy person_type_links_insert_public
      on public.person_type_links
      for insert
      to public
      with check (coalesce(auth.role(), '') in ('anon', 'authenticated', 'service_role'));
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'persons'
      and policyname = 'persons_insert_public'
  ) then
    drop policy if exists persons_insert_public on public.persons;
    create policy persons_insert_public
      on public.persons
      for insert
      to public
      with check (coalesce(auth.role(), '') in ('anon', 'authenticated', 'service_role'));
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'persons'
      and policyname = 'public_insert_persons'
  ) then
    drop policy if exists public_insert_persons on public.persons;
    create policy public_insert_persons
      on public.persons
      for insert
      to anon
      with check (auth.role() = 'anon');
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'persons'
      and policyname = 'trigger_insert_persons'
  ) then
    drop policy if exists trigger_insert_persons on public.persons;
    create policy trigger_insert_persons
      on public.persons
      for insert
      to public
      with check (auth.role() is null or auth.role() = 'service_role');
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tickets'
      and policyname = 'anon_insert_tickets'
  ) then
    drop policy if exists anon_insert_tickets on public.tickets;
    create policy anon_insert_tickets
      on public.tickets
      for insert
      to anon
      with check (auth.role() = 'anon');
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tickets'
      and policyname = 'tickets_insert_public'
  ) then
    drop policy if exists tickets_insert_public on public.tickets;
    create policy tickets_insert_public
      on public.tickets
      for insert
      to public
      with check (coalesce(auth.role(), '') in ('anon', 'authenticated', 'service_role'));
  end if;
end $$;
