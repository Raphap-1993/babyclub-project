-- Private cache of canonical 3DS information; same service-role-only RLS and
-- grants as mp_payment_attempts. Never persist card tokens or raw API responses.
alter table public.mp_payment_attempts
  add column challenge_url text,
  add column provider_status_detail text;
comment on column public.mp_payment_attempts.challenge_url is
  'Sensitive 3DS guest URL, disclosed only to the authorized checkout while pending';
