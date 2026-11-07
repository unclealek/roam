// Explicit user-requested hosted fixture. Secrets stay in memory; report contains IDs only.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
if (!process.argv.includes("--create-requested-fixture"))
  throw new Error("Explicit fixture flag required");
const project = "ywpmvqgtiawtkcqxeehf";
const dir = await mkdtemp(join(tmpdir(), "roam-fortest-"));
const manifest = {
  project,
  group_id: null,
  session_id: null,
  owner_id: null,
  users: [],
  checks: [],
  created_at: new Date().toISOString(),
};
async function record() {
  await writeFile(
    "docs/artifacts/fortest-fixture.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
}
function cli(args) {
  try {
    return execFileSync("supabase", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60000,
    });
  } catch {
    throw new Error("Supabase CLI failed; sensitive output suppressed");
  }
}
async function sql(query) {
  const file = join(dir, randomUUID() + ".sql");
  await writeFile(file, query, { mode: 0o600 });
  try {
    const raw = cli([
      "db",
      "query",
      "--linked",
      "--project-ref",
      project,
      "--file",
      file,
    ]);
    return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1))
      .rows;
  } finally {
    await rm(file, { force: true });
  }
}
function checked(result, label) {
  if (result.error)
    throw new Error(
      `${label} failed (${result.error.code ?? result.error.status ?? "request"})`,
    );
  return result.data;
}
async function rpc(client, name, args = {}) {
  return checked(await client.rpc(name, args), name);
}
function literal(value) {
  return "'" + value.replaceAll("'", "''") + "'";
}
function pass(name) {
  manifest.checks.push(name);
  console.log("PASS: " + name);
}
try {
  const [inspection] = await sql(
    `select (select id from public.profiles where lower(display_name)='kelvin') as owner, (select count(*) from public.groups where name='ForTest') as existing;`,
  );
  assert(
    inspection.owner && inspection.existing === 0,
    "Owner must be unique and ForTest must not already exist; use the manifest to resume manually",
  );
  manifest.owner_id = inspection.owner;
  const [session] = await sql(
    `select id from auth.sessions where user_id=${literal(inspection.owner)}::uuid order by created_at desc limit 1;`,
  );
  assert(session?.id, "Owner needs an active app session");
  async function owner(expression) {
    const claims = JSON.stringify({
      sub: inspection.owner,
      session_id: session.id,
      role: "authenticated",
    });
    const rows = await sql(
      `begin; do $$ begin perform set_config('request.jwt.claims',${literal(claims)},true); end $$; set local role authenticated; select ${expression} as value; commit;`,
    );
    assert(rows?.[0]?.value, "Owner fixture operation returned no result");
    return rows[0].value;
  }
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
  assert(secret && publicKey);
  const url = `https://${project}.supabase.co`;
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const admin = createClient(url, secret, options);
  const group = await owner(
    `public.create_group('ForTest','Dummy group for testing Roam with seven test members.',null)`,
  );
  manifest.group_id = group.id;
  await record();
  const invite = await owner(
    `public.create_group_invite(${literal(group.id)}::uuid,7,7)`,
  );
  const clients = [];
  for (let n = 1; n <= 7; n++) {
    const suffix = String(n).padStart(2, "0");
    const email = `fortest-${randomUUID()}@example.invalid`;
    const password = `ForTest!${randomBytes(28).toString("base64url")}9a`;
    const displayName = `ForTest Player ${suffix}`;
    const created = checked(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
        app_metadata: { roam_test_fixture: "ForTest" },
      }),
      "dummy account creation",
    );
    manifest.users.push({ id: created.user.id, display_name: displayName });
    await record();
    const client = createClient(url, publicKey, options);
    checked(
      await client.auth.signInWithPassword({ email, password }),
      "dummy sign-in",
    );
    checked(
      await client
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", created.user.id),
      "dummy profile",
    );
    await rpc(client, "redeem_group_invite", { p_code: invite.code });
    clients.push(client);
  }
  const detail = await owner(`public.get_group(${literal(group.id)}::uuid)`);
  assert.equal(detail.member_count, 8);
  pass("ForTest contains Kelvin as owner and seven dummy members");
  const joining = new Date(Date.now() + 7 * 86400000).toISOString();
  const settings = {
    description:
      "Ready for you to test. Seven dummy players are already enrolled; start the draw when you are ready.",
    joining_deadline: joining,
    exchange_date: new Date(Date.now() + 14 * 86400000)
      .toISOString()
      .slice(0, 10),
    exchange_timezone: "Europe/Helsinki",
    budget_amount: 25,
    currency_code: "EUR",
    identity_reveal_enabled: true,
    mind_match_enabled: false,
    secret_agent_enabled: false,
    secret_missions_enabled: false,
    max_participants: 100,
  };
  const lobby = await owner(
    `public.secret_santa_lobby('create',null,${literal(JSON.stringify({ name: "ForTest Secret Santa", settings, request_id: randomUUID(), group_id: group.id }))}::jsonb)`,
  );
  manifest.session_id = lobby.id;
  await record();
  for (const client of clients)
    await rpc(client, "secret_santa_lobby", {
      p_action: "join",
      p_session_id: lobby.id,
      p_data: {},
    });
  const current = await owner(
    `public.secret_santa_lobby('get',${literal(lobby.id)}::uuid,'{}'::jsonb)`,
  );
  assert.equal(current.participant_count, 8);
  assert.equal(current.settings.lobby_phase, "joining_open");
  pass("Test Secret Santa lobby has eight participants and an unstarted draw");
  for (const client of clients) {
    const dashboard = await rpc(client, "reward_account", {
      p_action: "dashboard",
      p_data: {},
    });
    assert.equal(dashboard.progress.total_xp, 0);
    assert(
      Array.isArray(dashboard.collectibles) &&
        dashboard.collectibles.length > 0,
    );
    const card = await rpc(client, "reward_account", {
      p_action: "card",
      p_data: { card_id: "first_steps" },
    });
    assert.equal(card.unlocked_at, null);
    const invalid = await rpc(client, "reward_account", {
      p_action: "card",
      p_data: { card_id: "unknown-card" },
    });
    assert.equal(invalid, null);
    const notifications = await rpc(client, "notification_account", {
      p_action: "list",
      p_data: {},
    });
    assert(Array.isArray(notifications.items));
  }
  pass(
    "All seven live authenticated dummy accounts can load rewards and notifications; cards remain correctly locked at zero XP",
  );
  const pref = await rpc(clients[0], "notification_account", {
    p_action: "preferences",
    p_data: {},
  });
  const changed = await rpc(clients[0], "notification_account", {
    p_action: "save_preferences",
    p_data: {
      timezone: "Europe/Helsinki",
      quiet_hours_enabled: !pref.quiet_hours_enabled,
    },
  });
  assert.equal(changed.quiet_hours_enabled, !pref.quiet_hours_enabled);
  await rpc(clients[0], "notification_account", {
    p_action: "save_preferences",
    p_data: {
      timezone: pref.timezone,
      quiet_hours_enabled: pref.quiet_hours_enabled,
    },
  });
  pass("Live notification preferences save and restore correctly");
  const unauthorized = await clients[0].rpc("award_xp_for_event", {
    p_user: manifest.users[0].id,
    p_event: "session_finished",
    p_session: lobby.id,
    p_source: null,
  });
  assert(unauthorized.error);
  pass("Client cannot grant itself unearned XP");
  const cross = checked(
    await clients[0]
      .from("xp_transactions")
      .select("id")
      .eq("user_id", manifest.owner_id),
    "cross-account rewards check",
  );
  assert.equal(cross.length, 0);
  pass("Reward data remains isolated across accounts");
  const hostNotices = await owner(
    `public.notification_account('list','{}'::jsonb)`,
  );
  manifest.host_notification_count = hostNotices.items.length;
  const final = await sql(
    `select (select count(*) from public.group_members where group_id=${literal(group.id)}::uuid) as members,(select count(*) from public.game_session_members where session_id=${literal(lobby.id)}::uuid) as participants,(select count(*) from private.secret_santa_assignments where session_id=${literal(lobby.id)}::uuid) as assignments;`,
  );
  assert.equal(final[0].members, 8);
  assert.equal(final[0].participants, 8);
  assert.equal(final[0].assignments, 0);
  manifest.final = final[0];
  await record();
  console.log(
    JSON.stringify({
      group_id: group.id,
      session_id: lobby.id,
      members: 8,
      draw: "unstarted",
    }),
  );
} catch (error) {
  await record();
  console.error(
    error instanceof Error ? error.message : "Fixture setup failed",
  );
  console.error(
    "Partial fixture IDs, if any, are saved in docs/artifacts/fortest-fixture.json. No existing data was deleted.",
  );
  process.exitCode = 1;
} finally {
  await rm(dir, { recursive: true, force: true });
}
