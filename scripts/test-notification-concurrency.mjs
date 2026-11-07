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
const data = await mkdtemp(join(tmpdir(), "roam-scheduler-race-"));
const pg = new EmbeddedPostgres({
  databaseDir: join(data, "db"),
  user: "postgres",
  password: "local-fixture-only",
  port: 55484,
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
  const one = await connect();
  const two = await connect();
  const args = [
    session,
    "challenge",
    user,
    null,
    null,
    "same-trusted-event",
    {},
  ];
  const created = await Promise.all([
    rpc(one, "schedule_activity", args),
    rpc(two, "schedule_activity", args),
  ]);
  assert.equal(created[0], created[1]);
  await one.query("begin");
  await rpc(one, "notification_worker", ["tick"]);
  // First transaction holds activity and notification locks. The second must skip,
  // finish without waiting, and publish no duplicate notification.
  await two.query("set statement_timeout='2s'");
  await rpc(two, "notification_worker", ["tick"]);
  await one.query("commit");
  await rpc(two, "notification_worker", ["tick"]);
  assert.equal(
    (await admin.query("select count(*)::int as n from user_notifications"))
      .rows[0].n,
    1,
  );
  await admin.query(
    "insert into notification_preferences(user_id,push_enabled,quiet_hours_enabled) values($1,true,false)",
    [user],
  );
  await admin.query(
    "insert into private.device_push_tokens(user_id,expo_push_token,platform,device_identifier) values($1,'ExpoPushToken[race]','ios',gen_random_uuid())",
    [user],
  );
  await one.query("begin");
  const claimed = await rpc(one, "notification_worker", ["claim"]);
  assert.equal(claimed.length, 1);
  assert.deepEqual(await rpc(two, "notification_worker", ["claim"]), []);
  await one.query("commit");
  assert.deepEqual(await rpc(two, "notification_worker", ["claim"]), []);
  assert.ok(await rpc(one, "notification_worker", ["begin_send", claimed[0]]));
  assert.equal(
    await rpc(two, "notification_worker", ["begin_send", claimed[0]]),
    null,
  );
  console.log(
    "PASS: independent PostgreSQL connections deduplicate trusted events, skip locked activity rows, create one notification and exclusively claim/begin each delivery.",
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
