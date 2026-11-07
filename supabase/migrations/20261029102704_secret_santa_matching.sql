-- Scope 07. Randomness and the complete transaction live in trusted PostgreSQL.
alter table public.secret_santa_settings drop constraint secret_santa_settings_lobby_phase_check;
alter table public.secret_santa_settings add constraint secret_santa_settings_lobby_phase_check check(lobby_phase in ('joining_open','joining_closed','ready_for_draw','insufficient_players','drawing','matched','draw_failed'));
alter table public.secret_santa_settings add column matched_at timestamptz;
alter table public.secret_santa_settings add column recovery_required boolean not null default false;
create table private.secret_santa_assignments(
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.secret_santa_settings(session_id) on delete cascade,
 giver_id uuid not null,recipient_id uuid not null,created_at timestamptz not null default now(),revealed_at timestamptz,
 unique(session_id,giver_id),unique(session_id,recipient_id),check(giver_id<>recipient_id),
 foreign key(session_id,giver_id) references public.game_session_members(session_id,user_id) deferrable initially deferred,
 foreign key(session_id,recipient_id) references public.game_session_members(session_id,user_id) deferrable initially deferred
);
alter table private.secret_santa_assignments enable row level security;
revoke all on private.secret_santa_assignments from public,anon,authenticated;
insert into private.notification_templates values
 ('secret_santa_draw_started','game_updates','The draw is underway','Your gift circle is being matched.'),
 ('secret_santa_assignment_ready','game_updates','Your secret assignment is ready! 🎁','Open Roam to privately reveal your recipient.'),
 ('secret_santa_draw_failed','game_updates','Your draw needs attention','Joining is locked. Roam will safely retry the draw.'),
 ('secret_santa_game_started','game_updates','Game Started','Your Secret Santa season has begun.');

-- UUIDv4 uses PostgreSQL's cryptographic RNG. Its FIRST 32 bits are entirely
-- random (no version/variant bits). Rejection sampling removes modulo bias.
create function private.santa_random_below(bound integer) returns integer language plpgsql volatile security invoker set search_path='' as $$
declare r bigint; lim bigint;
begin
 if bound<1 or bound>100 then raise exception 'Invalid random bound';end if;
 lim:=4294967296-(4294967296 % bound);
 loop
  r:=('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint;
  if r<lim then return (r % bound)::integer;end if;
 end loop;
end $$;
create function private.santa_draw(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare s public.game_sessions;t public.secret_santa_settings;ids uuid[];n integer;i integer;j integer;tmp uuid;m record;
begin
 select * into s from public.game_sessions where id=p_id for update;
 select * into t from public.secret_santa_settings where session_id=p_id for update;
 if t.lobby_phase='matched' then return true;end if;
 if s.status<>'lobby' or t.session_id is null then raise exception 'Draw unavailable';end if;
 select array_agg(user_id order by user_id) into ids from public.game_session_members where session_id=p_id;
 n:=coalesce(array_length(ids,1),0);
 if n<3 then
  if t.joining_closed_at is not null then
   update public.secret_santa_settings set lobby_phase='insufficient_players',updated_at=clock_timestamp() where session_id=p_id;
   perform private.santa_notice(s.host_id,'secret_santa_insufficient_players',p_id,'santa:draw-insufficient:'||p_id);
  end if;
  return false;
 end if;
 if n>t.max_participants or n>100 then raise exception 'Invalid participant count';end if;
 -- Closure and its permanent lock survive a failed matching subtransaction.
 if t.lobby_phase='joining_open' then perform private.santa_close(p_id);end if;
 update public.secret_santa_settings set lobby_phase='drawing',updated_at=clock_timestamp() where session_id=p_id;
 begin
  for i in reverse n..2 loop
   j:=private.santa_random_below(i)+1;tmp:=ids[i];ids[i]:=ids[j];ids[j]:=tmp;
  end loop;
  for i in 1..n loop
   insert into private.secret_santa_assignments(session_id,giver_id,recipient_id) values(p_id,ids[i],ids[(i % n)+1]);
  end loop;
  -- Explicitly validate full membership coverage and the single-cycle property.
  if (select count(*) from private.secret_santa_assignments where session_id=p_id)<>n or
     (with recursive walk(id,depth) as (
       select ids[1],0 union all
       select a.recipient_id,w.depth+1 from walk w join private.secret_santa_assignments a on a.session_id=p_id and a.giver_id=w.id where w.depth<n
      ) select count(distinct id)<>n or max(depth)<>n from walk) then raise exception 'Invalid draw';end if;
  update public.secret_santa_settings set lobby_phase='matched',matched_at=clock_timestamp(),updated_at=clock_timestamp() where session_id=p_id;
  update public.game_sessions set status='active' where id=p_id;
  -- In-app started events avoid two back-to-back pushes at instant completion.
  for m in select user_id from public.game_session_members where session_id=p_id loop
   perform private.santa_notice(m.user_id,'secret_santa_draw_started',p_id,'santa:draw:'||p_id,false);
   perform private.santa_notice(m.user_id,'secret_santa_assignment_ready',p_id,'santa:assignment:'||p_id);
   perform private.santa_notice(m.user_id,'secret_santa_game_started',p_id,'santa:started:'||p_id,false);
  end loop;
  return true;
 exception when others then
  -- All assignments, active state, timestamps and success notices roll back.
  -- Never store SQLERRM: constraint errors can contain private identities.
  update public.secret_santa_settings set lobby_phase='draw_failed',updated_at=clock_timestamp() where session_id=p_id;
  perform private.santa_notice(s.host_id,'secret_santa_draw_failed',p_id,'santa:draw-failed:'||p_id);
  return false;
 end;
end $$;

create function private.santa_draw_activity(p_activity uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.scheduled_activities;t public.secret_santa_settings;s public.game_sessions;
begin
 select * into a from public.scheduled_activities where id=p_activity;
 select * into s from public.game_sessions where id=a.game_session_id for update;
 select * into t from public.secret_santa_settings where session_id=s.id;
 if t.lobby_phase='matched' or s.status<>'lobby' then
  update public.scheduled_activities set status='completed',completed_at=clock_timestamp() where id=a.id;return;
 end if;
 if t.joining_closed_at is null or t.lobby_phase='insufficient_players' then
  update public.scheduled_activities set status='cancelled' where id=a.id;return;
 end if;
 if private.santa_draw(s.id) then
  update public.scheduled_activities set status='completed',completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=a.id;
 else
  update public.scheduled_activities set processing_attempts=processing_attempts+1,next_attempt_at=clock_timestamp()+interval '30 seconds'*power(2,least(processing_attempts+1,7)),last_error='Draw requires attention' where id=a.id;
 end if;
end $$;
insert into private.activity_handlers values('secret_santa_draw','private.santa_draw_activity(uuid)');
-- Every closure schedules a distinct, idempotent draw event. The existing worker
-- picks it up with its normal SKIP LOCKED/backoff loop, including after a restart.
alter function private.santa_close(uuid) rename to santa_close_scope06;
create function private.santa_close(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.santa_close_scope06(p_id);
 insert into public.scheduled_activities(game_session_id,activity_type,payload,status,unlock_at,idempotency_key)
 select p_id,'secret_santa_draw','{}','scheduled',clock_timestamp(),'santa:draw:'||p_id from public.secret_santa_settings where session_id=p_id and lobby_phase in ('ready_for_draw','draw_failed')
 on conflict do nothing;
end $$;
-- A close event arriving late must still close first. The previous handler checks
-- its deadline and never accepts client-supplied activity types or SQL.
do $$ begin execute pg_get_functiondef('private.santa_activity(uuid)'::regprocedure);end $$;
-- Existing ready lobbies also become eligible for automatic matching.
insert into public.scheduled_activities(game_session_id,activity_type,payload,status,unlock_at,idempotency_key)
select session_id,'secret_santa_draw','{}','scheduled',clock_timestamp(),'santa:draw:'||session_id from public.secret_santa_settings t join public.game_sessions s on s.id=t.session_id where t.lobby_phase='ready_for_draw' and s.status='lobby' on conflict do nothing;

-- Extend the one module API. Callers can never choose a giver or provide a map.
alter function private.santa_action(text,uuid,jsonb) rename to santa_action_scope06;
create function private.santa_action(p_action text,p_id uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor();s public.game_sessions;t public.secret_santa_settings;a private.secret_santa_assignments;recipient text;ok boolean;
begin
 if p_action not in ('draw','assignment','reveal') then
  -- Scope 06 config validation must omit the newly added server-owned fields.
  return private.santa_action_scope06(p_action,p_id,p_data);
 end if;
 if p_data<>'{}'::jsonb then raise exception 'Invalid assignment request' using errcode='42501';end if;
 select * into s from public.game_sessions where id=p_id for update;
 select * into t from public.secret_santa_settings where session_id=p_id;
 if s.id is null or t.session_id is null or not private.is_session_member(p_id) then raise exception 'Assignment unavailable' using errcode='42501';end if;
 if p_action='draw' then
  if s.host_id<>actor then raise exception 'Only the host may start the draw' using errcode='42501';end if;
  if t.lobby_phase='matched' then return private.santa_document(p_id);end if;
  if (select count(*) from public.game_session_members where session_id=p_id)<3 then raise exception 'At least three participants are required';end if;
  if s.status<>'lobby' then raise exception 'Draw unavailable';end if;
  perform private.santa_close(p_id);
  ok:=private.santa_draw(p_id);
  return private.santa_document(p_id);
 end if;
 if t.lobby_phase<>'matched' or s.status<>'active' then raise exception 'Assignment unavailable';end if;
 select * into a from private.secret_santa_assignments where session_id=p_id and giver_id=actor;
 if a.id is null then raise exception 'Assignment unavailable';end if;
 if p_action='reveal' then
  update private.secret_santa_assignments set revealed_at=coalesce(revealed_at,clock_timestamp()) where id=a.id returning * into a;
 end if;
 -- Before the explicit reveal even the API response contains no recipient name.
 if a.revealed_at is not null then select display_name into recipient from public.profiles where id=a.recipient_id;end if;
 return jsonb_build_object('session_id',p_id,'name',s.name,'status',s.status,'settings',to_jsonb(t),'server_now',clock_timestamp(),'revealed_at',a.revealed_at,
 'recipient',case when a.revealed_at is null then null else jsonb_build_object('display_name',coalesce(recipient,'Participant unavailable'),'available',recipient is not null) end);
end $$;
-- Rebind dependent SQL wrappers after renaming implementations.
create or replace function public.secret_santa_lobby(p_action text,p_session_id uuid default null,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.santa_action(p_action,p_session_id,p_data); $$;
do $$ declare def text;begin
 def:=pg_get_functiondef('private.santa_action_scope06(text,uuid,jsonb)'::regprocedure);
 def:=replace(def,$old$'created_at','updated_at']$old$,$new$'created_at','updated_at','matched_at','recovery_required']$new$);execute def;
 execute pg_get_functiondef('private.group_session_action(text,uuid,text,text,jsonb,uuid,uuid)'::regprocedure);
end $$;

-- Preserve matched identities as tombstones on account deletion. All ordinary
-- writes remain RPC-only. Unmatched sessions retain their prior cascade behavior.
-- A non-exposed identity reference retains UUIDs only, never deleted profiles.
-- Replacement FKs preserve database referential integrity for all game modules.
create table private.session_account_refs(user_id uuid primary key,deleted_at timestamptz);
alter table private.session_account_refs enable row level security;
revoke all on private.session_account_refs from public,anon,authenticated;
insert into private.session_account_refs(user_id) select id from auth.users;
create function private.santa_account_reference() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into private.session_account_refs(user_id) values(new.id) on conflict(user_id) do update set deleted_at=null;return new;end $$;
create trigger santa_account_reference after insert on auth.users for each row execute function private.santa_account_reference();
alter table public.game_sessions drop constraint game_sessions_host_id_fkey;
alter table public.game_session_members drop constraint game_session_members_user_id_fkey;
alter table public.game_sessions add constraint game_sessions_host_account_ref_fkey foreign key(host_id) references private.session_account_refs(user_id);
alter table public.game_session_members add constraint game_session_members_account_ref_fkey foreign key(user_id) references private.session_account_refs(user_id);

create function private.santa_deleted_account() returns trigger language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 update private.session_account_refs set deleted_at=clock_timestamp() where user_id=old.id;
 -- Same ordering/lock as draws and joins: deletion cannot race the roster load.
 for sid in select distinct s.id from public.game_sessions s join public.game_session_members m on m.session_id=s.id where m.user_id=old.id or s.host_id=old.id order by s.id loop
  perform 1 from public.game_sessions where id=sid for update;
 end loop;
 update public.secret_santa_settings t set recovery_required=true where t.lobby_phase='matched' and exists(select 1 from public.game_session_members m where m.session_id=t.session_id and m.user_id=old.id);
 delete from public.game_sessions s where s.host_id=old.id and not exists(select 1 from public.secret_santa_settings t where t.session_id=s.id and t.lobby_phase='matched');
 delete from public.game_session_members m where m.user_id=old.id and not exists(select 1 from public.secret_santa_settings t where t.session_id=m.session_id and t.lobby_phase='matched');
 return old;
end $$;
create trigger santa_preserve_deleted_account before delete on auth.users for each row execute function private.santa_deleted_account();
-- Preserve the participant row with an anonymous label once its profile is gone.
do $$ declare def text;begin
 def:=pg_get_functiondef('private.session_document(uuid,boolean)'::regprocedure);
 def:=replace(def,'join public.profiles p on p.id=m.user_id','left join public.profiles p on p.id=m.user_id');
 def:=replace(def,'(select display_name from public.profiles where id=s.host_id)', $host$coalesce((select display_name from public.profiles where id=s.host_id),'Participant unavailable')$host$);
 def:=replace(def,$old$'display_name',p.display_name$old$,$new$'display_name',coalesce(p.display_name,'Participant unavailable')$new$);execute def;
end $$;
-- Replacement integrity checks for host/member live-user inserts, plus a DB-level
-- membership lock (not just UI). Deleted matched members are never reassigned.
create function private.santa_roster_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare sid uuid:=case when TG_OP='DELETE' then old.session_id else new.session_id end;t public.secret_santa_settings;
begin
 perform 1 from public.game_sessions where id=sid for update;
 if not found and TG_OP='DELETE' then return old;end if;
 select * into t from public.secret_santa_settings where session_id=sid;
 if TG_OP<>'DELETE' then
  perform 1 from auth.users where id=new.user_id for key share;
  if not found then raise exception 'Participant unavailable';end if;
 end if;
 if t.lobby_phase in ('drawing','matched','draw_failed') then raise exception 'Participant membership is locked';end if;
 if TG_OP='DELETE' then return old;end if;return new;
end $$;
create trigger santa_roster_lock before insert or update or delete on public.game_session_members for each row execute function private.santa_roster_guard();
-- New privileged helpers have no default PUBLIC execute. Only the dispatch entry
-- point is callable by an authenticated account; private tables have no policies.
do $$ declare fn record;begin
 for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'santa_%' loop execute format('revoke all on function %s from public,anon,authenticated',fn.signature);end loop;
end $$;
grant execute on function private.santa_action(text,uuid,jsonb) to authenticated;

-- The host FK is replaced by an insert check because matched host IDs must survive
-- deletion. Session identity is already immutable under game_session_guard.
create function private.santa_host_exists() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from auth.users where id=new.host_id for key share;
 if not found then raise exception 'Host unavailable';end if;
 return new;
end $$;
create trigger santa_host_exists before insert on public.game_sessions for each row execute function private.santa_host_exists();
revoke all on function private.santa_host_exists() from public,anon,authenticated;
