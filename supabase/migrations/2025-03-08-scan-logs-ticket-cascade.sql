-- Cascade scan logs when deleting tickets (Option C)
alter table public.scan_logs
  drop constraint if exists scan_logs_ticket_id_fkey,
  add constraint scan_logs_ticket_id_fkey
    foreign key (ticket_id) references public.tickets(id) on delete cascade;
