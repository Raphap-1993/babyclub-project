-- Operational switch only. Credentials and payment environments stay in deployment config.
begin;
set local lock_timeout = '5s';
create table public.mp_sales_control (
  id boolean primary key default true check (id),
  paused boolean not null default false,
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.mp_sales_control (id) values (true);
create table public.mp_sales_control_audit (
  id bigint generated always as identity primary key,
  paused boolean not null,
  version integer not null,
  staff_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.mp_sales_control enable row level security;
alter table public.mp_sales_control_audit enable row level security;
revoke all on public.mp_sales_control, public.mp_sales_control_audit from public, anon, authenticated, service_role;
grant select on public.mp_sales_control, public.mp_sales_control_audit to service_role;

create function public.mp_set_sales_paused(p_paused boolean, p_version integer, p_staff uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_control public.mp_sales_control;
begin
  if p_paused is null or p_version is null then raise exception 'invalid_sales_control'; end if;
  if not exists (select 1 from public.staff s join public.staff_roles r on r.id=s.staff_role_id
    where s.id=p_staff and s.is_active=true and s.deleted_at is null and lower(r.code) in ('admin','superadmin')) then
    raise exception 'sales_control_forbidden';
  end if;
  select * into v_control from public.mp_sales_control where id=true for update;
  if v_control.id is null then raise exception 'sales_control_unavailable'; end if;
  if v_control.version <> p_version then raise exception 'sales_control_conflict'; end if;
  if v_control.paused = p_paused then return to_jsonb(v_control); end if;
  update public.mp_sales_control set paused=p_paused, version=version+1, updated_at=now(), updated_by=p_staff
    where id=true returning * into v_control;
  insert into public.mp_sales_control_audit(paused,version,staff_id) values(p_paused,v_control.version,p_staff);
  return to_jsonb(v_control);
end $$;
revoke all on function public.mp_set_sales_paused(boolean,integer,uuid) from public,anon,authenticated;
grant execute on function public.mp_set_sales_paused(boolean,integer,uuid) to service_role;

create function public.mp_guard_sales_open() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_paused boolean;
begin
  if tg_table_name='table_reservations' then
    if new.online_checkout_key is null then return new; end if;
  end if;
  -- Serialize the pause with reservation/attempt creation. Existing attempts,
  -- provider callbacks, fulfillment and QR validation do not use this guard.
  select paused into v_paused from public.mp_sales_control where id=true for share;
  if v_paused is distinct from false then raise exception 'mercadopago_sales_paused'; end if;
  return new;
end $$;
revoke all on function public.mp_guard_sales_open() from public,anon,authenticated;
create trigger mp_sales_reservation_guard before insert on public.table_reservations
  for each row execute function public.mp_guard_sales_open();
create trigger mp_sales_attempt_guard before insert on public.mp_payment_attempts
  for each row execute function public.mp_guard_sales_open();
notify pgrst, 'reload schema';
commit;
