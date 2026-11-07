-- Scope 04: server time is the only authorization clock. No gameplay rules live here.
create table private.notification_templates (
 key text primary key, category text not null check(category in ('group_updates','game_updates','your_turn','secret_messages','reminders','rewards')),
 title text not null, body text not null
);
insert into private.notification_templates values
 ('game_started','game_updates','Game started','Your game has started!'),
 ('assignment_ready','your_turn','Assignment ready','Your secret assignment is waiting 🎁'),
 ('activity_unlocked','your_turn','New activity','A new challenge is waiting for you.'),
 ('prediction_ready','your_turn','Your turn','It’s your turn to make a prediction 🧠'),
 ('clue_available','game_updates','New clue','A new mystery clue has appeared 🔎'),
 ('secret_message_received','secret_messages','Secret message','You’ve received a secret message ✉️'),
 ('activity_expiring','reminders','Activity reminder','Your challenge is closing soon.'),
 ('reward_unlocked','rewards','Reward unlocked','You’ve earned a new collectible card!');
create table public.scheduled_activities (
 id uuid primary key default gen_random_uuid(), game_session_id uuid not null references public.game_sessions on delete cascade,
 activity_type text not null check(activity_type ~ '^[a-z][a-z0-9_]{0,63}$'), target_user_id uuid references auth.users on delete cascade,
 -- Only public presentation metadata. Sensitive game data belongs in game-owned tables.
 payload jsonb not null default '{}' check(jsonb_typeof(payload)='object' and payload - array['template_key'] = '{}'::jsonb and (not payload ? 'template_key' or jsonb_typeof(payload->'template_key')='string')),
 status text not null default 'scheduled' check(status in ('scheduled','available','completed','expired','cancelled')),
 unlock_at timestamptz not null, expires_at timestamptz, completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 processing_attempts integer not null default 0, next_attempt_at timestamptz not null default now(), last_error text,
 idempotency_key text not null check(length(idempotency_key) between 1 and 200), unique(game_session_id,idempotency_key),
 check(expires_at is null or expires_at>unlock_at), check((status='completed')=(completed_at is not null))
);
create index activities_due on public.scheduled_activities(unlock_at,id) where status='scheduled';
create index activities_expire on public.scheduled_activities(expires_at,id) where status in ('scheduled','available');
create table public.notification_preferences (
 user_id uuid primary key references auth.users on delete cascade,
 push_enabled boolean not null default false,
 group_updates_enabled boolean not null default true, game_updates_enabled boolean not null default true,
 your_turn_enabled boolean not null default true, secret_messages_enabled boolean not null default true,
 reminders_enabled boolean not null default false, rewards_enabled boolean not null default false,
 preferred_reminder_time time not null default '18:00', quiet_hours_enabled boolean not null default true,
 quiet_hours_start time not null default '22:00', quiet_hours_end time not null default '08:00',
 timezone text not null default 'UTC', updated_at timestamptz not null default now()
);
create table private.device_push_tokens (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 expo_push_token text not null unique check(expo_push_token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$'),
 platform text not null check(platform in ('ios','android')), device_identifier uuid not null, registered_session_id uuid references auth.sessions on delete cascade,
 is_active boolean not null default true, last_registered_at timestamptz not null default now(), invalidated_at timestamptz,
 check (true)
);
create unique index active_device_owner on private.device_push_tokens(user_id,device_identifier) where is_active;
create table public.user_notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 category text not null, template_key text not null references private.notification_templates(key), title text not null, body text not null,
 route text not null check(route ~ '^/(session|group)/[0-9a-fA-F-]{36}$' or route='/notifications'),
 related_session_id uuid references public.game_sessions on delete cascade,
 read_at timestamptz, created_at timestamptz not null default now(), event_key text not null,
 unique(user_id,event_key)
);
create index notifications_user_page on public.user_notifications(user_id,created_at desc,id desc);
create index notifications_unread on public.user_notifications(user_id) where read_at is null;
create table private.notification_outbox (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 notification_id uuid not null references public.user_notifications on delete cascade, event_key text not null,
 activity_id uuid references public.scheduled_activities on delete cascade,
 scheduled_for timestamptz not null default now(), status text not null default 'pending' check(status in ('pending','processed','cancelled')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(), last_error text,
 created_at timestamptz not null default now(), unique(user_id,event_key)
);
create index outbox_due on private.notification_outbox(next_attempt_at,scheduled_for) where status='pending';
create table private.push_deliveries (
 id uuid primary key default gen_random_uuid(), outbox_id uuid not null references private.notification_outbox on delete cascade,
 device_token_id uuid not null references private.device_push_tokens on delete cascade,
 -- Snapshot prevents an old receipt invalidating a refreshed token.
 token_snapshot text not null, provider_ticket_id text unique, provider_receipt_status text,
 status text not null default 'pending' check(status in ('pending','leased','sending','accepted','receipt_ok','retry','failed','unknown','cancelled')),
 attempts integer not null default 0, lease_id uuid, lease_until timestamptz, next_attempt_at timestamptz not null default now(),
 attempted_at timestamptz, completed_at timestamptz, last_error text, unique(outbox_id,device_token_id)
);
create index deliveries_due on private.push_deliveries(next_attempt_at) where status in ('pending','retry','accepted','leased');
create table private.reminder_policies (
 game_type_id text primary key references public.game_types on delete cascade, enabled boolean not null default false,
 lead_time interval not null default '1 day' check(lead_time>interval '0 seconds'), stage text not null default 'deadline' check(stage ~ '^[a-z_]{1,32}$')
);
create table private.push_rate_windows (
 user_id uuid primary key references auth.users on delete cascade, last_push_at timestamptz, reminder_day date, reminder_outbox uuid
);

alter table public.scheduled_activities enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.user_notifications enable row level security;
revoke all on public.scheduled_activities,public.notification_preferences,public.user_notifications from public,anon,authenticated;
grant select on public.scheduled_activities,public.notification_preferences,public.user_notifications to authenticated;
create policy available_activities on public.scheduled_activities for select to authenticated using (
 private.is_session_member(game_session_id) and (target_user_id is null or target_user_id=(select auth.uid()))
 and status in ('available','completed') and unlock_at<=now() and (expires_at is null or expires_at>now() or status='completed')
 and exists(select 1 from public.game_sessions s where s.id=game_session_id and s.status='active'));
create policy own_notification_preferences on public.notification_preferences for select to authenticated using(user_id=(select private.active_actor()));
create policy own_notifications on public.user_notifications for select to authenticated using(user_id=(select private.active_actor()));

-- All notification creation is server-only; payloads never interpolate secrets.
create function private.emit_notification(p_user uuid,p_template text,p_session uuid,p_event text,p_activity uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare n uuid; t private.notification_templates;
begin
 select * into strict t from private.notification_templates where key=p_template;
 insert into public.user_notifications(user_id,category,template_key,title,body,route,related_session_id,event_key)
 values(p_user,t.category,t.key,t.title,t.body,case when p_session is null then '/notifications' else '/session/'||p_session::text end,p_session,p_event)
 on conflict(user_id,event_key) do nothing returning id into n;
 if n is not null then insert into private.notification_outbox(user_id,notification_id,event_key,activity_id) values(p_user,n,p_event,p_activity); end if;
 return n;
end $$;

-- Trusted game modules call only after validating their own event and game rules.
create function public.schedule_activity(p_session uuid,p_type text,p_target uuid,p_unlock timestamptz,p_expires timestamptz,p_key text,p_payload jsonb default '{}') returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.game_sessions; a public.scheduled_activities; result uuid;
begin
 select * into s from public.game_sessions where id=p_session for update;
 if s.id is null or s.status<>'active' then raise exception 'Active session required'; end if;
 if p_target is not null and not exists(select 1 from public.game_session_members where session_id=p_session and user_id=p_target) then raise exception 'Target must be a session member'; end if;
 if not exists(select 1 from private.notification_templates where key=coalesce(p_payload->>'template_key','activity_unlocked')) then raise exception 'Invalid template'; end if;
 insert into public.scheduled_activities(game_session_id,activity_type,target_user_id,unlock_at,expires_at,idempotency_key,payload)
 values(p_session,p_type,p_target,coalesce(p_unlock,now()),p_expires,p_key,p_payload) on conflict(game_session_id,idempotency_key) do nothing returning id into result;
 if result is null then
 select * into a from public.scheduled_activities where game_session_id=p_session and idempotency_key=p_key;
 if (a.activity_type,a.target_user_id,a.unlock_at,a.expires_at,a.payload) is distinct from (p_type,p_target,coalesce(p_unlock,a.unlock_at),p_expires,p_payload) then raise exception 'Idempotency key reused with different activity'; end if;
 result:=a.id;
 end if;
 return result;
end $$;
create function public.transition_activity(p_id uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.scheduled_activities;
begin
 select * into a from public.scheduled_activities where id=p_id for update;
 if a.id is null then raise exception 'Activity not found'; end if;
 if p_status not in ('completed','cancelled') then raise exception 'Invalid transition'; end if;
 if a.status=p_status then return; end if;
 if a.status not in ('scheduled','available') or (p_status='completed' and (a.status<>'available' or a.unlock_at>now() or a.expires_at<=now())) then raise exception 'Activity is not available'; end if;
 if p_status='completed' and not exists(select 1 from public.game_sessions where id=a.game_session_id and status='active') then raise exception 'Session ended'; end if;
 update public.scheduled_activities set status=p_status,completed_at=case when p_status='completed' then now() end,updated_at=now() where id=p_id;
 update private.notification_outbox set status='cancelled' where activity_id=p_id and status='pending';
 update private.push_deliveries d set status='cancelled' from private.notification_outbox o where o.id=d.outbox_id and o.activity_id=p_id and d.status in ('pending','retry','leased');
end $$;

create function private.run_activity_scheduler(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.scheduled_activities; m record; total integer:=0; errors integer:=0; pol private.reminder_policies;
begin
 -- Each activity gets a subtransaction: one malformed event cannot block the batch.
 for a in select x.* from public.scheduled_activities x where x.next_attempt_at<=now() and x.status in ('scheduled','available') and
 ((x.status='scheduled' and x.unlock_at<=now()) or x.expires_at<=now() or not exists(select 1 from public.game_sessions s where s.id=x.game_session_id and s.status='active')) order by x.unlock_at,x.id limit least(greatest(p_limit,1),500) for update skip locked loop
 begin
 if not exists(select 1 from public.game_sessions where id=a.game_session_id and status='active') then
 update public.scheduled_activities set status='cancelled',updated_at=now() where id=a.id;
 elsif a.expires_at<=now() then update public.scheduled_activities set status='expired',updated_at=now() where id=a.id;
 elsif a.status='scheduled' then
 update public.scheduled_activities set status='available',updated_at=now() where id=a.id;
 for m in select user_id from public.game_session_members where session_id=a.game_session_id and (a.target_user_id is null or user_id=a.target_user_id) loop
 perform private.emit_notification(m.user_id,coalesce(a.payload->>'template_key','activity_unlocked'),a.game_session_id,'unlock:'||a.id,a.id);
 end loop;
 end if;
 total:=total+1;
 exception when others then
 update public.scheduled_activities set processing_attempts=processing_attempts+1,next_attempt_at=now()+interval '30 seconds'*power(2,least(processing_attempts+1,7)),last_error='Scheduler error: '||SQLSTATE where id=a.id;
 errors:=errors+1;
 end;
 end loop;
 return jsonb_build_object('processed',total,'errors',errors);
end $$;

-- Policy registration is migration-only. Default disabled for every game.
create function private.enqueue_reminders(p_limit integer default 100) returns integer
language plpgsql security definer set search_path='' as $$
declare r record; n integer:=0;
begin
 for r in select a.id,a.game_session_id,m.user_id,p.stage from public.scheduled_activities a
 join public.game_sessions s on s.id=a.game_session_id and s.status='active'
 join private.reminder_policies p on p.game_type_id=s.game_type_id and p.enabled
 join public.game_session_members m on m.session_id=s.id and (a.target_user_id is null or a.target_user_id=m.user_id)
 join public.notification_preferences pref on pref.user_id=m.user_id and pref.reminders_enabled
 where a.status='available' and a.unlock_at<=now() and a.expires_at>now() and a.expires_at<=now()+p.lead_time
 and not exists(select 1 from public.user_notifications u where u.user_id=m.user_id and u.event_key='reminder:'||a.id||':'||p.stage)
 order by a.expires_at,a.id,m.user_id limit least(greatest(p_limit,1),500) for update of a skip locked loop
 perform private.emit_notification(r.user_id,'activity_expiring',r.game_session_id,'reminder:'||r.id||':'||r.stage,r.id); n:=n+1;
 end loop;
 return n;
end $$;

create function public.notification_account(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor(); pref public.notification_preferences; device uuid; result jsonb;
begin
 if p_action in ('preferences','save_preferences') then
 insert into public.notification_preferences(user_id) values(actor) on conflict do nothing;
 if p_action='save_preferences' then
 if p_data - array['push_enabled','group_updates_enabled','game_updates_enabled','your_turn_enabled','secret_messages_enabled','reminders_enabled','rewards_enabled','preferred_reminder_time','quiet_hours_enabled','quiet_hours_start','quiet_hours_end','timezone'] <> '{}'::jsonb then raise exception 'Unknown preference'; end if;
 select * into pref from public.notification_preferences where user_id=actor for update;
 select * into pref from jsonb_populate_record(pref,p_data);
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=pref.timezone) then raise exception 'Invalid timezone'; end if;
 update public.notification_preferences set push_enabled=pref.push_enabled,group_updates_enabled=pref.group_updates_enabled,game_updates_enabled=pref.game_updates_enabled,your_turn_enabled=pref.your_turn_enabled,secret_messages_enabled=pref.secret_messages_enabled,reminders_enabled=pref.reminders_enabled,rewards_enabled=pref.rewards_enabled,preferred_reminder_time=pref.preferred_reminder_time,quiet_hours_enabled=pref.quiet_hours_enabled,quiet_hours_start=pref.quiet_hours_start,quiet_hours_end=pref.quiet_hours_end,timezone=pref.timezone,updated_at=now() where user_id=actor;
 end if;
 return (select to_jsonb(p) from public.notification_preferences p where user_id=actor);
 elsif p_action='register_device' then
 device:=(p_data->>'device_identifier')::uuid;
 update private.device_push_tokens set is_active=false,invalidated_at=now() where user_id=actor and device_identifier=device and expo_push_token<>p_data->>'expo_push_token';
 -- Ownership transfer is permitted only with the device token; the installation UUID alone cannot hijack a token.
 insert into private.device_push_tokens(user_id,expo_push_token,platform,device_identifier,registered_session_id)
 values(actor,p_data->>'expo_push_token',p_data->>'platform',device,nullif(auth.jwt()->>'session_id','')::uuid)
 on conflict(expo_push_token) do update set user_id=actor,registered_session_id=excluded.registered_session_id,device_identifier=excluded.device_identifier,platform=excluded.platform,is_active=true,invalidated_at=null,last_registered_at=now();
 return 'true';
 elsif p_action='deactivate_device' then
 update private.device_push_tokens set is_active=false,invalidated_at=now() where user_id=actor and device_identifier=(p_data->>'device_identifier')::uuid;
 return 'true';
 elsif p_action='read' then
 update public.user_notifications set read_at=case when coalesce((p_data->>'read')::boolean,true) then now() end where user_id=actor and id=(p_data->>'id')::uuid;
 return 'true';
 elsif p_action='list' then
 select jsonb_build_object('unread_count',(select count(*) from public.user_notifications where user_id=actor and read_at is null),
 'items',coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc,page.id desc),'[]'::jsonb)) into result
 from (select * from public.user_notifications where user_id=actor and
 (p_data->>'before_created_at' is null or (created_at,id)<((p_data->>'before_created_at')::timestamptz,(p_data->>'before_id')::uuid))
 order by created_at desc,id desc limit 30) page;
 return result;
 end if;
 raise exception 'Unsupported operation';
end $$;

-- Local civil time is derived from the server timestamp in the user's IANA zone.
create function private.push_allowed(p public.notification_preferences,p_category text,p_now timestamptz) returns boolean
language sql stable set search_path='' as $$
 select p.push_enabled and coalesce((to_jsonb(p)->>(p_category||'_enabled'))::boolean,false)
 and not (p.quiet_hours_enabled and case
 when p.quiet_hours_start=p.quiet_hours_end then true
 when p.quiet_hours_start<p.quiet_hours_end then (p_now at time zone p.timezone)::time>=p.quiet_hours_start and (p_now at time zone p.timezone)::time<p.quiet_hours_end
 else (p_now at time zone p.timezone)::time>=p.quiet_hours_start or (p_now at time zone p.timezone)::time<p.quiet_hours_end end)
 and (p_category<>'reminders' or (p_now at time zone p.timezone)::time>=p.preferred_reminder_time);
$$;

-- Dispatcher transaction boundary: leases are fenced by random IDs. Expired sending
-- leases become unknown, never automatically resent (Expo has no idempotency API).
create function public.notification_worker(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare o private.notification_outbox; pref public.notification_preferences; n public.user_notifications;
 d private.push_deliveries; r private.push_rate_windows; a public.scheduled_activities;
 result jsonb:='[]'; lid uuid; code text; local_day date;
begin
 if p_action='tick' then
 result:=private.run_activity_scheduler(100); perform private.enqueue_reminders(100); return result;
 elsif p_action='claim' then
 update private.push_deliveries set status='unknown',last_error='Ambiguous provider send; manual reconciliation required',completed_at=now() where status='sending' and lease_until<now();
 update private.push_deliveries set status='retry',next_attempt_at=now(),lease_id=null where status='leased' and lease_until<now();
 for o in select * from private.notification_outbox where status='pending' and scheduled_for<=now() and next_attempt_at<=now() order by scheduled_for,id limit 100 for update skip locked loop
 select * into n from public.user_notifications where id=o.notification_id;
 if o.activity_id is not null then
 select * into a from public.scheduled_activities where id=o.activity_id for update skip locked;
 if not found then continue; end if;
 if a.status<>'available' or a.unlock_at>now() or a.expires_at<=now() or not exists(select 1 from public.game_sessions where id=a.game_session_id and status='active') then
 update private.notification_outbox set status='cancelled' where id=o.id; continue; end if;
 end if;
 select * into pref from public.notification_preferences where user_id=o.user_id;
 if pref.user_id is null or not pref.push_enabled or not coalesce((to_jsonb(pref)->>(n.category||'_enabled'))::boolean,false) then
 update private.notification_outbox set status='cancelled' where id=o.id; continue; end if;
 if not private.push_allowed(pref,n.category,now()) then update private.notification_outbox set next_attempt_at=now()+interval '1 minute' where id=o.id; continue; end if;
 if o.activity_id is not null and not exists(select 1 from public.game_session_members where session_id=a.game_session_id and user_id=o.user_id) then update private.notification_outbox set status='cancelled' where id=o.id; continue; end if;
 insert into private.push_rate_windows(user_id) values(o.user_id) on conflict do nothing;
 select * into r from private.push_rate_windows where user_id=o.user_id for update;
 local_day:=(now() at time zone pref.timezone)::date;
 if r.last_push_at>now()-interval '1 minute' or (n.category='reminders' and r.reminder_day=local_day and r.reminder_outbox<>o.id) then
 update private.notification_outbox set next_attempt_at=now()+interval '1 minute' where id=o.id; continue; end if;
 insert into private.push_deliveries(outbox_id,device_token_id,token_snapshot)
 select o.id,t.id,t.expo_push_token from private.device_push_tokens t where t.user_id=o.user_id and t.is_active on conflict do nothing;
 if not exists(select 1 from private.push_deliveries where outbox_id=o.id) then update private.notification_outbox set status='cancelled' where id=o.id; continue; end if;
 update private.push_rate_windows set last_push_at=now(),reminder_day=case when n.category='reminders' then local_day else reminder_day end,reminder_outbox=case when n.category='reminders' then o.id else reminder_outbox end where user_id=o.user_id;
 update private.notification_outbox set status='processed',attempts=attempts+1 where id=o.id;
 end loop;
 for d in select * from private.push_deliveries where status in ('pending','retry') and next_attempt_at<=now() order by next_attempt_at,id limit 10 for update skip locked loop
 lid:=gen_random_uuid();
 update private.push_deliveries set status='leased',lease_id=lid,lease_until=now()+interval '2 minutes' where id=d.id;
 result:=result||jsonb_build_array(jsonb_build_object('id',d.id,'lease_id',lid));
 end loop; return result;
 elsif p_action='begin_send' then
 select * into d from private.push_deliveries where id=(p_data->>'id')::uuid and lease_id=(p_data->>'lease_id')::uuid and status='leased' and lease_until>now() for update;
 if d.id is null then return 'null'; end if;
 select * into o from private.notification_outbox where id=d.outbox_id;
 select * into n from public.user_notifications where id=o.notification_id;
 select * into pref from public.notification_preferences where user_id=o.user_id;
 if o.activity_id is not null then
 select * into a from public.scheduled_activities where id=o.activity_id for update skip locked;
 if not found then update private.push_deliveries set status='retry',next_attempt_at=now()+interval '1 minute' where id=d.id; return 'null'; end if;
 end if;
 if pref.user_id is not null and pref.push_enabled and coalesce((to_jsonb(pref)->>(n.category||'_enabled'))::boolean,false) and not private.push_allowed(pref,n.category,now()) then
 update private.push_deliveries set status='retry',next_attempt_at=now()+interval '1 minute' where id=d.id; return 'null'; end if;
 if pref.user_id is null or not private.push_allowed(pref,n.category,now())
 or not exists(select 1 from private.device_push_tokens where id=d.device_token_id and user_id=o.user_id and is_active and expo_push_token=d.token_snapshot)
 or (o.activity_id is not null and (a.status<>'available' or a.expires_at<=now() or not exists(select 1 from public.game_sessions s join public.game_session_members m on m.session_id=s.id where s.id=a.game_session_id and s.status='active' and m.user_id=o.user_id))) then
 update private.push_deliveries set status='cancelled',completed_at=now() where id=d.id; return 'null'; end if;
 if n.category='reminders' then
 select * into r from private.push_rate_windows where user_id=o.user_id for update;
 local_day:=(now() at time zone pref.timezone)::date;
 if r.reminder_day=local_day and r.reminder_outbox<>o.id then
 update private.push_deliveries set status='retry',next_attempt_at=now()+interval '1 minute' where id=d.id; return 'null'; end if;
 update private.push_rate_windows set reminder_day=local_day,reminder_outbox=o.id where user_id=o.user_id;
 end if;
 update private.push_deliveries set status='sending',attempts=attempts+1,attempted_at=now(),lease_until=now()+interval '2 minutes' where id=d.id;
 return jsonb_build_object('to',d.token_snapshot,'title',n.title,'body',n.body,'data',jsonb_build_object('notification_id',n.id),'sound','default','channelId','roam') || case when a.expires_at is not null then jsonb_build_object('expiration',floor(extract(epoch from a.expires_at))::bigint) else '{}'::jsonb end;
 elsif p_action='sent' then
 select * into d from private.push_deliveries where id=(p_data->>'id')::uuid and lease_id=(p_data->>'lease_id')::uuid and status='sending' for update;
 if d.id is null then return 'false'; end if;
 code:=p_data->>'error';
 update private.push_deliveries set
 status=case when p_data->>'ticket' is not null then 'accepted' when code in ('MessageRateExceeded','HTTP_429','HTTP_503') and attempts<6 then 'retry' when code='ambiguous' then 'unknown' else 'failed' end,
 provider_ticket_id=p_data->>'ticket',last_error=left(code,200),
 next_attempt_at=now()+case when p_data->>'ticket' is not null then interval '15 minutes' else interval '30 seconds'*power(2,least(attempts,6)) end,
 completed_at=case when p_data->>'ticket' is null and code is not null and (code not in ('MessageRateExceeded','HTTP_429','HTTP_503') or attempts>=6) then now() end where id=d.id;
 if code='DeviceNotRegistered' then update private.device_push_tokens set is_active=false,invalidated_at=now() where id=d.device_token_id and expo_push_token=d.token_snapshot; end if;
 return 'true';
 elsif p_action='receipts' then
 for d in select * from private.push_deliveries where status='accepted' and next_attempt_at<=now() order by next_attempt_at limit 100 for update skip locked loop
 lid:=gen_random_uuid();
 update private.push_deliveries set lease_id=lid,next_attempt_at=now()+interval '5 minutes' where id=d.id;
 result:=result||jsonb_build_array(jsonb_build_object('id',d.id,'lease_id',lid,'ticket',d.provider_ticket_id));
 end loop; return result;
 elsif p_action='receipt' then
 select * into d from private.push_deliveries where id=(p_data->>'id')::uuid and lease_id=(p_data->>'lease_id')::uuid and status='accepted' for update;
 if d.id is null then return 'false'; end if;
 code:=p_data->>'error';
 if p_data->>'status'='missing' then
 if d.attempted_at<now()-interval '24 hours' then update private.push_deliveries set status='unknown',provider_receipt_status='missing',completed_at=now() where id=d.id; end if;
 return 'true'; end if;
 update private.push_deliveries set status=case when p_data->>'status'='ok' then 'receipt_ok' when code='MessageRateExceeded' and attempts<6 then 'retry' else 'failed' end,
 provider_receipt_status=p_data->>'status',last_error=left(code,200),completed_at=case when code='MessageRateExceeded' and attempts<6 then null else now() end,next_attempt_at=now()+interval '30 seconds'*power(2,least(attempts,6)),provider_ticket_id=case when code='MessageRateExceeded' then null else provider_ticket_id end where id=d.id;
 if code='DeviceNotRegistered' then update private.device_push_tokens set is_active=false,invalidated_at=now() where id=d.device_token_id and expo_push_token=d.token_snapshot; end if;
 return 'true';
 end if;
 raise exception 'Unsupported worker operation';
end $$;

-- Explicit revocations: Postgres grants new functions to PUBLIC by default.
revoke all on function public.schedule_activity(uuid,text,uuid,timestamptz,timestamptz,text,jsonb),public.transition_activity(uuid,text),public.notification_worker(text,jsonb),public.notification_account(text,jsonb) from public,anon,authenticated;
grant execute on function public.notification_account(text,jsonb) to authenticated;
grant execute on function public.schedule_activity(uuid,text,uuid,timestamptz,timestamptz,text,jsonb),public.transition_activity(uuid,text),public.notification_worker(text,jsonb) to service_role;
revoke all on private.notification_templates,private.device_push_tokens,private.notification_outbox,private.push_deliveries,private.reminder_policies,private.push_rate_windows from public,anon,authenticated;
alter table private.notification_templates enable row level security;
alter table private.device_push_tokens enable row level security;
alter table private.notification_outbox enable row level security;
alter table private.push_deliveries enable row level security;
alter table private.reminder_policies enable row level security;
alter table private.push_rate_windows enable row level security;
revoke all on function private.emit_notification(uuid,text,uuid,text,uuid),private.run_activity_scheduler(integer),private.enqueue_reminders(integer),private.push_allowed(public.notification_preferences,text,timestamptz) from public,anon,authenticated;
