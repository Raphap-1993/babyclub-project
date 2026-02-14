-- Optimize PostgREST list/count patterns on tickets:
-- WHERE deleted_at IS NULL
-- ORDER BY created_at DESC

do $$
begin
  if to_regclass('public.tickets') is not null
    and exists (
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
        and column_name = 'deleted_at'
    ) then
    create index if not exists tickets_not_deleted_created_at_idx
      on public.tickets(created_at desc)
      where deleted_at is null;
  end if;
end $$;
