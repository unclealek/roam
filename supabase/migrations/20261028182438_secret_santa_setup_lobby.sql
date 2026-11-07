-- Scope 06: setup and lobby only. No assignments, draw, or game completion.
update public.game_types set description='Exchange secret gifts and discover mysteries with friends.',min_players=3,max_players=100,availability_status='available',lifecycle_operations=array['create','join','leave','cancel'] where id='secret_santa';
create table private.currency_codes(code text primary key check(code ~ '^[A-Z]{3}$'));
alter table private.currency_codes enable row level security;
revoke all on private.currency_codes from public,anon,authenticated;
insert into private.currency_codes values ('AED'),('AFN'),('ALL'),('AMD'),('ANG'),('AOA'),('ARS'),('AUD'),('AWG'),('AZN'),('BAM'),('BBD'),('BDT'),('BGN'),('BHD'),('BIF'),('BMD'),('BND'),('BOB'),('BRL'),('BSD'),('BTN'),('BWP'),('BYN'),('BZD'),('CAD'),('CDF'),('CHF'),('CLP'),('CNY'),('COP'),('CRC'),('CUC'),('CUP'),('CVE'),('CZK'),('DJF'),('DKK'),('DOP'),('DZD'),('EGP'),('ERN'),('ETB'),('EUR'),('FJD'),('FKP'),('GBP'),('GEL'),('GHS'),('GIP'),('GMD'),('GNF'),('GTQ'),('GYD'),('HKD'),('HNL'),('HRK'),('HTG'),('HUF'),('IDR'),('ILS'),('INR'),('IQD'),('IRR'),('ISK'),('JMD'),('JOD'),('JPY'),('KES'),('KGS'),('KHR'),('KMF'),('KPW'),('KRW'),('KWD'),('KYD'),('KZT'),('LAK'),('LBP'),('LKR'),('LRD'),('LSL'),('LYD'),('MAD'),('MDL'),('MGA'),('MKD'),('MMK'),('MNT'),('MOP'),('MRU'),('MUR'),('MVR'),('MWK'),('MXN'),('MYR'),('MZN'),('NAD'),('NGN'),('NIO'),('NOK'),('NPR'),('NZD'),('OMR'),('PAB'),('PEN'),('PGK'),('PHP'),('PKR'),('PLN'),('PYG'),('QAR'),('RON'),('RSD'),('RUB'),('RWF'),('SAR'),('SBD'),('SCR'),('SDG'),('SEK'),('SGD'),('SHP'),('SLE'),('SLL'),('SOS'),('SRD'),('SSP'),('STN'),('SVC'),('SYP'),('SZL'),('THB'),('TJS'),('TMT'),('TND'),('TOP'),('TRY'),('TTD'),('TWD'),('TZS'),('UAH'),('UGX'),('USD'),('UYU'),('UZS'),('VES'),('VND'),('VUV'),('WST'),('XAF'),('XCD'),('XCG'),('XDR'),('XOF'),('XPF'),('XSU'),('YER'),('ZAR'),('ZMW'),('ZWG'),('ZWL');
create table public.secret_santa_settings(
 session_id uuid primary key references public.game_sessions on delete cascade,
 description text check(char_length(description)<=1000 and description !~ '[[:cntrl:]]'),
 joining_deadline timestamptz not null, exchange_date date not null,exchange_timezone text not null,
 budget_amount numeric(12,2) check(budget_amount>0 and budget_amount<1000000000),
 currency_code text not null references private.currency_codes,
 identity_reveal_enabled boolean not null default true,mind_match_enabled boolean not null default false,
 secret_agent_enabled boolean not null default false,secret_missions_enabled boolean not null default false,
 max_participants integer not null default 100 check(max_participants between 3 and 100),
 joining_closed_at timestamptz,lobby_phase text not null default 'joining_open' check(lobby_phase in ('joining_open','joining_closed','ready_for_draw','insufficient_players')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((lobby_phase='joining_open')=(joining_closed_at is null)),
 check(exchange_date>(joining_deadline at time zone exchange_timezone)::date)
);
alter table public.secret_santa_settings enable row level security;
revoke all on public.secret_santa_settings from public,anon,authenticated;
grant select on public.secret_santa_settings to authenticated;
create policy santa_participant_read on public.secret_santa_settings for select to authenticated using(private.is_session_member(session_id));
create index santa_open_deadlines on public.secret_santa_settings(joining_deadline,session_id) where lobby_phase='joining_open';
-- Session invitations reuse Scope 03's hash/preview/confirmation/limit pattern,
-- independently of persistent group membership. Plain codes are returned once.
create table private.session_invites(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references public.game_sessions on delete cascade,
 code_hash text not null unique,created_by uuid references auth.users on delete set null,
 expires_at timestamptz not null,revoked_at timestamptz,use_count integer not null default 0 check(use_count>=0),created_at timestamptz not null default now()
);
create table private.santa_requests(session_id uuid primary key references public.game_sessions on delete cascade,fingerprint text not null);
alter table private.santa_requests enable row level security;
revoke all on private.santa_requests from public,anon,authenticated;
create index session_invites_session on private.session_invites(session_id);
alter table private.session_invites enable row level security;
revoke all on private.session_invites from public,anon,authenticated;
-- Trusted registered activity handlers allow games to schedule non-gameplay
-- lifecycle actions. Registration is migration-only; clients cannot supply SQL.
create table private.activity_handlers(activity_type text primary key,handler text not null);
alter table private.activity_handlers enable row level security;
revoke all on private.activity_handlers from public,anon,authenticated;

insert into private.notification_templates values
 ('secret_santa_created','game_updates','Secret Santa is ready','Your gift exchange lobby is ready. Invite your friends!'),
 ('secret_santa_invitation','game_updates','Invite your friends','Your Secret Santa invitation is ready to share.'),
 ('secret_santa_player_joined','game_updates','A friend joined','Your Secret Santa circle is growing.'),
 ('secret_santa_joining_closing','reminders','Joining closes soon','Your Secret Santa joining deadline is approaching.'),
 ('secret_santa_joining_closed','game_updates','Joining has closed','Your Secret Santa participant list is now locked.'),
 ('secret_santa_ready_for_draw','game_updates','Ready for the next chapter','Your Secret Santa has enough participants for a draw.'),
 ('secret_santa_insufficient_players','game_updates','Your lobby needs attention','Invite at least three people in total. Extend joining or cancel the game.'),
 ('secret_santa_cancelled','game_updates','Secret Santa cancelled','Your host has cancelled this gift exchange.');

create function private.santa_config(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare k text; deadline timestamptz; day date; zone text; amount numeric; cap integer;
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>8192 then raise exception 'Invalid Secret Santa settings'; end if;
 for k in select jsonb_object_keys(p) loop
  if k not in ('description','joining_deadline','exchange_date','exchange_timezone','budget_amount','currency_code','identity_reveal_enabled','mind_match_enabled','secret_agent_enabled','secret_missions_enabled','max_participants') then raise exception 'Unknown Secret Santa setting'; end if;
 end loop;
 if p->>'joining_deadline' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' or p->>'exchange_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Use a UTC deadline and date-only exchange date'; end if;
 for k in select unnest(array['joining_deadline','exchange_date','exchange_timezone','currency_code']) loop
  if jsonb_typeof(p->k) is distinct from 'string' then raise exception 'Invalid date, timezone or currency';end if;
 end loop;
 if p ? 'max_participants' and jsonb_typeof(p->'max_participants')<>'number' then raise exception 'Invalid capacity';end if;
 if p ? 'description' and p->'description'<>'null'::jsonb and jsonb_typeof(p->'description')<>'string' then raise exception 'Invalid description';end if;
 deadline:=(p->>'joining_deadline')::timestamptz;day:=(p->>'exchange_date')::date;zone:=p->>'exchange_timezone';
 if deadline is null or not isfinite(deadline) or deadline<=clock_timestamp() then raise exception 'Joining deadline must be in the future'; end if;
 if zone is null or not exists(select 1 from pg_timezone_names where name=zone) then raise exception 'Invalid exchange timezone'; end if;
 if day is null or not isfinite(day) or day<=(deadline at time zone zone)::date then raise exception 'Exchange date must be after joining deadline'; end if;
 if not exists(select 1 from private.currency_codes where code=p->>'currency_code') then raise exception 'Choose an ISO 4217 currency'; end if;
 if p ? 'budget_amount' and p->'budget_amount'<>'null'::jsonb then
  if jsonb_typeof(p->'budget_amount')<>'number' then raise exception 'Invalid budget'; end if;
  amount:=(p->>'budget_amount')::numeric;
  if amount<=0 or amount>=1000000000 or amount<>round(amount,2) then raise exception 'Budget must be positive with at most two decimal places'; end if;
 end if;
 cap:=coalesce((p->>'max_participants')::integer,100);
 if cap not between 3 and 100 or (p ? 'max_participants' and (p->>'max_participants')::numeric<>cap) then raise exception 'Use 3 to 100 participants'; end if;
 for k in select unnest(array['identity_reveal_enabled','mind_match_enabled','secret_agent_enabled','secret_missions_enabled']) loop
  if p ? k and jsonb_typeof(p->k)<>'boolean' then raise exception 'Invalid activity option'; end if;
 end loop;
 if p->>'description' ~ '[[:cntrl:]]' or char_length(p->>'description')>1000 then raise exception 'Invalid description'; end if;
 return jsonb_build_object('description',nullif(btrim(p->>'description'),''),'joining_deadline',deadline,'exchange_date',day,'exchange_timezone',zone,'budget_amount',amount,'currency_code',p->>'currency_code','max_participants',cap,
 'identity_reveal_enabled',coalesce((p->>'identity_reveal_enabled')::boolean,true),'mind_match_enabled',coalesce((p->>'mind_match_enabled')::boolean,false),'secret_agent_enabled',coalesce((p->>'secret_agent_enabled')::boolean,false),'secret_missions_enabled',coalesce((p->>'secret_missions_enabled')::boolean,false));
end $$;
create function private.santa_document(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select private.session_document(p_id,true)||jsonb_build_object('settings',to_jsonb(t),'server_now',clock_timestamp(),
 'invitations',case when s.host_id=auth.uid() then coalesce((select jsonb_agg(to_jsonb(i)-array['code_hash','created_by']) from private.session_invites i where i.session_id=p_id),'[]'::jsonb) else '[]'::jsonb end)
 from public.secret_santa_settings t join public.game_sessions s on s.id=t.session_id where t.session_id=p_id;
$$;
create function private.santa_notice(p_user uuid,p_template text,p_session uuid,p_event text,p_push boolean default true) returns void language plpgsql security definer set search_path='' as $$
declare n uuid;
begin
 n:=private.emit_notification(p_user,p_template,p_session,p_event);
 if not p_push and n is not null then update private.notification_outbox set status='cancelled' where notification_id=n; end if;
end $$;
create function private.santa_close(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.game_sessions;t public.secret_santa_settings; n integer;m record;event text;
begin
 select * into s from public.game_sessions where id=p_id for update;
 select * into t from public.secret_santa_settings where session_id=p_id for update;
 if s.status<>'lobby' or t.lobby_phase<>'joining_open' then return; end if;
 select count(*) into n from public.game_session_members where session_id=p_id;
 update public.secret_santa_settings set joining_closed_at=clock_timestamp(),lobby_phase=case when n>=3 then 'ready_for_draw' else 'insufficient_players' end,updated_at=clock_timestamp() where session_id=p_id;
 event:=p_id::text||':'||t.updated_at::text;
 for m in select user_id from public.game_session_members where session_id=p_id loop
  perform private.santa_notice(m.user_id,'secret_santa_joining_closed',p_id,'santa:closed:'||event);
  if n>=3 then perform private.santa_notice(m.user_id,'secret_santa_ready_for_draw',p_id,'santa:ready:'||event,false); end if;
 end loop;
 if n<3 then perform private.santa_notice(s.host_id,'secret_santa_insufficient_players',p_id,'santa:attention:'||event); end if;
 update public.scheduled_activities set status='cancelled',updated_at=clock_timestamp() where game_session_id=p_id and activity_type in ('secret_santa_close','secret_santa_closing') and status='scheduled';
end $$;
create function private.santa_activity(p_activity uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.scheduled_activities;s public.game_sessions;t public.secret_santa_settings;m record;
begin
 select * into a from public.scheduled_activities where id=p_activity;
 select * into s from public.game_sessions where id=a.game_session_id for update;
 select * into t from public.secret_santa_settings where session_id=s.id;
 if s.status<>'lobby' or t.lobby_phase<>'joining_open' then update public.scheduled_activities set status='cancelled' where id=a.id;return;end if;
 if a.activity_type='secret_santa_close' then perform private.santa_close(s.id);
 else
  if t.joining_deadline<=clock_timestamp() then update public.scheduled_activities set status='cancelled' where id=a.id;return;end if;
  for m in select user_id from public.game_session_members where session_id=s.id loop
   perform private.santa_notice(m.user_id,'secret_santa_joining_closing',s.id,'santa:closing:'||a.id);
  end loop;
 end if;
 update public.scheduled_activities set status='completed',completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=a.id;
end $$;
insert into private.activity_handlers values('secret_santa_close','private.santa_activity(uuid)'),('secret_santa_closing','private.santa_activity(uuid)');
-- Extend the existing scheduler rather than creating another Cron job. The worker
-- retains bounded batches, SKIP LOCKED, per-row subtransactions and backoff.
do $$
declare def text;
begin
 def:=pg_get_functiondef('private.run_activity_scheduler_scope04(integer)'::regprocedure);
 def:=replace(def,$old$ or not exists(select 1 from public.game_sessions s where s.id=x.game_session_id and s.status='active')$old$,$new$ or (not exists(select 1 from private.activity_handlers h where h.activity_type=x.activity_type) and not exists(select 1 from public.game_sessions s where s.id=x.game_session_id and s.status='active'))$new$);
 def:=replace(def,$old$if not exists(select 1 from public.game_sessions where id=a.game_session_id and status='active') then$old$,$new$if exists(select 1 from private.activity_handlers where activity_type=a.activity_type) then
 execute format('select %s($1)',pg_catalog.to_regprocedure((select handler from private.activity_handlers where activity_type=a.activity_type))::oid::regproc) using a.id;
 elsif not exists(select 1 from public.game_sessions where id=a.game_session_id and status='active') then$new$);
 if strpos(def,'private.activity_handlers')=0 then raise exception 'Scheduler extension did not match the installed engine';end if;
 execute def;
end $$;
-- Dedicated module API. Generic session writes for this game are intercepted so
-- public generic join/update/start operations cannot bypass module rules.
alter function private.group_session_action(text,uuid,text,text,jsonb,uuid,uuid) rename to group_session_action_scope03;
revoke all on function private.group_session_action_scope03(text,uuid,text,text,jsonb,uuid,uuid) from public,anon,authenticated;

create function private.santa_schedule(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.secret_santa_settings;
begin
 select * into t from public.secret_santa_settings where session_id=p_id;
 update public.scheduled_activities set status='cancelled' where game_session_id=p_id and activity_type in ('secret_santa_close','secret_santa_closing') and status='scheduled';
 insert into public.scheduled_activities(game_session_id,activity_type,payload,status,unlock_at,idempotency_key)
 values(p_id,'secret_santa_close','{}','scheduled',t.joining_deadline,'santa:close:'||p_id||':'||t.joining_deadline||':'||t.updated_at);
 if t.joining_deadline-interval '1 day'>clock_timestamp() then
 insert into public.scheduled_activities(game_session_id,activity_type,payload,status,unlock_at,idempotency_key)
 values(p_id,'secret_santa_closing','{}','scheduled',t.joining_deadline-interval '1 day','santa:closing:'||p_id||':'||t.joining_deadline||':'||t.updated_at);
 end if;
end $$;
create function private.santa_invite(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare code text;i private.session_invites;
begin
 code:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into private.session_invites(session_id,code_hash,created_by,expires_at)
 select p_id,encode(sha256(convert_to(code,'UTF8')),'hex'),auth.uid(),joining_deadline from public.secret_santa_settings where session_id=p_id returning * into i;
 perform private.santa_notice(auth.uid(),'secret_santa_invitation',p_id,'santa:invite:'||i.id,false);
 return (to_jsonb(i)-array['code_hash','created_by'])||jsonb_build_object('code',code);
end $$;
create function private.santa_action(p_action text,p_id uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor();s public.game_sessions;t public.secret_santa_settings;c jsonb;doc jsonb;cfg jsonb;invite jsonb;i private.session_invites;n integer;gid uuid;target uuid;deadline timestamptz;
begin
 if p_action='group_lobbies' then
  gid:=(p_data->>'group_id')::uuid;
  if not private.is_group_member(gid) then raise exception 'Group access denied' using errcode='42501';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',gs.id,'name',gs.name,'joining_deadline',st.joining_deadline)) from public.game_sessions gs join public.secret_santa_settings st on st.session_id=gs.id where gs.group_id=gid and gs.status='lobby' and st.lobby_phase='joining_open' and st.joining_deadline>clock_timestamp()),'[]'::jsonb);
 end if;
 if p_action='create' then
  cfg:=p_data->'settings';gid:=(p_data->>'group_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||coalesce(p_data->>'request_id',''),0));
  -- Replay before the future-date check: a delayed retry returns the same lobby.
  select * into s from public.game_sessions where host_id=actor and creation_request_id=(p_data->>'request_id')::uuid for update;
  if s.id is not null then
   if s.game_type_id<>'secret_santa' or (select fingerprint from private.santa_requests where session_id=s.id) is distinct from encode(sha256(convert_to(jsonb_build_object('name',p_data->>'name','settings',cfg,'group',gid)::text,'UTF8')),'hex') then raise exception 'Creation request already used for different settings';end if;
   return private.santa_document(s.id);
  end if;
  c:=private.santa_config(cfg);
  doc:=private.group_session_action_scope03('create',null,'secret_santa',p_data->>'name','{}',(p_data->>'request_id')::uuid,gid);
  p_id:=(doc->>'id')::uuid;
  insert into private.santa_requests values(p_id,encode(sha256(convert_to(jsonb_build_object('name',p_data->>'name','settings',cfg,'group',gid)::text,'UTF8')),'hex'));
  -- Identity fingerprint is fixed by the engine trigger; module request evidence
  -- is stored separately rather than mutating immutable session identity.
  insert into public.secret_santa_settings(session_id,description,joining_deadline,exchange_date,exchange_timezone,budget_amount,currency_code,identity_reveal_enabled,mind_match_enabled,secret_agent_enabled,secret_missions_enabled,max_participants)
  values(p_id,c->>'description',(c->>'joining_deadline')::timestamptz,(c->>'exchange_date')::date,c->>'exchange_timezone',(c->>'budget_amount')::numeric,c->>'currency_code',(c->>'identity_reveal_enabled')::boolean,(c->>'mind_match_enabled')::boolean,(c->>'secret_agent_enabled')::boolean,(c->>'secret_missions_enabled')::boolean,(c->>'max_participants')::integer);
  update public.game_sessions set status='lobby' where id=p_id;
  perform private.santa_schedule(p_id);invite:=private.santa_invite(p_id);
  perform private.santa_notice(actor,'secret_santa_created',p_id,'santa:created:'||p_id,false);
  return private.santa_document(p_id)||jsonb_build_object('invitation',invite);
 end if;
 if p_action in ('preview','redeem') then
  -- Share the existing Scope 03 per-account attempt budget. Failures return
  -- values, so guesses cannot roll back the rate-limit increment.
  insert into private.group_invite_limits values(actor,clock_timestamp(),1) on conflict(user_id) do update set
   attempts=case when group_invite_limits.window_start<clock_timestamp()-interval '5 minutes' then 1 else group_invite_limits.attempts+1 end,
   window_start=case when group_invite_limits.window_start<clock_timestamp()-interval '5 minutes' then clock_timestamp() else group_invite_limits.window_start end returning attempts into n;
  if n>20 then return jsonb_build_object('error','rate_limited');end if;
  if p_data->>'code' is null or lower(p_data->>'code') !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','unavailable');end if;
  select * into i from private.session_invites where code_hash=encode(sha256(convert_to(lower(p_data->>'code'),'UTF8')),'hex');
  if not found then return jsonb_build_object('error','unavailable');end if;
  p_id:=i.session_id;
 end if;
 select * into s from public.game_sessions where id=p_id for update;
 select * into t from public.secret_santa_settings where session_id=p_id for update;
 if s.id is null or t.session_id is null then raise exception 'Session not found or access denied' using errcode='42501';end if;
 select count(*) into n from public.game_session_members where session_id=p_id;
 if p_action in ('preview','redeem','join') then
  if p_action<>'join' then
   select * into i from private.session_invites where session_invites.id=i.id for update;
   if i.revoked_at is not null or i.expires_at<=clock_timestamp() then return jsonb_build_object('error','unavailable');end if;
  elsif s.group_id is null then raise exception 'A session invitation is required';end if;
  if s.status<>'lobby' or t.lobby_phase<>'joining_open' or t.joining_deadline<=clock_timestamp() or (s.group_id is not null and not private.is_group_member(s.group_id)) or (n>=t.max_participants and not private.is_session_member(p_id)) then
   if p_action='join' then raise exception 'Joining is closed, full or not authorized';end if;
   return jsonb_build_object('error','unavailable');
  end if;
  if p_action='preview' then return jsonb_build_object('id',s.id,'name',s.name,'game_type_id','secret_santa','participant_count',n,'joining_deadline',t.joining_deadline,'exchange_date',t.exchange_date);end if;
  if not private.is_session_member(p_id) then
   insert into public.game_session_members(session_id,user_id,role) values(p_id,actor,'member');
   if p_action='redeem' then update private.session_invites set use_count=use_count+1 where id=i.id;end if;
   perform private.santa_notice(s.host_id,'secret_santa_player_joined',p_id,'santa:joined:'||p_id||':'||actor,false);
  end if;
  return private.santa_document(p_id);
 end if;
 if not private.is_session_member(p_id) then
  if p_action='get' and s.group_id is not null and private.is_group_member(s.group_id) then
   return jsonb_build_object('id',s.id,'name',s.name,'preview',true,'joining_deadline',t.joining_deadline,'participant_count',n,'can_join',s.status='lobby' and t.lobby_phase='joining_open' and t.joining_deadline>clock_timestamp());
  end if;
  raise exception 'Session access denied' using errcode='42501';
 end if;
 if p_action='get' then return private.santa_document(p_id);end if;
 if p_action='leave' then
  if actor=s.host_id then raise exception 'Host must cancel instead of leaving';end if;
  if s.status<>'lobby' or t.lobby_phase<>'joining_open' or t.joining_deadline<=clock_timestamp() then raise exception 'Participant membership is locked';end if;
  delete from public.game_session_members where session_id=p_id and user_id=actor;return 'null';
 end if;
 if s.host_id<>actor then raise exception 'Only the host may manage this lobby' using errcode='42501';end if;
 if p_action='cancel' then
  if s.status='cancelled' then return private.santa_document(p_id);end if;
  if s.status<>'lobby' then raise exception 'Cancellation is locked';end if;
  update public.game_sessions set status='cancelled' where id=p_id;
  update public.secret_santa_settings set joining_closed_at=coalesce(joining_closed_at,clock_timestamp()),lobby_phase='joining_closed',updated_at=clock_timestamp() where session_id=p_id;
  update public.scheduled_activities set status='cancelled' where game_session_id=p_id and status in ('scheduled','available');
  update private.session_invites set revoked_at=coalesce(revoked_at,clock_timestamp()) where session_id=p_id;
  perform private.santa_notice(m.user_id,'secret_santa_cancelled',p_id,'santa:cancelled:'||p_id) from public.game_session_members m where session_id=p_id;
  return private.santa_document(p_id);
 end if;
 if s.status<>'lobby' then raise exception 'Lobby is no longer editable';end if;
 if p_action='close' then perform private.santa_close(p_id);return private.santa_document(p_id);end if;
 if p_action='extend' then
  if t.lobby_phase='joining_open' and t.joining_deadline<=clock_timestamp() then perform private.santa_close(p_id);select * into t from public.secret_santa_settings where session_id=p_id;end if;
  if t.lobby_phase<>'insufficient_players' then raise exception 'Only insufficient lobbies may reopen';end if;
  c:=private.santa_config((to_jsonb(t)-array['session_id','joining_closed_at','lobby_phase','created_at','updated_at'])||jsonb_build_object('joining_deadline',p_data->>'joining_deadline'));
  update public.secret_santa_settings set joining_deadline=(c->>'joining_deadline')::timestamptz,joining_closed_at=null,lobby_phase='joining_open',updated_at=clock_timestamp() where session_id=p_id;
  perform private.santa_schedule(p_id);return private.santa_document(p_id);
 end if;
 if t.lobby_phase<>'joining_open' or t.joining_deadline<=clock_timestamp() then raise exception 'Lobby settings and participants are locked';end if;
 if p_action='edit' then
  c:=private.santa_config(p_data->'settings');
  if (c->>'max_participants')::integer<n then raise exception 'Capacity cannot be below current participants';end if;
  update public.game_sessions set name=btrim(p_data->>'name') where id=p_id;
  update public.secret_santa_settings set description=c->>'description',joining_deadline=(c->>'joining_deadline')::timestamptz,exchange_date=(c->>'exchange_date')::date,exchange_timezone=c->>'exchange_timezone',budget_amount=(c->>'budget_amount')::numeric,currency_code=c->>'currency_code',identity_reveal_enabled=(c->>'identity_reveal_enabled')::boolean,mind_match_enabled=(c->>'mind_match_enabled')::boolean,secret_agent_enabled=(c->>'secret_agent_enabled')::boolean,secret_missions_enabled=(c->>'secret_missions_enabled')::boolean,max_participants=(c->>'max_participants')::integer,updated_at=clock_timestamp() where session_id=p_id;
  if t.joining_deadline<>(c->>'joining_deadline')::timestamptz then perform private.santa_schedule(p_id);end if;
 elsif p_action='invite' then return private.santa_invite(p_id);
 elsif p_action='revoke' then update private.session_invites set revoked_at=coalesce(revoked_at,clock_timestamp()) where id=(p_data->>'invite_id')::uuid and session_id=p_id;
 elsif p_action='remove' then
  target:=(p_data->>'user_id')::uuid;
  if target=s.host_id then raise exception 'Cannot remove host';end if;
  delete from public.game_session_members where session_id=p_id and user_id=target;
 else raise exception 'Unsupported lobby operation';end if;
 return private.santa_document(p_id);
end $$;
create function public.secret_santa_lobby(p_action text,p_session_id uuid default null,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.santa_action(p_action,p_session_id,p_data); $$;
revoke all on function public.secret_santa_lobby(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.secret_santa_lobby(text,uuid,jsonb) to authenticated;
create function private.group_session_action(p_action text,p_session_id uuid default null,p_game_type_id text default null,p_name text default null,p_configuration jsonb default null,p_request_id uuid default null,p_group_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_game_type_id='secret_santa' and p_action='create' then raise exception 'Use the Secret Santa setup flow';end if;
 if exists(select 1 from public.game_sessions where id=p_session_id and game_type_id='secret_santa') then
  if p_action in ('get','join','leave','cancel') then return private.santa_action(p_action,p_session_id,'{}');
  else raise exception 'Use Secret Santa lobby controls. Drawing is not implemented.';end if;
 end if;
 return private.group_session_action_scope03(p_action,p_session_id,p_game_type_id,p_name,p_configuration,p_request_id,p_group_id);
end $$;
revoke all on function private.group_session_action(text,uuid,text,text,jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function private.group_session_action(text,uuid,text,text,jsonb,uuid,uuid) to authenticated;
-- Every new privileged helper is private, with a fixed empty search_path.
do $$ declare fn record;begin
 for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'santa_%' loop execute format('revoke all on function %s from public,anon,authenticated',fn.signature);end loop;
end $$;
grant execute on function private.santa_action(text,uuid,jsonb) to authenticated;
-- Invalidate the worker's cached scheduler binding after extending the handler.
do $$ begin execute pg_get_functiondef('public.notification_worker(text,jsonb)'::regprocedure);end $$;

-- Reusable notification eligibility guards recheck event validity after quiet
-- hours/retries. A template guard is installed only by trusted migrations.
create table private.notification_event_guards(template_key text primary key references private.notification_templates(key),validator text not null);
alter table private.notification_event_guards enable row level security;
revoke all on private.notification_event_guards from public,anon,authenticated;
create function private.notification_event_allowed(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare fn text;allowed boolean;
begin
 select g.validator into fn from private.notification_event_guards g join public.user_notifications n on n.template_key=g.template_key where n.id=p_id;
 if fn is null then return true;end if;
 execute format('select %s($1)',pg_catalog.to_regprocedure(fn)::oid::regproc) into allowed using p_id;
 return coalesce(allowed,false);
end $$;
create function private.santa_reminder_allowed(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_notifications n join public.game_sessions s on s.id=n.related_session_id join public.secret_santa_settings t on t.session_id=s.id join public.game_session_members m on m.session_id=s.id and m.user_id=n.user_id where n.id=p_id and s.status='lobby' and t.lobby_phase='joining_open' and t.joining_deadline>clock_timestamp());
$$;
insert into private.notification_event_guards values('secret_santa_joining_closing','private.santa_reminder_allowed(uuid)');
revoke all on function private.notification_event_allowed(uuid),private.santa_reminder_allowed(uuid) from public,anon,authenticated;
do $$ declare def text;begin
 def:=pg_get_functiondef('public.notification_worker(text,jsonb)'::regprocedure);
 def:=replace(def,$old$select * into n from public.user_notifications where id=o.notification_id;
 if o.activity_id is not null then$old$,$new$select * into n from public.user_notifications where id=o.notification_id;
 if not private.notification_event_allowed(n.id) then update private.notification_outbox set status='cancelled' where id=o.id;continue;end if;
 if o.activity_id is not null then$new$);
 def:=replace(def,$old$if pref.user_id is null or not private.push_allowed(pref,n.category,now())$old$,$new$if pref.user_id is null or not private.notification_event_allowed(n.id) or not private.push_allowed(pref,n.category,now())$new$);
 if strpos(def,'if not private.notification_event_allowed(n.id) then')=0 or strpos(def,'or not private.notification_event_allowed(n.id)')=0 then raise exception 'Notification worker guard extension did not match';end if;
 execute def;
end $$;
