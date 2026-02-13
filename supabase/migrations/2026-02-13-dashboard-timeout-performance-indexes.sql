-- Performance indexes for dashboard/login timeout mitigation.
-- Non-destructive and safe to re-run.

do $$
begin
  if to_regclass('public.tickets') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tickets'
        and column_name = 'created_at'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tickets'
        and column_name = 'is_active'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tickets'
        and column_name = 'deleted_at'
    ) then
      create index if not exists tickets_active_created_at_idx
        on public.tickets(created_at desc)
        where deleted_at is null and is_active = true;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tickets'
        and column_name = 'event_id'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tickets'
        and column_name = 'is_active'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tickets'
        and column_name = 'deleted_at'
    ) then
      create index if not exists tickets_active_event_created_at_idx
        on public.tickets(event_id, created_at desc)
        where deleted_at is null and is_active = true;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tickets'
        and column_name = 'used'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tickets'
        and column_name = 'is_active'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tickets'
        and column_name = 'deleted_at'
    ) then
      create index if not exists tickets_active_used_idx
        on public.tickets(used)
        where deleted_at is null and is_active = true;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tickets'
        and column_name = 'payment_status'
    ) then
      create index if not exists tickets_payment_status_idx
        on public.tickets(payment_status);
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.events') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'events'
        and column_name = 'starts_at'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'events'
        and column_name = 'is_active'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'events'
        and column_name = 'deleted_at'
    ) then
    create index if not exists events_active_starts_at_idx
      on public.events(starts_at)
      where deleted_at is null and is_active = true;
  end if;
end $$;

do $$
begin
  if to_regclass('public.payments') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'payments'
        and column_name = 'status'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'payments'
        and column_name = 'created_at'
    ) then
    create index if not exists payments_status_created_at_idx
      on public.payments(status, created_at desc);
  end if;
end $$;

do $$
begin
  if to_regclass('public.staff') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'staff'
        and column_name = 'auth_user_id'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'staff'
        and column_name = 'is_active'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'staff'
        and column_name = 'deleted_at'
    ) then
    create index if not exists staff_auth_user_active_idx
      on public.staff(auth_user_id)
      where deleted_at is null and is_active = true;
  end if;
end $$;

do $$
begin
  if to_regclass('public.table_availability') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'table_availability'
        and column_name = 'event_id'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'table_availability'
        and column_name = 'is_available'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'table_availability'
        and column_name = 'deleted_at'
    ) then
    create index if not exists table_availability_event_available_idx
      on public.table_availability(event_id, is_available)
      where deleted_at is null;
  end if;
end $$;
