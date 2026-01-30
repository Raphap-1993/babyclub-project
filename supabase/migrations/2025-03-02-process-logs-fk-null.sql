-- Allow deleting parent rows without breaking process_logs history
alter table public.process_logs
  drop constraint if exists process_logs_reservation_id_fkey,
  add constraint process_logs_reservation_id_fkey
    foreign key (reservation_id) references public.table_reservations(id) on delete set null;

alter table public.process_logs
  drop constraint if exists process_logs_ticket_id_fkey,
  add constraint process_logs_ticket_id_fkey
    foreign key (ticket_id) references public.tickets(id) on delete set null;
