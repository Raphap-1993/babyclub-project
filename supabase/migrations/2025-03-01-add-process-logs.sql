-- Generic process logs (email, background tasks, etc.)
create table if not exists public.process_logs (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  action text not null,
  status text not null,
  message text,
  to_email text,
  provider text,
  provider_id text,
  reservation_id uuid references public.table_reservations(id),
  ticket_id uuid references public.tickets(id),
  meta jsonb,
  created_at timestamptz default now()
);

create index if not exists process_logs_created_at_idx on public.process_logs(created_at);
create index if not exists process_logs_category_idx on public.process_logs(category);
create index if not exists process_logs_reservation_idx on public.process_logs(reservation_id);
create index if not exists process_logs_ticket_idx on public.process_logs(ticket_id);
