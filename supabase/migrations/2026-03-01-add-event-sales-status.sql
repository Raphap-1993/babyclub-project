-- Event commercial sale state (independent from operational close)
-- Enables dynamic sold out / paused messaging from backoffice

alter table if exists public.events
  add column if not exists sale_status text,
  add column if not exists sale_public_message text null,
  add column if not exists sale_updated_at timestamptz null,
  add column if not exists sale_updated_by uuid null;

update public.events
set sale_status = 'on_sale'
where sale_status is null;

alter table if exists public.events
  alter column sale_status set default 'on_sale';

alter table if exists public.events
  alter column sale_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_sale_status_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_sale_status_check
      check (sale_status in ('on_sale', 'sold_out', 'paused'));
  end if;
end $$;

create index if not exists events_sale_status_idx
  on public.events(sale_status);

create index if not exists events_active_sale_status_idx
  on public.events(is_active, sale_status, closed_at)
  where deleted_at is null;

comment on column public.events.sale_status is
  'Commercial status for web sales. on_sale: accepts new purchases; sold_out/paused: blocks new purchases.';

comment on column public.events.sale_public_message is
  'Public message shown on landing/checkout when sales are blocked for this event.';

comment on column public.events.sale_updated_at is
  'Last time commercial sale_status/message was updated.';

comment on column public.events.sale_updated_by is
  'Staff ID that changed sale_status/message.';
