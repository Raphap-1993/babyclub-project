create or replace function public.close_due_code_batches(p_now timestamptz default now())
returns table(batch_id uuid, closed_reason text, closed_codes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_reason text;
begin
  for v_batch in
    select
      cb.id,
      cb.expires_at,
      coalesce(sum(greatest(coalesce(c.max_uses, 1) - coalesce(c.uses, 0), 0)) filter (where c.deleted_at is null and c.is_active), 0) as remaining_usable_codes,
      count(c.id) filter (where c.deleted_at is null and c.is_active) as active_codes
    from public.code_batches cb
    left join public.codes c on c.batch_id = cb.id
    where cb.closed_at is null
    group by cb.id, cb.expires_at
  loop
    v_reason := case
      when v_batch.expires_at is not null and v_batch.expires_at <= p_now then 'expired'
      when v_batch.remaining_usable_codes <= 0 then 'quota'
      else null
    end;

    if v_reason is null then
      continue;
    end if;

    update public.code_batches
      set is_active = false,
          closed_at = p_now,
          closed_reason = v_reason,
          closed_by_staff_id = null
    where id = v_batch.id
      and closed_at is null;

    update public.codes
      set is_active = false,
          updated_at = p_now
    where batch_id = v_batch.id
      and deleted_at is null
      and is_active = true;

    batch_id := v_batch.id;
    closed_reason := v_reason;
    closed_codes := v_batch.active_codes;
    return next;
  end loop;
end;
$$;
