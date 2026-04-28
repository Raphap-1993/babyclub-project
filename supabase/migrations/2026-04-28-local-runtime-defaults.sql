-- Runtime defaults for local/legacy schemas that were restored with text IDs.
-- Newer migrations expect UUID defaults, but some local databases still have
-- text primary keys without generated values.

create extension if not exists pgcrypto;

create or replace function public._baby_set_generated_id_default(
  p_table_name text
)
returns void
language plpgsql
as $$
declare
  v_data_type text;
begin
  select data_type
    into v_data_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = p_table_name
    and column_name = 'id';

  if v_data_type is null then
    return;
  end if;

  if v_data_type = 'uuid' then
    execute format(
      'alter table public.%I alter column id set default gen_random_uuid()',
      p_table_name
    );
  elsif v_data_type in ('text', 'character varying', 'character') then
    execute format(
      'alter table public.%I alter column id set default gen_random_uuid()::text',
      p_table_name
    );
  end if;
end;
$$;

create or replace function public._baby_set_default_if_exists(
  p_table_name text,
  p_column_name text,
  p_default_sql text
)
returns void
language plpgsql
as $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_table_name
      and column_name = p_column_name
  ) then
    execute format(
      'alter table public.%I alter column %I set default %s',
      p_table_name,
      p_column_name,
      p_default_sql
    );
  end if;
end;
$$;

select public._baby_set_generated_id_default(table_name)
from (
  values
    ('access_logs'),
    ('code_batches'),
    ('codes'),
    ('events'),
    ('organizers'),
    ('payment_webhook_events'),
    ('payments'),
    ('persons'),
    ('process_logs'),
    ('promoters'),
    ('scan_logs'),
    ('staff'),
    ('table_availability'),
    ('table_products'),
    ('table_reservations'),
    ('tables'),
    ('tickets')
) as runtime_tables(table_name);

select public._baby_set_default_if_exists(table_name, 'created_at', 'now()')
from (
  values
    ('access_logs'),
    ('code_batches'),
    ('codes'),
    ('events'),
    ('organizers'),
    ('payment_webhook_events'),
    ('payments'),
    ('persons'),
    ('process_logs'),
    ('promoters'),
    ('scan_logs'),
    ('staff'),
    ('table_availability'),
    ('table_products'),
    ('table_reservations'),
    ('tables'),
    ('tickets')
) as runtime_tables(table_name);

select public._baby_set_default_if_exists(table_name, 'updated_at', 'now()')
from (
  values
    ('code_batches'),
    ('codes'),
    ('events'),
    ('organizers'),
    ('payments'),
    ('persons'),
    ('promoters'),
    ('staff'),
    ('table_availability'),
    ('table_products'),
    ('table_reservations'),
    ('tables')
) as runtime_tables(table_name);

select public._baby_set_default_if_exists(table_name, 'is_active', 'true')
from (
  values
    ('code_batches'),
    ('codes'),
    ('events'),
    ('organizers'),
    ('persons'),
    ('promoters'),
    ('staff'),
    ('table_products'),
    ('table_reservations'),
    ('tables'),
    ('tickets')
) as runtime_tables(table_name);

select public._baby_set_default_if_exists('codes', 'uses', '0');
select public._baby_set_default_if_exists('table_availability', 'is_available', 'true');
select public._baby_set_default_if_exists('table_reservations', 'sale_origin', '''table''');
select public._baby_set_default_if_exists('table_reservations', 'status', '''pending''');
select public._baby_set_default_if_exists('payments', 'status', '''pending''');
select public._baby_set_default_if_exists('payments', 'currency_code', '''PEN''');
select public._baby_set_default_if_exists('payment_webhook_events', 'status', '''received''');

drop function public._baby_set_generated_id_default(text);
drop function public._baby_set_default_if_exists(text, text, text);
