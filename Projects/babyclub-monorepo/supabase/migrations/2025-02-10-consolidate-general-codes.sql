-- Consolidate general codes: keep a single row per event and update RPC to reuse the same record

-- Remove extra general codes, keeping the most recently updated/created per event
with ranked as (
  select
    id,
    event_id,
    row_number() over (
      partition by event_id
      order by updated_at desc nulls last, created_at desc
    ) as rn
  from public.codes
  where type = 'general'
)
delete from public.codes c
using ranked r
where c.id = r.id
  and r.rn > 1;

-- Ensure single active general code per event_id (partial unique index already created previously)

-- Update RPC to reuse the same general code row instead of inserting new ones
create or replace function public.set_event_general_code(p_event_id uuid, p_code text, p_capacity integer default null)
returns public.codes
language plpgsql
as $$
declare
  v_result public.codes;
  v_capacity integer;
  v_existing_event uuid;
  v_current public.codes;
begin
  if p_event_id is null or p_code is null or length(trim(p_code)) = 0 then
    raise exception 'event_id and code are required';
  end if;

  -- capacity fallback from events
  select capacity into v_capacity from public.events where id = p_event_id;
  if not found then
    raise exception 'El evento % no existe', p_event_id using errcode = 'P0002';
  end if;
  if p_capacity is not null then
    v_capacity := p_capacity;
  end if;
  v_capacity := greatest(coalesce(v_capacity, 1000000), 1);

  -- fail fast if the code belongs to a different event
  select event_id into v_existing_event
  from public.codes
  where code = trim(p_code)
  limit 1;

  if v_existing_event is not null and v_existing_event <> p_event_id then
    raise exception 'El código % ya está asignado a otro evento', p_code using errcode = '23505';
  end if;

  -- pick current general code row for the event (if any)
  select *
    into v_current
    from public.codes
   where event_id = p_event_id
     and type = 'general'
   order by updated_at desc nulls last, created_at desc
   limit 1;

  -- deactivate any other general codes
  update public.codes
     set is_active = false,
         updated_at = now()
   where event_id = p_event_id
     and type = 'general'
     and (v_current.id is null or id <> v_current.id)
     and is_active = true;

  if v_current.id is not null then
    update public.codes
       set code = trim(p_code),
           is_active = true,
           promoter_id = null,
           type = 'general',
           max_uses = v_capacity,
           uses = case when code = trim(p_code) then uses else 0 end,
           updated_at = now()
     where id = v_current.id
     returning * into v_result;
  else
    insert into public.codes (code, event_id, type, promoter_id, is_active, max_uses, uses, expires_at)
    values (trim(p_code), p_event_id, 'general', null, true, v_capacity, 0, null)
    returning * into v_result;
  end if;

  return v_result;
end;
$$;
