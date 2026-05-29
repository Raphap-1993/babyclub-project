alter table public.event_ticket_types
  alter column sale_phase drop not null;

alter table public.event_ticket_types
  drop constraint if exists event_ticket_types_sale_phase_check;

alter table public.event_ticket_types
  add constraint event_ticket_types_sale_phase_check
  check (
    sale_phase is null or sale_phase in ('early_bird', 'all_night')
  );
