// A disposable, loopback-only PostgreSQL test. Install embedded-postgres in a
// temporary directory and set ROAM_POSTGRES_RUNTIME to its package.json path.
// This never reads .env or connects to the app's Supabase project.
import { createRequire } from "node:module";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const runtime = process.env.ROAM_POSTGRES_RUNTIME;
if (!runtime)
  throw new Error(
    "Set ROAM_POSTGRES_RUNTIME to a temporary embedded-postgres installation package.json.",
  );
const requireRuntime = createRequire(runtime);
const { default: EmbeddedPostgres } = await import(
  requireRuntime.resolve("embedded-postgres")
);
const data = await mkdtemp(join(tmpdir(), "roam-rewards-race-"));
const pg = new EmbeddedPostgres({
  databaseDir: join(data, "db"),
  user: "postgres",
  password: "local-fixture-only",
  port: 55485,
  persistent: false,
  onLog: () => {},
  onError: () => {},
});
const connections = [];
async function connect(actor) {
  const c = pg.getPgClient();
  await c.connect();
  connections.push(c);
  if (actor) {
    await c.query("set role authenticated");
    await c.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: actor, session_id: actor }),
    ]);
  }
  return c;
}
async function rpc(c, name, args = []) {
  const { rows } = await c.query(
    `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`,
    args,
  );
  return rows[0].value;
}
try {
  await pg.initialise();
  await pg.start();
  const admin = await connect();
  await admin.query(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade);create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.jwt(),auth.uid() to authenticated,anon;`,
  );
  for (const f of (
    await readdir(new URL("../supabase/migrations/", import.meta.url))
  )
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await admin.query(
      await readFile(
        new URL(`../supabase/migrations/${f}`, import.meta.url),
        "utf8",
      ),
    );
  const user = "11111111-1111-4111-8111-111111111111";
  await admin.query("insert into auth.users values($1)", [user]);
  await admin.query("insert into auth.sessions values($1,$1)", [user]);
  await admin.query(
    `insert into game_types(id,name,description,category,icon_ref,min_players,availability_status,configuration_schema,lifecycle_operations) values('scheduler_fixture','Fixture','Test','Test','test',1,'available','{"type":"object","properties":{},"required":[],"additionalProperties":false}','{}')`,
  );
  const session = (
    await admin.query(
      `insert into game_sessions(game_type_id,host_id,name,configuration,creation_request_id,creation_fingerprint) values('scheduler_fixture',$1,'Fixture','{}',gen_random_uuid(),'fixture') returning id`,
      [user],
    )
  ).rows[0].id;
  await admin.query(
    "insert into game_session_members(session_id,user_id,role) values($1,$2,'host')",
    [session, user],
  );
  await admin.query("update game_sessions set status='lobby' where id=$1", [
    session,
  ]);
  await admin.query("update game_sessions set status='active' where id=$1", [
    session,
  ]);

  await admin.query("update game_sessions set status='completed' where id=$1", [
    session,
  ]);
  const one = await connect();
  const two = await connect();
  const args = [user, "session_finished", session, null];
  await one.query("begin");
  const first = await rpc(one, "award_xp_for_event", args);
  const pending = rpc(two, "award_xp_for_event", args);
  let waiting = false;
  for (let i = 0; i < 100 && !waiting; i++) {
    waiting = (
      await admin.query(
        "select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and query like '%award_xp_for_event%') as waiting",
      )
    ).rows[0].waiting;
    if (!waiting) await new Promise((r) => setTimeout(r, 10));
  }
  assert.equal(
    waiting,
    true,
    "second reward transaction must contend for the same player lock",
  );
  await one.query("commit");
  const second = await pending;
  assert.equal(first.id, second.id);
  assert.equal(second.duplicate, true);
  await Promise.all([
    rpc(one, "award_xp_for_event", [
      user,
      "first_game_completed",
      session,
      null,
    ]),
    rpc(two, "award_xp_for_event", [
      user,
      "first_game_completed",
      session,
      null,
    ]),
  ]);
  await Promise.all([
    rpc(one, "process_reward_events"),
    rpc(two, "process_reward_events"),
  ]);
  assert.equal(
    (await admin.query("select sum(amount)::int as xp from xp_transactions"))
      .rows[0].xp,
    200,
  );
  assert.equal(
    (await admin.query("select count(*)::int as n from user_collectibles"))
      .rows[0].n,
    1,
  );
  await admin.query(
    `insert into collectible_cards(id,name,description,rarity,artwork_key,unlock_rule) values('test_race','Test race','Fixture','common','test','{"kind":"total_xp","count":1}')`,
  );
  const cards = await Promise.all([
    rpc(one, "unlock_collectible", [user, "test_race", session]),
    rpc(two, "unlock_collectible", [user, "test_race", session]),
  ]);
  assert.equal(cards.filter(Boolean).length, 1);
  const n = (
    await admin.query(
      "select count(*)::int as total,count(distinct event_key)::int as distinct_events from user_notifications where category='rewards'",
    )
  ).rows[0];
  assert.equal(n.total, n.distinct_events);
  console.log(
    "PASS: independent PostgreSQL transactions contend for the player lock, award one XP transaction, deduplicate first-game bonuses and worker replays, unlock one card and emit unique reward notifications.",
  );
} finally {
  await Promise.allSettled(
    connections.map(async (c) => {
      try {
        await c.query("rollback");
      } finally {
        await c.end();
      }
    }),
  );
  await pg.stop();
  await rm(data, { recursive: true, force: true });
}
