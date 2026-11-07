import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  login,
  resetUsers,
  rpc,
  sessionDatabase,
  users,
} from "./fixtures/database";

test("reports enforce scope, privacy, throttling and administrative review", async () => {
  const db = await sessionDatabase();
  try {
    await db.exec("create role service_role");
    await db.exec(
      readFileSync(
        "supabase/migrations/20261107202522_safety_reports.sql",
        "utf8",
      ),
    );
    await resetUsers(db);
    await login(db, "alice");
    const group = await rpc<{ id: string }>(db, "create_group", [
      "Amis 日本語",
      null,
      null,
    ]);
    const invite = await rpc<{ code: string }>(db, "create_group_invite", [
      group.id,
      7,
      null,
    ]);
    await login(db, "bob");
    await rpc(db, "redeem_group_invite", [invite.code]);
    const submit = (
      target: string | null,
      reason = "harassment",
      description: string | null = null,
    ) =>
      rpc(db, "submit_safety_report", [group.id, target, reason, description]);
    await expect(submit(users.bob)).rejects.toMatchObject({ code: "22023" });
    await expect(submit(users.carol)).rejects.toMatchObject({ code: "42501" });
    await expect(submit(null, "offensive_display_name")).rejects.toMatchObject({
      code: "22023",
    });
    await expect(
      submit(null, "harassment", "x".repeat(1001)),
    ).rejects.toMatchObject({ code: "22023" });
    await Promise.all([submit(null), submit(null)]);
    await submit(users.alice, "offensive_display_name", "  A concern  ");
    await expect(
      rpc(db, "submit_safety_report", [
        group.id,
        null,
        "harassment",
        null,
        users.alice,
      ]),
    ).rejects.toMatchObject({ code: "42883" });
    await expect(
      db.exec("insert into private.safety_reports default values"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.exec("select * from private.safety_reports"),
    ).rejects.toMatchObject({ code: "42501" });
    for (const reason of ["spam_scam", "impersonation", "privacy"])
      await submit(null, reason);
    await expect(submit(null, "other")).rejects.toMatchObject({
      code: "P0001",
    });
    await login(db, "alice");
    await expect(
      db.exec("select reporter_id from private.safety_reports"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.exec("update private.safety_reports set status = 'resolved'"),
    ).rejects.toMatchObject({ code: "42501" });
    await login(db, "carol");
    await expect(submit(null)).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role; set role anon");
    await expect(submit(null)).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
    const { rows } = await db.query(
      "select * from private.safety_reports order by created_at",
    );
    expect(rows).toHaveLength(5);
    expect(rows).toContainEqual(
      expect.objectContaining({
        reporter_id: users.bob,
        reported_user_id: users.alice,
        context_group_id: group.id,
        description: "A concern",
        status: "pending",
        resolved_at: null,
      }),
    );
    // Even an accidental client SELECT grant still exposes zero rows under RLS.
    await db.exec("grant select on private.safety_reports to authenticated");
    await login(db, "alice");
    expect(
      (await db.query("select * from private.safety_reports")).rows,
    ).toHaveLength(0);
    await db.exec(
      "reset role; revoke select on private.safety_reports from authenticated",
    );
    await expect(
      db.exec("update private.safety_reports set status = 'dismissed'"),
    ).rejects.toMatchObject({ code: "23514" });
    const reviewing = await db.query(
      "update private.safety_reports set status = 'reviewing' where reported_user_id is not null returning status, resolved_at",
    );
    expect(reviewing.rows[0]).toEqual({
      status: "reviewing",
      resolved_at: null,
    });
    const reviewed = await db.query(
      "update private.safety_reports set status = 'resolved', review_decision = 'Reviewed' where reported_user_id is not null returning resolved_at, updated_at",
    );
    expect(reviewed.rows[0]).toMatchObject({
      resolved_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
    await login(db, "bob");
    await expect(
      rpc(db, "create_group", ["KILL   ALL JEWS", null, null]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.query("update public.profiles set display_name = $1 where id = $2", [
        "kill all jews",
        users.bob,
      ]),
    ).rejects.toMatchObject({ code: "23514" });
    await rpc(db, "delete_own_account");
    await db.exec("reset role");
    expect(
      (await db.query("select * from private.safety_reports")).rows,
    ).toHaveLength(0);
  } finally {
    await db.close();
  }
});
