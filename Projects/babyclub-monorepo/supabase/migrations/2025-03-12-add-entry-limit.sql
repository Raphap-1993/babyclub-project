-- Add configurable entry cutoff (time only) for events
alter table public.events add column if not exists entry_limit time;
