-- Tabla de logs de escaneo en puerta
create table if not exists public.scan_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  code_id uuid references public.codes(id),
  ticket_id uuid references public.tickets(id),
  raw_value text not null,
  result text not null check (result in ('valid','duplicate','expired','inactive','invalid','not_found','exhausted')),
  scanned_by_staff_id uuid references public.staff(id),
  created_at timestamptz not null default now()
);

alter table public.scan_logs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'scan_logs_staff_rw' and schemaname = 'public' and tablename = 'scan_logs') then
    create policy scan_logs_staff_rw on public.scan_logs
      for all
      using (exists (select 1 from public.staff s where s.auth_user_id = auth.uid() and coalesce(s.is_active, true)))
      with check (exists (select 1 from public.staff s where s.auth_user_id = auth.uid() and coalesce(s.is_active, true)));
  end if;
end;
$$;

create index if not exists scan_logs_event_idx on public.scan_logs(event_id);
create index if not exists scan_logs_code_idx on public.scan_logs(code_id);
