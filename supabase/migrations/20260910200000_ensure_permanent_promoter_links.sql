-- The public permalink uses promoters.id; editable commercial codes remain independent.
-- This RPC is called only by validated purchase POSTs, never by link GET/prefetch.
create or replace function public.ensure_promoter_event_link(p_promoter_id uuid, p_event_id uuid)
returns table (id uuid, code text, promoter_id uuid, event_id uuid)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_link public.codes%rowtype;
begin
  if p_promoter_id is null or p_event_id is null then
    raise exception 'Promotor y evento requeridos';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('promoter-event:' || p_promoter_id::text || ':' || p_event_id::text, 0));
  perform 1 from public.promoters p
    where p.id = p_promoter_id and p.deleted_at is null and p.is_active is not false
    for share;
  if not found then raise exception 'Promotor no disponible'; end if;
  perform 1 from public.events e
    where e.id = p_event_id and e.deleted_at is null and e.is_active is not false
      and e.closed_at is null and coalesce(e.sale_status, 'on_sale') = 'on_sale'
    for share;
  if not found then raise exception 'Evento no disponible'; end if;

  select c.* into v_link from public.codes c
    where c.promoter_id = p_promoter_id and c.event_id = p_event_id
      and c.type = 'promoter_link' and c.deleted_at is null and c.is_active is not false
      and (c.expires_at is null or c.expires_at > clock_timestamp())
      and (c.max_uses is null or coalesce(c.uses, 0) < c.max_uses)
    order by c.created_at, c.id limit 1 for share;
  if not found then
    insert into public.codes (code, type, promoter_id, event_id, is_active, max_uses, uses)
    values ('PL-' || replace(gen_random_uuid()::text, '-', ''), 'promoter_link', p_promoter_id, p_event_id, true, null, 0)
    returning * into v_link;
  end if;
  return query select v_link.id, v_link.code::text, v_link.promoter_id, v_link.event_id;
end;
$$;
revoke all on function public.ensure_promoter_event_link(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ensure_promoter_event_link(uuid, uuid) to service_role;
