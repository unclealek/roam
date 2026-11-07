-- Scope 03: persistent private groups. All writes go through transactional RPCs.
create table public.groups (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(name) between 1 and 80 and name=btrim(name) and name !~ '[[:cntrl:]]'),
 description text check(char_length(description)<=500 and description !~ '[[:cntrl:]]'),
 icon_key text check(icon_key in ('people','sparkles','coffee','planet','heart')),
 owner_id uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index groups_owner on public.groups(owner_id);
create table public.group_members (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','member')), joined_at timestamptz not null default now(), unique(group_id,user_id)
);
create unique index group_single_owner on public.group_members(group_id) where role='owner';
create index group_members_user on public.group_members(user_id,group_id);
create table public.group_invites (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
 code_hash text not null unique, created_by uuid references auth.users(id) on delete set null,
 expires_at timestamptz, revoked_at timestamptz, max_uses integer check(max_uses>0),
 use_count integer not null default 0 check(use_count>=0 and (max_uses is null or use_count<=max_uses)), created_at timestamptz not null default now()
);
create index group_invites_group on public.group_invites(group_id);
create table private.group_invite_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null, attempts integer not null
);
revoke all on private.group_invite_limits from public,anon,authenticated;
alter table public.game_sessions drop constraint game_sessions_group_id_check;
alter table public.game_sessions add constraint game_sessions_group_id_fkey foreign key(group_id) references public.groups(id) on delete restrict;
create index game_sessions_group on public.game_sessions(group_id);

create function private.is_group_member(p_group_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.group_members where group_id=p_group_id and user_id=private.active_actor());
$$;
revoke all on function private.is_group_member(uuid) from public,anon,authenticated;
grant execute on function private.is_group_member(uuid) to authenticated;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
revoke all on public.groups,public.group_members,public.group_invites from public,anon,authenticated;
grant select on public.groups,public.group_members to authenticated;
create policy groups_member_read on public.groups for select to authenticated using(private.is_group_member(id));
create policy group_members_read on public.group_members for select to authenticated using(private.is_group_member(group_id));
-- Invitations have no client table access. Owner RPCs project metadata without hashes.
create function private.group_document(p_group_id uuid,p_details boolean default false) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(g)||jsonb_build_object('member_count',(select count(*) from public.group_members where group_id=g.id))||case when p_details then jsonb_build_object(
 'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',p.display_name,'role',m.role,'joined_at',m.joined_at) order by m.joined_at,m.id) from public.group_members m join public.profiles p on p.id=m.user_id where m.group_id=g.id),'[]'::jsonb),
 'sessions',coalesce((select jsonb_agg(private.session_document(s.id) order by s.created_at desc,s.id) from public.game_sessions s where s.group_id=g.id and private.is_session_member(s.id)),'[]'::jsonb),
 'invites',case when g.owner_id=auth.uid() then coalesce((select jsonb_agg(to_jsonb(i)-array['code_hash','created_by'] order by i.created_at desc) from public.group_invites i where i.group_id=g.id),'[]'::jsonb) else '[]'::jsonb end) else '{}'::jsonb end from public.groups g where g.id=p_group_id;
$$;
revoke all on function private.group_document(uuid,boolean) from public,anon,authenticated;

create function public.create_group(p_name text,p_description text default null,p_icon_key text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor(); gid uuid;
begin
 insert into public.groups(name,description,icon_key,owner_id) values(btrim(p_name),nullif(btrim(p_description),''),p_icon_key,actor) returning id into gid;
 insert into public.group_members(group_id,user_id,role) values(gid,actor,'owner');
 return private.group_document(gid);
end;
$$;
create function public.list_my_groups() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor();
begin return coalesce((select jsonb_agg(private.group_document(g.id) order by g.updated_at desc,g.id) from public.groups g join public.group_members m on m.group_id=g.id where m.user_id=actor),'[]'::jsonb); end;
$$;
create function public.get_group(p_group_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin if not private.is_group_member(p_group_id) then raise exception 'Group not found or access denied' using errcode='42501'; end if; return private.group_document(p_group_id,true); end;
$$;
-- All management operations lock the group first. Invites and group sessions use
-- the same lock order, serializing redemption/removal/transfer/deletion.
create function private.group_action(p_action text,p_group_id uuid,p_user_id uuid default null,p_name text default null,p_description text default null,p_icon_key text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor(); g public.groups;
begin
 select * into g from public.groups where id=p_group_id for update;
 if not found then raise exception 'Group not found or access denied' using errcode='42501'; end if;
 if p_action='leave' then
  if g.owner_id=actor then raise exception 'Transfer ownership before leaving'; end if;
  delete from public.group_members where group_id=g.id and user_id=actor;
  return 'null'::jsonb;
 end if;
 if g.owner_id<>actor then raise exception 'Only the owner may manage this group' using errcode='42501'; end if;
 case p_action
 when 'update' then update public.groups set name=btrim(p_name),description=nullif(btrim(p_description),''),icon_key=p_icon_key,updated_at=now() where id=g.id;
 when 'remove' then
  if p_user_id=g.owner_id then raise exception 'Transfer ownership before removing the owner'; end if;
  delete from public.group_members where group_id=g.id and user_id=p_user_id;
 when 'transfer' then
  if not exists(select 1 from public.group_members where group_id=g.id and user_id=p_user_id) then raise exception 'New owner must be a group member'; end if;
  update public.group_members set role='member' where group_id=g.id and user_id=g.owner_id;
  update public.group_members set role='owner' where group_id=g.id and user_id=p_user_id;
  update public.groups set owner_id=p_user_id,updated_at=now() where id=g.id;
 when 'delete' then
  if exists(select 1 from public.game_sessions where group_id=g.id) then raise exception 'Groups with game sessions cannot be deleted'; end if;
  delete from public.groups where id=g.id; return 'null'::jsonb;
 else raise exception 'Unknown group operation';
 end case;
 return 'null'::jsonb;
end;
$$;
revoke all on function private.group_action(text,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.group_action(text,uuid,uuid,text,text,text) to authenticated;
create function public.update_group(p_group_id uuid,p_name text,p_description text,p_icon_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.group_action('update',p_group_id,p_name=>p_name,p_description=>p_description,p_icon_key=>p_icon_key); $$;
create function public.leave_group(p_group_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.group_action('leave',p_group_id); $$;
create function public.remove_group_member(p_group_id uuid,p_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.group_action('remove',p_group_id,p_user_id); $$;
create function public.transfer_group_ownership(p_group_id uuid,p_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.group_action('transfer',p_group_id,p_user_id); $$;
create function public.delete_group(p_group_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.group_action('delete',p_group_id); $$;

create function public.create_group_invite(p_group_id uuid,p_days integer default 7,p_max_uses integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor(); g public.groups; code text; i public.group_invites;
begin
 select * into g from public.groups where id=p_group_id for update;
 if not found or g.owner_id<>actor then raise exception 'Only the owner may manage invitations' using errcode='42501'; end if;
 if p_days is null or p_days<1 or p_days>30 or (p_max_uses is not null and p_max_uses<1) then raise exception 'Invalid invitation limits'; end if;
 -- Two cryptographically random UUIDv4 values provide 244 random bits. Plaintext
 -- exists only in this response; persistent storage contains SHA-256 only.
 code:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into public.group_invites(group_id,code_hash,created_by,expires_at,max_uses) values(g.id,encode(sha256(convert_to(code,'UTF8')),'hex'),actor,now()+make_interval(days=>p_days),p_max_uses) returning * into i;
 return (to_jsonb(i)-array['code_hash','created_by'])||jsonb_build_object('code',code);
end;
$$;
create function public.revoke_group_invite(p_group_id uuid,p_invite_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor(); g public.groups;
begin
 select * into g from public.groups where id=p_group_id for update;
 if not found or g.owner_id<>actor then raise exception 'Only the owner may manage invitations' using errcode='42501'; end if;
 update public.group_invites set revoked_at=coalesce(revoked_at,now()) where id=p_invite_id and group_id=g.id;
 return 'null'::jsonb;
end;
$$;
create function private.use_group_invite(p_code text,p_join boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor(); n integer; i public.group_invites; g public.groups;
begin
 insert into private.group_invite_limits values(actor,clock_timestamp(),1)
 on conflict(user_id) do update set attempts=case when group_invite_limits.window_start<clock_timestamp()-interval '5 minutes' then 1 else group_invite_limits.attempts+1 end,
 window_start=case when group_invite_limits.window_start<clock_timestamp()-interval '5 minutes' then clock_timestamp() else group_invite_limits.window_start end returning attempts into n;
 -- Expected failures are values, not exceptions: otherwise PostgreSQL would roll
 -- back the counter and invalid attempts would evade the rate limit.
 if n>20 then return jsonb_build_object('error','rate_limited'); end if;
 if p_code is null or length(p_code)<>64 or lower(p_code) !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','unavailable'); end if;
 select * into i from public.group_invites where code_hash=encode(sha256(convert_to(lower(p_code),'UTF8')),'hex');
 if not found then return jsonb_build_object('error','unavailable'); end if;
 select * into g from public.groups where id=i.group_id for update;
 if not found then return jsonb_build_object('error','unavailable'); end if;
 select * into i from public.group_invites where id=i.id for update;
 if i.revoked_at is not null or (i.expires_at is not null and i.expires_at<=now()) then return jsonb_build_object('error','unavailable'); end if;
 if exists(select 1 from public.group_members where group_id=g.id and user_id=actor) then
  if p_join then return private.group_document(g.id); end if;
 elsif i.max_uses is not null and i.use_count>=i.max_uses then return jsonb_build_object('error','unavailable');
 elsif p_join then
  insert into public.group_members(group_id,user_id,role) values(g.id,actor,'member');
  update public.group_invites set use_count=use_count+1 where id=i.id;
  return private.group_document(g.id);
 end if;
 return jsonb_build_object('id',g.id,'name',g.name,'description',g.description,'icon_key',g.icon_key,'member_count',(select count(*) from public.group_members where group_id=g.id));
end;
$$;
revoke all on function private.use_group_invite(text,boolean) from public,anon,authenticated;
grant execute on function private.use_group_invite(text,boolean) to authenticated;
create function public.preview_group_invite(p_code text) returns jsonb language sql security invoker set search_path='' as $$ select private.use_group_invite(p_code,false); $$;
create function public.redeem_group_invite(p_code text) returns jsonb language sql security invoker set search_path='' as $$ select private.use_group_invite(p_code,true); $$;

-- Extend the existing generic engine, retaining every Scope 02 lifecycle check.
create function private.group_session_action(p_action text,p_session_id uuid default null,p_game_type_id text default null,p_name text default null,p_configuration jsonb default null,p_request_id uuid default null,p_group_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; s public.game_sessions; g public.game_types; fingerprint text; member_count integer;
begin
 actor:=private.active_actor();
 if p_action='list' then
   return coalesce((select jsonb_agg(private.session_document(gs.id) order by gs.created_at desc,gs.id) from public.game_sessions gs join public.game_session_members gm on gm.session_id=gs.id where gm.user_id=actor),'[]'::jsonb);
 end if;
 if p_action='create' then
   if p_group_id is not null then
     perform 1 from public.groups where id=p_group_id for update;
     if not found or not private.is_group_member(p_group_id) then raise exception 'Group not found or access denied' using errcode='42501'; end if;
   end if;
   select * into g from public.game_types where id=p_game_type_id;
   if not found or g.availability_status<>'available' or not ('create'=any(g.lifecycle_operations)) then raise exception 'Game is not available for sessions' using errcode='22023'; end if;
   if p_request_id is null then raise exception 'A creation request ID is required'; end if;
   if p_name is null or not private.valid_game_configuration(g.configuration_schema,p_configuration) then raise exception 'Invalid session name or configuration' using errcode='22023'; end if;
   fingerprint:=encode(sha256(convert_to((jsonb_build_object('game',p_game_type_id,'name',btrim(p_name),'configuration',p_configuration)||case when p_group_id is null then '{}'::jsonb else jsonb_build_object('group',p_group_id) end)::text,'UTF8')),'hex');
   insert into public.game_sessions(game_type_id,host_id,name,configuration,creation_request_id,creation_fingerprint,group_id)
   values(p_game_type_id,actor,btrim(p_name),p_configuration,p_request_id,fingerprint,p_group_id)
   on conflict(host_id,creation_request_id) do nothing returning * into s;
   if s.id is null then
     select * into s from public.game_sessions where host_id=actor and creation_request_id=p_request_id for update;
     if s.creation_fingerprint<>fingerprint then raise exception 'Creation request ID was already used for different settings'; end if;
   else
     insert into public.game_session_members(session_id,user_id,role) values(s.id,actor,'host');
   end if;
   return private.session_document(s.id);
 end if;
 select * into s from public.game_sessions where id=p_session_id for update;
 if not found then raise exception 'Session not found or access denied' using errcode='42501'; end if;
 select * into g from public.game_types where id=s.game_type_id;
 if p_action='join' then
   if private.is_session_member(s.id) then return private.session_document(s.id); end if;
   if s.group_id is not null and not private.is_group_member(s.group_id) then raise exception 'Group membership required' using errcode='42501'; end if;
   -- Group lobbies require group membership; standalone lobbies retain Scope 02 behavior.
   -- Joining a group never creates session membership.
   if s.status<>'lobby' or g.availability_status<>'available' or not ('join'=any(g.lifecycle_operations)) then raise exception 'Session is not open for joining'; end if;
   select count(*) into member_count from public.game_session_members where session_id=s.id;
   if g.max_players is not null and member_count>=g.max_players then raise exception 'Session is full'; end if;
   insert into public.game_session_members(session_id,user_id,role) values(s.id,actor,'member') on conflict(session_id,user_id) do nothing;
   return private.session_document(s.id);
 end if;
 if p_action='leave' then
   if s.host_id=actor then raise exception 'The host must cancel the session instead of leaving'; end if;
   if not private.is_session_member(s.id) then return 'null'::jsonb; end if;
   if s.status not in ('draft','lobby') or not ('leave'=any(g.lifecycle_operations)) then raise exception 'Leaving is not permitted after a session starts or ends'; end if;
   delete from public.game_session_members where session_id=s.id and user_id=actor;
   return 'null'::jsonb;
 end if;
 if not private.is_session_member(s.id) then raise exception 'Session not found or access denied' using errcode='42501'; end if;
 if p_action='get' then return private.session_document(s.id,true); end if;
 if s.host_id<>actor then raise exception 'Only the host may manage this session' using errcode='42501'; end if;
 if p_action='update' then
   if s.status not in ('draft','lobby') then raise exception 'Session settings are locked'; end if;
   if p_name is null or not private.valid_game_configuration(g.configuration_schema,p_configuration) then raise exception 'Invalid session name or configuration'; end if;
   update public.game_sessions set name=btrim(p_name),configuration=p_configuration where id=s.id;
 elsif p_action='open_lobby' then
   if s.status='lobby' then return private.session_document(s.id); end if;
   if s.status<>'draft' or g.availability_status<>'available' or not ('open_lobby'=any(g.lifecycle_operations)) then raise exception 'Invalid session transition or unsupported operation'; end if;
   update public.game_sessions set status='lobby' where id=s.id;
 elsif p_action='start' then
   if s.status='active' then return private.session_document(s.id); end if;
   if s.status<>'lobby' or g.availability_status<>'available' or not ('start'=any(g.lifecycle_operations)) then raise exception 'Invalid session transition or unsupported operation'; end if;
   select count(*) into member_count from public.game_session_members where session_id=s.id;
   if member_count<g.min_players or (g.max_players is not null and member_count>g.max_players) then raise exception 'Not enough players or too many players to start'; end if;
   update public.game_sessions set status='active' where id=s.id;
 elsif p_action='cancel' then
   if s.status='cancelled' then return private.session_document(s.id); end if;
   if s.status not in ('draft','lobby','active') or not ('cancel'=any(g.lifecycle_operations)) then raise exception 'Invalid session transition or unsupported operation'; end if;
   update public.game_sessions set status='cancelled' where id=s.id;
 else raise exception 'Unsupported session operation' using errcode='22023';
 end if;
 return private.session_document(s.id);
end;
$$;

revoke all on function private.group_session_action(text,uuid,text,text,jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function private.group_session_action(text,uuid,text,text,jsonb,uuid,uuid) to authenticated;
create or replace function private.session_action(p_action text,p_session_id uuid default null,p_game_type_id text default null,p_name text default null,p_configuration jsonb default null,p_request_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.group_session_action(p_action,p_session_id,p_game_type_id,p_name,p_configuration,p_request_id,null); $$;
create function public.create_group_game_session(p_group_id uuid,p_game_type_id text,p_name text,p_configuration jsonb,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.group_session_action('create',p_game_type_id=>p_game_type_id,p_name=>p_name,p_configuration=>p_configuration,p_request_id=>p_request_id,p_group_id=>p_group_id); $$;
revoke all on function public.create_group(text,text,text) from public,anon,authenticated;
grant execute on function public.create_group(text,text,text) to authenticated;
revoke all on function public.list_my_groups() from public,anon,authenticated;
grant execute on function public.list_my_groups() to authenticated;
revoke all on function public.get_group(uuid) from public,anon,authenticated;
grant execute on function public.get_group(uuid) to authenticated;
revoke all on function public.update_group(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.update_group(uuid,text,text,text) to authenticated;
revoke all on function public.leave_group(uuid) from public,anon,authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
revoke all on function public.remove_group_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.remove_group_member(uuid,uuid) to authenticated;
revoke all on function public.transfer_group_ownership(uuid,uuid) from public,anon,authenticated;
grant execute on function public.transfer_group_ownership(uuid,uuid) to authenticated;
revoke all on function public.delete_group(uuid) from public,anon,authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
revoke all on function public.create_group_invite(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.create_group_invite(uuid,integer,integer) to authenticated;
revoke all on function public.revoke_group_invite(uuid,uuid) from public,anon,authenticated;
grant execute on function public.revoke_group_invite(uuid,uuid) to authenticated;
revoke all on function public.preview_group_invite(text) from public,anon,authenticated;
grant execute on function public.preview_group_invite(text) to authenticated;
revoke all on function public.redeem_group_invite(text) from public,anon,authenticated;
grant execute on function public.redeem_group_invite(text) to authenticated;

revoke all on function public.create_group_game_session(uuid,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.create_group_game_session(uuid,text,text,jsonb,uuid) to authenticated;

-- Account deletion cannot orphan a persistent group. Preserve the previous
-- self-service flow after the owner transfers or deletes their groups.
create or replace function private.delete_own_account() returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor();
begin
 if exists(select 1 from public.groups where owner_id=actor) then
  raise exception 'GROUP_OWNERSHIP_REQUIRED' using errcode='P0001';
 end if;
 delete from auth.users where id=actor;
end;
$$;
