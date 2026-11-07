-- Scope 05. Catalog configuration is migration-owned; rewards derive from trusted state.
create table private.reward_event_registry (
 event_key text primary key check(event_key ~ '^[a-z][a-z0-9_]{0,63}$'),
 scope text not null check(scope in ('user','session','activity')),
 required_game_key text, validator regprocedure
);
create table private.reward_milestone_registry (
 key text primary key, required_game_key text, validator regprocedure
);
create table private.reward_accounts (user_id uuid primary key references auth.users on delete cascade);
create table public.reward_definitions (
 id text primary key, event_key text not null references private.reward_event_registry,
 game_type_id text references public.game_types, xp_amount integer not null check(xp_amount between 0 and 100000),
 is_active boolean not null default false, created_at timestamptz not null default now()
);
create unique index reward_definition_event_game on public.reward_definitions(event_key,coalesce(game_type_id,''));
create table public.level_thresholds (
 level integer primary key check(level>=1), xp_required bigint not null unique check(xp_required between 0 and 9007199254740991)
);
insert into public.level_thresholds values(1,0),(2,100),(3,250),(4,500),(5,850),(6,1300),(7,1850),(8,2500);
-- Only ordered, contiguous thresholds are accepted; a migration can replace the
-- whole configuration in a transaction. Deferred checking avoids row-order dependence.
create function private.guard_level_thresholds() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.level_thresholds where level=1 and xp_required=0)
 or exists(select 1 from (select level,xp_required,row_number() over(order by level) as position,lag(xp_required) over(order by level) as prev from public.level_thresholds) t where t.level<>t.position or t.xp_required<=t.prev) then raise exception 'Invalid level thresholds'; end if;
 return null;
end $$;
create constraint trigger level_thresholds_guard after insert or update or delete on public.level_thresholds deferrable initially deferred for each row execute function private.guard_level_thresholds();
create table public.xp_transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 game_session_id uuid references public.game_sessions on delete set null, game_type_id text references public.game_types,
 reward_definition_id text not null references public.reward_definitions,
 amount integer not null check(amount>=0), idempotency_key text not null,
 source_event_key text not null references private.reward_event_registry, source_id uuid not null, source_session_id uuid not null,
 created_at timestamptz not null default now(), unique(user_id,idempotency_key), unique(user_id,source_event_key,source_id)
);
create index xp_user_history on public.xp_transactions(user_id,created_at desc,id desc);
create index xp_user_game on public.xp_transactions(user_id,game_type_id,game_session_id);
create index xp_user_source_session on public.xp_transactions(user_id,source_session_id);
create function private.guard_xp_ledger() returns trigger language plpgsql set search_path='' as $$
begin
 -- Retain XP when a session is erased, but preserve all ledger attribution and amounts.
 if TG_OP='UPDATE' and new.game_session_id is null and old.game_session_id is not null
 and (to_jsonb(new)-'game_session_id')=(to_jsonb(old)-'game_session_id')
 and not exists(select 1 from public.game_sessions where id=old.game_session_id) then return new; end if;
 -- Account erasure remains compatible with Scope 01.
 if TG_OP='DELETE' and not exists(select 1 from auth.users where id=old.user_id) then return old; end if;
 raise exception 'XP ledger is append-only';
end $$;
create trigger xp_immutable before update or delete on public.xp_transactions for each row execute function private.guard_xp_ledger();
create table public.collectible_cards (
 id text primary key check(id ~ '^[a-z][a-z0-9_]{0,63}$'), name text not null, description text not null,
 rarity text not null check(rarity in ('common','uncommon','rare','legendary')),
 artwork_key text not null, game_type_id text references public.game_types,
 unlock_rule jsonb not null check(jsonb_typeof(unlock_rule)='object'), created_at timestamptz not null default now()
);
create table public.user_collectibles (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 card_id text not null references public.collectible_cards, game_session_id uuid references public.game_sessions on delete set null,
 unlocked_at timestamptz not null default now(), source_event_key text not null, unique(user_id,card_id)
);
create index collectibles_user on public.user_collectibles(user_id,unlocked_at desc,id desc);
create table public.achievement_definitions (
 id text primary key, name text not null, description text not null, game_type_id text references public.game_types,
 scope text not null default 'global' check(scope in ('global','game','session')),
 criteria jsonb not null check(jsonb_typeof(criteria)='object'), created_at timestamptz not null default now(),
 check(scope<>'game' or game_type_id is not null)
);
create table public.user_achievements (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 achievement_id text not null references public.achievement_definitions, game_session_id uuid references public.game_sessions on delete set null,
 -- Stable scope key survives session deletion and makes session achievements distinct.
 scope_key text not null, unlocked_at timestamptz not null default now(), unique(user_id,achievement_id,scope_key)
);
create index achievements_user on public.user_achievements(user_id,unlocked_at desc,id desc);
create table private.reward_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 event_key text not null references private.reward_event_registry, game_session_id uuid references public.game_sessions on delete cascade,
 source_id uuid not null, status text not null default 'pending' check(status in ('pending','processed','skipped')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(), last_error text,
 created_at timestamptz not null default now(), unique(user_id,event_key,source_id)
);
create index reward_events_due on private.reward_events(next_attempt_at,id) where status='pending';

create function private.reward_completed_session(p_user uuid,p_session uuid,p_source uuid) returns boolean language sql stable set search_path='' as $$
 select p_session=p_source and exists(select 1 from public.game_sessions s join public.game_session_members m on m.session_id=s.id where s.id=p_session and s.status='completed' and s.completed_at is not null and m.user_id=p_user);
$$;
create function private.reward_completed_activity(p_user uuid,p_session uuid,p_source uuid) returns boolean language sql stable set search_path='' as $$
 -- A broadcast's one shared completion does not prove each player's completion.
 select exists(select 1 from public.scheduled_activities a join public.game_session_members m on m.session_id=a.game_session_id and m.user_id=p_user
 where a.id=p_source and a.game_session_id=p_session and a.target_user_id=p_user and a.status='completed' and a.completed_at is not null and a.completed_at>=a.unlock_at and (a.expires_at is null or a.completed_at<=a.expires_at));
$$;
create function private.reward_participation(p_user uuid,p_session uuid,p_source uuid) returns boolean language sql stable set search_path='' as $$
 select p_session=p_source and exists(select 1 from public.game_sessions s join public.game_session_members m on m.session_id=s.id where s.id=p_session and s.status in ('active','completed') and m.user_id=p_user);
$$;
insert into private.reward_event_registry values
 ('participation_confirmed','session',null,'private.reward_participation(uuid,uuid,uuid)'),
 ('first_game_completed','user',null,'private.reward_completed_session(uuid,uuid,uuid)'),
 ('activity_completed','activity',null,'private.reward_completed_activity(uuid,uuid,uuid)'),
 ('session_finished','session',null,'private.reward_completed_session(uuid,uuid,uuid)'),
 ('mind_match_prediction_correct','activity','mind_match',null),
 ('secret_mission_completed','activity','secret_agent',null);
insert into private.reward_milestone_registry values ('mind_reader','mind_match',null),('gift_detective','secret_santa',null),('mystery_solver','secret_agent',null),('full_activity_series',null,null);
insert into public.reward_definitions(id,event_key,xp_amount,is_active) values
 ('first_game_completed','first_game_completed',100,true),('activity_completed','activity_completed',20,true),
 ('session_finished','session_finished',100,true),('mind_match_prediction_correct','mind_match_prediction_correct',80,false),('secret_mission_completed','secret_mission_completed',40,false);
insert into public.collectible_cards(id,name,description,rarity,artwork_key,unlock_rule) values
 ('first_steps','First Steps','Every shared adventure starts with a first game.','common','first_steps','{"kind":"completed_sessions","count":1,"description":"Complete your first game."}'),
 ('mind_reader','Mind Reader','A celebration of knowing how your friends think.','rare','mind_reader','{"kind":"milestone","key":"mind_reader","description":"Reach a verified Mind Match prediction milestone. Available when Mind Match launches."}'),
 ('gift_detective','Gift Detective','For discovering the little things someone loves.','uncommon','gift_detective','{"kind":"milestone","key":"gift_detective","description":"Discover gift preferences in Secret Santa. Available when Secret Santa launches."}'),
 ('mystery_solver','Mystery Solver','For following the trail to a brilliant discovery.','legendary','mystery_solver','{"kind":"milestone","key":"mystery_solver","description":"Make a successful Secret Agent prediction. Available when Secret Agent launches."}'),
 ('dedicated_explorer','Dedicated Explorer','Different games. More stories to share.','uncommon','dedicated_explorer','{"kind":"game_types","count":3,"description":"Participate in active or completed sessions across three game types."}');
insert into public.achievement_definitions(id,name,description,scope,criteria) values
 ('first_game','First game complete','Complete your first game.','global','{"kind":"completed_sessions","count":1}'),
 ('three_sessions','In good company','Participate in three active or completed game sessions.','global','{"kind":"participated_sessions","count":3}'),
 ('xp_500','Finding your stride','Earn 500 XP across Roam games.','global','{"kind":"total_xp","count":500}'),
 ('full_series','The whole story','Complete a full, verified activity series.','session','{"kind":"milestone","key":"full_activity_series"}'),
 ('five_cards','A collection of moments','Collect five unique cards.','global','{"kind":"unique_cards","count":5}');

-- Registered function references are migration-owned, never selected by clients.
create function private.reward_rule_eligible(p_rule jsonb,p_user uuid,p_game text,p_session uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare n bigint; target bigint; r private.reward_milestone_registry; fn record; valid boolean;
begin
 if p_game is not null and p_session is not null and not exists(select 1 from public.game_sessions where id=p_session and game_type_id=p_game) then return false; end if;
 target:=coalesce((p_rule->>'count')::bigint,1);
 if target<1 then return false; end if;
 case p_rule->>'kind'
 when 'completed_sessions' then select count(*) into n from public.game_sessions s join public.game_session_members m on m.session_id=s.id where m.user_id=p_user and s.status='completed' and s.completed_at is not null and (p_game is null or s.game_type_id=p_game) and (p_session is null or s.id=p_session);
 when 'participated_sessions' then select count(*) into n from public.game_sessions s join public.game_session_members m on m.session_id=s.id where m.user_id=p_user and s.status in ('active','completed') and (p_game is null or s.game_type_id=p_game) and (p_session is null or s.id=p_session);
 when 'game_types' then select count(distinct s.game_type_id) into n from public.game_sessions s join public.game_session_members m on m.session_id=s.id where m.user_id=p_user and s.status in ('active','completed') and (p_game is null or s.game_type_id=p_game) and (p_session is null or s.id=p_session);
 when 'total_xp' then select coalesce(sum(amount),0) into n from public.xp_transactions where user_id=p_user and (p_game is null or game_type_id=p_game) and (p_session is null or game_session_id=p_session);
 when 'unique_cards' then select count(*) into n from public.user_collectibles u join public.collectible_cards c on c.id=u.card_id where u.user_id=p_user and (p_game is null or c.game_type_id=p_game) and (p_session is null or u.game_session_id=p_session);
 when 'milestone' then
 select * into r from private.reward_milestone_registry where key=p_rule->>'key';
 if r.validator is null then return false; end if;
 if r.required_game_key is not null and not exists(select 1 from public.game_sessions s join public.game_session_members m on m.session_id=s.id where s.id=p_session and s.game_type_id=r.required_game_key and m.user_id=p_user) then return false; end if;
 select ns.nspname,p.proname into fn from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where p.oid=r.validator::oid and ns.nspname='private' and p.prorettype='boolean'::regtype and p.proargtypes='2950 2950'::oidvector;
 if not found then return false; end if;
 execute format('select %I.%I($1,$2)',fn.nspname,fn.proname) into valid using p_user,p_session; return coalesce(valid,false);
 else return false;
 end case;
 return n>=target;
end $$;

-- One per-user lock serializes awards, thresholds, cards, and achievements.
create function private.lock_reward_player(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into private.reward_accounts(user_id) values(p_user) on conflict do nothing;
 perform 1 from private.reward_accounts where user_id=p_user for update;
end $$;
create function private.emit_reward_notification(p_user uuid,p_template text,p_event text) returns void language plpgsql security definer set search_path='' as $$
declare n uuid;
begin
 n:=private.emit_notification(p_user,p_template,null,p_event);
 if n is not null then update public.user_notifications set route='/rewards' where id=n; end if;
end $$;
-- Preserve the existing allowlist, adding only the authenticated Rewards tab.
alter table public.user_notifications drop constraint user_notifications_route_check;
alter table public.user_notifications add constraint user_notifications_route_check check(route ~ '^/(session|group)/[0-9a-fA-F-]{36}$' or route in ('/notifications','/rewards'));
insert into private.notification_templates values
 ('xp_earned','rewards','XP earned','You’ve earned XP for a shared adventure.'),
 ('level_up','rewards','Level up','You’ve reached a new Roam level!'),
 ('achievement_earned','rewards','Achievement earned','You’ve unlocked a new achievement!');

create function private.unlock_eligible_card(p_user uuid,p_card text,p_session uuid default null) returns boolean language plpgsql security definer set search_path='' as $$
declare c public.collectible_cards; inserted uuid;
begin
 perform private.lock_reward_player(p_user);
 if p_session is not null and not exists(select 1 from public.game_session_members where session_id=p_session and user_id=p_user) then raise exception 'Session access denied' using errcode='42501'; end if;
 select * into c from public.collectible_cards where id=p_card;
 if c.id is null then raise exception 'Collectible not found'; end if;
 if c.game_type_id is not null and p_session is not null and not exists(select 1 from public.game_sessions where id=p_session and game_type_id=c.game_type_id) then return false; end if;
 if not private.reward_rule_eligible(c.unlock_rule,p_user,c.game_type_id,case when c.unlock_rule->>'kind'='milestone' then p_session end) then return false; end if;
 insert into public.user_collectibles(user_id,card_id,game_session_id,source_event_key) values(p_user,c.id,p_session,'card:'||c.id) on conflict(user_id,card_id) do nothing returning id into inserted;
 if inserted is null then return false; end if;
 perform private.emit_reward_notification(p_user,'reward_unlocked','card:'||c.id);
 return true;
end $$;
create function public.unlock_collectible(p_user uuid,p_card text,p_session uuid default null) returns boolean language plpgsql security definer set search_path='' as $$ declare unlocked boolean; begin unlocked:=private.unlock_eligible_card(p_user,p_card,p_session); if unlocked then perform private.evaluate_player_rewards(p_user,p_session); end if; return unlocked; end $$;
create function private.evaluate_player_rewards(p_user uuid,p_session uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.collectible_cards; a public.achievement_definitions; inserted uuid; cards integer:=0; achievements integer:=0; key text;
begin
 perform private.lock_reward_player(p_user);
 if p_session is not null and not exists(select 1 from public.game_session_members where session_id=p_session and user_id=p_user) then raise exception 'Session access denied' using errcode='42501'; end if;
 for c in select * from public.collectible_cards order by id loop
 if private.unlock_eligible_card(p_user,c.id,p_session) then cards:=cards+1; end if;
 end loop;
 for a in select * from public.achievement_definitions order by id loop
 if a.scope='session' and p_session is null then continue; end if;
 if private.reward_rule_eligible(a.criteria,p_user,a.game_type_id,case when a.scope='session' then p_session end) then
 key:=case when a.scope='session' then p_session::text else a.scope end;
 insert into public.user_achievements(user_id,achievement_id,game_session_id,scope_key) values(p_user,a.id,case when a.scope='session' then p_session end,key) on conflict(user_id,achievement_id,scope_key) do nothing returning id into inserted;
 if inserted is not null then perform private.emit_reward_notification(p_user,'achievement_earned','achievement:'||a.id||':'||key);achievements:=achievements+1;end if;
 end if;
 end loop;
 return jsonb_build_object('cards',cards,'achievements',achievements);
end $$;

create function private.award_verified_reward(p_user uuid,p_event text,p_session uuid,p_source uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.reward_event_registry; def public.reward_definitions; s public.game_sessions; fn record; valid boolean;
 source uuid; key text; transaction_id uuid; before_xp bigint; after_xp bigint; before_level integer; after_level integer;
begin
 perform private.lock_reward_player(p_user);
 select * into r from private.reward_event_registry where event_key=p_event;
 if r.event_key is null or r.validator is null then raise exception 'Reward event has no registered verifier' using errcode='22023'; end if;
 select * into s from public.game_sessions where id=p_session;
 if s.id is null or not exists(select 1 from public.game_session_members where session_id=s.id and user_id=p_user) or (r.required_game_key is not null and r.required_game_key<>s.game_type_id) then raise exception 'Reward session access denied' using errcode='42501'; end if;
 source:=case when r.scope='user' then p_user when r.scope='session' then s.id else p_source end;
 if source is null then raise exception 'Verified source required'; end if;
 key:=p_event||':'||source::text;
 -- Replays return the existing immutable amount even if configuration later changes.
 select id,amount into transaction_id,after_xp from public.xp_transactions where user_id=p_user and idempotency_key=key;
 if transaction_id is not null then return jsonb_build_object('id',transaction_id,'amount',after_xp,'duplicate',true); end if;
 select ns.nspname,p.proname into fn from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where p.oid=r.validator::oid and ns.nspname='private' and p.prorettype='boolean'::regtype and p.proargtypes='2950 2950 2950'::oidvector;
 if not found then raise exception 'Invalid reward verifier'; end if;
 execute format('select %I.%I($1,$2,$3)',fn.nspname,fn.proname) into valid using p_user,s.id,coalesce(p_source,s.id);
 if not coalesce(valid,false) then raise exception 'Reward event is not proven by game state' using errcode='42501'; end if;
 -- A game override takes precedence, including an explicitly inactive override.
 select * into def from public.reward_definitions where event_key=p_event and (game_type_id=s.game_type_id or game_type_id is null) order by (game_type_id is not null) desc limit 1;
 if def.id is null or not def.is_active then perform private.evaluate_player_rewards(p_user,s.id); return jsonb_build_object('skipped',true,'reason','missing_or_inactive_definition'); end if;
 select coalesce(sum(amount),0) into before_xp from public.xp_transactions where user_id=p_user;
 after_xp:=before_xp+def.xp_amount;
 if after_xp>9007199254740991 then raise exception 'XP limit exceeded'; end if;
 select coalesce(max(level),1) into before_level from public.level_thresholds where xp_required<=before_xp;
 select coalesce(max(level),1) into after_level from public.level_thresholds where xp_required<=after_xp;
 insert into public.xp_transactions(user_id,game_session_id,game_type_id,reward_definition_id,amount,idempotency_key,source_event_key,source_id,source_session_id)
 values(p_user,s.id,s.game_type_id,def.id,def.xp_amount,key,p_event,source,s.id) returning id into transaction_id;
 perform private.emit_reward_notification(p_user,'xp_earned','xp:'||transaction_id);
 if after_level>before_level then perform private.emit_reward_notification(p_user,'level_up','level:'||after_level); end if;
 perform private.evaluate_player_rewards(p_user,s.id);
 return jsonb_build_object('id',transaction_id,'amount',def.xp_amount,'duplicate',false,'level',after_level);
end $$;
create function public.award_xp_for_event(p_user uuid,p_event text,p_session uuid,p_source uuid default null) returns jsonb language sql security definer set search_path='' as $$ select private.award_verified_reward(p_user,p_event,p_session,p_source); $$;
create function public.evaluate_reward_eligibility(p_user uuid,p_session uuid default null) returns jsonb language sql security definer set search_path='' as $$ select private.evaluate_player_rewards(p_user,p_session); $$;

-- Capture only genuine transitions. There are no synthetic completed events or backfills.
create function private.enqueue_state_rewards() returns trigger language plpgsql security definer set search_path='' as $$
declare member record;
begin
 if TG_TABLE_NAME='game_sessions' and new.status='active' and old.status<>'active' then
 for member in select user_id from public.game_session_members where session_id=new.id order by user_id loop
 insert into private.reward_events(user_id,event_key,game_session_id,source_id) values(member.user_id,'participation_confirmed',new.id,new.id) on conflict do nothing;
 end loop;
 end if;
 if new.status='completed' and old.status<>'completed' then
 if TG_TABLE_NAME='game_sessions' then
 for member in select user_id from public.game_session_members where session_id=new.id order by user_id loop
 insert into private.reward_events(user_id,event_key,game_session_id,source_id) values(member.user_id,'first_game_completed',new.id,new.id),(member.user_id,'session_finished',new.id,new.id) on conflict do nothing;
 end loop;
 elsif new.target_user_id is not null then
 insert into private.reward_events(user_id,event_key,game_session_id,source_id) values(new.target_user_id,'activity_completed',new.game_session_id,new.id) on conflict do nothing;
 end if;
 end if;
 return new;
end $$;
create trigger session_reward_events after update of status on public.game_sessions for each row execute function private.enqueue_state_rewards();
create trigger activity_reward_events after update of status on public.scheduled_activities for each row execute function private.enqueue_state_rewards();
create function private.process_reward_events(p_limit integer default 100) returns integer language plpgsql security definer set search_path='' as $$
declare e private.reward_events; result jsonb; processed integer:=0;
begin
 for e in select * from private.reward_events where status='pending' and next_attempt_at<=now() order by created_at,id limit least(greatest(p_limit,1),500) for update skip locked loop
 begin
 result:=private.award_verified_reward(e.user_id,e.event_key,e.game_session_id,e.source_id);
 update private.reward_events set status=case when result->>'skipped'='true' then 'skipped' else 'processed' end,last_error=null where id=e.id;
 processed:=processed+1;
 exception when others then update private.reward_events set attempts=attempts+1,next_attempt_at=now()+interval '30 seconds'*power(2,least(attempts+1,7)),last_error='Reward processing error: '||SQLSTATE where id=e.id;
 end;
 end loop;
 return processed;
end $$;
create function public.process_reward_events(p_limit integer default 100) returns integer language sql security definer set search_path='' as $$ select private.process_reward_events(p_limit); $$;
-- Reuse Scope 04's global activity Cron; no level-calculation job or per-user jobs.
alter function private.run_activity_scheduler(integer) rename to run_activity_scheduler_scope04;
create function private.run_activity_scheduler(p_limit integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=private.run_activity_scheduler_scope04(p_limit);
 return result||jsonb_build_object('reward_events_processed',private.process_reward_events(p_limit));
end $$;

create function private.reward_progress(p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with total as (select coalesce(sum(amount),0)::bigint xp from public.xp_transactions where user_id=p_user),
 current_level as (select l.* from public.level_thresholds l,total t where l.xp_required<=t.xp order by l.level desc limit 1)
 select jsonb_build_object('total_xp',t.xp,'level',l.level,'level_xp',l.xp_required,'next_level_xp',n.xp_required,
 'xp_into_level',t.xp-l.xp_required,'xp_to_next_level',case when n.level is null then null else n.xp_required-t.xp end,
 'progress',case when n.level is null then 1 else (t.xp-l.xp_required)::numeric/(n.xp_required-l.xp_required) end)
 from total t cross join current_level l left join public.level_thresholds n on n.level=l.level+1;
$$;
create function public.reward_account(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.active_actor(); result jsonb; progress jsonb; games jsonb; cards jsonb; achievements jsonb; history jsonb;
begin
 if p_action='progress' then return private.reward_progress(actor); end if;
 if p_action in ('game_progress','dashboard') then
 select coalesce(jsonb_agg(to_jsonb(g) order by g.game_type_id),'[]') into games from (
 select x.game_type_id,t.name as game_name,sum(x.amount)::bigint as total_xp from public.xp_transactions x join public.game_types t on t.id=x.game_type_id
 where x.user_id=actor and (p_data->>'game_type_id' is null or x.game_type_id=p_data->>'game_type_id') and (p_data->>'session_id' is null or x.source_session_id=(p_data->>'session_id')::uuid)
 group by x.game_type_id,t.name) g;
 if p_action='game_progress' then return games; end if;
 end if;
 if p_action in ('collectibles','card','dashboard') then
 select coalesce(jsonb_agg(to_jsonb(c) order by c.name),'[]') into cards from (
 select d.*,u.id as owned_id,u.unlocked_at,u.game_session_id as earned_session_id from public.collectible_cards d left join public.user_collectibles u on u.card_id=d.id and u.user_id=actor
 where p_action<>'card' or d.id=p_data->>'card_id') c;
 if p_action='card' then return coalesce(cards->0,'null'); end if;
 if p_action='collectibles' then return cards; end if;
 end if;
 if p_action in ('achievements','dashboard') then
 select coalesce(jsonb_agg(to_jsonb(a) order by a.unlocked_at desc nulls last,a.id),'[]') into achievements from (
 select d.*,u.id as earned_id,u.unlocked_at,u.game_session_id from public.achievement_definitions d left join public.user_achievements u on u.achievement_id=d.id and u.user_id=actor) a;
 if p_action='achievements' then return achievements; end if;
 end if;
 if p_action in ('history','dashboard') then
 select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc,h.id desc),'[]') into history from (
 select x.* from public.xp_transactions x where user_id=actor and (p_data->>'before_created_at' is null or (x.created_at,x.id)<((p_data->>'before_created_at')::timestamptz,(p_data->>'before_id')::uuid)) order by x.created_at desc,x.id desc limit 30) h;
 if p_action='history' then return history; end if;
 end if;
 if p_action='dashboard' then return jsonb_build_object('progress',private.reward_progress(actor),'game_progress',games,'collectibles',cards,'achievements',achievements,'history',history);end if;
 raise exception 'Unsupported reward operation';
end $$;

-- No public award endpoint. Clients receive only their own projections and read access.
revoke all on function public.award_xp_for_event(uuid,text,uuid,uuid),public.evaluate_reward_eligibility(uuid,uuid),public.process_reward_events(integer),public.reward_account(text,jsonb) from public,anon,authenticated;
grant execute on function public.award_xp_for_event(uuid,text,uuid,uuid),public.evaluate_reward_eligibility(uuid,uuid),public.process_reward_events(integer) to service_role;
grant execute on function public.reward_account(text,jsonb) to authenticated;
do $$ declare t text; begin
 foreach t in array array['reward_definitions','level_thresholds','xp_transactions','collectible_cards','user_collectibles','achievement_definitions','user_achievements'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['reward_definitions','level_thresholds','collectible_cards','achievement_definitions'] loop
 execute format('create policy reward_catalog_read on public.%I for select to authenticated using ((select private.active_actor()) is not null)',t);
 end loop;
 foreach t in array array['xp_transactions','user_collectibles','user_achievements'] loop
 execute format('create policy own_rewards on public.%I for select to authenticated using(user_id=(select private.active_actor()))',t);
 end loop;
 foreach t in array array['reward_event_registry','reward_milestone_registry','reward_accounts','reward_events'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
 end loop;
end $$;
revoke all on function private.guard_level_thresholds(),private.guard_xp_ledger(),private.reward_completed_session(uuid,uuid,uuid),private.reward_completed_activity(uuid,uuid,uuid),private.reward_rule_eligible(jsonb,uuid,text,uuid),private.lock_reward_player(uuid),private.emit_reward_notification(uuid,text,text),private.evaluate_player_rewards(uuid,uuid),private.award_verified_reward(uuid,text,uuid,uuid),private.enqueue_state_rewards(),private.process_reward_events(integer),private.reward_progress(uuid),private.run_activity_scheduler(integer),private.run_activity_scheduler_scope04(integer) from public,anon,authenticated;

revoke all on function private.unlock_eligible_card(uuid,text,uuid),public.unlock_collectible(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.unlock_collectible(uuid,text,uuid) to service_role;
-- Invalidate any existing PL/pgSQL worker plan so its scheduler lookup resolves to
-- the wrapper above, including on database connections that ran before this migration.
do $$ begin execute pg_get_functiondef('public.notification_worker(text,jsonb)'::regprocedure); end $$;

revoke all on function private.reward_participation(uuid,uuid,uuid) from public,anon,authenticated;
