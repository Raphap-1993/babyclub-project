-- Preserve the promoter link that originated ticket purchases or table reservations.
-- promoter_id keeps the payable owner; these fields keep the source link for audit.

do $$
begin
  if to_regclass('public.table_reservations') is not null then
    alter table public.table_reservations
      add column if not exists promoter_link_code_id text,
      add column if not exists promoter_link_code text;

    create index if not exists table_reservations_promoter_link_idx
      on public.table_reservations(promoter_id, promoter_link_code_id)
      where promoter_id is not null
        and promoter_link_code_id is not null;

    comment on column public.table_reservations.promoter_link_code_id is
      'codes.id snapshot for the promoter_link URL that originated the ticket purchase or table reservation.';

    comment on column public.table_reservations.promoter_link_code is
      'Human-readable promoter_link code snapshot used for liquidation traceability.';
  end if;
end $$;
