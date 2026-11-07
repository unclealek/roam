import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fixtureGame } from "./game";
export const users = {
  alice: "11111111-1111-4111-8111-111111111111",
  bob: "22222222-2222-4222-8222-222222222222",
  carol: "33333333-3333-4333-8333-333333333333",
  dave: "44444444-4444-4444-8444-444444444444",
  eve: "55555555-5555-4555-8555-555555555555",
} as const;
export async function sessionDatabase() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade);create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.jwt(),auth.uid() to authenticated,anon;`,
  );
  for (const name of [
    "20261026183840_platform_foundation.sql",
    "20261026185245_game_catalog_session_engine.sql",
    "20261026194636_restrict_rls_maintenance_function.sql",
    "20261027090000_groups_invitations.sql",
    "20261027090001_group_rpc_private_implementations.sql",
    "20261028170737_group_vice_owner_succession.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  await db.query(
    `insert into public.game_types(id,name,description,category,icon_ref,min_players,max_players,availability_status,configuration_schema,lifecycle_operations) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      fixtureGame.id,
      fixtureGame.metadata.name,
      fixtureGame.metadata.description,
      fixtureGame.metadata.category,
      fixtureGame.metadata.icon_ref,
      2,
      4,
      "available",
      JSON.stringify(fixtureGame.configurationSchema),
      [...fixtureGame.operations],
    ],
  );
  return db;
}
export async function resetUsers(db: PGlite) {
  await db.exec("reset role;truncate auth.users cascade;");
  for (const id of Object.values(users)) {
    await db.query("insert into auth.users values ($1)", [id]);
    await db.query("insert into auth.sessions values ($1,$1)", [id]);
  }
}
export async function login(db: PGlite, user: keyof typeof users) {
  await db.exec("reset role;set role authenticated");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: users[user], session_id: users[user] }),
  ]);
}
export async function rpc<T = Record<string, unknown>>(
  db: PGlite,
  name: string,
  args: unknown[] = [],
): Promise<T> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(",");
  const { rows } = await db.query<{ result: T }>(
    `select public.${name}(${placeholders}) as result`,
    args,
  );
  return rows[0].result;
}
