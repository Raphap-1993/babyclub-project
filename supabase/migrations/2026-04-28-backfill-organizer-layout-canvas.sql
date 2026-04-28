-- Forward-only production backfill for organizer layout canvas dimensions.
-- This mirrors the hardened reset logic from the historical 2026-02-13
-- migration because already-applied migrations are not re-run remotely.

alter table if exists public.organizers
  add column if not exists layout_canvas_width integer,
  add column if not exists layout_canvas_height integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizers_layout_canvas_width_positive'
  ) then
    alter table public.organizers
      add constraint organizers_layout_canvas_width_positive
      check (layout_canvas_width is null or layout_canvas_width > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizers_layout_canvas_height_positive'
  ) then
    alter table public.organizers
      add constraint organizers_layout_canvas_height_positive
      check (layout_canvas_height is null or layout_canvas_height > 0);
  end if;
end $$;

do $$
declare
  v_has_layout_settings_columns boolean;
  v_has_deleted_at boolean;
  v_has_updated_at boolean;
  v_has_created_at boolean;
  v_deleted_filter text := '';
  v_order_clause text := '';
begin
  if to_regclass('public.layout_settings') is null then
    return;
  end if;

  select count(*) = 3
    into v_has_layout_settings_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'layout_settings'
    and column_name in ('organizer_id', 'canvas_width', 'canvas_height');

  if not coalesce(v_has_layout_settings_columns, false) then
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'layout_settings'
      and column_name = 'deleted_at'
  ) into v_has_deleted_at;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'layout_settings'
      and column_name = 'updated_at'
  ) into v_has_updated_at;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'layout_settings'
      and column_name = 'created_at'
  ) into v_has_created_at;

  if v_has_deleted_at then
    v_deleted_filter := ' and ls.deleted_at is null';
  end if;

  if v_has_updated_at and v_has_created_at then
    v_order_clause := ' order by ls.updated_at desc nulls last, ls.created_at desc nulls last';
  elsif v_has_updated_at then
    v_order_clause := ' order by ls.updated_at desc nulls last';
  end if;

  execute '
    update public.organizers o
    set
      layout_canvas_width = ls.canvas_width,
      layout_canvas_height = ls.canvas_height
    from lateral (
      select canvas_width, canvas_height
      from public.layout_settings ls
      where ls.organizer_id = o.id' || v_deleted_filter || v_order_clause || '
      limit 1
    ) as ls
    where (o.layout_canvas_width is null or o.layout_canvas_height is null)';
end $$;

do $$
begin
  if to_regclass('public.tables') is null then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tables'
      and column_name in ('organizer_id', 'layout_size', 'pos_w', 'pos_h')
    group by table_name
    having count(*) = 4
  ) then
    return;
  end if;

  with inferred as (
    select
      t.organizer_id,
      round(
        percentile_cont(0.5) within group (
          order by t.layout_size * 100 / nullif(t.pos_w, 0)
        )
      )::integer as canvas_width,
      round(
        percentile_cont(0.5) within group (
          order by t.layout_size * 100 / nullif(t.pos_h, 0)
        )
      )::integer as canvas_height
    from public.tables t
    where t.layout_size is not null
      and t.pos_w is not null
      and t.pos_h is not null
      and t.pos_w > 0
      and t.pos_h > 0
    group by t.organizer_id
  )
  update public.organizers o
  set
    layout_canvas_width = inferred.canvas_width,
    layout_canvas_height = inferred.canvas_height
  from inferred
  where (o.layout_canvas_width is null or o.layout_canvas_height is null)
    and inferred.organizer_id = o.id
    and inferred.canvas_width is not null
    and inferred.canvas_height is not null;
end $$;

comment on column public.organizers.layout_canvas_width is
  'Canvas width in pixels used in backoffice croquis designer when layout positions were saved';
comment on column public.organizers.layout_canvas_height is
  'Canvas height in pixels used in backoffice croquis designer when layout positions were saved';
