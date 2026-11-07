-- Scope 02. Every mutation uses a trusted RPC; clients receive SELECT only.
create table public.game_types (
 id text primary key check (id ~ '^[a-z][a-z0-9_]{0,63}$'),
 name text not null, description text not null, category text not null,
 icon_ref text not null,
 min_players integer not null check(min_players >= 1),
 max_players integer check(max_players >= min_players),
 availability_status text not null check(availability_status in ('available','coming_soon','unavailable')),
 configuration_schema jsonb not null check (coalesce(
   configuration_schema->>'type' = 'object'
   and configuration_schema->'additionalProperties' = 'false'::jsonb
   and jsonb_typeof(configuration_schema->'properties') = 'object'
   and jsonb_typeof(configuration_schema->'required') = 'array',false)),
 lifecycle_operations text[] not null default '{}' check(lifecycle_operations <@ array['create','open_lobby','join','leave','start','cancel']::text[]),
 created_at timestamptz not null default now()
);
insert into public.game_types(id,name,description,category,icon_ref,min_players,max_players,availability_status,configuration_schema,lifecycle_operations)
values ('secret_santa','Secret Santa','Exchange secret gifts, discover clues and play mystery challenges with friends.','Social / Mystery','gift',2,null,'coming_soon','{"type":"object","properties":{},"required":[],"additionalProperties":false}','{}');

create table public.game_sessions (
 id uuid primary key default gen_random_uuid(),
 game_type_id text not null references public.game_types(id),
 host_id uuid not null references auth.users(id) on delete cascade,
 -- Scope 03 will replace this constraint with a groups FK and group authorization.
 group_id uuid check(group_id is null),
 name text not null check(char_length(name) between 1 and 120 and name=btrim(name) and name !~ '[[:cntrl:]]'),
 configuration jsonb not null,
 status text not null default 'draft' check(status in ('draft','lobby','active','completed','cancelled','failed')),
 created_at timestamptz not null default now(),
 started_at timestamptz,
 completed_at timestamptz,
 creation_request_id uuid not null,
 creation_fingerprint text not null,
 unique(host_id,creation_request_id),
 check((status not in ('active','completed') or started_at is not null) and (status<>'draft' or started_at is null)),
 check((status='completed') = (completed_at is not null)),
 check(started_at is null or started_at>=created_at),
 check(completed_at is null or completed_at>=started_at)
);
create index game_sessions_host_created_idx on public.game_sessions(host_id,created_at desc);
create index game_sessions_game_status_idx on public.game_sessions(game_type_id,status);
create table public.game_session_members (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.game_sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 role text not null check(role in ('host','member')),
 unique(session_id,user_id)
);
create index game_session_members_user_idx on public.game_session_members(user_id,session_id);
create unique index game_session_single_host_idx on public.game_session_members(session_id) where role='host';

-- Strict, deliberately limited JSON Schema subset. Trusted migrations register schemas;
-- adding a module using these scalar contracts does not require changing this engine.
create function private.valid_game_configuration(p_schema jsonb,p_config jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare field text; value jsonb; rule jsonb; required_field text; n numeric;
begin
 if p_config is null or jsonb_typeof(p_config)<>'object' or octet_length(p_config::text)>16384 then return false; end if;
 for required_field in select jsonb_array_elements_text(p_schema->'required') loop
   if not (p_config ? required_field) then return false; end if;
 end loop;
 for field,value in select * from jsonb_each(p_config) loop
   if not (p_schema->'properties' ? field) then return false; end if;
   rule := p_schema->'properties'->field;
   case rule->>'type'
    when 'integer' then
     if jsonb_typeof(value)<>'number' then return false; end if;
     n := (value::text)::numeric;
     if n<>trunc(n) or abs(n)>9007199254740991 or (rule ? 'minimum' and n<(rule->>'minimum')::numeric) or (rule ? 'maximum' and n>(rule->>'maximum')::numeric) then return false; end if;
    when 'string' then
     if jsonb_typeof(value)<>'string' or (rule ? 'minLength' and char_length(value#>>'{}')<(rule->>'minLength')::integer) or (rule ? 'maxLength' and char_length(value#>>'{}')>(rule->>'maxLength')::integer) then return false; end if;
    when 'boolean' then if jsonb_typeof(value)<>'boolean' then return false; end if;
    else return false;
   end case;
 end loop;
 return true;
end;
$$;
revoke all on function private.valid_game_configuration(jsonb,jsonb) from public,anon,authenticated;

create function private.guard_game_session() returns trigger
language plpgsql security invoker set search_path='' as $$
declare schema jsonb;
begin
 select configuration_schema into schema from public.game_types where id=new.game_type_id;
 if schema is null or not private.valid_game_configuration(schema,new.configuration) then
   raise exception 'Invalid game configuration' using errcode='22023';
 end if;
 if TG_OP='INSERT' then
   if new.status<>'draft' or new.started_at is not null or new.completed_at is not null then raise exception 'Sessions must begin as drafts'; end if;
 else
   if (new.id,new.game_type_id,new.host_id,new.group_id,new.created_at,new.creation_request_id,new.creation_fingerprint) is distinct from (old.id,old.game_type_id,old.host_id,old.group_id,old.created_at,old.creation_request_id,old.creation_fingerprint) then raise exception 'Session identity is immutable'; end if;
   if old.status not in ('draft','lobby') and (new.name,new.configuration) is distinct from (old.name,old.configuration) then raise exception 'Session settings are locked'; end if;
   if new.status<>old.status then
    if not ((old.status='draft' and new.status in ('lobby','cancelled')) or (old.status='lobby' and new.status in ('active','cancelled','failed')) or (old.status='active' and new.status in ('completed','cancelled','failed'))) then raise exception 'Invalid session transition'; end if;
   end if;
   new.started_at := case when new.status='active' and old.status='lobby' then now() else old.started_at end;
   new.completed_at := case when new.status='completed' and old.status='active' then now() else old.completed_at end;
 end if;
 return new;
end;
$$;
revoke all on function private.guard_game_session() from public,anon,authenticated;
create trigger game_session_guard before insert or update on public.game_sessions for each row execute function private.guard_game_session();

create function private.active_actor() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
begin
 if actor is null or sid is null or not exists(select 1 from auth.sessions where id=sid and user_id=actor) then raise exception 'An active authenticated session is required' using errcode='42501'; end if;
 return actor;
end;
$$;
revoke all on function private.active_actor() from public,anon,authenticated;
grant execute on function private.active_actor() to authenticated;

-- Definer lookup prevents recursive RLS on the membership table. No caller id argument.
create function private.is_session_member(p_session_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.game_session_members m join auth.sessions s on s.user_id=m.user_id
 where m.session_id=p_session_id and m.user_id=auth.uid() and s.id=nullif(auth.jwt()->>'session_id','')::uuid);
$$;
revoke all on function private.is_session_member(uuid) from public,anon,authenticated;
grant execute on function private.is_session_member(uuid) to authenticated;

alter table public.game_types enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_session_members enable row level security;
revoke all on public.game_types,public.game_sessions,public.game_session_members from public,anon,authenticated;
grant select on public.game_types,public.game_sessions,public.game_session_members to authenticated;
create policy game_catalog_read on public.game_types for select to authenticated using ((select private.active_actor()) is not null);
create policy sessions_member_read on public.game_sessions for select to authenticated using (private.is_session_member(id));
create policy session_members_read on public.game_session_members for select to authenticated using (private.is_session_member(session_id));

-- Internal projection: callers are authorized by session_action before this is invoked.
create function private.session_document(p_session_id uuid,p_details boolean default false) returns jsonb
language sql stable security definer set search_path='' as $$
 select (to_jsonb(s)-array['creation_request_id','creation_fingerprint']) || jsonb_build_object('participant_count',(select count(*) from public.game_session_members m where m.session_id=s.id)) ||
 case when p_details then jsonb_build_object(
 'host',jsonb_build_object('id',s.host_id,'display_name',(select display_name from public.profiles where id=s.host_id)),
 'participants',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'display_name',p.display_name,'role',m.role,'joined_at',m.joined_at) order by m.joined_at,m.id) from public.game_session_members m join public.profiles p on p.id=m.user_id where m.session_id=s.id),'[]'::jsonb)) else '{}'::jsonb end
 from public.game_sessions s where s.id=p_session_id;
$$;
revoke all on function private.session_document(uuid,boolean) from public,anon,authenticated;

-- One authorization/lifecycle boundary for all public wrappers. The session row lock
-- serializes joins, capacity checks, leaving, settings, and starts across transactions.
create function private.session_action(p_action text,p_session_id uuid default null,p_game_type_id text default null,p_name text default null,p_configuration jsonb default null,p_request_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; s public.game_sessions; g public.game_types; fingerprint text; member_count integer;
begin
 actor:=private.active_actor();
 if p_action='list' then
   return coalesce((select jsonb_agg(private.session_document(gs.id) order by gs.created_at desc,gs.id) from public.game_sessions gs join public.game_session_members gm on gm.session_id=gs.id where gm.user_id=actor),'[]'::jsonb);
 end if;
 if p_action='create' then
   select * into g from public.game_types where id=p_game_type_id;
   if not found or g.availability_status<>'available' or not ('create'=any(g.lifecycle_operations)) then raise exception 'Game is not available for sessions' using errcode='22023'; end if;
   if p_request_id is null then raise exception 'A creation request ID is required'; end if;
   if p_name is null or not private.valid_game_configuration(g.configuration_schema,p_configuration) then raise exception 'Invalid session name or configuration' using errcode='22023'; end if;
   fingerprint:=encode(sha256(convert_to(jsonb_build_object('game',p_game_type_id,'name',btrim(p_name),'configuration',p_configuration)::text,'UTF8')),'hex');
   insert into public.game_sessions(game_type_id,host_id,name,configuration,creation_request_id,creation_fingerprint)
   values(p_game_type_id,actor,btrim(p_name),p_configuration,p_request_id,fingerprint)
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
   -- Opening a lobby is an explicit opt-in: any authenticated user with its UUID can join.
   -- Drafts are never joinable. No lobby discovery, invitation, or group access is added here.
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
revoke all on function private.session_action(text,uuid,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.session_action(text,uuid,text,text,jsonb,uuid) to authenticated;

create function public.create_game_session(p_game_type_id text,p_name text,p_configuration jsonb,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.session_action('create',p_game_type_id=>p_game_type_id,p_name=>p_name,p_configuration=>p_configuration,p_request_id=>p_request_id); $$;
revoke all on function public.create_game_session(text,text,jsonb,uuid) from public,anon;
grant execute on function public.create_game_session(text,text,jsonb,uuid) to authenticated;

create function public.list_my_game_sessions() returns jsonb language sql security invoker set search_path='' as $$ select private.session_action('list'); $$;
revoke all on function public.list_my_game_sessions() from public,anon;
grant execute on function public.list_my_game_sessions() to authenticated;

create function public.get_game_session(p_session_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.session_action('get',p_session_id); $$;
revoke all on function public.get_game_session(uuid) from public,anon;
grant execute on function public.get_game_session(uuid) to authenticated;

create function public.update_game_session(p_session_id uuid,p_name text,p_configuration jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.session_action('update',p_session_id,p_name=>p_name,p_configuration=>p_configuration); $$;
revoke all on function public.update_game_session(uuid,text,jsonb) from public,anon;
grant execute on function public.update_game_session(uuid,text,jsonb) to authenticated;

create function public.join_game_session(p_session_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.session_action('join',p_session_id); $$;
revoke all on function public.join_game_session(uuid) from public,anon;
grant execute on function public.join_game_session(uuid) to authenticated;

create function public.leave_game_session(p_session_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.session_action('leave',p_session_id); $$;
revoke all on function public.leave_game_session(uuid) from public,anon;
grant execute on function public.leave_game_session(uuid) to authenticated;

create function public.start_game_session(p_session_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.session_action('start',p_session_id); $$;
revoke all on function public.start_game_session(uuid) from public,anon;
grant execute on function public.start_game_session(uuid) to authenticated;

create function public.cancel_game_session(p_session_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.session_action('cancel',p_session_id); $$;
revoke all on function public.cancel_game_session(uuid) from public,anon;
grant execute on function public.cancel_game_session(uuid) to authenticated;

create function public.open_game_lobby(p_session_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.session_action('open_lobby',p_session_id); $$;
revoke all on function public.open_game_lobby(uuid) from public,anon;
grant execute on function public.open_game_lobby(uuid) to authenticated;
