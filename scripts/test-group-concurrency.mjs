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
const data = await mkdtemp(join(tmpdir(), "roam-group-race-"));
const pg = new EmbeddedPostgres({
  databaseDir: join(data, "db"),
  user: "postgres",
  password: "local-fixture-only",
  port: 55483,
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
  const ids = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
  ];
  for (const id of ids) {
    await admin.query("insert into auth.users values($1)", [id]);
    await admin.query("insert into auth.sessions values($1,$1)", [id]);
  }
  const alice = await connect(ids[0]);
  const bob = await connect(ids[1]);
  const carol = await connect(ids[2]);
  const g = await rpc(alice, "create_group", ["Race test", null, null]);
  const i = await rpc(alice, "create_group_invite", [g.id, 7, 1]);
  await admin.query("begin");
  await admin.query("select id from groups where id=$1 for update", [g.id]);
  // Both transactions reach the same group lock before either can redeem.
  const requests = [
    rpc(bob, "redeem_group_invite", [i.code]),
    rpc(carol, "redeem_group_invite", [i.code]),
  ];
  let waiting = 0;
  for (let n = 0; n < 100 && waiting < 2; n++) {
    const { rows } = await admin.query(
      "select count(*)::int as n from pg_stat_activity where wait_event_type='Lock' and query like '%redeem_group_invite%'",
    );
    waiting = rows[0].n;
    if (waiting < 2) await new Promise((r) => setTimeout(r, 10));
  }
  assert.equal(
    waiting,
    2,
    "both independent transactions must be blocked concurrently",
  );
  await admin.query("commit");
  const results = await Promise.all(requests);
  assert.equal(results.filter((r) => r.id === g.id).length, 1);
  assert.deepEqual(
    results.find((r) => r.error),
    { error: "unavailable" },
  );
  const { rows } = await admin.query(
    "select use_count,(select count(*)::int from group_members where group_id=$2) as members from group_invites where id=$1",
    [i.id, g.id],
  );
  assert.deepEqual(rows, [{ use_count: 1, members: 2 }]);
  console.log(
    "PASS: two independent PostgreSQL transactions contended for a one-use invitation; exactly one joined, use_count=1, membership count=2.",
  );
  const succession = await rpc(alice, "create_group", [
    "Succession race",
    null,
    null,
  ]);
  const joinInvite = await rpc(alice, "create_group_invite", [
    succession.id,
    7,
    null,
  ]);
  await rpc(bob, "redeem_group_invite", [joinInvite.code]);
  await rpc(alice, "set_group_vice_owner", [succession.id, ids[1]]);
  await admin.query("begin");
  await admin.query("select id from groups where id=$1 for update", [
    succession.id,
  ]);
  const exits = [
    rpc(alice, "leave_group", [succession.id]),
    rpc(bob, "leave_group", [succession.id]),
  ];
  const settled = Promise.allSettled(exits);
  await new Promise((r) => setTimeout(r, 100));
  await admin.query("commit");
  const outcomes = await settled;
  assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
  const invariant = await admin.query(
    `select g.owner_id,g.vice_owner_id,
    (select count(*)::int from group_members m where m.group_id=g.id and m.user_id=g.owner_id and m.role='owner') as owners,
    (select count(*)::int from group_members m where m.group_id=g.id) as members
    from groups g where id=$1`,
    [succession.id],
  );
  assert.equal(invariant.rows[0].owners, 1);
  assert.equal(invariant.rows[0].members, 1);
  assert.equal(invariant.rows[0].vice_owner_id, null);
  console.log(
    "PASS: concurrent owner and vice departures preserve exactly one owner and prevent an orphaned group.",
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
