-- Hosted pg_net queue ACLs are controlled by supabase_admin. Avoid persisting
-- the Vault key in HTTP headers regardless of queue ACLs.
create function private.invoke_notification_dispatcher() returns bigint
language plpgsql security definer set search_path='' as $$
declare endpoint text; signing_key text; stamp text; payload jsonb := '{}'::jsonb;
begin
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='project_url';
 select decrypted_secret into signing_key from vault.decrypted_secrets where name='notification_worker_secret';
 if endpoint is null or signing_key is null then raise exception 'Notification worker not configured'; end if;
 stamp := floor(extract(epoch from clock_timestamp()))::bigint::text;
 return net.http_post(
  url := endpoint || '/functions/v1/notification-dispatcher',
  headers := jsonb_build_object('Content-Type','application/json','X-Roam-Timestamp',stamp,
   'X-Roam-Signature',encode(extensions.hmac(stamp||'.'||payload::text,signing_key,'sha256'),'hex')),
  body := payload, timeout_milliseconds := 55000);
end $$;
revoke all on function private.invoke_notification_dispatcher() from public,anon,authenticated,service_role;
do $$ begin
 if to_regprocedure('cron.schedule(text,text,text)') is not null then
  perform cron.schedule('roam-notifications','* * * * *','select private.invoke_notification_dispatcher();');
 end if;
end $$;
