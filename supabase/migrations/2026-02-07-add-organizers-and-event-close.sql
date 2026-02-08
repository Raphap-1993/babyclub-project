-- Hito 03 + Hito 04 foundation
-- Multi-organizador (sin subdominio) + cierre operativo de eventos

create table if not exists public.organizers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  settings jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  deleted_by uuid null
);

insert into public.organizers (slug, name, is_active, sort_order)
values ('babyclub', 'Baby Club', true, 1)
on conflict (slug) do nothing;

alter table if exists public.events
  add column if not exists organizer_id uuid references public.organizers(id),
  add column if not exists closed_at timestamptz null,
  add column if not exists closed_by uuid null,
  add column if not exists close_reason text null;

alter table if exists public.promoters
  add column if not exists organizer_id uuid references public.organizers(id);

alter table if exists public.payments
  add column if not exists organizer_id uuid references public.organizers(id);

with default_org as (
  select id from public.organizers where slug = 'babyclub' limit 1
)
update public.events e
set organizer_id = d.id
from default_org d
where e.organizer_id is null;

with default_org as (
  select id from public.organizers where slug = 'babyclub' limit 1
)
update public.promoters p
set organizer_id = d.id
from default_org d
where p.organizer_id is null;

do $$
begin
  if to_regclass('public.payments') is not null then
    update public.payments p
    set organizer_id = e.organizer_id
    from public.events e
    where p.organizer_id is null
      and p.event_id = e.id
      and e.organizer_id is not null;
  end if;
end $$;

create index if not exists organizers_slug_idx on public.organizers(slug);
create index if not exists organizers_deleted_at_idx on public.organizers(deleted_at);
create index if not exists events_organizer_id_idx on public.events(organizer_id);
create index if not exists promoters_organizer_id_idx on public.promoters(organizer_id);
do $$
begin
  if to_regclass('public.payments') is not null then
    create index if not exists payments_organizer_id_idx on public.payments(organizer_id);
  end if;
end $$;
create index if not exists events_closed_at_idx on public.events(closed_at);
