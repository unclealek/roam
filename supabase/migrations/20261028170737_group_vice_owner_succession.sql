-- Optional successor; existing groups default to no vice. A vice has no extra
-- management permissions until ownership is transferred by a trusted RPC.
alter table public.groups add column vice_owner_id uuid;
alter table public.groups add constraint group_vice_not_owner
 check (vice_owner_id is null or vice_owner_id <> owner_id);
alter table public.groups add constraint group_vice_membership
 foreign key (id,vice_owner_id) references public.group_members(group_id,user_id)
 on delete set null (vice_owner_id);
create index groups_vice_owner on public.groups(vice_owner_id) where vice_owner_id is not null;

-- Keep the existing owner-only operations and their session deletion safeguards.
alter function private.group_action(text,uuid,uuid,text,text,text) rename to group_action_base;
revoke all on function private.group_action_base(text,uuid,uuid,text,text,text) from public,anon,authenticated;

create function private.group_action(p_action text,p_group_id uuid,p_user_id uuid default null,p_name text default null,p_description text default null,p_icon_key text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor(); g public.groups;
begin
 select * into g from public.groups where id=p_group_id for update;
 if not found then raise exception 'Group not found or access denied' using errcode='42501'; end if;
 if p_action='vice' then
  if g.owner_id<>actor then raise exception 'Only the owner may manage this group' using errcode='42501'; end if;
  if p_user_id is not null and (p_user_id=actor or not exists(
   select 1 from public.group_members where group_id=g.id and user_id=p_user_id
  )) then raise exception 'Vice owner must be another existing group member'; end if;
  update public.groups set vice_owner_id=p_user_id,updated_at=clock_timestamp() where id=g.id;
  return 'null'::jsonb;
 end if;
 if p_action='leave' and g.owner_id=actor then
  if g.vice_owner_id is null then raise exception 'Appoint a vice owner or transfer ownership before leaving'; end if;
  -- Clear the vice before promoting: the check constraint forbids owner=vice.
  update public.groups set vice_owner_id=null,updated_at=clock_timestamp() where id=g.id;
  perform private.group_action_base('transfer',g.id,g.vice_owner_id);
  delete from public.group_members where group_id=g.id and user_id=actor;
  return 'null'::jsonb;
 end if;
 if p_action='transfer' and g.owner_id=actor then
  update public.groups set vice_owner_id=null where id=g.id;
 end if;
 -- Removing/leaving/deleting a vice clears the designation through its FK.
 return private.group_action_base(p_action,p_group_id,p_user_id,p_name,p_description,p_icon_key);
end;
$$;
revoke all on function private.group_action(text,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.group_action(text,uuid,uuid,text,text,text) to authenticated;
create function public.set_group_vice_owner(p_group_id uuid,p_user_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.group_action('vice',p_group_id,p_user_id); $$;
revoke all on function public.set_group_vice_owner(uuid,uuid) from public,anon,authenticated;
grant execute on function public.set_group_vice_owner(uuid,uuid) to authenticated;

create or replace function private.delete_own_account() returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor(); g record;
begin
 -- Same group-first locks as membership and vice mutations. Lock every affected
 -- group in deterministic order, including vice memberships, before cascading.
 perform gr.id from public.groups gr join public.group_members m on m.group_id=gr.id
 where m.user_id=actor order by gr.id for update of gr;
 if exists(select 1 from public.groups where owner_id=actor and vice_owner_id is null) then
  raise exception 'GROUP_OWNERSHIP_REQUIRED' using errcode='P0001';
 end if;
 for g in select id from public.groups where owner_id=actor order by id loop
  perform private.group_action('leave',g.id);
 end loop;
 delete from auth.users where id=actor;
end;
$$;
-- Existing private ACL and public SECURITY INVOKER account wrapper are retained.
