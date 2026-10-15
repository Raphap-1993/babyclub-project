-- Payment state is managed by server routes using service_role, never browser clients.
-- Existing rows and policies are retained; revoke direct browser privileges too.
begin;
set local lock_timeout = '5s';
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.ticket_reservation_units enable row level security;
revoke all on public.payments, public.payment_webhook_events, public.ticket_reservation_units from public, anon, authenticated;
grant all on public.payments, public.payment_webhook_events, public.ticket_reservation_units to service_role;
commit;
