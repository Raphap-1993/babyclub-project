-- Store per-ticket attendee snapshots for ticket-only reservations.
-- Used when a 2 QR purchase needs the second QR under a different person.

do $$
begin
  if to_regclass('public.table_reservations') is not null then
    alter table public.table_reservations
      add column if not exists attendees jsonb;

    update public.table_reservations
    set attendees = '[]'::jsonb
    where attendees is null;

    alter table public.table_reservations
      alter column attendees set default '[]'::jsonb;

    alter table public.table_reservations
      alter column attendees set not null;

    alter table public.table_reservations
      drop constraint if exists table_reservations_attendees_array_check;

    alter table public.table_reservations
      add constraint table_reservations_attendees_array_check
      check (jsonb_typeof(attendees) = 'array');

    comment on column public.table_reservations.attendees is
      'JSON array with per-ticket attendee snapshots for ticket-only reservations. Each item may include person_index, doc_type, document, full_name, first_name, last_name_p, last_name_m, email and phone.';
  end if;
end $$;
