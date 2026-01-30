-- Allow ticket-only reservations without a table, and store requested quantity
alter table public.table_reservations
  alter column table_id drop not null;

alter table public.table_reservations
  add column if not exists ticket_quantity integer default 1;

update public.table_reservations
set ticket_quantity = 1
where ticket_quantity is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'table_reservations_ticket_quantity_check'
  ) then
    alter table public.table_reservations
      add constraint table_reservations_ticket_quantity_check
      check (ticket_quantity >= 1);
  end if;
end $$;
