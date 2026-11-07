-- Some Supabase projects include this event-trigger maintenance helper.
-- It must remain usable by its event trigger, but is not a client RPC.
-- Guard the exact signature so fresh/local databases without it remain supported.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
