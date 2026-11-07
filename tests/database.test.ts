import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const session = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
async function actAs(id: string, sid = session) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: id, session_id: sid })}', false);`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key, user_id uuid references auth.users on delete cascade);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.jwt(), auth.uid() to authenticated, anon;
    insert into auth.users values ('${alice}');`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261026183840_platform_foundation.sql",
      "utf8",
    ),
  );
  expect((await db.query("select id from public.profiles")).rows).toEqual([
    { id: alice },
  ]);
}, 30000);
beforeEach(async () => {
  await db.exec(
    `reset role; truncate auth.users cascade; insert into auth.users values ('${alice}'),('${bob}'); insert into auth.sessions values ('${session}','${alice}');`,
  );
});
afterAll(async () => {
  await db?.close();
});
describe("profile migration and RLS in PostgreSQL", () => {
  it("creates default profiles with UTC-capable timestamps and backfills existing users", async () => {
    const { rows } = await db.query<{ display_name: string; created_at: Date }>(
      `select * from public.profiles`,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].display_name).toBe("Player");
    expect(rows[0].created_at).toBeTruthy();
  });
  it("allows only reading and updating your own display name", async () => {
    await actAs(alice);
    expect((await db.query("select * from public.profiles")).rows).toHaveLength(
      1,
    );
    expect(
      (
        await db.query(
          `update public.profiles set display_name='Bob' where id='${bob}' returning *`,
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          `update public.profiles set display_name='Alice' where id='${alice}' returning display_name`,
        )
      ).rows,
    ).toEqual([{ display_name: "Alice" }]);
  });
  it("denies anonymous profile access", async () => {
    await db.exec("set role anon");
    await expect(db.query("select * from public.profiles")).rejects.toThrow(
      /permission denied/,
    );
  });
  it("protects identity, timestamps, insertion, and direct profile deletion", async () => {
    await actAs(alice);
    for (const query of [
      `update public.profiles set id='${bob}'`,
      `update public.profiles set created_at=now()`,
      `delete from public.profiles`,
      `insert into public.profiles(id) values ('${session}')`,
    ]) {
      await expect(db.query(query)).rejects.toThrow(/permission denied/);
    }
  });
  it.each(["", " ", "a".repeat(51), "a\nb"])(
    "enforces display-name constraints server-side: %j",
    async (name) => {
      await actAs(alice);
      await expect(
        db.query("update public.profiles set display_name=$1 where id=$2", [
          name,
          alice,
        ]),
      ).rejects.toThrow(/check constraint/);
    },
  );
  it("deletes only the active caller and cascades their profile and sessions", async () => {
    await actAs(alice);
    await db.query("select public.delete_own_account()");
    await db.exec("reset role");
    expect((await db.query("select id from auth.users")).rows).toEqual([
      { id: bob },
    ]);
    expect((await db.query("select id from public.profiles")).rows).toEqual([
      { id: bob },
    ]);
    expect((await db.query("select * from auth.sessions")).rows).toHaveLength(
      0,
    );
    await actAs(alice);
    await expect(
      db.query("select public.delete_own_account()"),
    ).rejects.toThrow(/active authenticated session/);
  });
  it("rejects missing, revoked, and another user’s session", async () => {
    await actAs(bob);
    await expect(
      db.query("select public.delete_own_account()"),
    ).rejects.toThrow(/active authenticated session/);
    await actAs(alice, "44444444-4444-4444-8444-444444444444");
    await expect(
      db.query("select public.delete_own_account()"),
    ).rejects.toThrow(/active authenticated session/);
    await db.exec(
      `reset role; set role authenticated; select set_config('request.jwt.claims','{}',false)`,
    );
    await expect(
      db.query("select public.delete_own_account()"),
    ).rejects.toThrow(/active authenticated session/);
  });
  it("denies anonymous deletion", async () => {
    await db.exec("set role anon");
    await expect(
      db.query("select public.delete_own_account()"),
    ).rejects.toThrow(/permission denied/);
  });
});
