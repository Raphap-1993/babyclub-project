-- Persist designer canvas dimensions per organizer so landing can render
-- table coordinates with the exact same reference space used in backoffice.

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
begin
  if to_regclass('public.layout_settings') is not null then
    update public.organizers o
    set
      layout_canvas_width = ls.canvas_width,
      layout_canvas_height = ls.canvas_height
    from lateral (
      select canvas_width, canvas_height
      from public.layout_settings ls
      where ls.organizer_id = o.id
        and ls.deleted_at is null
      order by ls.updated_at desc nulls last, ls.created_at desc nulls last
      limit 1
    ) as ls
    where (o.layout_canvas_width is null or o.layout_canvas_height is null);
  end if;
end $$;

comment on column public.organizers.layout_canvas_width is
  'Canvas width in pixels used in backoffice croquis designer when layout positions were saved';
comment on column public.organizers.layout_canvas_height is
  'Canvas height in pixels used in backoffice croquis designer when layout positions were saved';
