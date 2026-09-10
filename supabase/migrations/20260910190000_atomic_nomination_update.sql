-- Atomic edits to an already-issued reservation unit. Service API only.
-- The caller must authorize access to the reservation before invoking this RPC.
create or replace function public.update_ticket_reservation_unit_nomination(
  p_reservation_id uuid,
  p_unit_id uuid,
  p_expected_updated_at timestamptz,
  p_full_name text,
  p_doc_type text,
  p_document text,
  p_email text,
  p_phone text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_res public.table_reservations%rowtype;
  v_event public.events%rowtype;
  v_unit public.ticket_reservation_units%rowtype;
  v_ticket public.tickets%rowtype;
  v_own_code public.codes%rowtype;
  v_person_id uuid;
  v_person_type text;
  v_ticket_id uuid;
  v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_doc_type text := lower(btrim(coalesce(p_doc_type, '')));
  v_document text := btrim(coalesce(p_document, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_effective_email text;
  v_identity_changed boolean;
  v_now timestamptz;
  v_local_start timestamp;
  v_entry_limit time;
  v_general_cutoff timestamptz;
begin
  if v_name = '' or v_doc_type not in ('dni','ce','pasaporte','ruc','otro') or
     not (case v_doc_type
       when 'dni' then v_document ~ '^[0-9]{8}$'
       when 'ce' then v_document ~ '^[A-Za-z0-9]{9,12}$'
       when 'pasaporte' then v_document ~ '^[A-Za-z0-9]{6,12}$'
       when 'ruc' then v_document ~ '^[0-9]{11}$'
       else length(v_document) between 1 and 20 end) or
     (v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'INVALID_NOMINATION' using errcode = '22023';
  end if;

  select * into v_res from public.table_reservations
    where id = p_reservation_id and deleted_at is null for share;
  if not found or v_res.status not in ('approved','confirmed','paid') then
    raise exception 'RESERVATION_NOT_APPROVED' using errcode = 'P0001';
  end if;
  select * into v_event from public.events where id = v_res.event_id for share;
  if not found or v_event.is_active = false or v_event.closed_at is not null or v_event.deleted_at is not null then
    raise exception 'EVENT_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  -- Same minute-level cutoff and next-day rule as shared/entryLimit.ts.
  v_local_start := v_event.starts_at at time zone 'America/Lima';
  v_entry_limit := date_trunc('minute', date '2000-01-01' + coalesce(v_event.entry_limit, time '23:30'))::time;
  v_general_cutoff := ((v_local_start::date + v_entry_limit) +
    case when v_entry_limit < date_trunc('minute', v_local_start)::time then interval '1 day' else interval '0 days' end) at time zone 'America/Lima';
  -- Serialize transfers of identities in this event. Other issuance paths still
  -- need their own atomic admission/issuance work; this lock is not a global claim.
  perform pg_advisory_xact_lock(hashtextextended('nomination:event:' || v_res.event_id::text, 0));

  select ticket_id::uuid into v_ticket_id from public.ticket_reservation_units
    where id = p_unit_id and reservation_id = p_reservation_id and deleted_at is null;
  if not found or v_ticket_id is null then
    raise exception 'ISSUED_UNIT_REQUIRED' using errcode = 'P0001';
  end if;
  -- Scanner updates tickets before units. Keep the same row-lock order.
  select * into v_ticket from public.tickets where id = v_ticket_id for update;
  if not found then raise exception 'TICKET_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into v_unit from public.ticket_reservation_units
    where id = p_unit_id and reservation_id = p_reservation_id and deleted_at is null for update;
  if not found or v_unit.ticket_id is distinct from v_ticket.id::text or
     v_unit.event_id is distinct from v_res.event_id or
     v_ticket.event_id is distinct from v_res.event_id or
     v_ticket.table_reservation_id is distinct from p_reservation_id then
    raise exception 'UNIT_TICKET_MISMATCH' using errcode = 'P0001';
  end if;
  if v_unit.status <> 'issued' or v_unit.used_at is not null or v_unit.cancelled_at is not null or
     coalesce(v_ticket.used, false) or v_ticket.used_at is not null or
     not v_ticket.is_active or v_ticket.deleted_at is not null or v_ticket.payment_status = 'pending' then
    raise exception 'UNIT_NOT_EDITABLE' using errcode = 'P0001';
  end if;
  select * into v_own_code from public.codes where id = v_ticket.code_id;
  if coalesce(v_own_code.expires_at < clock_timestamp(),false) or
     (v_own_code.type = 'general' and coalesce(v_general_cutoff < clock_timestamp(),false)) then
    raise exception 'UNIT_EXPIRED' using errcode = 'P0001';
  end if;

  v_effective_email := coalesce(v_email, nullif(lower(btrim(v_res.email)), ''));
  -- An exact replay succeeds without another rotation, including a retry after
  -- the response was lost. It does not waive state guards above.
  if v_unit.full_name is not distinct from v_name and v_unit.doc_type is not distinct from v_doc_type and
     v_unit.document is not distinct from v_document and v_unit.email is not distinct from v_email and
     v_unit.phone is not distinct from v_phone and v_ticket.full_name is not distinct from v_name and
     v_ticket.doc_type is not distinct from v_doc_type and v_ticket.document is not distinct from v_document and
     v_ticket.email is not distinct from v_effective_email and v_ticket.phone is not distinct from v_phone then
    return jsonb_build_object('unit_id', v_unit.id, 'ticket_id', v_ticket.id,
      'updated_at', v_unit.updated_at, 'qr_rotated', false, 'unchanged', true);
  end if;
  if p_expected_updated_at is null or v_unit.updated_at is distinct from p_expected_updated_at then
    raise exception 'NOMINATION_VERSION_CONFLICT' using errcode = 'P0001';
  end if;
  v_identity_changed := v_ticket.full_name is distinct from v_name or
    v_ticket.doc_type is distinct from v_doc_type or v_ticket.document is distinct from v_document;
  v_person_id := v_ticket.person_id;

  if v_identity_changed then
    -- Contacts are delivery destinations, not identity. Do not attach another
    -- attendee to the buyer just because they share an email or telephone.
    perform pg_advisory_xact_lock(hashtextextended('nomination:document:' || lower(v_document), 0));
    select id, coalesce(doc_type, 'dni') into v_person_id, v_person_type from public.persons
      where lower(document) = lower(v_document) or (v_doc_type = 'dni' and dni = v_document)
      order by created_at, id limit 1;
    if found and v_person_type <> v_doc_type then
      raise exception 'PERSON_DOCUMENT_TYPE_CONFLICT' using errcode = 'P0001';
    end if;
    if v_person_id is null then
      insert into public.persons (first_name, last_name, doc_type, document, dni, email, phone)
        values (split_part(v_name, ' ', 1), coalesce(nullif(substr(v_name, strpos(v_name, ' ') + 1), v_name), 'Reserva'),
          v_doc_type, v_document, case when v_doc_type = 'dni' then v_document end, v_email, v_phone)
        returning id into v_person_id;
    end if;
    if exists (select 1 from public.tickets t left join public.codes c on c.id = t.code_id
      where t.event_id = v_res.event_id and t.id <> v_ticket.id
      and t.is_active and t.deleted_at is null and
      (t.person_id = v_person_id or (coalesce(t.doc_type, 'dni') = v_doc_type and lower(coalesce(t.document,t.dni)) = lower(v_document)))
      -- Preserve the expired free ticket; the purchased ticket keeps its own QR.
      and not (coalesce(c.type = 'general',false) and not coalesce(t.used,false) and t.used_at is null
        and coalesce(t.payment_status,'') <> 'pending'
        and (coalesce(c.expires_at < clock_timestamp(),false) or coalesce(v_general_cutoff < clock_timestamp(),false))))
      or exists (select 1 from public.ticket_reservation_units u where u.reservation_id = p_reservation_id
        and u.id <> p_unit_id and u.deleted_at is null and u.status <> 'cancelled'
        and coalesce(u.doc_type,'dni') = v_doc_type and lower(u.document) = lower(v_document)) then
      raise exception 'EVENT_TICKET_IDENTITY_CONFLICT' using errcode = 'P0001';
    end if;
  end if;

  v_now := clock_timestamp();
  update public.tickets set full_name = v_name, doc_type = v_doc_type, document = v_document,
    dni = case when v_doc_type = 'dni' then v_document end, person_id = v_person_id,
    email = v_effective_email, phone = v_phone,
    qr_token = case when v_identity_changed then gen_random_uuid()::text else qr_token end
    where id = v_ticket.id;
  update public.ticket_reservation_units set full_name = v_name, doc_type = v_doc_type, document = v_document,
    email = v_email, phone = v_phone, updated_at = v_now,
    nominated_at = case when v_identity_changed then v_now else nominated_at end
    where id = p_unit_id;
  return jsonb_build_object('unit_id', p_unit_id, 'ticket_id', v_ticket.id,
    'updated_at', v_now, 'qr_rotated', v_identity_changed, 'unchanged', false);
end;
$$;

revoke all on function public.update_ticket_reservation_unit_nomination(uuid,uuid,timestamptz,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.update_ticket_reservation_unit_nomination(uuid,uuid,timestamptz,text,text,text,text,text) to service_role;
