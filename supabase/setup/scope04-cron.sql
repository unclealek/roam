-- Run after the migration and function deployment in the selected Supabase project.
-- Requires Cron, pg_net and Vault. Do not put actual secrets in this file.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
-- HTTP request headers contain the decrypted worker secret until sent.
revoke all on table net.http_request_queue from public,anon,authenticated;
-- First store project_url and notification_worker_secret in Vault using Dashboard.
-- The latter must equal the Edge Function NOTIFICATION_WORKER_SECRET.
select cron.schedule('roam-activities','* * * * *',
 $$select public.notification_worker('tick');$$);
-- Signed headers keep the shared key out of the pg_net request queue.
-- Requires the sign_notification_cron_requests migration.
select cron.schedule('roam-notifications','* * * * *',
 $$select private.invoke_notification_dispatcher();$$);
