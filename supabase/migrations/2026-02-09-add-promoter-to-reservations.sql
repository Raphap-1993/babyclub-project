-- Add promoter_id to table_reservations to track who referred the reservation
-- This allows tickets to inherit the promoter when approved

alter table public.table_reservations
  add column if not exists promoter_id uuid references public.promoters(id) on delete set null;

create index if not exists table_reservations_promoter_id_idx on public.table_reservations(promoter_id);

comment on column public.table_reservations.promoter_id is 'Promoter who referred this reservation (optional)';
