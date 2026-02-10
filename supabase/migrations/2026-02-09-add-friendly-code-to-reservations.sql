-- Add friendly_code column to table_reservations for user-friendly reservation codes

alter table public.table_reservations
  add column if not exists friendly_code text;

-- Create unique index for friendly_code (ensuring no duplicates)
create unique index if not exists table_reservations_friendly_code_unique 
  on public.table_reservations(friendly_code) 
  where friendly_code is not null;

-- Create index for faster lookups
create index if not exists table_reservations_friendly_code_idx 
  on public.table_reservations(friendly_code);

comment on column public.table_reservations.friendly_code is 
  'User-friendly reservation code (e.g., LOVE1234) for easy reference and customer communication';
