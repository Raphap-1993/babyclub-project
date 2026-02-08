-- Align RPC with codes.type check: store promoter batches but insert codes as 'courtesy'
drop function if exists public.generate_codes_batch(
  uuid,       -- p_event_id
  text,       -- p_type
  integer,    -- p_quantity
  uuid,       -- p_promoter_id
  timestamptz,-- p_expires_at
  integer,    -- p_max_uses
  text,       -- p_prefix
  text        -- p_notes
);

create or replace function public.generate_codes_batch(
  p_event_id uuid,
  p_type text,
  p_quantity integer,
  p_promoter_id uuid default null,
  p_expires_at timestamptz default null,
  p_max_uses integer default 1,
  p_prefix text default null,
  p_notes text default null
) returns table(batch_id uuid, code_id uuid, generated_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_type text;
  v_quantity integer;
  v_max_uses integer;
  v_prefix text;
  v_prom_code text;
  v_expiration timestamptz;
  v_batch_id uuid;
  v_code text;
  v_code_id uuid;
  v_event_start timestamptz;
  v_attempts integer;
  v_code_type text;
begin
  if p_event_id is null then
    raise exception 'event_id es requerido';
  end if;

  v_type := lower(trim(coalesce(p_type, '')));
  if v_type not in ('courtesy','promoter','table') then
    raise exception 'tipo inválido: %', p_type using errcode = '22P02';
  end if;

  v_quantity := coalesce(p_quantity, 0);
  if v_quantity < 1 or v_quantity > 500 then
    raise exception 'quantity debe estar entre 1 y 500' using errcode = '22023';
  end if;

  v_max_uses := greatest(coalesce(p_max_uses, 1), 1);

  select id into v_staff_id from public.staff where auth_user_id = auth.uid() and coalesce(is_active, true) limit 1;
  if v_staff_id is null then
    raise exception 'Solo staff puede generar códigos' using errcode = '42501';
  end if;

  select starts_at into v_event_start from public.events where id = p_event_id;
  if not found then
    raise exception 'Evento no encontrado' using errcode = 'P0002';
  end if;

  if v_type = 'promoter' and p_promoter_id is null then
    raise exception 'promoter_id es requerido para tipo promoter' using errcode = '23514';
  end if;

  if p_promoter_id is not null then
    select code into v_prom_code from public.promoters where id = p_promoter_id;
    if not found then
      raise exception 'Promotor no encontrado' using errcode = 'P0002';
    end if;
  end if;

  if p_expires_at is not null then
    v_expiration := p_expires_at;
  elsif v_event_start is not null then
    v_expiration := v_event_start + interval '1 day';
  else
    v_expiration := null;
  end if;

  v_prefix := trim(coalesce(p_prefix, ''));
  if v_prefix = '' then
    v_prefix := coalesce(nullif(v_prom_code, ''), case when v_type = 'promoter' then 'promoter' else 'courtesy' end);
  end if;
  v_prefix := lower(regexp_replace(v_prefix, '[^a-z0-9]+', '-', 'g'));
  v_prefix := trim(both '-' from v_prefix);
  if v_prefix <> '' then
    v_prefix := v_prefix || '-';
  else
    v_prefix := 'courtesy-';
  end if;

  insert into public.code_batches(event_id, promoter_id, type, quantity, prefix, expires_at, max_uses, created_by_staff_id, notes)
  values (p_event_id, p_promoter_id, v_type, v_quantity, v_prefix, v_expiration, v_max_uses, v_staff_id, p_notes)
  returning id into v_batch_id;

  -- codes.type: usar 'courtesy' para cortesía/promotor para respetar el check constraint
  v_code_type := case when v_type = 'promoter' then 'courtesy' else v_type end;

  for i in 1..v_quantity loop
    v_attempts := 0;
    loop
      v_attempts := v_attempts + 1;
      v_code := v_prefix || substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 6);
      begin
        insert into public.codes (code, event_id, promoter_id, type, is_active, max_uses, uses, expires_at, batch_id)
        values (v_code, p_event_id, p_promoter_id, v_code_type, true, v_max_uses, 0, v_expiration, v_batch_id)
        returning id into v_code_id;

        batch_id := v_batch_id;
        code_id := v_code_id;
        generated_code := v_code;
        return next;
        exit;
      exception
        when unique_violation then
          if v_attempts > 10 then
            raise exception 'No se pudo generar código único después de varios intentos' using errcode = '23505';
          end if;
      end;
    end loop;
  end loop;
end;
$$;
