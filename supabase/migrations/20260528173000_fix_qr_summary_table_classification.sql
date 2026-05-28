create or replace function public.get_qr_summary_all(
  p_cutoff timestamptz default (now() - interval '7 days')
)
returns table (
  event_id text,
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
      when t.table_id is not null then 'table'
      when coalesce(tr.sale_origin, '') = 'ticket'
        and coalesce(nullif(c.type, ''), 'desconocido') = 'courtesy'
        then 'general'
      else coalesce(nullif(c.type, ''), 'desconocido')
    end as type_key
  from public.tickets t
  left join public.codes c
    on c.id = t.code_id
   and c.deleted_at is null
  left join public.table_reservations tr
    on tr.id = t.table_reservation_id
   and tr.deleted_at is null
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
  e.id::text as event_id,
  e.name,
  e.starts_at as date,
  coalesce(t.total_qr, 0)::int as total_qr,
  coalesce(a.by_type, '{}'::jsonb) as by_type
from scoped_events e
left join totals t on t.event_id = e.id
left join aggregated a on a.event_id = e.id
order by e.starts_at asc;
$$;
