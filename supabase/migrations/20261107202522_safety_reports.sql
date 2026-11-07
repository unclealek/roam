-- Scope 07.6. Only the submission wrapper is exposed through the Data API.
create table private.safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_type text not null,
  reported_group_id uuid references public.groups(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete cascade,
  context_group_id uuid references public.groups(id) on delete cascade,
  reason text not null,
  description text check (char_length(description) <= 1000),
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  review_decision text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint safety_reports_target_check check (
    (reported_type = 'group' and reported_group_id is not null
      and reported_user_id is null and context_group_id is null
      and reason in ('inappropriate_group_content', 'harassment', 'spam_scam', 'impersonation', 'privacy', 'other'))
    or
    (reported_type = 'user' and reported_group_id is null
      and reported_user_id is not null and reported_user_id <> reporter_id
      and context_group_id is not null
      and reason in ('offensive_display_name', 'impersonation', 'harassment', 'suspicious_behavior', 'privacy', 'other'))
  )
);
create index safety_reports_reporter_time on private.safety_reports(reporter_id, created_at desc);
create index safety_reports_group on private.safety_reports(reported_group_id);
create index safety_reports_user on private.safety_reports(reported_user_id);
create index safety_reports_context on private.safety_reports(context_group_id);
create index safety_reports_review_queue on private.safety_reports(status, created_at);

create table private.safety_report_limits (
  reporter_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  submissions integer not null
);

alter table private.safety_reports enable row level security;
alter table private.safety_report_limits enable row level security;
revoke all on private.safety_reports, private.safety_report_limits
  from public, anon, authenticated, service_role;

create function private.submit_safety_report(
  p_group_id uuid, p_user_id uuid, p_reason text, p_description text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.active_actor();
  group_target uuid;
  context_group uuid;
  target_type text;
  submitted_at timestamptz;
begin
  if p_user_id = actor then
    raise exception 'You cannot report yourself' using errcode = '22023';
  end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = actor)
    or (p_user_id is not null and not exists (
      select 1 from public.group_members where group_id = p_group_id and user_id = p_user_id
    )) then
    raise exception 'Report target is unavailable' using errcode = '42501';
  end if;
  if p_reason is null or char_length(p_description) > 1000 then
    raise exception 'Invalid report details' using errcode = '22023';
  end if;

  if p_user_id is null then
    target_type := 'group';
    group_target := p_group_id;
  else
    target_type := 'user';
    context_group := p_group_id;
  end if;

  -- Serialize submissions for the same reporter, including concurrent retries.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('roam:safety:' || actor::text, 0));
  submitted_at := pg_catalog.clock_timestamp();
  if exists (
    select 1 from private.safety_reports
    where reporter_id = actor and created_at > submitted_at - interval '24 hours'
      and reported_group_id is not distinct from group_target
      and reported_user_id is not distinct from p_user_id
      and context_group_id is not distinct from context_group
      and reason = p_reason
  ) then
    return;
  end if;

  insert into private.safety_report_limits as limits (reporter_id, window_start, submissions)
    values (actor, submitted_at, 1)
    on conflict (reporter_id) do update
    set window_start = case when limits.window_start <= submitted_at - interval '1 hour'
      then submitted_at else limits.window_start end,
      submissions = case when limits.window_start <= submitted_at - interval '1 hour'
      then 1 else limits.submissions + 1 end
    where limits.window_start <= submitted_at - interval '1 hour' or limits.submissions < 5;
  if not found then
    raise exception 'safety_report_rate_limited' using errcode = 'P0001';
  end if;

  insert into private.safety_reports (
    reporter_id, reported_type, reported_group_id, reported_user_id, context_group_id,
    reason, description, created_at, updated_at
  ) values (
    actor, target_type, group_target, p_user_id, context_group,
    p_reason, nullif(btrim(p_description), ''), submitted_at, submitted_at
  );
exception when check_violation then
  raise exception 'Invalid report details' using errcode = '22023';
end;
$$;
revoke all on function private.submit_safety_report(uuid, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function private.submit_safety_report(uuid, uuid, text, text) to authenticated;

create function public.submit_safety_report(p_group_id uuid, p_user_id uuid, p_reason text, p_description text)
returns void language sql security invoker set search_path = '' as $$
  select private.submit_safety_report(p_group_id, p_user_id, p_reason, p_description);
$$;
revoke all on function public.submit_safety_report(uuid, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.submit_safety_report(uuid, uuid, text, text) to authenticated;

create function private.stamp_safety_review() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  if new.status in ('resolved', 'dismissed') then
    if nullif(btrim(new.review_decision), '') is null then
      raise exception 'A review decision is required' using errcode = '23514';
    end if;
    if new.status is distinct from old.status then
      new.resolved_at := new.updated_at;
    end if;
  else
    new.resolved_at := null;
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_safety_review() from public, anon, authenticated, service_role;
create trigger stamp_safety_review before update of status, review_decision on private.safety_reports
  for each row execute function private.stamp_safety_review();

-- Keep this deliberately narrow and in sync with content.ts. Legacy text is checked only if changed.
create function private.check_safety_text() returns trigger
language plpgsql set search_path = '' as $$
declare
  changed_text text[];
  value text;
begin
  if tg_table_name = 'profiles' then
    if tg_op = 'INSERT' or new.display_name is distinct from old.display_name then
      changed_text := array[new.display_name];
    end if;
  elsif tg_op = 'INSERT' then
    changed_text := array[new.name, new.description];
  else
    changed_text := array[
      case when new.name is distinct from old.name then new.name end,
      case when new.description is distinct from old.description then new.description end
    ];
  end if;
  foreach value in array coalesce(changed_text, array[]::text[]) loop
    if lower(regexp_replace(btrim(value), ' +', ' ', 'g') collate "C")
      in ('kill all jews', 'kill all muslims', 'kill all gays') then
      raise exception 'Text contains a threat' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.check_safety_text() from public, anon, authenticated, service_role;
create trigger check_profile_safety_text before insert or update of display_name on public.profiles
  for each row execute function private.check_safety_text();
create trigger check_group_safety_text before insert or update of name, description on public.groups
  for each row execute function private.check_safety_text();
