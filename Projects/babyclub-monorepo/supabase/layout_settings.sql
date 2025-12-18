-- Configuración del plano de mesas
create table if not exists public.layout_settings (
  id integer primary key default 1,
  layout_url text,
  updated_at timestamptz default now()
);

alter table public.layout_settings enable row level security;
create policy layout_settings_service_role_all
  on public.layout_settings
  for all
  to service_role
  using (true)
  with check (true);
