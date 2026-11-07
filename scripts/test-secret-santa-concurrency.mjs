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
const data = await mkdtemp(join(tmpdir(), "roam-santa-race-"));
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
  const settings = {
    joining_deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
    exchange_date: new Date(Date.now() + 86400000 * 10)
      .toISOString()
      .slice(0, 10),
    exchange_timezone: "Europe/Helsinki",
    currency_code: "EUR",
    identity_reveal_enabled: true,
    mind_match_enabled: false,
    secret_agent_enabled: false,
    secret_missions_enabled: false,
    max_participants: 3,
  };
  const request = crypto.randomUUID();
  const payload = {
    name: "Concurrent gifts",
    settings,
    request_id: request,
    group_id: null,
  };
  const alice2 = await connect(ids[0]);
  const created = await Promise.all([
    rpc(alice, "secret_santa_lobby", ["create", null, payload]),
    rpc(alice2, "secret_santa_lobby", ["create", null, payload]),
  ]);
  assert.equal(created[0].id, created[1].id);
  const lobby = created.find((x) => x.invitation?.code);
  const id4 = "44444444-4444-4444-8444-444444444444";
  await admin.query("insert into auth.users values($1)", [id4]);
  await admin.query("insert into auth.sessions values($1,$1)", [id4]);
  const dave = await connect(id4);
  await admin.query("begin");
  await admin.query("select id from game_sessions where id=$1 for update", [
    lobby.id,
  ]);
  const attempts = Promise.all(
    [bob, carol, dave].map((c) =>
      rpc(c, "secret_santa_lobby", [
        "redeem",
        null,
        { code: lobby.invitation.code },
      ]),
    ),
  );
  await new Promise((r) => setTimeout(r, 100));
  await admin.query("commit");
  const joined = await attempts;
  assert.equal(joined.filter((x) => x.id === lobby.id).length, 2);
  assert.equal(joined.filter((x) => x.error === "unavailable").length, 1);
  const counts = await admin.query(
    "select (select count(*)::int from game_session_members where session_id=$1) as members,(select count(*)::int from secret_santa_settings where session_id=$1) as settings,(select count(*)::int from private.session_invites where session_id=$1) as invites",
    [lobby.id],
  );
  assert.deepEqual(counts.rows, [{ members: 3, settings: 1, invites: 1 }]);
  await rpc(alice, "secret_santa_lobby", ["close", lobby.id, {}]);
  await rpc(alice2, "secret_santa_lobby", ["close", lobby.id, {}]);
  const ready = await rpc(alice, "secret_santa_lobby", ["get", lobby.id, {}]);
  assert.equal(ready.settings.lobby_phase, "ready_for_draw");
  assert.equal(ready.status, "lobby");
  console.log(
    "PASS: concurrent creates return one atomic lobby/invitation; three simultaneous joiners compete for two slots, capacity remains three; repeated closure reaches ready_for_draw without starting or matching.",
  );
  // Scope 07: build an actual group and join through authorized APIs, then race
  // independent PostgreSQL transactions. Never print the private mapping.
  const group = await rpc(alice, "create_group", [
    "Disposable Scope 07 circle",
    null,
    null,
  ]);
  const groupInvite = await rpc(alice, "create_group_invite", [
    group.id,
    7,
    null,
  ]);
  const people = [alice];
  const dummyIds = [];
  for (let i = 0; i < 12; i++) {
    const actor = crypto.randomUUID();
    dummyIds.push(actor);
    await admin.query("insert into auth.users values ($1)", [actor]);
    await admin.query("insert into auth.sessions values ($1,$1)", [actor]);
    const client = await connect(actor);
    people.push(client);
    await rpc(client, "redeem_group_invite", [groupInvite.code]);
  }
  const circle = await rpc(alice, "secret_santa_lobby", [
    "create",
    null,
    {
      ...payload,
      request_id: crypto.randomUUID(),
      group_id: group.id,
      settings: { ...settings, max_participants: 100 },
    },
  ]);
  for (const client of people.slice(1))
    await rpc(client, "secret_santa_lobby", ["join", circle.id, {}]);
  assert.equal(
    (await rpc(alice, "secret_santa_lobby", ["get", circle.id, {}]))
      .participant_count,
    13,
  );
  // Hold the first draw open while a second draw and late join wait for its lock.
  await alice.query("begin");
  const drawn = await rpc(alice, "secret_santa_lobby", ["draw", circle.id, {}]);
  assert.equal(drawn.status, "active");
  const secondDraw = rpc(alice2, "secret_santa_lobby", ["draw", circle.id, {}]);
  const lateJoin = rpc(dave, "secret_santa_lobby", [
    "redeem",
    null,
    { code: circle.invitation.code },
  ]);
  await alice.query("commit");
  assert.equal(
    (await secondDraw).settings.matched_at,
    drawn.settings.matched_at,
  );
  assert.equal((await lateJoin).error, "unavailable");
  const matching = (
    await admin.query(
      "select giver_id,recipient_id from private.secret_santa_assignments where session_id=$1",
      [circle.id],
    )
  ).rows;
  assert.equal(matching.length, 13);
  assert.equal(new Set(matching.map((x) => x.recipient_id)).size, 13);
  assert(matching.every((x) => x.giver_id !== x.recipient_id));
  let current = matching[0].giver_id;
  const visited = new Set();
  for (let i = 0; i < 13; i++) {
    assert(!visited.has(current));
    visited.add(current);
    current = matching.find((x) => x.giver_id === current).recipient_id;
  }
  assert.equal(current, matching[0].giver_id);
  for (const client of people) {
    const privateView = await rpc(client, "secret_santa_lobby", [
      "assignment",
      circle.id,
      {},
    ]);
    assert.equal(privateView.recipient, null);
    const reveal = await rpc(client, "secret_santa_lobby", [
      "reveal",
      circle.id,
      {},
    ]);
    assert(reveal.recipient.display_name);
    assert.equal(
      (await rpc(client, "secret_santa_lobby", ["assignment", circle.id, {}]))
        .revealed_at,
      reveal.revealed_at,
    );
    assert(!("recipient_id" in reveal));
  }
  assert.equal(
    (
      await admin.query(
        "select count(*)::int as n from user_notifications where related_session_id=$1 and template_key='secret_santa_assignment_ready'",
        [circle.id],
      )
    ).rows[0].n,
    13,
  );
  await admin.query("delete from game_sessions where id=$1", [circle.id]);
  await admin.query("delete from groups where id=$1", [group.id]);
  for (const actor of dummyIds)
    await admin.query("delete from auth.users where id=$1", [actor]);
  assert.equal(
    (
      await admin.query(
        "select count(*)::int as n from auth.users where id=any($1::uuid[])",
        [dummyIds],
      )
    ).rows[0].n,
    0,
  );
  console.log(
    "PASS: 13-person group created and joined through APIs; concurrent early draws converge, late join rejected, full single cycle validated, all 13 privately reveal and revisit, 13 deduplicated alerts; fixture group/session/users deleted.",
  );

  const next = await rpc(alice, "secret_santa_lobby", [
    "create",
    null,
    { ...payload, request_id: crypto.randomUUID() },
  ]);
  await admin.query(
    "update secret_santa_settings set joining_deadline=now()-interval '1 minute' where session_id=$1",
    [next.id],
  );
  await admin.query(
    "update scheduled_activities set unlock_at=now()-interval '1 minute' where game_session_id=$1",
    [next.id],
  );
  const worker2 = await connect();
  await Promise.all([
    rpc(admin, "notification_worker", ["tick"]),
    rpc(worker2, "notification_worker", ["tick"]),
  ]);
  // The earlier ready three-person lobby is drawn by these automatic workers.
  await Promise.all([
    rpc(admin, "notification_worker", ["tick"]),
    rpc(worker2, "notification_worker", ["tick"]),
  ]);
  const automatic = await rpc(alice, "secret_santa_lobby", [
    "get",
    lobby.id,
    {},
  ]);
  assert.equal(automatic.settings.lobby_phase, "matched");
  assert.equal(automatic.status, "active");
  assert.equal(
    (
      await admin.query(
        "select count(*)::int as n from private.secret_santa_assignments where session_id=$1",
        [lobby.id],
      )
    ).rows[0].n,
    3,
  );
  assert.equal(
    (
      await admin.query(
        "select count(*)::int as n from user_notifications where related_session_id=$1 and template_key='secret_santa_assignment_ready'",
        [lobby.id],
      )
    ).rows[0].n,
    3,
  );
  console.log(
    "PASS: concurrent automatic workers match a closed eligible session, activate it and emit exactly three private-ready alerts; insufficient session is not drawn.",
  );
  const notices = await admin.query(
    "select count(*)::int as n from user_notifications where related_session_id=$1 and template_key='secret_santa_joining_closed'",
    [next.id],
  );
  assert.equal(notices.rows[0].n, 1);
  console.log(
    "PASS: concurrent scheduler workers close the same due lobby once and deduplicate closure notification.",
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
