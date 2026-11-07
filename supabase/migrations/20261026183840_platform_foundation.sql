-- Scope 01 only: profiles and authenticated self-service account deletion.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player'
    check (char_length(display_name) between 1 and 50
      and display_name = btrim(display_name)
      and display_name !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id);
  return new;
end;
$$;
revoke all on function private.create_profile() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.create_profile();
-- Preserve accounts that predate this migration.
insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;

create function private.touch_profile() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.touch_profile() from public, anon, authenticated;
create trigger profiles_updated before update on public.profiles
  for each row execute function private.touch_profile();

-- Privilege elevation is required solely to remove the caller's auth record.
-- No target id is accepted. Check a live session as deleted/revoked JWTs can linger.
create function private.delete_own_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  current_session uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
begin
  if caller is null or current_session is null or not exists (
    select 1 from auth.sessions where id = current_session and user_id = caller
  ) then
    raise exception 'An active authenticated session is required' using errcode = '42501';
  end if;
  delete from auth.users where id = caller;
end;
$$;
revoke all on function private.delete_own_account() from public, anon, authenticated;
grant execute on function private.delete_own_account() to authenticated;
create function public.delete_own_account() returns void
language sql security invoker set search_path = '' as $$
  select private.delete_own_account();
$$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
