-- Update get_promoter_summary_all to also count table_reservations
-- so that promoter_link codes used in the reservation (mesa) flow are reported.
-- Reservations with approved/confirmed/paid status are counted as 1 unit each.

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
-- Direct tickets + tickets via codes
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
-- Table reservations attributed to a promoter (approved/confirmed/paid)
reservation_source as (
  select
    tr.event_id,
    tr.promoter_id::text as promoter_key
  from public.table_reservations tr
  where tr.deleted_at is null
    and tr.promoter_id is not null
    and tr.event_id in (select id from scoped_events)
    and lower(coalesce(tr.status, '')) in ('approved', 'confirmed', 'paid')
),
-- Union both sources
combined_source as (
  select event_id, promoter_key from ticket_source
  union all
  select event_id, promoter_key from reservation_source
),
counted as (
  select
    cs.event_id,
    cs.promoter_key,
    count(*)::int as tickets
  from combined_source cs
  group by cs.event_id, cs.promoter_key
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
