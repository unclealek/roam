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
let session: string;
const migration =
  "supabase/migrations/20261027090002_scheduling_notifications.sql";
beforeAll(async () => {
  db = await sessionDatabase();
  await db.exec("create role service_role;");
  await db.exec(readFileSync(migration, "utf8"));
}, 30000);
beforeEach(async () => {
  await resetUsers(db);
  await login(db, "alice");
  const s = await rpc<{ id: string }>(db, "create_game_session", [
    "engine_fixture",
    "Scheduling",
    { rounds: 3 },
    "99999999-9999-4999-8999-999999999999",
  ]);
  session = s.id;
  await rpc(db, "open_game_lobby", [session]);
  await login(db, "bob");
  await rpc(db, "join_game_session", [session]);
  await login(db, "alice");
  await rpc(db, "start_game_session", [session]);
  await db.exec("reset role");
});
afterAll(async () => {
  await db?.close();
});
async function schedule(
  unlock = "-1 minute",
  expires = "1 day",
  key = "event",
  target: string | null = users.alice,
) {
  return rpc<string>(db, "schedule_activity", [
    session,
    "challenge",
    target,
    new Date(
      Date.now() + (unlock === "-1 minute" ? -60000 : 3600000),
    ).toISOString(),
    new Date(
      Date.now() + (expires === "1 day" ? 86400000 : -30000),
    ).toISOString(),
    key,
    {},
  ]);
}
async function tick() {
  return rpc(db, "notification_worker", ["tick"]);
}
it("hides future activities, unlocks due ones exactly once, and scopes notifications to recipients", async () => {
  const future = await schedule("future");
  await tick();
  await login(db, "alice");
  expect(
    (await db.query<{ id: string }>("select * from scheduled_activities")).rows,
  ).toHaveLength(0);
  await expect(rpc(db, "notification_worker", ["tick"])).rejects.toThrow(
    /permission/i,
  );
  await expect(
    rpc(db, "transition_activity", [future, "completed"]),
  ).rejects.toThrow(/permission/i);
  await db.exec("reset role");
  const due = await schedule("-1 minute", "1 day", "due");
  await tick();
  await tick();
  await login(db, "alice");
  expect(
    (
      await db.query<{ id: string }>("select * from scheduled_activities")
    ).rows.map((x) => x.id),
  ).toEqual([due]);
  expect(
    (await rpc<{ items: unknown[] }>(db, "notification_account", ["list"]))
      .items,
  ).toHaveLength(1);
  await login(db, "bob");
  expect(
    (await db.query("select * from user_notifications")).rows,
  ).toHaveLength(0);
  await login(db, "carol");
  expect(
    (await db.query<{ id: string }>("select * from scheduled_activities")).rows,
  ).toHaveLength(0);
});
it("rejects duplicate keys with changed settings and expires before notifying", async () => {
  const id = await schedule("-1 minute", "past");
  await tick();
  expect(
    (
      await db.query<{ status: string }>(
        "select status from scheduled_activities where id=$1",
        [id],
      )
    ).rows[0].status,
  ).toBe("expired");
  expect(
    (await db.query("select * from user_notifications")).rows,
  ).toHaveLength(0);
  await expect(schedule()).rejects.toThrow(/Idempotency/i);
});
it("supports broadcast, completion, cancellation and no reminder after completion", async () => {
  const id = await schedule("-1 minute", "1 day", "all", null);
  await tick();
  expect(
    (await db.query("select * from user_notifications")).rows,
  ).toHaveLength(2);
  await rpc(db, "transition_activity", [id, "completed"]);
  await rpc(db, "transition_activity", [id, "completed"]);
  await expect(
    rpc(db, "transition_activity", [id, "cancelled"]),
  ).rejects.toThrow();
  await tick();
  expect(
    (
      await db.query(
        "select * from private.notification_outbox where status='pending'",
      )
    ).rows,
  ).toHaveLength(0);
});
it("validates preferences and prevents arbitrary fields or timezone mutation", async () => {
  await login(db, "alice");
  const pref = await rpc<{
    push_enabled: boolean;
    reminders_enabled: boolean;
    quiet_hours_start: string;
  }>(db, "notification_account", ["preferences"]);
  expect(pref.push_enabled).toBe(false);
  expect(pref.reminders_enabled).toBe(false);
  expect(pref.quiet_hours_start).toBe("22:00:00");
  await expect(
    rpc(db, "notification_account", [
      "save_preferences",
      { user_id: users.bob },
    ]),
  ).rejects.toThrow();
  await expect(
    rpc(db, "notification_account", [
      "save_preferences",
      { timezone: "invalid/zone" },
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("update notification_preferences set push_enabled=true"),
  ).rejects.toThrow(/permission/i);
});
it("registers multiple devices, replaces tokens, and never exposes tokens", async () => {
  await login(db, "alice");
  const reg = (token: string, device: string) =>
    rpc(db, "notification_account", [
      "register_device",
      { expo_push_token: token, device_identifier: device, platform: "ios" },
    ]);
  await reg("ExpoPushToken[first]", users.alice);
  await reg("ExpoPushToken[second]", users.bob);
  await reg("ExpoPushToken[third]", users.alice);
  await expect(
    db.query("select * from private.device_push_tokens"),
  ).rejects.toThrow(/permission/i);
  await db.exec("reset role");
  expect(
    (await db.query("select * from private.device_push_tokens where is_active"))
      .rows,
  ).toHaveLength(2);
});
it("leases deliveries exclusively, retries explicit rejections and disables invalid tokens from receipts", async () => {
  await login(db, "alice");
  await rpc(db, "notification_account", [
    "save_preferences",
    { push_enabled: true, quiet_hours_enabled: false },
  ]);
  await rpc(db, "notification_account", [
    "register_device",
    {
      expo_push_token: "ExpoPushToken[test]",
      device_identifier: users.alice,
      platform: "ios",
    },
  ]);
  await db.exec("reset role");
  await schedule();
  await tick();
  const claims = await rpc<{ id: string; lease_id: string }[]>(
    db,
    "notification_worker",
    ["claim"],
  );
  expect(claims).toHaveLength(1);
  expect(await rpc(db, "notification_worker", ["claim"])).toEqual([]);
  const claim = claims[0];
  expect(
    await rpc(db, "notification_worker", ["begin_send", claim]),
  ).toMatchObject({ to: "ExpoPushToken[test]" });
  await rpc(db, "notification_worker", [
    "sent",
    { ...claim, error: "HTTP_429" },
  ]);
  expect(
    (
      await db.query<{ status: string }>(
        "select status from private.push_deliveries",
      )
    ).rows[0].status,
  ).toBe("retry");
  await db.exec(
    "update private.push_deliveries set next_attempt_at=now()-interval '1 minute'",
  );
  const [retry] = await rpc<typeof claims>(db, "notification_worker", [
    "claim",
  ]);
  await rpc(db, "notification_worker", ["begin_send", retry]);
  await rpc(db, "notification_worker", [
    "sent",
    { ...retry, ticket: "ticket-1" },
  ]);
  await db.exec(
    "update private.push_deliveries set next_attempt_at=now()-interval '1 minute'",
  );
  const [receipt] = await rpc<typeof claims>(db, "notification_worker", [
    "receipts",
  ]);
  await rpc(db, "notification_worker", [
    "receipt",
    { ...receipt, status: "error", error: "DeviceNotRegistered" },
  ]);
  expect(
    (
      await db.query<{ is_active: boolean }>(
        "select is_active from private.device_push_tokens",
      )
    ).rows[0].is_active,
  ).toBe(false);
});
it("makes triggered event creation idempotent without a caller clock", async () => {
  const args = [
    session,
    "prediction",
    users.bob,
    null,
    null,
    "answer-submitted",
    {},
  ];
  const id = await rpc(db, "schedule_activity", args);
  expect(await rpc(db, "schedule_activity", args)).toBe(id);
  await tick();
  await login(db, "bob");
  expect(
    (await db.query("select * from scheduled_activities")).rows,
  ).toHaveLength(1);
});
it("handles IANA timezones, DST folds/gaps, overnight and same-day quiet hours, and preferred times", async () => {
  const allowed = async (
    at: string,
    patch: Record<string, unknown> = {},
    category = "reminders",
  ) => {
    const { rows } = await db.query<{ ok: boolean }>(
      `select private.push_allowed(jsonb_populate_record(null::public.notification_preferences,$1::jsonb),$2,$3::timestamptz) as ok`,
      [
        JSON.stringify({
          push_enabled: true,
          reminders_enabled: true,
          your_turn_enabled: true,
          quiet_hours_enabled: true,
          quiet_hours_start: "22:00",
          quiet_hours_end: "08:00",
          preferred_reminder_time: "18:00",
          timezone: "Europe/Helsinki",
          ...patch,
        }),
        category,
        at,
      ],
    );
    return rows[0].ok;
  };
  expect(await allowed("2026-10-27T15:59:00Z")).toBe(false);
  expect(await allowed("2026-10-27T16:00:00Z")).toBe(true);
  expect(await allowed("2026-10-27T20:00:00Z")).toBe(false);
  expect(await allowed("2026-10-27T06:00:00Z", {}, "your_turn")).toBe(true);
  // Both instances of 03:30 during the autumn fold are quiet.
  expect(await allowed("2026-10-25T00:30:00Z", {}, "your_turn")).toBe(false);
  expect(await allowed("2026-10-25T01:30:00Z", {}, "your_turn")).toBe(false);
  // Spring gap: no nonexistent wall-clock timestamp is constructed.
  expect(await allowed("2026-03-29T00:59:00Z", {}, "your_turn")).toBe(false);
  expect(await allowed("2026-03-29T01:00:00Z", {}, "your_turn")).toBe(false);
  expect(
    await allowed("2026-10-27T16:00:00Z", {
      quiet_hours_start: "08:00",
      quiet_hours_end: "20:00",
    }),
  ).toBe(false);
  expect(
    await allowed("2026-10-27T16:00:00Z", {
      quiet_hours_start: "08:00",
      quiet_hours_end: "08:00",
    }),
  ).toBe(false);
  expect(
    await allowed("2026-10-27T16:00:00Z", { reminders_enabled: false }),
  ).toBe(false);
  expect(
    await allowed("2026-10-27T16:00:00Z", { timezone: "America/New_York" }),
  ).toBe(false);
});
it("deduplicates reminder stages, limits daily reminder pushes, and cancels completed reminders before send", async () => {
  await login(db, "alice");
  await rpc(db, "notification_account", [
    "save_preferences",
    {
      push_enabled: true,
      reminders_enabled: true,
      quiet_hours_enabled: false,
      preferred_reminder_time: "00:00",
    },
  ]);
  await rpc(db, "notification_account", [
    "register_device",
    {
      expo_push_token: "ExpoPushToken[reminder]",
      device_identifier: users.alice,
      platform: "android",
    },
  ]);
  await db.exec("reset role");
  await db.exec(
    "insert into private.reminder_policies(game_type_id,enabled,lead_time) values('engine_fixture',true,'2 days') on conflict(game_type_id) do update set enabled=true",
  );
  const first = await schedule("-1 minute", "1 day", "first");
  const second = await schedule("-1 minute", "1 day", "second");
  await tick();
  await tick();
  expect(
    (
      await db.query(
        "select * from user_notifications where category='reminders'",
      )
    ).rows,
  ).toHaveLength(2);
  // Remove turn pushes from this fixture so only reminder frequency is measured.
  await db.exec(
    "update private.notification_outbox set status='cancelled' where event_key like 'unlock:%'",
  );
  const claims = await rpc<{ id: string; lease_id: string }[]>(
    db,
    "notification_worker",
    ["claim"],
  );
  expect(claims).toHaveLength(1);
  await db.exec(
    "update private.push_rate_windows set last_push_at=now()-interval '2 minutes';update private.notification_outbox set next_attempt_at=now()-interval '1 minute'",
  );
  expect(await rpc(db, "notification_worker", ["claim"])).toEqual([]);
  await rpc(db, "transition_activity", [first, "completed"]);
  await rpc(db, "transition_activity", [second, "completed"]);
  expect(
    await rpc(db, "notification_worker", ["begin_send", claims[0]]),
  ).toBeNull();
});
it("does not resend ambiguous sends or accept stale worker leases", async () => {
  await login(db, "alice");
  await rpc(db, "notification_account", [
    "save_preferences",
    { push_enabled: true, quiet_hours_enabled: false },
  ]);
  await rpc(db, "notification_account", [
    "register_device",
    {
      expo_push_token: "ExpoPushToken[ambiguous]",
      device_identifier: users.alice,
      platform: "ios",
    },
  ]);
  await db.exec("reset role");
  await schedule();
  await tick();
  const [claim] = await rpc<{ id: string; lease_id: string }[]>(
    db,
    "notification_worker",
    ["claim"],
  );
  expect(
    await rpc(db, "notification_worker", [
      "begin_send",
      { ...claim, lease_id: users.bob },
    ]),
  ).toBeNull();
  await rpc(db, "notification_worker", ["begin_send", claim]);
  await db.exec(
    "update private.push_deliveries set lease_until=now()-interval '1 minute'",
  );
  expect(await rpc(db, "notification_worker", ["claim"])).toEqual([]);
  expect(
    (
      await db.query<{ status: string }>(
        "select status from private.push_deliveries",
      )
    ).rows[0].status,
  ).toBe("unknown");
});
it("keeps scheduler failures atomic, records backoff, and processes other eligible rows", async () => {
  const bad = await schedule("-1 minute", "1 day", "bad");
  const good = await schedule("-1 minute", "1 day", "good");
  await db.query(
    `update scheduled_activities set payload='{"template_key":"unregistered"}' where id=$1`,
    [bad],
  );
  const result = await tick();
  expect(result.errors).toBe(1);
  expect(
    (
      await db.query<{ status: string }>(
        "select status from scheduled_activities where id=$1",
        [bad],
      )
    ).rows[0].status,
  ).toBe("scheduled");
  expect(
    (
      await db.query<{ status: string }>(
        "select status from scheduled_activities where id=$1",
        [good],
      )
    ).rows[0].status,
  ).toBe("available");
  expect(
    (
      await db.query<{ attempts: number }>(
        "select processing_attempts as attempts from scheduled_activities where id=$1",
        [bad],
      )
    ).rows[0].attempts,
  ).toBe(1);
  expect((await tick()).errors).toBe(0);
});
it("rejects sensitive payloads and foreign recipients, and prevents reading or mutating another user notification", async () => {
  await expect(
    rpc(db, "schedule_activity", [
      session,
      "challenge",
      users.carol,
      null,
      null,
      "foreign",
      {},
    ]),
  ).rejects.toThrow(/member/);
  await expect(
    rpc(db, "schedule_activity", [
      session,
      "challenge",
      users.alice,
      null,
      null,
      "secret",
      { answer: "private" },
    ]),
  ).rejects.toThrow();
  await schedule();
  await tick();
  const id = (
    await db.query<{ id: string }>("select id from user_notifications")
  ).rows[0].id;
  await login(db, "bob");
  await rpc(db, "notification_account", ["read", { id, read: true }]);
  await db.exec("reset role");
  expect(
    (
      await db.query<{ read_at: null }>(
        "select read_at from user_notifications where id=$1",
        [id],
      )
    ).rows[0].read_at,
  ).toBeNull();
});
it("paginates notifications deterministically without dropping records with matching timestamps", async () => {
  for (let i = 0; i < 31; i++)
    await db.query(
      `select private.emit_notification($1,'game_started',$2,$3)`,
      [users.alice, session, `page:${i}`],
    );
  await login(db, "alice");
  const page = await rpc<{
    unread_count: number;
    items: { id: string; created_at: string }[];
  }>(db, "notification_account", ["list"]);
  expect(page.items).toHaveLength(30);
  expect(page.unread_count).toBe(31);
  const last = page.items.at(-1)!;
  const second = await rpc<typeof page>(db, "notification_account", [
    "list",
    { before_id: last.id, before_created_at: last.created_at },
  ]);
  expect(second.items).toHaveLength(1);
  expect(page.items.map((x) => x.id)).not.toContain(second.items[0].id);
});
it("records receipt success separately from delivery and protects a refreshed token from an old invalid receipt", async () => {
  await login(db, "alice");
  await rpc(db, "notification_account", [
    "save_preferences",
    { push_enabled: true, quiet_hours_enabled: false },
  ]);
  const reg = (token: string, device: string) =>
    rpc(db, "notification_account", [
      "register_device",
      { expo_push_token: token, device_identifier: device, platform: "ios" },
    ]);
  await reg("ExpoPushToken[old]", users.alice);
  await reg("ExpoPushToken[other]", users.bob);
  await db.exec("reset role");
  await schedule();
  await tick();
  const claims = await rpc<{ id: string; lease_id: string }[]>(
    db,
    "notification_worker",
    ["claim"],
  );
  for (let i = 0; i < claims.length; i++) {
    await rpc(db, "notification_worker", ["begin_send", claims[i]]);
    await rpc(db, "notification_worker", [
      "sent",
      { ...claims[i], ticket: `receipt-${i}` },
    ]);
  }
  await login(db, "alice");
  await reg("ExpoPushToken[new]", users.alice);
  await db.exec("reset role");
  await db.exec(
    "update private.push_deliveries set next_attempt_at=now()-interval '1 minute'",
  );
  const receipts = await rpc<typeof claims>(db, "notification_worker", [
    "receipts",
  ]);
  for (const r of receipts) {
    const { rows } = await db.query<{ token_snapshot: string }>(
      "select token_snapshot from private.push_deliveries where id=$1",
      [r.id],
    );
    const old = rows[0].token_snapshot === "ExpoPushToken[old]";
    await rpc(db, "notification_worker", [
      "receipt",
      {
        ...r,
        status: old ? "error" : "ok",
        error: old ? "DeviceNotRegistered" : undefined,
      },
    ]);
  }
  expect(
    (
      await db.query<{ is_active: boolean }>(
        "select is_active from private.device_push_tokens where expo_push_token='ExpoPushToken[new]' ",
      )
    ).rows[0].is_active,
  ).toBe(true);
  expect(
    (
      await db.query(
        "select * from private.push_deliveries where status='receipt_ok' and provider_receipt_status='ok'",
      )
    ).rows,
  ).toHaveLength(1);
});
it("reclaims an expired unsent lease with a new fencing ID", async () => {
  await login(db, "alice");
  await rpc(db, "notification_account", [
    "save_preferences",
    { push_enabled: true, quiet_hours_enabled: false },
  ]);
  await rpc(db, "notification_account", [
    "register_device",
    {
      expo_push_token: "ExpoPushToken[reclaim]",
      device_identifier: users.alice,
      platform: "ios",
    },
  ]);
  await db.exec("reset role");
  await schedule();
  await tick();
  const [old] = await rpc<{ id: string; lease_id: string }[]>(
    db,
    "notification_worker",
    ["claim"],
  );
  await db.exec(
    "update private.push_deliveries set lease_until=now()-interval '1 minute'",
  );
  const [fresh] = await rpc<(typeof old)[]>(db, "notification_worker", [
    "claim",
  ]);
  expect(fresh.id).toBe(old.id);
  expect(fresh.lease_id).not.toBe(old.lease_id);
  expect(await rpc(db, "notification_worker", ["begin_send", old])).toBeNull();
  expect(
    await rpc(db, "notification_worker", ["begin_send", fresh]),
  ).toBeTruthy();
});
