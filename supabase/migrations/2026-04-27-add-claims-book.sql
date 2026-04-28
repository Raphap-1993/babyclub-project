-- Store Libro de Reclamaciones entries submitted from the public landing.

create table if not exists public.claims_book_entries (
  id uuid primary key default gen_random_uuid(),
  claim_code text not null unique,
  claim_type text not null check (claim_type in ('reclamo', 'queja')),
  consumer_name text not null,
  doc_type text not null check (doc_type in ('dni', 'ce', 'passport')),
  document_number text not null,
  address text not null,
  phone text not null,
  email text not null,
  service_description text not null,
  event_reference text null,
  claimed_amount numeric(10, 2) null check (claimed_amount is null or claimed_amount >= 0),
  detail text not null,
  requested_solution text not null,
  provider_trade_name text not null,
  provider_legal_name text not null,
  provider_ruc text not null,
  provider_address text not null,
  provider_phone text not null,
  provider_email text not null,
  source_ip text null,
  user_agent text null,
  status text not null default 'received' check (status in ('received', 'in_review', 'answered', 'closed')),
  response_detail text null,
  responded_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists claims_book_entries_created_at_idx
  on public.claims_book_entries(created_at desc);

create index if not exists claims_book_entries_status_idx
  on public.claims_book_entries(status, created_at desc);

alter table public.claims_book_entries enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'claims_book_entries'
      and policyname = 'claims_book_entries_service_role_all'
  ) then
    create policy claims_book_entries_service_role_all
      on public.claims_book_entries
      for all
      to service_role
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

comment on table public.claims_book_entries is
  'Libro de Reclamaciones Virtual records submitted from the landing.';
