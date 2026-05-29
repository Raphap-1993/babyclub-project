alter table if exists public.code_batches
  add column if not exists closed_at timestamptz null,
  add column if not exists closed_reason text null check (closed_reason in ('closed', 'expired', 'quota')),
  add column if not exists closed_by_staff_id uuid references public.staff(id);

create table if not exists public.code_type_policies (
  code_type text primary key,
  requires_expiration boolean not null default false,
  updated_by_staff_id uuid references public.staff(id),
  updated_at timestamptz not null default now()
);
