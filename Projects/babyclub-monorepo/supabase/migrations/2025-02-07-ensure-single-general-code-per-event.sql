-- Cleanup: leave only the most recently updated general active code per event
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
    and is_active = true
)
update public.codes c
set is_active = false, updated_at = now()
from ranked r
where c.id = r.id
  and r.rn > 1;

-- Create partial unique index to enforce a single active general code per event
create unique index if not exists codes_one_active_general_per_event
  on public.codes(event_id)
  where type = 'general' and is_active = true;

-- RPC to set the general code of an event atomically
create or replace function public.set_event_general_code(p_event_id uuid, p_code text, p_capacity integer default null)
returns public.codes
language plpgsql
as $$
declare
  v_result public.codes;
  v_capacity integer;
  v_existing_event uuid;
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

  -- desactivar existentes
  update public.codes
     set is_active = false,
         updated_at = now()
   where event_id = p_event_id
     and type = 'general'
     and is_active = true;

  -- insertar o actualizar el nuevo
  insert into public.codes (code, event_id, type, promoter_id, is_active, max_uses, uses, expires_at)
  values (trim(p_code), p_event_id, 'general', null, true, v_capacity, 0, null)
  on conflict (code) do update
    set event_id = excluded.event_id,
        type = 'general',
        promoter_id = null,
        is_active = true,
        max_uses = excluded.max_uses,
        updated_at = now()
    where public.codes.event_id = excluded.event_id
    returning * into v_result;

  return v_result;
end;
$$;
