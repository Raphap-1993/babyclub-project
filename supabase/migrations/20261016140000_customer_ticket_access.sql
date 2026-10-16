-- Customer device verification. No changes to existing purchases or QR tokens.
create table public.customer_access_challenges (
  id uuid primary key,
  document_hash text not null,
  ip_hash text not null,
  binding_hash text not null,
  code_hash text not null,
  identity_encrypted text,
  attempts integer not null default 0 check (attempts between 0 and 5),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz
);
create index customer_access_document_time on public.customer_access_challenges(document_hash, created_at);
create index customer_access_ip_time on public.customer_access_challenges(ip_hash, created_at);
create table public.customer_access_devices (
  token_hash text primary key check (length(token_hash) = 64),
  identity_encrypted text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz
);
alter table public.customer_access_challenges enable row level security;
alter table public.customer_access_devices enable row level security;
revoke all on public.customer_access_challenges, public.customer_access_devices from public, anon, authenticated;
grant all on public.customer_access_challenges, public.customer_access_devices to service_role;

create function public.create_customer_access_challenge(
  p_id uuid, p_document_hash text, p_ip_hash text, p_binding_hash text, p_code_hash text
) returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('customer-document:' || p_document_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('customer-ip:' || p_ip_hash, 0));
  if exists(select 1 from public.customer_access_challenges where document_hash=p_document_hash and created_at > now()-interval '60 seconds')
    or (select count(*) from public.customer_access_challenges where document_hash=p_document_hash and created_at > now()-interval '1 hour') >= 3
    or (select count(*) from public.customer_access_challenges where ip_hash=p_ip_hash and created_at > now()-interval '1 hour') >= 10 then
    return false;
  end if;
  insert into public.customer_access_challenges(id,document_hash,ip_hash,binding_hash,code_hash)
    values(p_id,p_document_hash,p_ip_hash,p_binding_hash,p_code_hash);
  return true;
end;
$$;

create function public.verify_customer_access_challenge(
  p_id uuid, p_binding_hash text, p_code_hash text, p_token_hash text
) returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare challenge public.customer_access_challenges%rowtype;
begin
  select * into challenge from public.customer_access_challenges where id=p_id for update;
  if not found or challenge.consumed_at is not null or challenge.expires_at <= now()
    or challenge.attempts >= 5 or challenge.binding_hash <> p_binding_hash then return null; end if;
  update public.customer_access_challenges set attempts=attempts+1 where id=p_id;
  if challenge.code_hash <> p_code_hash or challenge.identity_encrypted is null then return null; end if;
  update public.customer_access_challenges set consumed_at=now() where id=p_id;
  insert into public.customer_access_devices(token_hash,identity_encrypted) values(p_token_hash,challenge.identity_encrypted);
  return challenge.identity_encrypted;
end;
$$;
revoke all on function public.create_customer_access_challenge(uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.verify_customer_access_challenge(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.create_customer_access_challenge(uuid,text,text,text,text) to service_role;
grant execute on function public.verify_customer_access_challenge(uuid,text,text,text) to service_role;

-- Retain no expired authentication records beyond a short operational window.
create function public.cleanup_customer_access() returns void language sql security definer set search_path = pg_catalog, public as $$
  delete from public.customer_access_challenges where expires_at < now()-interval '1 day';
  delete from public.customer_access_devices where expires_at < now()-interval '1 day' or revoked_at < now()-interval '1 day';
$$;
revoke all on function public.cleanup_customer_access() from public, anon, authenticated;
grant execute on function public.cleanup_customer_access() to service_role;
