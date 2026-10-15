-- Apply only to BabyClub production after saving the dedicated worker key in
-- Vault as baby_mp_worker_secret. No Mercado Pago token belongs in the scheduler.
begin;
set local lock_timeout = '5s';
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
  if not exists (select 1 from vault.secrets where name='baby_mp_worker_secret') then
    raise exception 'Missing dedicated worker secret in Vault';
  end if;
end $$;
select cron.schedule('baby-mp-reconcile', '* * * * *', $job$
  select net.http_post(
    url := 'https://babyclubaccess.com/api/payments/mercadopago/reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name='baby_mp_worker_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$job$);
-- Keep inactive until the release is Ready and a manual invocation returns 200.
select cron.alter_job((select jobid from cron.job where jobname='baby-mp-reconcile'), active := false);
commit;

-- Activation (run separately, after HTTP verification):
-- select cron.alter_job((select jobid from cron.job where jobname='baby-mp-reconcile'), active := true);
-- Verification: inspect cron.job_run_details AND net._http_response for HTTP 200.
-- A successful SQL schedule does not prove a successful HTTP invocation.
