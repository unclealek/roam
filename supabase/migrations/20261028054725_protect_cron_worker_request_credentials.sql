-- pg_net temporarily stores decrypted HTTP headers in its request queue.
-- Only trusted database roles may inspect worker credentials in that queue.
do $$ begin
 if to_regclass('net.http_request_queue') is not null then
  revoke all on table net.http_request_queue from public,anon,authenticated;
 end if;
end $$;
