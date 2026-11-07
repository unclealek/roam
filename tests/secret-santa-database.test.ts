import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import {
  sessionDatabase,
  resetUsers,
  login,
  rpc,
  users,
} from "./fixtures/database";
let db: PGlite;
const settings = () => ({
  description: "Winter gifts",
  joining_deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
  exchange_date: new Date(Date.now() + 86400000 * 10)
    .toISOString()
    .slice(0, 10),
  exchange_timezone: "Europe/Helsinki",
  currency_code: "EUR",
  identity_reveal_enabled: true,
  mind_match_enabled: false,
  secret_agent_enabled: false,
  secret_missions_enabled: false,
  max_participants: 100,
});
const create = (
  config = settings(),
  request = crypto.randomUUID(),
  group: string | null = null,
) =>
  rpc<any>(db, "secret_santa_lobby", [
    "create",
    null,
    { name: "Winter", settings: config, request_id: request, group_id: group },
  ]);
const act = (op: string, id: string, data = {}) =>
  rpc<any>(db, "secret_santa_lobby", [op, id, data]);
beforeAll(async () => {
  db = await sessionDatabase();
  await db.exec("create role service_role");
  for (const f of [
    "20261027090002_scheduling_notifications.sql",
    "20261027134631_shared_rewards_collectibles.sql",
    "20261027181151_harden_notification_reward_rpc_storage.sql",
    "20261028182438_secret_santa_setup_lobby.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
}, 30000);
beforeEach(async () => {
  await resetUsers(db);
  await login(db, "alice");
});
afterAll(async () => {
  await db?.close();
});
it("creates atomically with host, lobby, hashed invite and scheduled closure; replays once", async () => {
  const c = settings(),
    key = crypto.randomUUID();
  const a = await create(c, key);
  const b = await create(c, key);
  expect(b.id).toBe(a.id);
  expect(a.status).toBe("lobby");
  expect(a.participant_count).toBe(1);
  expect(a.settings.lobby_phase).toBe("joining_open");
  expect(a.invitation.code).toMatch(/^[a-f0-9]{64}$/);
  await db.exec("reset role");
  expect(
    (await db.query("select * from private.session_invites")).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query(
        "select * from scheduled_activities where activity_type='secret_santa_close'",
      )
    ).rows,
  ).toHaveLength(1);
});
it("rejects invalid dates, currencies, budget and timezone without partial sessions", async () => {
  for (const patch of [
    { joining_deadline: "2000-01-01T00:00:00Z" },
    { exchange_date: "2000-01-01" },
    { budget_amount: -1 },
    { budget_amount: "NaN" },
    { currency_code: "ZZZ" },
    { exchange_timezone: "Mars/Space" },
    { max_participants: 2 },
  ])
    await expect(create({ ...settings(), ...patch } as any)).rejects.toThrow();
  expect(await rpc(db, "list_my_game_sessions")).toEqual([]);
});
it("secure invitation preview, confirm join, duplicate prevention, no implicit group membership", async () => {
  const a = await create();
  await login(db, "bob");
  await expect(rpc(db, "join_game_session", [a.id])).rejects.toThrow();
  const p = await act("preview", a.id, { code: a.invitation.code });
  expect(p.participants).toBeUndefined();
  expect(p.host_id).toBeUndefined();
  expect(p.name).toBe("Winter");
  await act("redeem", a.id, { code: a.invitation.code });
  await act("redeem", a.id, { code: a.invitation.code });
  expect((await act("get", a.id)).participant_count).toBe(2);
  expect(await rpc(db, "list_my_groups")).toEqual([]);
});
it("group members opt in independently and invitations do not bypass group authorization", async () => {
  const g = await rpc<any>(db, "create_group", ["Friends", null, null]);
  const i = await rpc<any>(db, "create_group_invite", [g.id, 7, null]);
  const a = await create(settings(), crypto.randomUUID(), g.id);
  await login(db, "bob");
  await expect(act("join", a.id)).rejects.toThrow();
  expect(await act("redeem", a.id, { code: a.invitation.code })).toEqual({
    error: "unavailable",
  });
  await rpc(db, "redeem_group_invite", [i.code]);
  expect(await rpc(db, "list_my_game_sessions")).toEqual([]);
  await act("join", a.id);
  expect((await act("get", a.id)).participant_count).toBe(2);
});
it("enforces capacity, locks host controls, closes early ready with 3, and cannot draw", async () => {
  const a = await create({ ...settings(), max_participants: 3 });
  for (const user of ["bob", "carol"] as const) {
    await login(db, user);
    await act("redeem", a.id, { code: a.invitation.code });
  }
  await login(db, "dave");
  expect(await act("redeem", a.id, { code: a.invitation.code })).toEqual({
    error: "unavailable",
  });
  await login(db, "bob");
  await expect(act("close", a.id)).rejects.toThrow();
  await login(db, "alice");
  await act("close", a.id);
  expect((await act("get", a.id)).settings.lobby_phase).toBe("ready_for_draw");
  await expect(act("remove", a.id, { user_id: users.bob })).rejects.toThrow();
  await expect(
    act("edit", a.id, { name: "Changed", settings: settings() }),
  ).rejects.toThrow();
  await expect(rpc(db, "start_game_session", [a.id])).rejects.toThrow();
});
it("rejects late joins before worker runs, closes insufficient, extends and cancels idempotently", async () => {
  const a = await create();
  await db.exec("reset role");
  await db.query(
    "update secret_santa_settings set joining_deadline=now()-interval '1 minute' where session_id=$1",
    [a.id],
  );
  await db.query(
    "update scheduled_activities set unlock_at=now()-interval '1 minute' where game_session_id=$1",
    [a.id],
  );
  await login(db, "bob");
  expect(await act("redeem", a.id, { code: a.invitation.code })).toEqual({
    error: "unavailable",
  });
  await db.exec("reset role");
  await rpc(db, "notification_worker", ["tick"]);
  await rpc(db, "notification_worker", ["tick"]);
  await login(db, "alice");
  expect((await act("get", a.id)).settings.lobby_phase).toBe(
    "insufficient_players",
  );
  await act("extend", a.id, { joining_deadline: settings().joining_deadline });
  expect((await act("get", a.id)).settings.lobby_phase).toBe("joining_open");
  await act("cancel", a.id);
  await act("cancel", a.id);
  expect((await act("get", a.id)).status).toBe("cancelled");
  await db.exec("reset role");
  expect(
    (
      await db.query(
        "select * from user_notifications where template_key='secret_santa_cancelled'",
      )
    ).rows,
  ).toHaveLength(1);
});
it("revokes invitations, rate limits guesses and keeps private rows protected", async () => {
  const a = await create();
  await act("revoke", a.id, { invite_id: a.invitation.id });
  await login(db, "bob");
  expect(await act("preview", a.id, { code: a.invitation.code })).toEqual({
    error: "unavailable",
  });
  for (let i = 0; i < 20; i++)
    await act("preview", a.id, { code: "f".repeat(64) });
  expect(await act("preview", a.id, { code: "f".repeat(64) })).toEqual({
    error: "rate_limited",
  });
  expect((await db.query("select * from secret_santa_settings")).rows).toEqual(
    [],
  );
  await expect(
    db.query("select * from private.session_invites"),
  ).rejects.toThrow(/permission/);
  await expect(
    db.query("update secret_santa_settings set lobby_phase='ready_for_draw'"),
  ).rejects.toThrow(/permission/);
});

it("edits only open host settings, removes members, and reuses a group across gift exchanges", async () => {
  const g = await rpc<any>(db, "create_group", ["Friends", null, null]);
  const gi = await rpc<any>(db, "create_group_invite", [g.id, 7, null]);
  const a = await create(settings(), crypto.randomUUID(), g.id);
  const b = await create(settings(), crypto.randomUUID(), g.id);
  expect(b.id).not.toBe(a.id);
  await login(db, "bob");
  await rpc(db, "redeem_group_invite", [gi.code]);
  const visible = await act("group_lobbies", a.id, { group_id: g.id });
  expect(visible).toHaveLength(2);
  await act("join", a.id);
  await expect(
    act("edit", a.id, { name: "Hacked", settings: settings() }),
  ).rejects.toThrow(/host/);
  await login(db, "alice");
  await act("edit", a.id, {
    name: "Edited",
    settings: { ...settings(), budget_amount: 25, mind_match_enabled: true },
  });
  expect((await act("get", a.id)).name).toBe("Edited");
  await act("remove", a.id, { user_id: users.bob });
  expect((await act("get", a.id)).participant_count).toBe(1);
  await login(db, "bob");
  expect(await rpc(db, "list_my_game_sessions")).toEqual([]);
  expect(await rpc<any[]>(db, "list_my_groups")).toHaveLength(1);
});
it("rolls back all session rows when a settings write fails after generic creation", async () => {
  await db.exec(
    "reset role;create function private.santa_test_fail() returns trigger language plpgsql as $$ begin raise exception 'fixture failure';end $$;create trigger santa_test_fail before insert on secret_santa_settings for each row execute function private.santa_test_fail();",
  );
  await login(db, "alice");
  await expect(create()).rejects.toThrow(/fixture failure/);
  expect(await rpc(db, "list_my_game_sessions")).toEqual([]);
  await db.exec(
    "reset role;drop trigger santa_test_fail on secret_santa_settings;drop function private.santa_test_fail()",
  );
});
it("automatically closes sufficient lobbies once and emits unique notifications", async () => {
  const a = await create();
  for (const u of ["bob", "carol"] as const) {
    await login(db, u);
    await act("redeem", a.id, { code: a.invitation.code });
  }
  await db.exec("reset role");
  await db.query(
    "update secret_santa_settings set joining_deadline=now()-interval '1 minute' where session_id=$1",
    [a.id],
  );
  await db.query(
    "update scheduled_activities set unlock_at=now()-interval '1 minute' where game_session_id=$1",
    [a.id],
  );
  await rpc(db, "notification_worker", ["tick"]);
  await rpc(db, "notification_worker", ["tick"]);
  const rows = await db.query<any>(
    "select template_key,count(*)::int as n from user_notifications where template_key in ('secret_santa_joining_closed','secret_santa_ready_for_draw') group by template_key",
  );
  expect(rows.rows).toHaveLength(2);
  expect(rows.rows.every((x) => x.n === 3)).toBe(true);
  await login(db, "alice");
  expect((await act("get", a.id)).settings.lobby_phase).toBe("ready_for_draw");
  await expect(rpc(db, "leave_game_session", [a.id])).rejects.toThrow();
});
it("denies low-level bypasses, expired invitations and mismatched idempotent replays", async () => {
  const c = settings(),
    key = crypto.randomUUID();
  const a = await create(c, key);
  await expect(create({ ...c, currency_code: "USD" }, key)).rejects.toThrow(
    /different settings/,
  );
  await expect(
    db.query("select private.group_session_action_scope03('join',$1)", [a.id]),
  ).rejects.toThrow(/permission/);
  await db.exec("reset role");
  await db.query(
    "update private.session_invites set expires_at=now()-interval '1 minute' where session_id=$1",
    [a.id],
  );
  await login(db, "bob");
  expect(await act("preview", a.id, { code: a.invitation.code })).toEqual({
    error: "unavailable",
  });
  await expect(act("get", a.id)).rejects.toThrow(/denied/);
});

it("expires a quiet-hours-delayed closing reminder before provider send", async () => {
  const a = await create();
  await db.exec("reset role");
  await db.query(
    "update scheduled_activities set unlock_at=now()-interval '1 minute' where game_session_id=$1 and activity_type='secret_santa_closing'",
    [a.id],
  );
  await rpc(db, "notification_worker", ["tick"]);
  let n = await db.query<any>(
    "select id from user_notifications where template_key='secret_santa_joining_closing' and related_session_id=$1",
    [a.id],
  );
  expect(n.rows).toHaveLength(1);
  expect(
    (
      await db.query<any>(
        "select private.notification_event_allowed($1) as allowed",
        [n.rows[0].id],
      )
    ).rows[0].allowed,
  ).toBe(true);
  await db.query(
    "update secret_santa_settings set joining_deadline=now()-interval '1 minute' where session_id=$1",
    [a.id],
  );
  expect(
    (
      await db.query<any>(
        "select private.notification_event_allowed($1) as allowed",
        [n.rows[0].id],
      )
    ).rows[0].allowed,
  ).toBe(false);
  await rpc(db, "notification_worker", ["claim"]);
  expect(
    (
      await db.query<any>(
        "select status from private.notification_outbox where notification_id=$1",
        [n.rows[0].id],
      )
    ).rows[0].status,
  ).toBe("cancelled");
});
