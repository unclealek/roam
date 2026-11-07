import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("removes client execution without disabling automatic RLS, and tolerates an absent helper", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated;");
    const migration = readFileSync(
      "supabase/migrations/20261026194636_restrict_rls_maintenance_function.sql",
      "utf8",
    );
    await db.exec(migration);
    await db.exec(`
      create function public.rls_auto_enable() returns event_trigger
      language plpgsql security definer set search_path=pg_catalog as $$
      declare command record;
      begin
        for command in select * from pg_event_trigger_ddl_commands() loop
          if command.schema_name='public' and command.object_type='table' then
            execute format('alter table %s enable row level security', command.object_identity);
          end if;
        end loop;
      end;
      $$;
      grant execute on function public.rls_auto_enable() to anon,authenticated;
      create event trigger enable_rls on ddl_command_end when tag in ('CREATE TABLE') execute function public.rls_auto_enable();
    `);
    await db.exec(migration);
    const { rows } = await db.query<{ anon: boolean; authenticated: boolean }>(
      `select has_function_privilege('anon','public.rls_auto_enable()','execute') as anon,has_function_privilege('authenticated','public.rls_auto_enable()','execute') as authenticated`,
    );
    expect(rows).toEqual([{ anon: false, authenticated: false }]);
    await db.exec("create table public.rls_probe(id integer);");
    expect(
      (
        await db.query<{ rowsecurity: boolean }>(
          "select rowsecurity from pg_tables where schemaname='public' and tablename='rls_probe'",
        )
      ).rows,
    ).toEqual([{ rowsecurity: true }]);
  } finally {
    await db.close();
  }
}, 30000);
