// Explicit hosted Scope 07 verification. Creates disposable accounts and a group,
// exercises real authenticated APIs and Cron, then removes only its own fixtures.
// API keys/passwords/tokens/recipient relationships never enter files or output.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
const project = "ywpmvqgtiawtkcqxeehf";
if (!process.argv.includes("--approved-hosted-fixtures"))
  throw new Error(
    "Requires explicit authorization for hosted fixture creation and deletion.",
  );
const run = randomUUID();
const dir = await mkdtemp(join(tmpdir(), "roam-scope07-hosted-"));
const users = [],
  sessions = [];
let groupId = null;
let admin;
const evidence = {
  run,
  project,
  started_at: new Date().toISOString(),
  tests: [],
  sessions: [],
  cleanup: null,
};
function cli(args) {
  try {
    return execFileSync("supabase", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60000,
    });
  } catch {
    throw new Error(
      "Supabase CLI operation failed; no sensitive output was logged.",
    );
  }
}
async function sql(query) {
  const path = join(dir, `${randomUUID()}.sql`);
  await writeFile(path, query, { mode: 0o600 });
  try {
    const raw = cli([
      "db",
      "query",
      "--linked",
      "--project-ref",
      project,
      "--file",
      path,
    ]);
    return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1))
      .rows;
  } finally {
    await rm(path, { force: true });
  }
}
function check(result, label) {
  if (result.error)
    throw new Error(
      `${label} failed (${result.error.code ?? result.error.status ?? "request"})`,
    );
  return result.data;
}
async function rpc(client, name, args = {}) {
  return check(await client.rpc(name, args), name);
}
const act = (client, action, id = null, data = {}) =>
  rpc(client, "secret_santa_lobby", {
    p_action: action,
    p_session_id: id,
    p_data: data,
  });
const pass = (name) => {
  evidence.tests.push(name);
  console.log(`PASS: ${name}`);
};
const q = (v) => {
  assert.match(v, /^[a-f0-9-]{36}$/);
  return `'${v}'::uuid`;
};
async function recordManifest() {
  await writeFile(
    join(dir, "fixtures.json"),
    JSON.stringify({
      run,
      project,
      users: users.map((u) => u.id),
      sessions,
      groupId,
    }),
    { mode: 0o600 },
  );
}
async function newSession(kind, deadline) {
  const date = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const lobby = await act(users[0].client, "create", null, {
    name: `S07 verification ${kind} ${run.slice(0, 8)}`,
    settings: {
      description: "Disposable Scope 07 verification",
      joining_deadline: deadline,
      exchange_date: date,
      exchange_timezone: "Europe/Helsinki",
      budget_amount: 25,
      currency_code: "EUR",
      identity_reveal_enabled: true,
      mind_match_enabled: true,
      secret_agent_enabled: true,
      secret_missions_enabled: false,
      max_participants: 100,
    },
    request_id: randomUUID(),
    group_id: groupId,
  });
  sessions.push(lobby.id);
  await recordManifest();
  for (const user of users.slice(1)) await act(user.client, "join", lobby.id);
  const joined = await act(users[0].client, "get", lobby.id);
  assert.equal(joined.participant_count, 13);
  assert.equal(joined.settings.lobby_phase, "joining_open");
  return joined;
}
async function verifyPrivateCycle(session) {
  const map = new Map();
  for (const user of users) {
    const hidden = await act(user.client, "assignment", session.id);
    assert.equal(hidden.recipient, null);
    assert.equal(hidden.revealed_at, null);
    const revealed = await act(user.client, "reveal", session.id);
    assert.equal(typeof revealed.recipient.display_name, "string");
    assert.equal(revealed.recipient.available, true);
    assert.equal(Object.hasOwn(revealed, "giver_id"), false);
    assert.equal(Object.hasOwn(revealed, "recipient_id"), false);
    assert.equal(Object.hasOwn(revealed.recipient, "id"), false);
    const recipient = users.find(
      (u) => u.displayName === revealed.recipient.display_name,
    );
    assert(recipient, "Recipient must belong to fixture group");
    assert.notEqual(recipient.id, user.id);
    map.set(user.id, recipient.id);
    const revisit = await act(user.client, "assignment", session.id);
    assert.equal(revisit.revealed_at, revealed.revealed_at);
    assert.deepEqual(revisit.recipient, revealed.recipient);
    const repeated = await act(user.client, "reveal", session.id);
    assert.equal(repeated.revealed_at, revealed.revealed_at);
    const notices = check(
      await user.client
        .from("user_notifications")
        .select("template_key,title,body,route")
        .eq("related_session_id", session.id),
      "owned notifications",
    );
    assert.equal(
      notices.filter((n) => n.template_key === "secret_santa_assignment_ready")
        .length,
      1,
    );
    assert.equal(
      notices.filter((n) => n.template_key === "secret_santa_game_started")
        .length,
      1,
    );
    for (const notice of notices) {
      assert(
        !users.some((u) =>
          (notice.title + notice.body).includes(u.displayName),
        ),
      );
      assert.equal(notice.route, `/session/${session.id}`);
    }
  }
  assert.equal(map.size, 13);
  assert.equal(new Set(map.values()).size, 13);
  let current = users[0].id;
  const visited = new Set();
  for (let i = 0; i < 13; i++) {
    assert(!visited.has(current));
    visited.add(current);
    current = map.get(current);
  }
  assert.equal(current, users[0].id);
  const snapshot = (
    await sql(
      `select s.status,t.lobby_phase,t.joining_deadline,t.joining_closed_at,t.matched_at,t.exchange_date,t.exchange_timezone,(select count(*) from private.secret_santa_assignments a where a.session_id=s.id) as assignments,(select count(*) from public.user_notifications n where n.related_session_id=s.id and n.template_key='secret_santa_assignment_ready') as ready_notifications,(select count(*) from public.scheduled_activities a where a.game_session_id=s.id and a.activity_type not in ('secret_santa_close','secret_santa_closing','secret_santa_draw')) as gameplay_activities from public.game_sessions s join public.secret_santa_settings t on t.session_id=s.id where s.id=${q(session.id)};`,
    )
  )[0];
  assert.equal(snapshot.assignments, 13);
  assert.equal(snapshot.ready_notifications, 13);
  assert.equal(snapshot.gameplay_activities, 0);
  assert.equal(snapshot.status, "active");
  assert.equal(snapshot.lobby_phase, "matched");
  evidence.sessions.push({ id: session.id, ...snapshot });
}
let failure = null;
try {
  const keys = JSON.parse(
    cli([
      "projects",
      "api-keys",
      "--project-ref",
      project,
      "--reveal",
      "--output",
      "json",
    ]),
  );
  const secret =
    keys.find((k) => k.type === "secret")?.api_key ??
    keys.find((k) => k.name === "service_role")?.api_key;
  const publicKey =
    keys.find((k) => k.type === "publishable")?.api_key ??
    keys.find((k) => k.name === "anon")?.api_key;
  assert(secret && publicKey, "Required API keys unavailable");
  const url = `https://${project}.supabase.co`;
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  admin = createClient(url, secret, options);
  for (let i = 0; i < 13; i++) {
    const password = `S07!${randomBytes(24).toString("base64url")}a9`;
    const email = `s07-${run}-${i}@example.invalid`;
    const created = check(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
      "create disposable account",
    );
    const fixture = {
      id: created.user.id,
      client: null,
      displayName: `S07 ${run.slice(0, 8)} Player ${String(i + 1).padStart(2, "0")}`,
    };
    users.push(fixture);
    await recordManifest();
    fixture.client = createClient(url, publicKey, options);
    check(
      await fixture.client.auth.signInWithPassword({ email, password }),
      "fixture password sign-in",
    );
    check(
      await fixture.client
        .from("profiles")
        .update({ display_name: fixture.displayName })
        .eq("id", fixture.id),
      "fixture profile",
    );
  }
  pass("13 disposable accounts authenticated with real live Auth sessions");
  const group = await rpc(users[0].client, "create_group", {
    p_name: `S07 verification ${run.slice(0, 8)}`,
    p_description: "Disposable integration verification",
    p_icon_key: null,
  });
  groupId = group.id;
  await recordManifest();
  const invite = await rpc(users[0].client, "create_group_invite", {
    p_group_id: groupId,
    p_days: 1,
    p_max_uses: 12,
  });
  for (const user of users.slice(1))
    await rpc(user.client, "redeem_group_invite", { p_code: invite.code });
  const details = await rpc(users[0].client, "get_group", {
    p_group_id: groupId,
  });
  assert.equal(details.member_count, 13);
  pass("Persistent group invitation redeemed by all 13 participants");
  const early = await newSession(
    "early",
    new Date(Date.now() + 20 * 60000).toISOString(),
  );
  const unauthorized = await users[1].client.rpc("secret_santa_lobby", {
    p_action: "draw",
    p_session_id: early.id,
    p_data: {},
  });
  assert(unauthorized.error);
  pass("Non-host early draw denied");
  const [first, retry] = await Promise.all([
    act(users[0].client, "draw", early.id),
    act(users[0].client, "draw", early.id),
  ]);
  assert.equal(first.status, "active");
  assert.equal(first.settings.matched_at, retry.settings.matched_at);
  const forged = await users[0].client.rpc("secret_santa_lobby", {
    p_action: "assignment",
    p_session_id: early.id,
    p_data: { giver_id: users[1].id },
  });
  assert(forged.error);
  const genericStart = await users[0].client.rpc("start_game_session", {
    p_session_id: early.id,
  });
  assert(genericStart.error);
  const locked = await users[1].client.rpc("secret_santa_lobby", {
    p_action: "leave",
    p_session_id: early.id,
    p_data: {},
  });
  assert(locked.error);
  const direct = await users[0].client
    .schema("private")
    .from("secret_santa_assignments")
    .select("*");
  assert(direct.error);
  const publicTable = await users[0].client
    .from("secret_santa_assignments")
    .select("*");
  assert(publicTable.error);
  const anon = createClient(url, publicKey, options);
  assert(
    (
      await anon.rpc("secret_santa_lobby", {
        p_action: "assignment",
        p_session_id: early.id,
        p_data: {},
      })
    ).error,
  );
  pass(
    "Concurrent host draws converge; generic start, forged giver, anonymous and direct assignment reads are denied; membership locked",
  );
  await verifyPrivateCycle(early);
  pass(
    "Early draw: all 13 form one cycle, privately reveal and revisit; exactly 13 safe ready alerts",
  );
  // Build a separate 13-player season and let the existing minute Cron close and
  // draw it. This script NEVER calls notification_worker or a scheduler RPC.
  const automatic = await newSession(
    "automatic",
    new Date(Date.now() + 45000).toISOString(),
  );
  console.log(
    `WAITING: existing Cron will close and draw the 13-player session after ${automatic.settings.joining_deadline}`,
  );
  const stop = Date.now() + 240000;
  let matched = null;
  while (Date.now() < stop) {
    const current = await act(users[0].client, "get", automatic.id);
    if (current.settings.lobby_phase === "matched") {
      matched = current;
      break;
    }
    if (current.settings.lobby_phase === "draw_failed")
      throw new Error(
        "Hosted automatic draw entered recoverable failure; inspect safe activity state",
      );
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  assert(
    matched,
    "Hosted Cron did not complete automatic draw within four minutes",
  );
  assert(
    Date.parse(matched.settings.joining_closed_at) >=
      Date.parse(matched.settings.joining_deadline),
  );
  assert(
    Date.parse(matched.settings.matched_at) >=
      Date.parse(matched.settings.joining_closed_at),
  );
  await verifyPrivateCycle(automatic);
  const cron = await sql(
    `select d.runid,d.status,d.start_time,d.end_time from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname='roam-activities' and d.start_time >= (select joining_deadline from public.secret_santa_settings where session_id=${q(automatic.id)}) and d.start_time <= (select matched_at+interval '10 seconds' from public.secret_santa_settings where session_id=${q(automatic.id)}) order by d.start_time;`,
  );
  assert(cron.some((r) => r.status === "succeeded"));
  evidence.cron = cron;
  pass(
    "Existing live minute Cron closed joining and automatically matched all 13 without a manual scheduler call",
  );
  const replay = await act(users[0].client, "draw", automatic.id);
  assert.equal(replay.settings.matched_at, matched.settings.matched_at);
  const notices = check(
    await users[0].client
      .from("user_notifications")
      .select("id")
      .eq("related_session_id", automatic.id)
      .eq("template_key", "secret_santa_assignment_ready"),
    "deduplicated alerts",
  );
  assert.equal(notices.length, 1);
  pass(
    "Automatic draw replay preserves timestamp and does not duplicate notifications",
  );
} catch (error) {
  failure = error;
  console.error(
    "VERIFICATION FAILED: private error details withheld; inspect the last completed stage and fixture manifest.",
  );
} finally {
  // Cleanup uses only UUIDs registered by this process, even if verification fails.
  try {
    if (sessions.length)
      await sql(
        `delete from public.game_sessions where id in (${sessions.map(q).join(",")});select count(*) as remaining_sessions from public.game_sessions where id in (${sessions.map(q).join(",")});`,
      );
    if (groupId) {
      const result = await admin.from("groups").delete().eq("id", groupId);
      if (result.error)
        await sql(
          `delete from public.groups where id=${q(groupId)};select count(*) as remaining_groups from public.groups where id=${q(groupId)};`,
        );
    }
    for (const user of users)
      check(
        await admin.auth.admin.deleteUser(user.id),
        "delete disposable account",
      );
    if (users.length) {
      const ids = users.map((u) => q(u.id)).join(",");
      // This fixture has no remaining sessions, so even UUID-only tombstones can go.
      await sql(
        `delete from private.session_account_refs r where r.user_id in (${ids}) and not exists(select 1 from public.game_sessions s where s.host_id=r.user_id) and not exists(select 1 from public.game_session_members m where m.user_id=r.user_id);select count(*) as remaining_refs from private.session_account_refs where user_id in (${ids});`,
      );
      const cleanup = (
        await sql(
          `select (select count(*) from auth.users where id in (${ids})) as auth_users,(select count(*) from auth.sessions where user_id in (${ids})) as auth_sessions,(select count(*) from public.profiles where id in (${ids})) as profiles,(select count(*) from public.game_session_members where user_id in (${ids})) as memberships,(select count(*) from public.user_notifications where user_id in (${ids})) as notifications,(select count(*) from private.session_account_refs where user_id in (${ids})) as account_refs${sessions.length ? `,(select count(*) from public.game_sessions where id in (${sessions.map(q).join(",")})) as game_sessions,(select count(*) from private.secret_santa_assignments where session_id in (${sessions.map(q).join(",")})) as assignments,(select count(*) from public.scheduled_activities where game_session_id in (${sessions.map(q).join(",")})) as activities` : ""}${groupId ? `,(select count(*) from public.groups where id=${q(groupId)}) as groups` : ""};`,
        )
      )[0];
      assert(
        Object.values(cleanup).every((n) => n === 0),
        "Fixture cleanup must leave zero rows",
      );
      evidence.cleanup = cleanup;
      pass(
        "Hosted cleanup verified: zero fixture accounts, auth sessions, profiles, memberships, notifications, identity refs, games, assignments, activities or groups",
      );
    }
    evidence.finished_at = new Date().toISOString();
    evidence.success = !failure;
    await writeFile(
      "docs/artifacts/scope-07-hosted-verification.json",
      JSON.stringify(evidence, null, 2) + "\n",
    );
    await rm(dir, { recursive: true, force: true });
  } catch (error) {
    console.error(
      `CLEANUP NEEDS ATTENTION: private error details withheld; fixture ID manifest retained in ${dir}`,
    );
    failure ??= error;
  }
}
if (failure) process.exitCode = 1;
