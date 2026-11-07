import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import {
  sessionDatabase,
  resetUsers,
  login,
  rpc,
  users,
} from "./fixtures/database";
import type { PGlite } from "@electric-sql/pglite";
let db: PGlite;
const create = () =>
  rpc<any>(db, "create_group", ["Office Friends", "Play together", "people"]);
const invite = (id: string, uses: number | null = null) =>
  rpc<any>(db, "create_group_invite", [id, 7, uses]);
beforeAll(async () => {
  db = await sessionDatabase();
});
beforeEach(async () => {
  await db.exec("reset role;truncate public.groups cascade");
  await resetUsers(db);
  await login(db, "alice");
});
afterAll(async () => {
  await db?.close();
});
describe("persistent groups and trusted invitations", () => {
  it("creates owner membership and supports multiple groups", async () => {
    const a = await create();
    const b = await create();
    expect(a.owner_id).toBe(users.alice);
    expect(a.member_count).toBe(1);
    expect((await rpc<any[]>(db, "list_my_groups")).map((g) => g.id)).toEqual(
      expect.arrayContaining([a.id, b.id]),
    );
    const detail = await rpc<any>(db, "get_group", [a.id]);
    expect(detail.members[0].role).toBe("owner");
  });
  it("previews safe fields then joins once, without enrolling in sessions", async () => {
    const g = await create();
    const i = await invite(g.id, 1);
    expect(i.code).toMatch(/^[a-f0-9]{64}$/);
    await login(db, "bob");
    const p = await rpc<any>(db, "preview_group_invite", [i.code]);
    expect(p.name).toBe(g.name);
    expect(p.members).toBeUndefined();
    expect(p.owner_id).toBeUndefined();
    expect((await rpc<any>(db, "redeem_group_invite", [i.code])).id).toBe(g.id);
    expect((await rpc<any>(db, "redeem_group_invite", [i.code])).id).toBe(g.id);
    expect(await rpc(db, "list_my_game_sessions")).toEqual([]);
    await login(db, "carol");
    expect(await rpc(db, "redeem_group_invite", [i.code])).toEqual({
      error: "unavailable",
    });
  });
  it("rejects invalid, revoked and expired codes", async () => {
    const g = await create();
    const i = await invite(g.id);
    expect(await rpc(db, "preview_group_invite", ["bad"])).toEqual({
      error: "unavailable",
    });
    await rpc(db, "revoke_group_invite", [g.id, i.id]);
    expect(await rpc(db, "redeem_group_invite", [i.code])).toEqual({
      error: "unavailable",
    });
    const j = await invite(g.id);
    await db.exec("reset role");
    await db.query(
      "update group_invites set expires_at=now()-interval '1 day' where id=$1",
      [j.id],
    );
    await login(db, "bob");
    expect(await rpc(db, "preview_group_invite", [j.code])).toEqual({
      error: "unavailable",
    });
  });
  it("persists rate limits even for failed lookups", async () => {
    for (let n = 0; n < 20; n++)
      expect(await rpc(db, "preview_group_invite", ["bad"])).toEqual({
        error: "unavailable",
      });
    expect(await rpc(db, "redeem_group_invite", ["bad"])).toEqual({
      error: "rate_limited",
    });
  });
  it("denies outsiders reads and all direct writes; owners alone manage", async () => {
    const g = await create();
    await login(db, "bob");
    expect((await db.query("select * from groups")).rows).toEqual([]);
    await expect(rpc(db, "get_group", [g.id])).rejects.toThrow(/denied/i);
    for (const op of ["update_group", "delete_group", "create_group_invite"]) {
      const args =
        op === "update_group"
          ? [g.id, "hacked", null, null]
          : op === "create_group_invite"
            ? [g.id, 7, null]
            : [g.id];
      await expect(rpc(db, op, args)).rejects.toThrow(/owner/i);
    }
    await expect(
      db.query("update groups set name='hacked' where id=$1", [g.id]),
    ).rejects.toThrow(/permission/);
    await expect(db.query("select * from group_invites")).rejects.toThrow(
      /permission/,
    );
  });
  it("transfers ownership and restricts owner leave and unauthorized removal", async () => {
    const g = await create();
    await expect(rpc(db, "leave_group", [g.id])).rejects.toThrow(/transfer/i);
    const i = await invite(g.id);
    await login(db, "bob");
    await rpc(db, "redeem_group_invite", [i.code]);
    await expect(
      rpc(db, "remove_group_member", [g.id, users.alice]),
    ).rejects.toThrow(/owner/i);
    await login(db, "alice");
    await rpc(db, "transfer_group_ownership", [g.id, users.bob]);
    await expect(rpc(db, "delete_group", [g.id])).rejects.toThrow(/owner/i);
    await rpc(db, "leave_group", [g.id]);
    await login(db, "bob");
    const d = await rpc<any>(db, "get_group", [g.id]);
    expect(d.owner_id).toBe(users.bob);
    expect(d.members).toHaveLength(1);
    await rpc(db, "delete_group", [g.id]);
  });
  it("enforces a single-use invite under queued concurrent redemptions", async () => {
    const g = await create();
    const i = await invite(g.id, 1);
    await login(db, "bob");
    const results = await Promise.all([
      rpc<any>(db, "redeem_group_invite", [i.code]),
      rpc<any>(db, "redeem_group_invite", [i.code]),
    ]);
    expect(results.every((x) => x.id === g.id)).toBe(true);
    await db.exec("reset role");
    expect(
      (
        await db.query<any>("select use_count from group_invites where id=$1", [
          i.id,
        ])
      ).rows[0].use_count,
    ).toBe(1);
  });
  it("hosts multiple sessions, protects private lobbies and preserves started participants after removal", async () => {
    const g = await create();
    const i = await invite(g.id);
    const s = await rpc<any>(db, "create_group_game_session", [
      g.id,
      "engine_fixture",
      "One",
      { rounds: 2 },
      crypto.randomUUID(),
    ]);
    await rpc(db, "create_group_game_session", [
      g.id,
      "engine_fixture",
      "Two",
      { rounds: 2 },
      crypto.randomUUID(),
    ]);
    await rpc(db, "open_game_lobby", [s.id]);
    await login(db, "bob");
    await expect(rpc(db, "join_game_session", [s.id])).rejects.toThrow(
      /group/i,
    );
    await expect(
      rpc(db, "create_group_game_session", [
        g.id,
        "engine_fixture",
        "Bad",
        { rounds: 2 },
        crypto.randomUUID(),
      ]),
    ).rejects.toThrow(/denied/i);
    await rpc(db, "redeem_group_invite", [i.code]);
    expect((await rpc<any>(db, "get_group", [g.id])).sessions).toEqual([]);
    await rpc(db, "join_game_session", [s.id]);
    await login(db, "alice");
    await rpc(db, "start_game_session", [s.id]);
    await rpc(db, "remove_group_member", [g.id, users.bob]);
    await expect(rpc(db, "delete_group", [g.id])).rejects.toThrow(/sessions/i);
    expect((await rpc<any>(db, "get_group", [g.id])).sessions).toHaveLength(2);
    await login(db, "bob");
    expect(
      (await rpc<any>(db, "get_game_session", [s.id])).participants,
    ).toHaveLength(2);
    await expect(rpc(db, "get_group", [g.id])).rejects.toThrow(/denied/i);
  });
});

describe("group security boundaries and recovery", () => {
  it("validates inputs and rolls back invalid ownership transfer", async () => {
    await expect(rpc(db, "create_group", ["", null, null])).rejects.toThrow();
    const g = await create();
    await expect(
      rpc(db, "transfer_group_ownership", [g.id, users.bob]),
    ).rejects.toThrow(/member/);
    expect((await rpc<any>(db, "get_group", [g.id])).owner_id).toBe(
      users.alice,
    );
    await expect(
      rpc(db, "remove_group_member", [g.id, users.alice]),
    ).rejects.toThrow(/transfer/i);
    await expect(
      rpc(db, "create_group_invite", [g.id, 0, null]),
    ).rejects.toThrow(/limits/);
  });
  it("stores hashes only and prevents invitation enumeration even for owners", async () => {
    const g = await create();
    const i = await invite(g.id);
    const detail = await rpc<any>(db, "get_group", [g.id]);
    expect(detail.invites[0].code).toBeUndefined();
    expect(detail.invites[0].code_hash).toBeUndefined();
    await expect(db.query("select * from group_invites")).rejects.toThrow(
      /permission/,
    );
    await db.exec("reset role");
    const row = (
      await db.query<any>("select * from group_invites where id=$1", [i.id])
    ).rows[0];
    expect(row.code_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.code_hash).not.toBe(i.code);
    expect(JSON.stringify(row)).not.toContain(i.code);
  });
  it("prevents duplicate memberships with a database constraint", async () => {
    const g = await create();
    await db.exec("reset role");
    await expect(
      db.query(
        "insert into group_members(group_id,user_id,role) values($1,$2,'member')",
        [g.id, users.alice],
      ),
    ).rejects.toThrow(/unique/);
  });
  it("rejects anonymous requests and revoked sessions", async () => {
    await db.exec("reset role;set role anon");
    await expect(rpc(db, "list_my_groups")).rejects.toThrow(/permission/);
    await login(db, "alice");
    await db.exec("reset role");
    await db.query("delete from auth.sessions where user_id=$1", [users.alice]);
    await login(db, "alice");
    await expect(create()).rejects.toThrow(/authenticated/);
    await expect(rpc(db, "preview_group_invite", ["bad"])).rejects.toThrow(
      /authenticated/,
    );
  });
  it("resets the five-minute rate window and separates account budgets", async () => {
    for (let n = 0; n < 21; n++) await rpc(db, "preview_group_invite", ["bad"]);
    await login(db, "bob");
    expect(await rpc(db, "preview_group_invite", ["bad"])).toEqual({
      error: "unavailable",
    });
    await db.exec(
      "reset role;update private.group_invite_limits set window_start=now()-interval '6 minutes'",
    );
    await login(db, "alice");
    expect(await rpc(db, "preview_group_invite", ["bad"])).toEqual({
      error: "unavailable",
    });
  });
  it("allows members to read peer names but keeps their sessions private in RLS and RPC projections", async () => {
    const g = await create();
    const i = await invite(g.id);
    const s = await rpc<any>(db, "create_group_game_session", [
      g.id,
      "engine_fixture",
      "Private",
      { rounds: 2 },
      crypto.randomUUID(),
    ]);
    await login(db, "bob");
    await rpc(db, "redeem_group_invite", [i.code]);
    const d = await rpc<any>(db, "get_group", [g.id]);
    expect(d.members).toHaveLength(2);
    expect(d.invites).toEqual([]);
    expect(d.sessions).toEqual([]);
    expect((await db.query("select * from game_sessions")).rows).toEqual([]);
    expect((await db.query("select * from game_session_members")).rows).toEqual(
      [],
    );
    await expect(rpc(db, "get_game_session", [s.id])).rejects.toThrow(/denied/);
    await rpc(db, "leave_group", [g.id]);
    expect((await db.query("select * from groups")).rows).toEqual([]);
  });
  it("serializes distinct users against the same exhausted usage limit", async () => {
    const g = await create();
    const i = await invite(g.id, 1);
    await login(db, "bob");
    await rpc(db, "redeem_group_invite", [i.code]);
    await login(db, "carol");
    expect(await rpc(db, "redeem_group_invite", [i.code])).toEqual({
      error: "unavailable",
    });
    await login(db, "alice");
    expect((await rpc<any>(db, "get_group", [g.id])).member_count).toBe(2);
  });
});

it("protects owned groups during account deletion and allows deletion after transfer", async () => {
  const g = await create();
  const i = await invite(g.id);
  await expect(rpc(db, "delete_own_account")).rejects.toThrow(
    "GROUP_OWNERSHIP_REQUIRED",
  );
  await login(db, "bob");
  await rpc(db, "redeem_group_invite", [i.code]);
  await login(db, "alice");
  await rpc(db, "transfer_group_ownership", [g.id, users.bob]);
  await rpc(db, "delete_own_account");
  await login(db, "bob");
  expect((await rpc<any>(db, "get_group", [g.id])).member_count).toBe(1);
});

describe("vice owner succession", () => {
  async function joined() {
    const g = await create();
    const i = await invite(g.id);
    await login(db, "bob");
    await rpc(db, "redeem_group_invite", [i.code]);
    await login(db, "alice");
    return g;
  }
  it("allows only the owner to appoint an existing different member", async () => {
    const g = await joined();
    for (const id of [users.alice, users.carol])
      await expect(rpc(db, "set_group_vice_owner", [g.id, id])).rejects.toThrow(
        /member/,
      );
    await rpc(db, "set_group_vice_owner", [g.id, users.bob]);
    expect((await rpc<any>(db, "get_group", [g.id])).vice_owner_id).toBe(
      users.bob,
    );
    await login(db, "bob");
    await expect(rpc(db, "set_group_vice_owner", [g.id, null])).rejects.toThrow(
      /owner/,
    );
    await expect(rpc(db, "delete_group", [g.id])).rejects.toThrow(/owner/);
  });
  it("promotes the vice and removes the departing owner atomically", async () => {
    const g = await joined();
    await rpc(db, "set_group_vice_owner", [g.id, users.bob]);
    await rpc(db, "leave_group", [g.id]);
    await login(db, "bob");
    const d = await rpc<any>(db, "get_group", [g.id]);
    expect(d.owner_id).toBe(users.bob);
    expect(d.vice_owner_id).toBeNull();
    expect(d.members.map((m: any) => m.role)).toEqual(["owner"]);
  });
  it("hands over all owned groups on account deletion and keeps groups alive", async () => {
    const a = await joined();
    await rpc(db, "set_group_vice_owner", [a.id, users.bob]);
    const b = await joined();
    await rpc(db, "set_group_vice_owner", [b.id, users.bob]);
    await rpc(db, "delete_own_account");
    await login(db, "bob");
    for (const g of [a, b])
      expect((await rpc<any>(db, "get_group", [g.id])).owner_id).toBe(
        users.bob,
      );
  });
  it("blocks deletion without partial transfers if any owned group lacks a vice", async () => {
    const a = await joined();
    await rpc(db, "set_group_vice_owner", [a.id, users.bob]);
    await create();
    await expect(rpc(db, "delete_own_account")).rejects.toThrow(
      "GROUP_OWNERSHIP_REQUIRED",
    );
    expect((await rpc<any>(db, "get_group", [a.id])).owner_id).toBe(
      users.alice,
    );
  });
  it("clears the vice when removed, leaving, or deleting their own account", async () => {
    for (const action of ["remove", "leave", "delete"]) {
      const g = await joined();
      await rpc(db, "set_group_vice_owner", [g.id, users.bob]);
      if (action === "remove")
        await rpc(db, "remove_group_member", [g.id, users.bob]);
      else {
        await login(db, "bob");
        await rpc(
          db,
          action === "leave" ? "leave_group" : "delete_own_account",
          action === "leave" ? [g.id] : [],
        );
        await login(db, "alice");
      }
      expect(
        (await rpc<any>(db, "get_group", [g.id])).vice_owner_id,
      ).toBeNull();
      await expect(rpc(db, "leave_group", [g.id])).rejects.toThrow(
        /vice|transfer/i,
      );
    }
  });
  it("keeps direct writes and privileged helpers inaccessible, and permits owner group deletion", async () => {
    const g = await joined();
    await rpc(db, "set_group_vice_owner", [g.id, users.bob]);
    await expect(
      db.query("update public.groups set vice_owner_id=null where id=$1", [
        g.id,
      ]),
    ).rejects.toThrow(/permission/);
    await expect(
      db.query("select private.group_action_base('transfer',$1,$2)", [
        g.id,
        users.bob,
      ]),
    ).rejects.toThrow(/permission/);
    await db.exec("reset role;set role anon");
    await expect(
      rpc(db, "set_group_vice_owner", [g.id, users.bob]),
    ).rejects.toThrow(/permission/);
    await login(db, "alice");
    await rpc(db, "delete_group", [g.id]);
    expect(await rpc(db, "list_my_groups")).toEqual([]);
  });
  it("clears succession on manual transfer and permits unsetting a vice", async () => {
    const g = await joined();
    await rpc(db, "set_group_vice_owner", [g.id, users.bob]);
    await rpc(db, "set_group_vice_owner", [g.id, null]);
    expect((await rpc<any>(db, "get_group", [g.id])).vice_owner_id).toBeNull();
    await rpc(db, "set_group_vice_owner", [g.id, users.bob]);
    await rpc(db, "transfer_group_ownership", [g.id, users.bob]);
    await login(db, "bob");
    expect((await rpc<any>(db, "get_group", [g.id])).vice_owner_id).toBeNull();
  });
});
