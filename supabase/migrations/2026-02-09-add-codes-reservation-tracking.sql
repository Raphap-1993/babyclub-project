-- Add reservation tracking fields to codes table for individual QR per person
-- This enables the friendly code system: BC-LOVE-M1-001 format
-- where each person in a table reservation gets their own scannable code

-- Add foreign key to table_reservations
alter table public.codes 
  add column if not exists table_reservation_id uuid references public.table_reservations(id) on delete cascade;

-- Add person index (1-5 depending on table capacity)
-- This tracks which person in the reservation this code belongs to
alter table public.codes 
  add column if not exists person_index integer check (person_index >= 1 and person_index <= 10);

-- Add index for efficient querying of codes by reservation
create index if not exists codes_table_reservation_idx 
  on public.codes(table_reservation_id) 
  where table_reservation_id is not null;

-- Add compound index for reservation + person lookup
create index if not exists codes_reservation_person_idx 
  on public.codes(table_reservation_id, person_index) 
  where table_reservation_id is not null;

-- Add comment for documentation
comment on column public.codes.table_reservation_id is 
  'Links code to a table reservation. Used for individual QR codes per person in mesa reservations.';

comment on column public.codes.person_index is 
  'Position index (1-N) of the person within the reservation. Used to generate friendly codes like BC-LOVE-M1-001.';
