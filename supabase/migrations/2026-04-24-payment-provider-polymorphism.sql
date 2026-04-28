-- Payment provider polymorphism foundation
-- Makes provider validation generic and scopes payment uniqueness per provider.

alter table if exists public.payments
  drop constraint if exists payments_provider_check;

alter table if exists public.payments
  add constraint payments_provider_check
  check (provider ~ '^[a-z][a-z0-9_-]{1,31}$');

alter table if exists public.payment_webhook_events
  drop constraint if exists payment_webhook_events_provider_check;

alter table if exists public.payment_webhook_events
  add constraint payment_webhook_events_provider_check
  check (provider ~ '^[a-z][a-z0-9_-]{1,31}$');

alter table if exists public.payments
  drop constraint if exists payments_order_id_key;

alter table if exists public.payments
  drop constraint if exists payments_charge_id_key;

alter table if exists public.payments
  drop constraint if exists payments_idempotency_key_key;

drop index if exists public.payments_provider_order_id_uidx;
create unique index if not exists payments_provider_order_id_uidx
  on public.payments(provider, order_id)
  where order_id is not null;

drop index if exists public.payments_provider_charge_id_uidx;
create unique index if not exists payments_provider_charge_id_uidx
  on public.payments(provider, charge_id)
  where charge_id is not null;

drop index if exists public.payments_provider_idempotency_key_uidx;
create unique index if not exists payments_provider_idempotency_key_uidx
  on public.payments(provider, idempotency_key)
  where idempotency_key is not null;
