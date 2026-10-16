begin;

create table public.manual_sale_email_jobs (
  payment_id uuid primary key references public.payments(id),
  reservation_id uuid not null references public.table_reservations(id),
  status text not null default 'pending' check(status in ('pending','sending','sent','error','failed')),
  attempts integer not null default 0,
  locked_until timestamptz,
  lock_token uuid,
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.manual_sale_email_jobs enable row level security;
revoke all on public.manual_sale_email_jobs from public,anon,authenticated;
grant all on public.manual_sale_email_jobs to service_role;

create function public.queue_manual_sale_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.provider='manual' and new.status='paid' then
    insert into public.manual_sale_email_jobs(payment_id,reservation_id)
      values(new.id,new.reservation_id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger queue_manual_sale_email after insert on public.payments
  for each row execute function public.queue_manual_sale_email();

create function public.claim_manual_sale_email(p_payment uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.manual_sale_email_jobs;
begin
  -- Automatic retries stay within the provider's 24h idempotency window.
  update public.manual_sale_email_jobs set status='failed',locked_until=null
    where payment_id=p_payment and status in ('pending','error','sending')
      and (locked_until is null or locked_until<=now())
      and (attempts>=10 or created_at<now()-interval '23 hours');
  update public.manual_sale_email_jobs set status='sending',attempts=attempts+1,
    locked_until=now()+interval '2 minutes',lock_token=gen_random_uuid()
    where payment_id=p_payment and status in ('pending','error','sending')
      and (locked_until is null or locked_until<=now())
    returning * into j;
  if not found then return null; end if;
  return to_jsonb(j);
end $$;
revoke all on function public.queue_manual_sale_email(),public.claim_manual_sale_email(uuid) from public,anon,authenticated;
grant execute on function public.claim_manual_sale_email(uuid) to service_role;
commit;
