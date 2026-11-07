import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  sessionDatabase,
  resetUsers,
  login,
  rpc,
  users,
} from "./fixtures/database";
import type {
  GameSession,
  SessionDetails,
  SessionSummary,
} from "../src/platform/sessions/types";
import { gameRegistry } from "../src/platform/games/registry";
let db: PGlite;
const requestId = "99999999-9999-4999-8999-999999999999";
async function create(name = "Test session") {
  return rpc<GameSession>(db, "create_game_session", [
    "engine_fixture",
    name,
    { rounds: 3 },
    requestId,
  ]);
}
beforeAll(async () => {
  db = await sessionDatabase();
}, 30000);
beforeEach(async () => {
  await resetUsers(db);
  await login(db, "alice");
});
afterAll(async () => {
  await db?.close();
});
describe("trusted session engine", () => {
  it("seeds only Secret Santa in production, with the same reserved schema as the typed module", async () => {
    const { rows } = await db.query<{
      id: string;
      availability_status: string;
      configuration_schema: unknown;
    }>(
      "select id,availability_status,configuration_schema from game_types where id<>'engine_fixture'",
    );
    expect(rows).toEqual([
      {
        id: "secret_santa",
        availability_status: "coming_soon",
        configuration_schema:
          gameRegistry.require("secret_santa").configurationSchema,
      },
    ]);
  });
  it("atomically creates a private draft and derives host membership from authentication", async () => {
    const session = await create();
    expect(session.host_id).toBe(users.alice);
    expect(session.group_id).toBeNull();
    expect(session.status).toBe("draft");
    const details = await rpc<SessionDetails>(db, "get_game_session", [
      session.id,
    ]);
    expect(details.participants).toHaveLength(1);
    expect(details.participants[0].role).toBe("host");
  });
  it("makes creation retries idempotent and rejects reusing an id for different settings", async () => {
    const a = await create();
    const b = await create();
    expect(a.id).toBe(b.id);
    await expect(create("Different")).rejects.toThrow(/request/i);
    expect(
      (await rpc<SessionSummary[]>(db, "list_my_game_sessions")).length,
    ).toBe(1);
  });
  it("blocks unavailable and unknown game types and validates configuration on the server", async () => {
    for (const game of ["secret_santa", "unknown"])
      await expect(
        rpc(db, "create_game_session", [game, "Test", {}, requestId]),
      ).rejects.toThrow();
    for (const config of [
      {},
      { rounds: 0 },
      { rounds: 6 },
      { rounds: "3" },
      { rounds: 1.5 },
      { rounds: 3, extra: 1 },
      null,
      [],
    ])
      await expect(
        rpc(db, "create_game_session", [
          "engine_fixture",
          "Test",
          config,
          requestId,
        ]),
      ).rejects.toThrow();
  });
  it("prevents invalid names and unvalidated group associations", async () => {
    for (const name of ["", " ", "a".repeat(121), "Hi\nThere"])
      await expect(create(name)).rejects.toThrow();
    const session = await create();
    await db.exec("reset role");
    await expect(
      db.query("update game_sessions set group_id=$1 where id=$2", [
        users.bob,
        session.id,
      ]),
    ).rejects.toThrow(/check constraint|immutable/);
  });
  it("denies direct DML, anonymous calls, and stale sessions", async () => {
    await create();
    for (const table of ["game_types", "game_sessions", "game_session_members"])
      for (const op of [`delete from ${table}`, `update ${table} set id=id`])
        await expect(db.query(op)).rejects.toThrow(/permission denied/);
    await db.exec("reset role;set role anon");
    await expect(create()).rejects.toThrow(/permission denied/);
    await db.exec("reset role;delete from auth.sessions");
    await login(db, "alice");
    await expect(create()).rejects.toThrow(/authenticated session/);
  });
  it("hides private drafts and their members from outsiders", async () => {
    const s = await create();
    await login(db, "bob");
    expect(await rpc(db, "list_my_game_sessions")).toEqual([]);
    expect((await db.query("select * from game_sessions")).rows).toHaveLength(
      0,
    );
    expect(
      (await db.query("select * from game_session_members")).rows,
    ).toHaveLength(0);
    await expect(rpc(db, "get_game_session", [s.id])).rejects.toThrow(
      /not found|access/i,
    );
    await expect(rpc(db, "join_game_session", [s.id])).rejects.toThrow();
  });
  it("permits only host settings changes and cancellation", async () => {
    const s = await create();
    await login(db, "bob");
    for (const operation of [
      "cancel_game_session",
      "start_game_session",
      "open_game_lobby",
    ])
      await expect(rpc(db, operation, [s.id])).rejects.toThrow();
    await expect(
      rpc(db, "update_game_session", [s.id, "Hacked", { rounds: 1 }]),
    ).rejects.toThrow();
    await login(db, "alice");
    const changed = await rpc<GameSession>(db, "update_game_session", [
      s.id,
      "Updated",
      { rounds: 2 },
    ]);
    expect(changed.name).toBe("Updated");
    expect(changed.configuration).toEqual({ rounds: 2 });
    await expect(
      rpc(db, "update_game_session", [s.id, "Test", { rounds: 99 }]),
    ).rejects.toThrow();
    expect(
      (await rpc<GameSession>(db, "cancel_game_session", [s.id])).status,
    ).toBe("cancelled");
  });
  it("joins open lobbies idempotently, shows participants, and permits leaving", async () => {
    const s = await create();
    await rpc(db, "open_game_lobby", [s.id]);
    await login(db, "bob");
    await rpc(db, "join_game_session", [s.id]);
    await rpc(db, "join_game_session", [s.id]);
    const details = await rpc<SessionDetails>(db, "get_game_session", [s.id]);
    expect(details.participant_count).toBe(2);
    expect(details.participants.map((m) => m.user_id)).toContain(users.bob);
    expect((await db.query("select * from profiles")).rows).toHaveLength(1);
    await db.exec("reset role");
    await expect(
      db.query(
        "insert into game_session_members(session_id,user_id,role) values($1,$2,$3)",
        [s.id, users.bob, "member"],
      ),
    ).rejects.toThrow(/unique/);
    await login(db, "bob");
    await rpc(db, "leave_game_session", [s.id]);
    await rpc(db, "leave_game_session", [s.id]);
    await expect(rpc(db, "get_game_session", [s.id])).rejects.toThrow();
    await login(db, "alice");
    await expect(rpc(db, "leave_game_session", [s.id])).rejects.toThrow(
      /host/i,
    );
  });
  it("enforces player limits and serializes membership-changing operations", async () => {
    const s = await create();
    await rpc(db, "open_game_lobby", [s.id]);
    await expect(rpc(db, "start_game_session", [s.id])).rejects.toThrow(
      /players/i,
    );
    for (const user of ["bob", "carol", "dave"] as const) {
      await login(db, user);
      await rpc(db, "join_game_session", [s.id]);
    }
    await login(db, "eve");
    await expect(rpc(db, "join_game_session", [s.id])).rejects.toThrow(/full/i);
    await login(db, "alice");
    const started = await rpc<GameSession>(db, "start_game_session", [s.id]);
    expect(started.status).toBe("active");
    expect(started.started_at).toBeTruthy();
    await login(db, "bob");
    await expect(rpc(db, "leave_game_session", [s.id])).rejects.toThrow();
    await login(db, "eve");
    await expect(rpc(db, "join_game_session", [s.id])).rejects.toThrow();
  });
  it("enforces graph transitions, immutable terminal states, and lifecycle support", async () => {
    const s = await create();
    await expect(rpc(db, "start_game_session", [s.id])).rejects.toThrow();
    await rpc(db, "open_game_lobby", [s.id]);
    await login(db, "bob");
    await rpc(db, "join_game_session", [s.id]);
    await login(db, "alice");
    await rpc(db, "start_game_session", [s.id]);
    await expect(
      rpc(db, "update_game_session", [s.id, "Late edit", { rounds: 2 }]),
    ).rejects.toThrow();
    await db.exec("reset role");
    await expect(
      db.query("update game_sessions set status='draft' where id=$1", [s.id]),
    ).rejects.toThrow(/transition/);
    await db.query("update game_sessions set status='completed' where id=$1", [
      s.id,
    ]);
    await login(db, "alice");
    const done = await rpc<GameSession>(db, "get_game_session", [s.id]);
    expect(done.completed_at).toBeTruthy();
    await expect(rpc(db, "cancel_game_session", [s.id])).rejects.toThrow();
  });
  it("cascades hosted sessions and memberships during account deletion", async () => {
    await create();
    await rpc(db, "delete_own_account");
    await db.exec("reset role");
    expect((await db.query("select * from game_sessions")).rows).toHaveLength(
      0,
    );
    expect(
      (await db.query("select * from game_session_members")).rows,
    ).toHaveLength(0);
  });
});

describe("lifecycle graph and configuration parity", () => {
  it("accepts only the documented lifecycle graph, including failed and terminal states", async () => {
    await db.exec("reset role");
    const statuses = [
      "draft",
      "lobby",
      "active",
      "completed",
      "cancelled",
      "failed",
    ];
    const allowed: Record<string, string[]> = {
      draft: ["lobby", "cancelled"],
      lobby: ["active", "cancelled", "failed"],
      active: ["completed", "cancelled", "failed"],
      completed: [],
      cancelled: [],
      failed: [],
    };
    for (const from of statuses)
      for (const to of statuses) {
        if (from === to) continue;
        const { rows } = await db.query<{ id: string }>(
          `insert into game_sessions(game_type_id,host_id,name,configuration,creation_request_id,creation_fingerprint) values('engine_fixture',$1,'Graph test','{"rounds":3}',gen_random_uuid(),'test') returning id`,
          [users.alice],
        );
        const id = rows[0].id;
        const setup =
          from === "draft"
            ? []
            : from === "cancelled"
              ? ["cancelled"]
              : from === "lobby"
                ? ["lobby"]
                : from === "failed"
                  ? ["lobby", "failed"]
                  : from === "active"
                    ? ["lobby", "active"]
                    : ["lobby", "active", "completed"];
        for (const status of setup)
          await db.query("update game_sessions set status=$1 where id=$2", [
            status,
            id,
          ]);
        const transition = db.query(
          "update game_sessions set status=$1 where id=$2",
          [to, id],
        );
        if (allowed[from].includes(to))
          await expect(transition).resolves.toBeTruthy();
        else await expect(transition).rejects.toThrow(/transition/);
      }
  });
  it("denies host-only operations to an actual participant, not just outsiders", async () => {
    const s = await create();
    await rpc(db, "open_game_lobby", [s.id]);
    await login(db, "bob");
    await rpc(db, "join_game_session", [s.id]);
    for (const operation of [
      "cancel_game_session",
      "start_game_session",
      "open_game_lobby",
    ])
      await expect(rpc(db, operation, [s.id])).rejects.toThrow(/host/i);
    await expect(
      rpc(db, "update_game_session", [s.id, "Hacked", { rounds: 2 }]),
    ).rejects.toThrow(/host/i);
  });
  it("rejects lifecycle operations a registered module does not support", async () => {
    const s = await create();
    await rpc(db, "open_game_lobby", [s.id]);
    await login(db, "bob");
    await rpc(db, "join_game_session", [s.id]);
    await db.exec(
      "reset role;update game_types set lifecycle_operations=array_remove(lifecycle_operations,'start') where id='engine_fixture'",
    );
    try {
      await login(db, "alice");
      await expect(rpc(db, "start_game_session", [s.id])).rejects.toThrow(
        /unsupported/,
      );
    } finally {
      await db.exec(
        "reset role;update game_types set lifecycle_operations=array_append(lifecycle_operations,'start') where id='engine_fixture'",
      );
    }
  });
  it("matches scalar schema validation and rejects unsafe integer or unknown fields", async () => {
    await db.exec("reset role");
    const schema = {
      type: "object",
      properties: {
        label: { type: "string", minLength: 1, maxLength: 5 },
        enabled: { type: "boolean" },
        rounds: { type: "integer", minimum: 1, maximum: 5 },
      },
      required: ["label", "rounds"],
      additionalProperties: false,
    };
    for (const [value, valid] of [
      [{ label: "🎲", rounds: 2, enabled: true }, true],
      [{ label: "", rounds: 2 }, false],
      [{ label: "abcdef", rounds: 2 }, false],
      [{ label: true, rounds: 2 }, false],
      [{ label: "Hey", rounds: 2, enabled: 1 }, false],
      [{ label: "Hey", rounds: 2, unknown: true }, false],
      [{ label: "Hey", rounds: 9007199254740992 }, false],
    ] as const) {
      const { rows } = await db.query<{ valid: boolean }>(
        "select private.valid_game_configuration($1,$2) as valid",
        [schema, value],
      );
      expect(rows[0].valid).toBe(valid);
    }
    await expect(
      db.query(
        `insert into game_types(id,name,description,category,icon_ref,min_players,availability_status,configuration_schema) values('broken','Broken','Broken','Test','test',2,'available','{}')`,
      ),
    ).rejects.toThrow(/check constraint/);
  });
});
