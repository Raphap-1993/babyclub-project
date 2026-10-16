begin;

-- Manual receipts share the payment ledger, but never impersonate a gateway.
create unique index payments_manual_request_uidx on public.payments(idempotency_key)
  where provider='manual';

create function public.manual_bind_ticket() returns trigger language plpgsql
security definer set search_path='' as $$
declare v_res uuid; v_status text;
begin
  if new.is_active=false or new.deleted_at is not null then return new; end if;
  v_res:=coalesce(new.table_reservation_id,(select table_reservation_id from public.codes where id=new.code_id));
  select status into v_status from public.payments where provider='manual' and reservation_id=v_res limit 1;
  if found then
    if v_status<>'paid' then raise exception 'manual_payment_not_accredited'; end if;
    if not exists(select 1 from public.table_reservations where id=v_res and status='approved' and deleted_at is null) then
      raise exception 'manual_reservation_not_approved';
    end if;
    new.table_reservation_id:=v_res;
    new.payment_status:='paid';
  end if;
  return new;
end $$;
create trigger manual_ticket_guard before insert or update of is_active,payment_status,table_reservation_id,code_id
  on public.tickets for each row execute function public.manual_bind_ticket();

create unique index payments_manual_reference_uidx on public.payments
  ((metadata->>'method'), lower(btrim(metadata->>'reference')))
  where provider='manual' and metadata->>'method'<>'cash' and nullif(btrim(metadata->>'reference'),'') is not null;

-- Reservation, receipt, internal codes, buyer QR and nomination units commit together.
create function public.record_manual_sale(p_request uuid,p_staff uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  e public.events%rowtype; t public.tables%rowtype; product public.table_products%rowtype;
  typ public.event_ticket_types%rowtype; previous public.payments%rowtype;
  v_event uuid:=(p_payload->>'event_id')::uuid;
  v_table uuid:=nullif(p_payload->>'table_id','')::uuid;
  v_product uuid:=nullif(p_payload->>'product_id','')::uuid;
  v_code text:=p_payload->>'ticket_type_code'; v_label text; v_phase text;
  v_packages integer:=coalesce((p_payload->>'package_quantity')::integer,1);
  v_units integer; v_per integer; v_price numeric; v_amount integer;
  v_doc text:=btrim(p_payload->>'document'); v_doc_type text:=p_payload->>'doc_type';
  v_name text:=btrim(p_payload->>'full_name'); v_email text:=lower(btrim(p_payload->>'email'));
  v_method text:=p_payload->>'payment_method'; v_ref text:=btrim(p_payload->>'reference');
  v_res uuid:=gen_random_uuid(); v_ticket uuid:=gen_random_uuid(); v_person uuid;
  v_code_id uuid; v_buyer_code uuid; v_codes text[]:='{}'; v_friendly text;
  v_reserved bigint; v_index integer;
begin
  if not exists(select 1 from public.staff s join public.staff_roles r on r.id=s.staff_role_id
    where s.id=p_staff and s.is_active=true and s.deleted_at is null and r.code in ('admin','superadmin')) then
    raise exception 'manual_sale_forbidden';
  end if;
  if p_request is null or p_payload->>'received' is distinct from 'true' or
     v_method is null or v_doc_type is null or v_method not in ('cash','yape','transfer','card_external') or
     length(coalesce(v_name,''))<3 or length(coalesce(v_doc,''))<1 or
     v_doc_type not in ('dni','ce','pasaporte','ruc','otro') or
     coalesce(v_email,'') !~ '^[^ @]+@[^ @]+\.[^ @]+$' or
     v_packages<1 or v_packages>10 or (v_method<>'cash' and length(coalesce(v_ref,''))<3) then
    raise exception 'manual_sale_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('baby-manual:'||p_request::text,0));
  select * into previous from public.payments where idempotency_key='manual:'||p_request::text and provider='manual';
  if found then
    if previous.metadata->>'payload_hash'<>md5(p_payload::text) or previous.metadata->>'staff_id'<>p_staff::text then
      raise exception 'manual_request_conflict';
    end if;
    return jsonb_build_object('reservationId',previous.reservation_id,'ticketId',previous.ticket_id,'paymentId',previous.id,'replayed',true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('baby-inventory:'||v_event::text,0));
  select * into e from public.events where id=v_event and deleted_at is null and is_active=true and closed_at is null;
  if not found or e.force_closed=true then raise exception 'event_unavailable'; end if;
  if v_table is not null then
    if v_packages<>1 then raise exception 'manual_sale_invalid'; end if;
    select * into t from public.tables where id=v_table and is_active=true and deleted_at is null;
    if not found or t.organizer_id is distinct from e.organizer_id then raise exception 'table_unavailable'; end if;
    if exists(select 1 from public.table_availability where event_id=v_event and table_id=v_table and is_available=false and deleted_at is null)
      or (t.event_id is not null and t.event_id<>v_event and not exists(select 1 from public.table_availability where event_id=v_event and table_id=v_table and deleted_at is null))
      then raise exception 'table_unavailable'; end if;
    select * into product from public.table_products where id=v_product and table_id=v_table and is_active=true and deleted_at is null;
    if not found then raise exception 'product_unavailable'; end if;
    v_units:=coalesce(product.tickets_included,t.ticket_count,1); v_per:=v_units;
    v_price:=product.price; v_label:=product.name;
  else
    select * into typ from public.event_ticket_types where event_id=v_event and code=v_code and is_active=true and deleted_at is null;
    if found then
      v_price:=typ.price; v_per:=typ.ticket_quantity; v_label:=typ.label; v_phase:=typ.sale_phase;
    else
      -- Legacy configured ticket prices remain supported; arbitrary prices do not.
      if exists(select 1 from public.event_ticket_types where event_id=v_event and code=v_code) then raise exception 'ticket_type_unavailable'; end if;
      v_per:=case when v_code in ('early_bird_2','all_night_2') then 2 else 1 end;
      v_price:=case v_code when 'early_bird_1' then case when e.early_bird_enabled then e.early_bird_price_1 end
        when 'early_bird_2' then case when e.early_bird_enabled then e.early_bird_price_2 end
        when 'all_night_1' then e.all_night_price_1 when 'all_night_2' then e.all_night_price_2 end;
      v_label:=case v_code when 'early_bird_1' then 'EARLY BABY SOLO' when 'early_bird_2' then 'EARLY BABY DUO'
        when 'all_night_1' then 'ALL NIGHT SOLO' when 'all_night_2' then 'ALL NIGHT DUO' end;
      v_phase:=case when v_code like 'early_bird_%' then 'early_bird' else 'all_night' end;
    end if;
    v_units:=v_per*v_packages;
  end if;
  if v_price is null or v_price<=0 or v_units<1 or v_units>100 then raise exception 'invalid_sale_price'; end if;
  v_amount:=round(v_price*v_packages*100);
  if v_amount is distinct from (p_payload->>'expected_amount_cents')::integer then raise exception 'sale_price_changed'; end if;
  if exists(select 1 from public.table_reservations where event_id=v_event and deleted_at is null and status in ('pending','approved','confirmed','paid')
    and online_checkout_key is not null and doc_type=v_doc_type and document=v_doc) then raise exception 'buyer_checkout_exists'; end if;
  if exists(select 1 from public.tickets where event_id=v_event and is_active=true and deleted_at is null
    and coalesce(doc_type,'dni')=v_doc_type and coalesce(document,dni)=v_doc) then raise exception 'buyer_ticket_exists'; end if;
  select coalesce(sum(case when r.table_id is not null then r.ticket_quantity else r.total_ticket_units end),0) into v_reserved
    from public.table_reservations r where r.event_id=v_event and r.deleted_at is null and r.status in ('pending','approved','confirmed','paid');
  v_reserved:=v_reserved+(select count(*) from public.tickets x where x.event_id=v_event and x.is_active=true and x.deleted_at is null
    and not exists(select 1 from public.table_reservations r where r.id=coalesce(x.table_reservation_id,(select table_reservation_id from public.codes where id=x.code_id))
      and r.deleted_at is null and r.status in ('pending','approved','confirmed','paid')));
  if e.capacity>0 and v_reserved+v_units>e.capacity then raise exception 'event_capacity_exceeded'; end if;
  insert into public.table_reservations(id,event_id,table_id,product_id,full_name,email,phone,doc_type,document,status,
    sale_origin,ticket_type_id,ticket_type_code,ticket_type_label,ticket_pricing_phase,ticket_unit_price,ticket_total_amount,
    package_quantity,ticket_quantity,total_ticket_units,created_by_staff_id,notes)
  values(v_res,v_event,v_table,v_product,v_name,v_email,p_payload->>'phone',v_doc_type,v_doc,'approved',
    case when v_table is null then 'ticket' else 'table' end,typ.id,v_code,v_label,v_phase,v_price,v_amount/100.0,
    v_packages,v_units,v_units,p_staff,nullif(btrim(p_payload->>'notes'),''));
  perform pg_advisory_xact_lock(hashtextextended('baby-person:'||v_doc_type||':'||v_doc,0));
  select id into v_person from public.persons where (doc_type=v_doc_type and document=v_doc) or (v_doc_type='dni' and dni=v_doc) limit 1;
  if v_person is null then
    insert into public.persons(first_name,last_name,doc_type,document,dni,email,phone)
      values(v_name,'',v_doc_type,v_doc,case when v_doc_type='dni' then v_doc end,v_email,p_payload->>'phone') returning id into v_person;
  end if;
  insert into public.payments(id,provider,status,event_id,reservation_id,amount,currency_code,customer_name,customer_email,customer_phone,
    idempotency_key,receipt_number,paid_at,metadata)
    values(p_request,'manual','paid',v_event,v_res,v_amount,'PEN',v_name,v_email,p_payload->>'phone',
    'manual:'||p_request::text,'BC-MAN-'||replace(p_request::text,'-',''),now(),
    jsonb_build_object('source','backoffice','staff_id',p_staff,'method',v_method,'reference',v_ref,'payload_hash',md5(p_payload::text)));
  for v_index in 1..v_units loop
    v_code_id:=gen_random_uuid();
    v_friendly:='BC-MAN-'||replace(v_res::text,'-','')||'-'||v_index::text;
    insert into public.codes(id,code,event_id,type,is_active,max_uses,uses,table_reservation_id,person_index)
      values(v_code_id,v_friendly,v_event,case when v_table is null then 'courtesy' else 'table' end,true,1,0,v_res,v_index);
    v_codes:=array_append(v_codes,v_friendly);
    if v_index=1 then v_buyer_code:=v_code_id; end if;
    insert into public.ticket_reservation_units(reservation_id,event_id,package_index,person_index,unit_index,status)
      values(v_res,v_event,((v_index-1)/v_per)+1,((v_index-1)%v_per)+1,v_index,'pending_nomination');
  end loop;
  insert into public.tickets(id,event_id,code_id,person_id,qr_token,full_name,email,phone,doc_type,document,dni,
    table_reservation_id,table_id,product_id,payment_status)
    values(v_ticket,v_event,v_buyer_code,v_person,gen_random_uuid()::text,v_name,v_email,p_payload->>'phone',v_doc_type,v_doc,
    case when v_doc_type='dni' then v_doc end,v_res,v_table,v_product,'paid');
  update public.ticket_reservation_units set status='issued',ticket_id=v_ticket,full_name=v_name,doc_type=v_doc_type,
    document=v_doc,email=v_email,phone=p_payload->>'phone',issued_at=now(),nominated_at=now(),updated_at=now()
    where reservation_id=v_res and unit_index=1;
  update public.codes set uses=1 where id=v_buyer_code;
  update public.table_reservations set codes=v_codes where id=v_res;
  update public.payments set ticket_id=v_ticket where id=p_request;
  return jsonb_build_object('reservationId',v_res,'ticketId',v_ticket,'paymentId',p_request,'replayed',false);
end $$;

-- Serialize with the online reservation inventory lock: a manual receipt cannot
-- race a second checkout for the same buyer, or convert an invitation in place.
create function public.manual_guard_online_buyer() returns trigger language plpgsql
security definer set search_path='' as $
begin
  if new.online_checkout_key is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('baby-inventory:'||new.event_id::text,0));
  if exists(select 1 from public.table_reservations r join public.payments p on p.reservation_id=r.id
    where r.event_id=new.event_id and r.doc_type=new.doc_type and r.document=new.document
      and r.deleted_at is null and r.status='approved' and p.provider='manual' and p.status='paid') then
    raise exception 'buyer_manual_sale_exists';
  end if;
  return new;
end $;
create trigger manual_online_buyer_guard before insert on public.table_reservations
  for each row execute function public.manual_guard_online_buyer();
revoke all on function public.manual_guard_online_buyer() from public,anon,authenticated;

revoke all on function public.record_manual_sale(uuid,uuid,jsonb),public.manual_bind_ticket() from public,anon,authenticated;
grant execute on function public.record_manual_sale(uuid,uuid,jsonb) to service_role;
commit;
