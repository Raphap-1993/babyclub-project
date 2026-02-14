-- Promoters flow + dashboard summary performance hardening.
-- Safe, additive changes only.

create extension if not exists pg_trgm;

do $$
begin
  if to_regclass('public.code_batches') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'code_batches' and column_name = 'promoter_id'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'code_batches' and column_name = 'created_at'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'code_batches' and column_name = 'deleted_at'
    ) then
    create index if not exists code_batches_promoter_created_idx
      on public.code_batches(promoter_id, created_at desc)
      where deleted_at is null;
  end if;

  if to_regclass('public.codes') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'codes' and column_name = 'promoter_id'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'codes' and column_name = 'event_id'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'codes' and column_name = 'created_at'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'codes' and column_name = 'deleted_at'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'codes' and column_name = 'is_active'
    ) then
    create index if not exists codes_promoter_event_active_created_idx
      on public.codes(promoter_id, event_id, created_at desc)
      where deleted_at is null and is_active = true;
  end if;

  if to_regclass('public.tickets') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tickets' and column_name = 'event_id'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tickets' and column_name = 'promoter_id'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tickets' and column_name = 'created_at'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tickets' and column_name = 'deleted_at'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tickets' and column_name = 'is_active'
    ) then
    create index if not exists tickets_event_promoter_active_idx
      on public.tickets(event_id, promoter_id, created_at desc)
      where deleted_at is null and is_active = true;
  end if;

  if to_regclass('public.promoters') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'promoters' and column_name = 'created_at'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'promoters' and column_name = 'deleted_at'
    ) then
    create index if not exists promoters_active_created_idx
      on public.promoters(created_at asc)
      where deleted_at is null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.promoters') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'promoters' and column_name = 'code'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'promoters' and column_name = 'deleted_at'
    ) then
    create index if not exists promoters_code_trgm_idx
      on public.promoters
      using gin ((lower(coalesce(code, ''))) gin_trgm_ops)
      where deleted_at is null;
  end if;

  if to_regclass('public.persons') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'persons' and column_name = 'first_name'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'persons' and column_name = 'last_name'
    ) then
    create index if not exists persons_full_name_trgm_idx
      on public.persons
      using gin ((lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')))) gin_trgm_ops);
  end if;
end $$;

create or replace function public.get_qr_summary_all(
  p_cutoff timestamptz default (now() - interval '7 days')
)
returns table (
  event_id uuid,
  name text,
  date timestamptz,
  total_qr integer,
  by_type jsonb
)
language sql
stable
set search_path = public
as $$
with scoped_events as (
  select
    e.id,
    e.name,
    e.starts_at
  from public.events e
  where e.deleted_at is null
    and coalesce(e.is_active, true)
    and e.starts_at >= p_cutoff
),
scoped_tickets as (
  select
    t.event_id,
    case
      when c.table_reservation_id is not null then 'table'
      else coalesce(nullif(c.type, ''), 'desconocido')
    end as type_key
  from public.tickets t
  left join public.codes c
    on c.id = t.code_id
   and c.deleted_at is null
  where t.deleted_at is null
    and coalesce(t.is_active, true)
    and t.event_id in (select id from scoped_events)
    and coalesce(c.is_active, true)
),
by_type_rows as (
  select
    st.event_id,
    st.type_key,
    count(*)::int as qty
  from scoped_tickets st
  group by st.event_id, st.type_key
),
totals as (
  select
    event_id,
    sum(qty)::int as total_qr
  from by_type_rows
  group by event_id
),
aggregated as (
  select
    event_id,
    jsonb_object_agg(type_key, qty order by type_key) as by_type
  from by_type_rows
  group by event_id
)
select
  e.id as event_id,
  e.name,
  e.starts_at as date,
  coalesce(t.total_qr, 0)::int as total_qr,
  coalesce(a.by_type, '{}'::jsonb) as by_type
from scoped_events e
left join totals t on t.event_id = e.id
left join aggregated a on a.event_id = e.id
order by e.starts_at asc;
$$;

create or replace function public.get_promoter_summary_all(
  p_cutoff timestamptz default (now() - interval '7 days'),
  p_top_limit integer default 10
)
returns table (
  event_id uuid,
  name text,
  date timestamptz,
  total_tickets integer,
  promoters jsonb
)
language sql
stable
set search_path = public
as $$
with scoped_events as (
  select
    e.id,
    e.name,
    e.starts_at
  from public.events e
  where e.deleted_at is null
    and coalesce(e.is_active, true)
    and e.starts_at >= p_cutoff
),
ticket_source as (
  select
    t.event_id,
    coalesce(t.promoter_id::text, c.promoter_id::text, 'direct') as promoter_key
  from public.tickets t
  left join public.codes c
    on c.id = t.code_id
   and c.deleted_at is null
  where t.deleted_at is null
    and coalesce(t.is_active, true)
    and t.event_id in (select id from scoped_events)
    and coalesce(c.is_active, true)
),
counted as (
  select
    ts.event_id,
    ts.promoter_key,
    count(*)::int as tickets
  from ticket_source ts
  group by ts.event_id, ts.promoter_key
),
promoter_labels as (
  select
    p.id::text as promoter_key,
    coalesce(
      nullif(trim(concat_ws(' ', per.first_name, per.last_name)), ''),
      nullif(trim(p.code), ''),
      'Promotor ' || left(p.id::text, 6)
    ) as promoter_name
  from public.promoters p
  left join public.persons per on per.id = p.person_id
),
ranked as (
  select
    c.event_id,
    c.promoter_key,
    case
      when c.promoter_key = 'direct' then 'Invitacion directa'
      else coalesce(pl.promoter_name, 'Promotor ' || left(c.promoter_key, 6))
    end as promoter_name,
    c.tickets,
    row_number() over (partition by c.event_id order by c.tickets desc, c.promoter_key asc) as rn
  from counted c
  left join promoter_labels pl on pl.promoter_key = c.promoter_key
),
totals as (
  select
    event_id,
    sum(tickets)::int as total_tickets
  from counted
  group by event_id
),
top_promoters as (
  select
    r.event_id,
    jsonb_agg(
      jsonb_build_object(
        'promoter_id', r.promoter_key,
        'name', r.promoter_name,
        'tickets', r.tickets
      )
      order by r.tickets desc, r.promoter_name asc
    ) as promoters
  from ranked r
  where r.rn <= greatest(coalesce(p_top_limit, 10), 1)
  group by r.event_id
)
select
  e.id as event_id,
  e.name,
  e.starts_at as date,
  coalesce(t.total_tickets, 0)::int as total_tickets,
  coalesce(tp.promoters, '[]'::jsonb) as promoters
from scoped_events e
left join totals t on t.event_id = e.id
left join top_promoters tp on tp.event_id = e.id
order by e.starts_at asc;
$$;
