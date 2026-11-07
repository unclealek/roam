-- Retain authenticated RPC contracts while keeping privileged bodies unexposed.
alter function public.notification_account(text,jsonb) set schema private;
revoke all on function private.notification_account(text,jsonb) from public,anon,authenticated;
grant execute on function private.notification_account(text,jsonb) to authenticated;
create function public.notification_account(p_action text,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select private.notification_account(p_action,p_data); $$;
revoke all on function public.notification_account(text,jsonb) from public,anon,authenticated;
grant execute on function public.notification_account(text,jsonb) to authenticated;
alter function public.reward_account(text,jsonb) set schema private;
revoke all on function private.reward_account(text,jsonb) from public,anon,authenticated;
grant execute on function private.reward_account(text,jsonb) to authenticated;
create function public.reward_account(p_action text,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select private.reward_account(p_action,p_data); $$;
revoke all on function public.reward_account(text,jsonb) from public,anon,authenticated;
grant execute on function public.reward_account(text,jsonb) to authenticated;
-- Persist qualified signatures rather than regprocedure OIDs, supporting pg_upgrade.
alter table private.reward_event_registry alter column validator type text using validator::text;
alter table private.reward_milestone_registry alter column validator type text using validator::text;
do $$
declare signature text;
begin
 foreach signature in array array['private.reward_rule_eligible(jsonb,uuid,text,uuid)','private.award_verified_reward(uuid,text,uuid,uuid)'] loop
  execute replace(pg_get_functiondef(signature::regprocedure),'r.validator::oid','pg_catalog.to_regprocedure(r.validator)::oid');
 end loop;
end $$;
