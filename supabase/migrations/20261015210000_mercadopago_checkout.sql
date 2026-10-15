-- Additive checkout persistence. Apply to the isolated local database first.
begin;

alter table public.table_reservations
  add column if not exists online_checkout_key uuid,
  add column if not exists online_checkout_token_hash text,
  add column if not exists online_amount_cents integer,
  add column if not exists online_checkout_expires_at timestamptz;
create unique index if not exists reservations_online_key_uidx
  on public.table_reservations(online_checkout_key) where online_checkout_key is not null;

create table public.mp_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.table_reservations(id),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  environment text not null check (environment in ('test','live')),
  collector_id text not null,
  application_id text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency_code text not null default 'PEN' check (currency_code = 'PEN'),
  status text not null default 'awaiting_payment' check (status in
    ('awaiting_payment','processing','paid','fulfilled','expired','review','refunded')),
  expires_at timestamptz not null,
  current_attempt_id uuid,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  fulfillment_locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.mp_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mp_checkout_sessions(id),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  order_id text unique,
  status text not null default 'creating' check (status in
    ('creating','unknown','pending','paid','failed','canceled','refunded','review')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mp_checkout_sessions add constraint mp_current_attempt_fk
  foreign key (current_attempt_id) references public.mp_payment_attempts(id);
create table public.mp_webhook_events (
  event_key text primary key,
  order_id text not null,
  status text not null default 'received' check (status in ('received','processed','error','ignored')),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create table public.mp_notification_jobs (
  session_id uuid primary key references public.mp_checkout_sessions(id),
  status text not null default 'pending' check (status in ('pending','sending','sent','error')),
  locked_until timestamptz,
  attempts integer not null default 0,
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.mp_checkout_sessions enable row level security;
alter table public.mp_payment_attempts enable row level security;
alter table public.mp_webhook_events enable row level security;
alter table public.mp_notification_jobs enable row level security;
revoke all on public.mp_checkout_sessions, public.mp_payment_attempts,
  public.mp_webhook_events, public.mp_notification_jobs from public, anon, authenticated;
grant all on public.mp_checkout_sessions, public.mp_payment_attempts,
  public.mp_webhook_events, public.mp_notification_jobs to service_role;

-- Serializes admission of a new reservation per event. Existing manual holds
-- retain their semantics; only unsubmitted/terminal online holds can expire.
create function public.mp_guard_inventory() returns trigger language plpgsql
security definer set search_path = '' as $$
declare v_capacity integer; v_reserved bigint;
begin
  if new.event_id is null or new.status not in ('pending','approved','confirmed','paid') then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('baby-inventory:' || new.event_id::text, 0));
  update public.table_reservations r set status = 'rejected', updated_at = now()
    where r.event_id = new.event_id and r.status = 'pending' and r.deleted_at is null
      and r.online_checkout_key is not null and r.online_checkout_expires_at <= now()
      and not exists (select 1 from public.mp_payment_attempts a
        join public.mp_checkout_sessions s on s.id = a.session_id
        where s.reservation_id = r.id and a.status in ('creating','unknown','pending','paid','review'));
  update public.mp_checkout_sessions s set status = 'expired', updated_at = now()
    where s.status = 'awaiting_payment' and s.expires_at <= now()
      and exists (select 1 from public.table_reservations r where r.id=s.reservation_id and r.status='rejected');
  if new.table_id is not null and exists (
    select 1 from public.table_reservations r where r.table_id = new.table_id
      and r.event_id = new.event_id and r.deleted_at is null
      and r.status in ('pending','approved','confirmed','paid')
  ) then raise exception using errcode='23505', message='reservation_table_active'; end if;
  if new.online_checkout_key is not null then
    if exists(select 1 from public.table_reservations other where other.event_id=new.event_id
      and other.deleted_at is null and other.status in ('pending','approved','confirmed','paid')
      and other.online_checkout_key is not null and (
        (other.doc_type=new.doc_type and other.document=new.document)
        or (nullif(btrim(new.email),'') is not null and lower(other.email)=lower(new.email)))) then
      raise exception using errcode='23505',message='reservation_buyer_active';
    end if;
    if new.online_amount_cents is null or new.online_amount_cents <= 0 or
       new.online_checkout_token_hash is null or new.online_checkout_token_hash !~ '^[a-f0-9]{64}$' then
      raise exception 'invalid_online_quote';
    end if;
    select capacity into v_capacity from public.events where id=new.event_id;
    if v_capacity > 0 then
      select coalesce(sum(case when r.table_id is not null then coalesce(r.ticket_quantity,1)
        else coalesce(r.total_ticket_units,r.ticket_quantity,1) end),0)
        into v_reserved from public.table_reservations r
        where r.event_id=new.event_id and r.deleted_at is null
          and r.status in ('pending','approved','confirmed','paid');
      v_reserved:=v_reserved+(select count(*) from public.tickets t where t.event_id=new.event_id
        and t.is_active=true and t.deleted_at is null and not exists(select 1 from public.table_reservations r
          where r.id=coalesce(t.table_reservation_id,(select c.table_reservation_id from public.codes c where c.id=t.code_id))
            and r.deleted_at is null and r.status in ('pending','approved','confirmed','paid')));
      if v_reserved + coalesce(new.total_ticket_units,new.ticket_quantity,1) > v_capacity then
        raise exception using errcode='23514', message='event_capacity_exceeded';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger mp_inventory_guard before insert on public.table_reservations
  for each row execute function public.mp_guard_inventory();

create function public.mp_open_checkout(p_reservation uuid, p_token_hash text,
  p_environment text, p_collector text, p_application text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.table_reservations; s public.mp_checkout_sessions;
begin
  select * into r from public.table_reservations where id=p_reservation for update;
  if r.id is null or r.deleted_at is not null or r.online_checkout_token_hash is distinct from p_token_hash then
    raise exception 'checkout_not_found'; end if;
  select * into s from public.mp_checkout_sessions where reservation_id=r.id;
  if s.id is not null then return to_jsonb(s); end if;
  if r.status <> 'pending' or r.online_checkout_expires_at <= now() then raise exception 'checkout_expired'; end if;
  insert into public.mp_checkout_sessions(reservation_id,token_hash,environment,collector_id,application_id,amount_cents,expires_at)
    values(r.id,p_token_hash,p_environment,p_collector,p_application,r.online_amount_cents,r.online_checkout_expires_at)
    returning * into s;
  return to_jsonb(s);
end $$;

create function public.mp_claim_attempt(p_session uuid,p_request_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.mp_checkout_sessions; a public.mp_payment_attempts; v_event uuid;
begin
  select r.event_id into v_event from public.mp_checkout_sessions c
    join public.table_reservations r on r.id=c.reservation_id where c.id=p_session;
  perform pg_advisory_xact_lock(hashtextextended('baby-inventory:' || v_event::text, 0));
  select * into s from public.mp_checkout_sessions where id=p_session for update;
  if s.id is null then raise exception 'checkout_not_found'; end if;
  if s.status in ('paid','fulfilled') then return jsonb_build_object('action','settled'); end if;
  if s.status in ('review','refunded','expired') then raise exception 'checkout_unavailable'; end if;
  select * into a from public.mp_payment_attempts where id=s.current_attempt_id for update;
  if a.id is not null and a.status not in ('failed','canceled') then
    if a.order_id is not null then return jsonb_build_object('action','reconcile','attempt',to_jsonb(a)); end if;
    if a.status='creating' and a.updated_at > now()-interval '30 seconds' then
      return jsonb_build_object('action','busy'); end if;
    if a.request_hash <> p_request_hash then raise exception 'payment_result_unknown'; end if;
    update public.mp_payment_attempts set status='creating',updated_at=now() where id=a.id returning * into a;
    return jsonb_build_object('action','submit','attempt',to_jsonb(a));
  end if;
  if s.expires_at <= now() then raise exception 'checkout_expired'; end if;
  insert into public.mp_payment_attempts(session_id,request_hash) values(s.id,p_request_hash) returning * into a;
  update public.mp_checkout_sessions set current_attempt_id=a.id,status='processing',updated_at=now() where id=s.id;
  return jsonb_build_object('action','submit','attempt',to_jsonb(a));
end $$;

-- Only call with a canonical provider resource already matched to the saved
-- attempt, collector/application, amount, currency and environment in server code.
create function public.mp_apply_order(p_attempt uuid,p_order text,p_status text,p_charge text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.mp_checkout_sessions; a public.mp_payment_attempts; r public.table_reservations; v_session uuid; v_event uuid; v_status text;
begin
  select session_id into v_session from public.mp_payment_attempts where id=p_attempt;
  select reservation_row.event_id into v_event from public.mp_checkout_sessions c
    join public.table_reservations reservation_row on reservation_row.id=c.reservation_id where c.id=v_session;
  perform pg_advisory_xact_lock(hashtextextended('baby-inventory:' || v_event::text, 0));
  select * into s from public.mp_checkout_sessions where id=v_session for update;
  select * into a from public.mp_payment_attempts where id=p_attempt for update;
  if a.id is null or p_status not in ('paid','pending','failed','canceled','refunded','review') then raise exception 'invalid_order_update'; end if;
  if a.order_id is not null and a.order_id <> p_order then raise exception 'order_id_mismatch'; end if;
  -- A canonical query may race another canonical query; never undo accreditation.
  v_status := case when a.status='refunded' then 'refunded'
    when a.status='paid' and p_status in ('pending','failed','canceled') then 'paid' else p_status end;
  update public.mp_payment_attempts set order_id=p_order,status=v_status,last_checked_at=now(),updated_at=now() where id=a.id;
  select * into r from public.table_reservations where id=s.reservation_id;
  if s.current_attempt_id=a.id then
    if v_status='paid' then
      perform pg_advisory_xact_lock(hashtextextended('baby-inventory:' || r.event_id::text, 0));
      if r.deleted_at is not null or r.status='rejected' or s.status in ('expired','refunded') or
         (r.table_id is not null and exists(select 1 from public.table_reservations other
           where other.id<>r.id and other.table_id=r.table_id and other.event_id=r.event_id
             and other.deleted_at is null and other.status in ('pending','approved','confirmed','paid'))) then
        v_status := 'review';
        update public.mp_payment_attempts set status='review' where id=a.id;
        update public.mp_checkout_sessions set status='review',updated_at=now() where id=s.id;
      else
        update public.table_reservations set status='approved',updated_at=now() where id=r.id;
        update public.mp_checkout_sessions set status=case when status='fulfilled' then status else 'paid' end,
          paid_at=coalesce(paid_at,now()),updated_at=now() where id=s.id;
        insert into public.mp_notification_jobs(session_id) values(s.id) on conflict do nothing;
      end if;
    elsif v_status='refunded' then
      update public.mp_checkout_sessions set status='refunded',updated_at=now() where id=s.id;
      update public.table_reservations set status='rejected',updated_at=now() where id=r.id;
      update public.tickets set is_active=false,payment_status='refunded' where table_reservation_id=r.id;
      update public.codes set is_active=false where table_reservation_id=r.id;
      update public.ticket_reservation_units set status='cancelled',cancelled_at=now(),updated_at=now() where reservation_id=r.id;
    elsif s.status not in ('paid','fulfilled','refunded') then
      update public.mp_checkout_sessions set status=case when v_status='review' then 'review'
        when v_status in ('failed','canceled') then 'awaiting_payment' else 'processing' end,updated_at=now() where id=s.id;
    end if;
  end if;
  -- Never persist the raw response: it can include card tokens or payer data.
  insert into public.payments(id,provider,status,order_id,charge_id,event_id,reservation_id,amount,currency_code,
    customer_email,customer_name,customer_phone,idempotency_key,receipt_number,paid_at,metadata)
    values(a.id,'mercadopago',case when v_status='review' then 'pending' else v_status end,p_order,p_charge,
      r.event_id,r.id,s.amount_cents,'PEN',r.email,r.full_name,r.phone,a.id::text,
      case when v_status='paid' then 'BC-MP-'||replace(a.id::text,'-','') end,
      case when v_status='paid' then now() end,jsonb_build_object('checkout_session_id',s.id,'environment',s.environment))
    on conflict(id) do update set status=excluded.status,charge_id=excluded.charge_id,
      paid_at=coalesce(public.payments.paid_at,excluded.paid_at),
      receipt_number=coalesce(public.payments.receipt_number,excluded.receipt_number),updated_at=now();
  select * into s from public.mp_checkout_sessions where id=s.id;
  return to_jsonb(s);
end $$;

create function public.mp_claim_fulfillment(p_session uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.mp_checkout_sessions set fulfillment_locked_until=now()+interval '60 seconds'
    where id=p_session and status='paid' and (fulfillment_locked_until is null or fulfillment_locked_until<now());
  return found;
end $$;

-- Tickets created by either public or admin paths cannot bypass an unpaid
-- Mercado Pago reservation. A unique active person/reservation repairs retries.
alter table public.tickets add column if not exists mp_checkout_session_id uuid references public.mp_checkout_sessions(id);
alter table public.tickets drop constraint if exists tickets_payment_status_check;
alter table public.tickets add constraint tickets_payment_status_check
  check(payment_status in ('pending','paid','failed','refunded'));
create unique index tickets_mp_session_person_uidx on public.tickets(mp_checkout_session_id,person_id)
  where mp_checkout_session_id is not null and deleted_at is null and is_active=true;
create unique index tickets_mp_event_person_uidx on public.tickets(event_id,person_id)
  where mp_checkout_session_id is not null and deleted_at is null and is_active=true;
create function public.mp_bind_ticket() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_res uuid; s public.mp_checkout_sessions;
begin
  if TG_OP='UPDATE' and new.is_active=false then return new; end if;
  v_res:=new.table_reservation_id;
  if v_res is null and new.code_id is not null then
    select table_reservation_id into v_res from public.codes where id=new.code_id;
  end if;
  if exists(select 1 from public.table_reservations where id=v_res and online_checkout_key is not null) then
    select * into s from public.mp_checkout_sessions where reservation_id=v_res;
    if s.id is null or s.status not in ('paid','fulfilled') then raise exception 'online_payment_not_accredited'; end if;
    new.mp_checkout_session_id:=s.id;
    new.table_reservation_id:=v_res;
    new.payment_status:='paid';
  end if;
  return new;
end $$;
create trigger mp_ticket_guard before insert or update of is_active,payment_status,table_reservation_id,code_id
  on public.tickets for each row execute function public.mp_bind_ticket();

create function public.mp_claim_notification(p_session uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.mp_notification_jobs j set status='sending',locked_until=now()+interval '60 seconds',attempts=attempts+1
    where session_id=p_session and status<>'sent' and (locked_until is null or locked_until<now())
      and created_at>now()-interval '23 hours'
      and exists(select 1 from public.mp_checkout_sessions s where s.id=j.session_id and s.status='fulfilled');
  return found;
end $$;

create function public.mp_expire_checkouts() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_event uuid; v_count integer:=0; v_changed integer;
begin
  for v_event in select distinct event_id from public.table_reservations
    where online_checkout_key is not null and online_checkout_expires_at<=now() and status='pending' loop
    perform pg_advisory_xact_lock(hashtextextended('baby-inventory:'||v_event::text,0));
    update public.table_reservations r set status='rejected',updated_at=now()
      where r.event_id=v_event and r.online_checkout_key is not null and r.online_checkout_expires_at<=now()
        and r.status='pending' and r.deleted_at is null
        and not exists(select 1 from public.mp_payment_attempts a join public.mp_checkout_sessions s on s.id=a.session_id
          where s.reservation_id=r.id and a.status in ('creating','unknown','pending','paid','review'));
    get diagnostics v_changed = row_count;
    v_count:=v_count+v_changed;
    update public.mp_checkout_sessions s set status='expired',updated_at=now()
      where s.status='awaiting_payment' and s.expires_at<=now()
        and exists(select 1 from public.table_reservations r where r.id=s.reservation_id and r.status='rejected');
  end loop;
  return v_count;
end $$;

-- Same provider validation as the existing provider-polymorphism migration.
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider ~ '^[a-z][a-z0-9_-]{1,31}$');

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('mp_guard_inventory','mp_open_checkout','mp_claim_attempt',
      'mp_apply_order','mp_claim_fulfillment','mp_bind_ticket','mp_claim_notification','mp_expire_checkouts') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
    execute format('grant execute on function %s to service_role', f.signature);
  end loop;
end $$;
commit;
