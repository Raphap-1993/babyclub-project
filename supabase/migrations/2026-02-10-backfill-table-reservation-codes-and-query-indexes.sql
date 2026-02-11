-- Normalize codes type check to accept reservation codes as 'table'
-- Keep NOT VALID to avoid failing on legacy rows while enforcing new writes.
alter table public.codes drop constraint if exists codes_type_check;
alter table public.codes
  add constraint codes_type_check
  check (type in ('general', 'courtesy', 'promoter', 'table'))
  not valid;

-- Backfill reservation-generated codes as type 'table'
-- and ensure they are linked to their table_reservation_id/person_index.
with reservation_codes as (
  select
    tr.id as reservation_id,
    trim(u.code_txt) as code_value,
    u.ordinality::int as person_index
  from public.table_reservations tr
  cross join lateral unnest(coalesce(tr.codes, '{}'::text[])) with ordinality as u(code_txt, ordinality)
  where tr.deleted_at is null
    and coalesce(trim(u.code_txt), '') <> ''
),
matched_codes as (
  select
    c.id as code_id,
    rc.reservation_id,
    case when rc.person_index between 1 and 10 then rc.person_index else null end as safe_person_index
  from reservation_codes rc
  join public.codes c
    on c.code = rc.code_value
   and c.deleted_at is null
)
update public.codes c
set
  type = 'table',
  table_reservation_id = m.reservation_id,
  person_index = m.safe_person_index
from matched_codes m
where c.id = m.code_id
  and (
    c.type is distinct from 'table'
    or c.table_reservation_id is distinct from m.reservation_id
    or c.person_index is distinct from m.safe_person_index
  );

-- Query performance indexes for dashboard/reservations flows
create index if not exists tickets_event_active_idx
  on public.tickets(event_id, is_active)
  where deleted_at is null;

create index if not exists tickets_code_active_idx
  on public.tickets(code_id, is_active)
  where deleted_at is null;

create index if not exists table_reservations_status_table_idx
  on public.table_reservations(status, table_id)
  where deleted_at is null;
