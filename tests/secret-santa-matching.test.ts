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
const act = (op: string, id: string | null, data = {}) =>
  rpc<any>(db, "secret_santa_lobby", [op, id, data]);
const config = () => ({
  joining_deadline: new Date(Date.now() + 86400000).toISOString(),
  exchange_date: new Date(Date.now() + 864000000).toISOString().slice(0, 10),
  exchange_timezone: "Europe/Helsinki",
  currency_code: "EUR",
  max_participants: 100,
});
async function create(count = 3) {
  const a = await act("create", null, {
    name: "Scope 07",
    settings: config(),
    request_id: crypto.randomUUID(),
  });
  await db.exec("reset role");
  for (let i = 1; i < count; i++) {
    const id =
      i === 1 ? users.bob : i === 2 ? users.carol : crypto.randomUUID();
    if (i > 2) {
      await db.query("insert into auth.users values ($1)", [id]);
      await db.query("insert into auth.sessions values ($1,$1)", [id]);
    }
    await db.query(
      "insert into game_session_members(session_id,user_id,role) values ($1,$2,'member')",
      [a.id, id],
    );
  }
  await login(db, "alice");
  return a;
}
async function assignments(id: string) {
  await db.exec("reset role");
  return (
    await db.query<{ giver_id: string; recipient_id: string }>(
      "select giver_id,recipient_id from private.secret_santa_assignments where session_id=$1 order by giver_id",
      [id],
    )
  ).rows;
}
beforeAll(async () => {
  db = await sessionDatabase();
  await db.exec("create role service_role");
  for (const f of [
    "20261027090002_scheduling_notifications.sql",
    "20261027134631_shared_rewards_collectibles.sql",
    "20261027181151_harden_notification_reward_rpc_storage.sql",
    "20261028182438_secret_santa_setup_lobby.sql",
    "20261029102704_secret_santa_matching.sql",
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
for (const n of [3, 5, 11, 13, 50, 100])
  it(`secure single cycle for ${n} participants across repeated draws`, async () => {
    for (let trial = 0; trial < 4; trial++) {
      const a = await create(n);
      const drawn = await act("draw", a.id);
      expect(drawn.status).toBe("active");
      expect(drawn.settings.lobby_phase).toBe("matched");
      const rows = await assignments(a.id);
      expect(rows).toHaveLength(n);
      expect(new Set(rows.map((r) => r.giver_id)).size).toBe(n);
      expect(new Set(rows.map((r) => r.recipient_id)).size).toBe(n);
      const map = new Map(rows.map((r) => [r.giver_id, r.recipient_id]));
      const visited = new Set<string>();
      let cursor = rows[0].giver_id;
      for (let i = 0; i < n; i++) {
        expect(visited.has(cursor)).toBe(false);
        visited.add(cursor);
        expect(map.get(cursor)).not.toBe(cursor);
        cursor = map.get(cursor)!;
      }
      expect(cursor).toBe(rows[0].giver_id);
    }
  }, 30000);
it("rejects insufficient players and non-hosts, never activates or closes on invalid early draw", async () => {
  const a = await create(2);
  await expect(act("draw", a.id)).rejects.toThrow(/three/);
  expect((await act("get", a.id)).settings.lobby_phase).toBe("joining_open");
  await login(db, "bob");
  await expect(act("draw", a.id)).rejects.toThrow(/host/);
});
it("private own assignment, reveal persists, no arbitrary giver or cross-session access", async () => {
  const a = await create();
  await expect(act("assignment", a.id)).rejects.toThrow();
  await act("draw", a.id);
  const hidden = await act("assignment", a.id);
  expect(hidden.recipient).toBeNull();
  const revealed = await act("reveal", a.id);
  expect(revealed.recipient.display_name).toBeTruthy();
  expect(revealed.recipient.id).toBeUndefined();
  expect(revealed.giver_id).toBeUndefined();
  expect(await act("reveal", a.id)).toEqual(
    expect.objectContaining({
      revealed_at: revealed.revealed_at,
      recipient: revealed.recipient,
    }),
  );
  await expect(
    act("assignment", a.id, { giver_id: users.bob }),
  ).rejects.toThrow();
  await expect(
    db.query("select * from private.secret_santa_assignments"),
  ).rejects.toThrow();
  await expect(
    db.query("select private.santa_draw($1)", [a.id]),
  ).rejects.toThrow();
  await login(db, "dave");
  await expect(act("assignment", a.id)).rejects.toThrow();
  await expect(act("reveal", a.id)).rejects.toThrow();
  await db.exec("reset role;set role anon");
  await expect(act("assignment", a.id)).rejects.toThrow();
});
it("duplicate draws keep assignments, timestamps and notifications; membership cannot change", async () => {
  const a = await create();
  const first = await act("draw", a.id);
  const rows = await assignments(a.id);
  await login(db, "alice");
  const second = await act("draw", a.id);
  expect(second.settings.matched_at).toBe(first.settings.matched_at);
  expect(await assignments(a.id)).toEqual(rows);
  const notices = (
    await db.query<{ template_key: string; body: string }>(
      "select template_key,body from user_notifications where related_session_id=$1 and template_key in ('secret_santa_assignment_ready','secret_santa_game_started','secret_santa_draw_started')",
      [a.id],
    )
  ).rows;
  expect(notices).toHaveLength(9);
  await login(db, "alice");
  for (const op of ["edit", "remove", "extend", "cancel"])
    await expect(act(op, a.id, { user_id: users.bob })).rejects.toThrow();
  await login(db, "bob");
  await expect(act("leave", a.id)).rejects.toThrow();
  await login(db, "dave");
  expect(await act("redeem", a.id, { code: a.invitation.code })).toEqual({
    error: "unavailable",
  });
});
it("rolls back partial inserts and success notifications; retry is safe", async () => {
  const a = await create();
  await db.exec(
    `reset role;create function private.fail_fixture() returns trigger language plpgsql as $$ begin if (select count(*) from private.secret_santa_assignments)>0 then raise exception 'fixture failure';end if;return new;end $$;create trigger fail_fixture before insert on private.secret_santa_assignments for each row execute function private.fail_fixture();`,
  );
  await login(db, "alice");
  expect((await act("draw", a.id)).settings.lobby_phase).toBe("draw_failed");
  expect(await assignments(a.id)).toHaveLength(0);
  expect(
    (
      await db.query(
        "select * from user_notifications where template_key='secret_santa_assignment_ready'",
      )
    ).rows,
  ).toHaveLength(0);
  await db.exec(
    "drop trigger fail_fixture on private.secret_santa_assignments;drop function private.fail_fixture()",
  );
  await login(db, "alice");
  expect((await act("draw", a.id)).status).toBe("active");
  expect(await assignments(a.id)).toHaveLength(3);
});
it("automatic deadline closure then draw uses scheduler; insufficient lobbies never match", async () => {
  const a = await create();
  await db.exec("reset role");
  await db.query(
    "update secret_santa_settings set joining_deadline=now()-interval '1 minute' where session_id=$1",
    [a.id],
  );
  await db.query(
    "update scheduled_activities set unlock_at=now()-interval '1 minute' where game_session_id=$1 and activity_type='secret_santa_close'",
    [a.id],
  );
  await db.query("select private.run_activity_scheduler(100)");
  await db.query("select private.run_activity_scheduler(100)");
  await login(db, "alice");
  expect((await act("get", a.id)).status).toBe("active");
  const b = await create(2);
  await act("close", b.id);
  await db.exec("reset role");
  await db.query("select private.run_activity_scheduler(100)");
  expect(await assignments(b.id)).toHaveLength(0);
});
it("account deletion preserves the entire cycle and surfaces recovery without redraw", async () => {
  const a = await create();
  await act("draw", a.id);
  const original = await assignments(a.id);
  await db.query("delete from auth.users where id=$1", [users.bob]);
  expect(await assignments(a.id)).toEqual(original);
  await login(db, "alice");
  const lobby = await act("get", a.id);
  expect(lobby.settings.recovery_required).toBe(true);
  expect(lobby.participant_count).toBe(3);
  expect(
    lobby.participants.some(
      (p: any) => p.display_name === "Participant unavailable",
    ),
  ).toBe(true);
  await db.exec("reset role");
  await db.query("delete from auth.users where id=$1", [users.alice]);
  expect(await assignments(a.id)).toEqual(original);
});
it("scheduler retries a failed draw without partial results or duplicate alerts", async () => {
  const a = await create();
  await act("close", a.id);
  await db.exec(
    `reset role;create function private.draw_failure() returns trigger language plpgsql as $$ begin raise exception 'transient fixture';end $$;create trigger draw_failure before insert on private.secret_santa_assignments for each row execute function private.draw_failure();`,
  );
  await db.query("select private.run_activity_scheduler(100)");
  expect(await assignments(a.id)).toHaveLength(0);
  const failed = (
    await db.query<{ lobby_phase: string }>(
      "select lobby_phase from secret_santa_settings where session_id=$1",
      [a.id],
    )
  ).rows[0];
  expect(failed.lobby_phase).toBe("draw_failed");
  await db.query(
    "update scheduled_activities set next_attempt_at=now() where game_session_id=$1 and activity_type='secret_santa_draw'",
    [a.id],
  );
  await db.query("select private.run_activity_scheduler(100)");
  expect(
    (
      await db.query(
        "select * from user_notifications where template_key='secret_santa_draw_failed' and related_session_id=$1",
        [a.id],
      )
    ).rows,
  ).toHaveLength(1);
  await db.exec(
    "drop trigger draw_failure on private.secret_santa_assignments;drop function private.draw_failure()",
  );
  await db.query(
    "update scheduled_activities set next_attempt_at=now() where game_session_id=$1 and activity_type='secret_santa_draw'",
    [a.id],
  );
  await db.query("select private.run_activity_scheduler(100)");
  expect(await assignments(a.id)).toHaveLength(3);
  await db.query("select private.run_activity_scheduler(100)");
  expect(
    (
      await db.query(
        "select * from user_notifications where template_key='secret_santa_assignment_ready' and related_session_id=$1",
        [a.id],
      )
    ).rows,
  ).toHaveLength(3);
});
it("private assignment constraints reject self, duplicate, and cross-session members", async () => {
  const a = await create();
  await db.exec("reset role");
  await expect(
    db.query(
      "insert into private.secret_santa_assignments(session_id,giver_id,recipient_id) values($1,$2,$2)",
      [a.id, users.alice],
    ),
  ).rejects.toThrow();
  await expect(
    db.query(
      "insert into private.secret_santa_assignments(session_id,giver_id,recipient_id) values($1,$2,$3)",
      [a.id, users.alice, users.dave],
    ),
  ).rejects.toThrow();
  await login(db, "alice");
  await act("draw", a.id);
  await db.exec("reset role");
  await expect(
    db.query(
      "insert into private.secret_santa_assignments(session_id,giver_id,recipient_id) values($1,$2,$3)",
      [a.id, users.alice, users.bob],
    ),
  ).rejects.toThrow();
});
