-- Keep privileged implementations outside the exposed API schema.
-- Public RPC signatures and internal authentication/authorization checks are unchanged.

alter function public.create_group(text,text,text) set schema private;
revoke all on function private.create_group(text,text,text) from public,anon,authenticated;
grant execute on function private.create_group(text,text,text) to authenticated;
create function public.create_group(p_name text,p_description text default null,p_icon_key text default null) returns jsonb language sql security invoker set search_path='' as $$ select private.create_group(p_name,p_description,p_icon_key); $$;
revoke all on function public.create_group(text,text,text) from public,anon,authenticated;
grant execute on function public.create_group(text,text,text) to authenticated;

alter function public.list_my_groups() set schema private;
revoke all on function private.list_my_groups() from public,anon,authenticated;
grant execute on function private.list_my_groups() to authenticated;
create function public.list_my_groups() returns jsonb language sql security invoker set search_path='' as $$ select private.list_my_groups(); $$;
revoke all on function public.list_my_groups() from public,anon,authenticated;
grant execute on function public.list_my_groups() to authenticated;

alter function public.get_group(uuid) set schema private;
revoke all on function private.get_group(uuid) from public,anon,authenticated;
grant execute on function private.get_group(uuid) to authenticated;
create function public.get_group(p_group_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_group(p_group_id); $$;
revoke all on function public.get_group(uuid) from public,anon,authenticated;
grant execute on function public.get_group(uuid) to authenticated;

alter function public.create_group_invite(uuid,integer,integer) set schema private;
revoke all on function private.create_group_invite(uuid,integer,integer) from public,anon,authenticated;
grant execute on function private.create_group_invite(uuid,integer,integer) to authenticated;
create function public.create_group_invite(p_group_id uuid,p_days integer default 7,p_max_uses integer default null) returns jsonb language sql security invoker set search_path='' as $$ select private.create_group_invite(p_group_id,p_days,p_max_uses); $$;
revoke all on function public.create_group_invite(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.create_group_invite(uuid,integer,integer) to authenticated;

alter function public.revoke_group_invite(uuid,uuid) set schema private;
revoke all on function private.revoke_group_invite(uuid,uuid) from public,anon,authenticated;
grant execute on function private.revoke_group_invite(uuid,uuid) to authenticated;
create function public.revoke_group_invite(p_group_id uuid,p_invite_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.revoke_group_invite(p_group_id,p_invite_id); $$;
revoke all on function public.revoke_group_invite(uuid,uuid) from public,anon,authenticated;
grant execute on function public.revoke_group_invite(uuid,uuid) to authenticated;
