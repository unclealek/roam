import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import {
  sessionDatabase,
  resetUsers,
  login,
  rpc,
  users,
} from "./fixtures/database";
let db: PGlite;
let session: string;
beforeAll(async () => {
  db = await sessionDatabase();
  await db.exec("create role service_role");
  await db.exec(
    "create schema net; create table net.http_request_queue(id bigint); grant all on net.http_request_queue to public",
  );
  for (const name of [
    "20261027090002_scheduling_notifications.sql",
    "20261027134631_shared_rewards_collectibles.sql",
    "20261027181151_harden_notification_reward_rpc_storage.sql",
    "20261028054725_protect_cron_worker_request_credentials.sql",
    "20261028054852_sign_notification_cron_requests.sql",
  ]) {
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
    if (name.includes("scheduling_notifications"))
      await rpc(db, "notification_worker", ["tick"]);
  }
}, 30000);
beforeEach(async () => {
  await resetUsers(db);
  await db.exec(
    `update collectible_cards set unlock_rule='{"kind":"completed_sessions","count":1,"description":"Complete your first game."}' where id='first_steps'`,
  );
  await db.exec(
    "delete from reward_definitions where game_type_id is not null; delete from achievement_definitions where id like 'test_%'; delete from collectible_cards where id like 'test_%'; update reward_definitions set is_active=true where id in ('first_game_completed','activity_completed','session_finished')",
  );
  await login(db, "alice");
  const s = await rpc<{ id: string }>(db, "create_game_session", [
    "engine_fixture",
    "Rewards",
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
  await rpc(db, "process_reward_events");
});
afterAll(async () => {
  await db?.close();
});
const finish = () =>
  db.query("update game_sessions set status='completed' where id=$1", [
    session,
  ]);
const process = () => rpc<number>(db, "process_reward_events");
const award = (
  event = "session_finished",
  user: string = users.alice,
  source: string | null = null,
) =>
  rpc<{ amount?: number; duplicate?: boolean; skipped?: boolean }>(
    db,
    "award_xp_for_event",
    [user, event, session, source],
  );
it("starts with zero XP and the configured level 1; seeds definitions without synthetic rewards", async () => {
  await login(db, "alice");
  const p = await rpc(db, "reward_account", ["progress"]);
  expect(p).toMatchObject({
    total_xp: 0,
    level: 1,
    level_xp: 0,
    next_level_xp: 100,
    progress: 0,
  });
  const cards = await rpc<{ id: string; unlocked_at: string | null }[]>(
    db,
    "reward_account",
    ["collectibles"],
  );
  expect(cards).toHaveLength(5);
  expect(cards.every((c) => c.unlocked_at === null)).toBe(true);
});
it("refuses unproven events, foreign actors and dormant game verifiers", async () => {
  await expect(award()).rejects.toThrow(/not proven/);
  await expect(award("session_finished", users.carol)).rejects.toThrow(
    /access denied/,
  );
  await expect(award("mind_match_prediction_correct")).rejects.toThrow(
    /verifier/,
  );
  await expect(award("arbitrary")).rejects.toThrow(/verifier/);
  expect((await db.query("select * from xp_transactions")).rows).toHaveLength(
    0,
  );
});
it("awards first-game bonus once, finishes once per session and counts game XP once globally", async () => {
  await finish();
  expect(await process()).toBe(4);
  await process();
  await login(db, "alice");
  const dashboard = await rpc<{
    progress: Record<string, number>;
    game_progress: { total_xp: number }[];
    collectibles: { id: string; unlocked_at: string | null }[];
  }>(db, "reward_account", ["dashboard"]);
  expect(dashboard.progress).toMatchObject({
    total_xp: 200,
    level: 2,
    xp_into_level: 100,
    xp_to_next_level: 50,
  });
  expect(dashboard.game_progress[0].total_xp).toBe(200);
  expect(
    dashboard.collectibles.find((c) => c.id === "first_steps")?.unlocked_at,
  ).toBeTruthy();
  await db.exec("reset role");
  expect(await award()).toMatchObject({ duplicate: true, amount: 100 });
  expect(
    (
      await db.query("select * from xp_transactions where user_id=$1", [
        users.alice,
      ])
    ).rows,
  ).toHaveLength(2);
});
it("prevents direct writes and privileged RPC access, and isolates all player tables by RLS", async () => {
  await finish();
  await process();
  await login(db, "carol");
  for (const table of [
    "xp_transactions",
    "user_collectibles",
    "user_achievements",
  ])
    expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
  for (const [, sql] of [
    [
      "xp_transactions",
      "insert into xp_transactions(user_id) values (auth.uid())",
    ],
    [
      "user_collectibles",
      "insert into user_collectibles(user_id,card_id,source_event_key) values(auth.uid(),'first_steps','fake')",
    ],
    ["reward_definitions", "update reward_definitions set xp_amount=999"],
  ])
    await expect(db.exec(sql)).rejects.toThrow(/permission/);
  await expect(award()).rejects.toThrow(/permission/);
  await expect(
    rpc(db, "evaluate_reward_eligibility", [users.carol, null]),
  ).rejects.toThrow(/permission/);
  await expect(process()).rejects.toThrow(/permission/);
  const progress = await rpc(db, "reward_account", [
    "progress",
    { user_id: users.alice },
  ]);
  expect(progress.total_xp).toBe(0);
});
it("requires targeted, completed activity proof and deduplicates arbitrary retries", async () => {
  const id = await rpc<string>(db, "schedule_activity", [
    session,
    "challenge",
    users.alice,
    null,
    null,
    "proof",
    {},
  ]);
  await rpc(db, "notification_worker", ["tick"]);
  await expect(award("activity_completed", users.alice, id)).rejects.toThrow(
    /not proven/,
  );
  await rpc(db, "transition_activity", [id, "completed"]);
  await process();
  expect(await award("activity_completed", users.alice, id)).toMatchObject({
    duplicate: true,
    amount: 20,
  });
  await expect(award("activity_completed", users.bob, id)).rejects.toThrow(
    /not proven/,
  );
  const broadcast = await rpc<string>(db, "schedule_activity", [
    session,
    "challenge",
    null,
    null,
    null,
    "broadcast",
    {},
  ]);
  await rpc(db, "notification_worker", ["tick"]);
  await rpc(db, "transition_activity", [broadcast, "completed"]);
  await expect(
    award("activity_completed", users.alice, broadcast),
  ).rejects.toThrow(/not proven/);
});
it("deduplicates cards, achievements and every notification even when evaluations repeat", async () => {
  await finish();
  await process();
  for (let i = 0; i < 3; i++)
    await rpc(db, "evaluate_reward_eligibility", [users.alice, session]);
  expect(
    (
      await db.query("select * from user_collectibles where user_id=$1", [
        users.alice,
      ])
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query("select * from user_achievements where user_id=$1", [
        users.alice,
      ])
    ).rows,
  ).toHaveLength(1);
  const notifications = (
    await db.query<{ event_key: string; route: string }>(
      "select event_key,route from user_notifications where user_id=$1 and category='rewards'",
      [users.alice],
    )
  ).rows;
  expect(notifications).toHaveLength(5);
  expect(new Set(notifications.map((n) => n.event_key)).size).toBe(5);
  expect(notifications.every((n) => n.route === "/rewards")).toBe(true);
  await login(db, "alice");
  const pref = await rpc(db, "notification_account", ["preferences"]);
  expect(pref.rewards_enabled).toBe(false);
});
it("skips inactive or missing definitions and never invents XP", async () => {
  await finish();
  await db.exec(
    "update reward_definitions set is_active=false where id='session_finished'",
  );
  expect(await award()).toMatchObject({ skipped: true });
  await db.exec("delete from reward_definitions where id='session_finished'");
  expect(await award()).toMatchObject({ skipped: true });
  await db.exec(
    "insert into reward_definitions(id,event_key,xp_amount,is_active) values('session_finished','session_finished',100,true)",
  );
});
it("uses game overrides, including inactive overrides, without double counting global rules", async () => {
  await finish();
  await db.exec(
    "insert into reward_definitions(id,event_key,game_type_id,xp_amount,is_active) values('fixture_finish','session_finished','engine_fixture',45,false)",
  );
  expect(await award()).toMatchObject({ skipped: true });
  await db.exec(
    "update reward_definitions set is_active=true where id='fixture_finish'",
  );
  expect(await award()).toMatchObject({ amount: 45 });
  await db.exec(
    "update reward_definitions set xp_amount=50 where id='fixture_finish'",
  );
  expect(await award()).toMatchObject({ amount: 45, duplicate: true });
  await db.exec(
    "update reward_definitions set is_active=false where id='fixture_finish'",
  );
});
it("calculates every level boundary from actual, verified XP transactions", async () => {
  const thresholds = [0, 100, 250, 500, 850, 1300, 1850, 2500];
  let total = 0;
  const earn = async (amount: number, key: string) => {
    await db.query(
      "update reward_definitions set xp_amount=$1 where id='activity_completed'",
      [amount],
    );
    const id = await rpc<string>(db, "schedule_activity", [
      session,
      "challenge",
      users.alice,
      null,
      null,
      key,
      {},
    ]);
    await rpc(db, "notification_worker", ["tick"]);
    await rpc(db, "transition_activity", [id, "completed"]);
    await award("activity_completed", users.alice, id);
    total += amount;
    await login(db, "alice");
    const result = await rpc(db, "reward_account", ["progress"]);
    await db.exec("reset role");
    return result;
  };
  for (let i = 1; i < thresholds.length; i++) {
    const before = await earn(
      thresholds[i] - total - 1,
      `boundary:${i}:before`,
    );
    expect(before).toMatchObject({ level: i, total_xp: thresholds[i] - 1 });
    const exact = await earn(1, `boundary:${i}:exact`);
    expect(exact).toMatchObject({ level: i + 1, total_xp: thresholds[i] });
    if (i === 7)
      expect(exact).toMatchObject({ next_level_xp: null, progress: 1 });
  }
  await db.exec(
    "update reward_definitions set xp_amount=20 where id='activity_completed'",
  );
});
it("unlocks XP achievements only at eligibility and evaluates cards even when XP is disabled", async () => {
  await rpc(db, "evaluate_reward_eligibility", [users.alice, session]);
  expect((await db.query("select * from user_achievements")).rows).toHaveLength(
    0,
  );
  await finish();
  await db.exec(
    "update reward_definitions set is_active=false where id in ('first_game_completed','session_finished')",
  );
  await process();
  expect((await db.query("select * from xp_transactions")).rows).toHaveLength(
    0,
  );
  expect((await db.query("select * from user_collectibles")).rows).toHaveLength(
    2,
  );
  expect(
    await rpc(db, "unlock_collectible", [users.alice, "mind_reader", session]),
  ).toBe(false);
  await db.exec(
    "update reward_definitions set is_active=true,xp_amount=500 where id='session_finished'",
  );
  await award();
  expect(
    (
      await db.query(
        "select * from user_achievements where user_id=$1 and achievement_id='xp_500'",
        [users.alice],
      )
    ).rows,
  ).toHaveLength(1);
  await db.exec(
    "update reward_definitions set xp_amount=100 where id='session_finished'",
  );
});
it("supports game and session achievement scopes, without leaking another user progress", async () => {
  await db.exec(`insert into achievement_definitions(id,name,description,scope,game_type_id,criteria) values
 ('test_game','Game progress','Earn game XP','game','engine_fixture','{"kind":"total_xp","count":100}'),
 ('test_session','Session progress','Finish this session','session',null,'{"kind":"completed_sessions","count":1}')`);
  await finish();
  await process();
  expect(
    (
      await db.query(
        "select * from user_achievements where user_id=$1 and achievement_id like 'test_%'",
        [users.alice],
      )
    ).rows,
  ).toHaveLength(2);
  await login(db, "bob");
  const games = await rpc<{ total_xp: number }[]>(db, "reward_account", [
    "game_progress",
    { game_type_id: "engine_fixture", session_id: session },
  ]);
  expect(games[0].total_xp).toBe(200);
  await login(db, "carol");
  expect(
    await rpc(db, "reward_account", [
      "game_progress",
      { game_type_id: "engine_fixture", session_id: session },
    ]),
  ).toEqual([]);
});
it("preserves immutable ledger amounts and lifetime XP after session deletion, while allowing account erasure", async () => {
  await finish();
  await process();
  await expect(
    db.exec("update xp_transactions set amount=999"),
  ).rejects.toThrow(/append-only/);
  await expect(db.exec("delete from xp_transactions")).rejects.toThrow(
    /append-only/,
  );
  await db.query("delete from game_sessions where id=$1", [session]);
  await login(db, "alice");
  expect((await rpc(db, "reward_account", ["progress"])).total_xp).toBe(200);
  const history = await rpc<
    { game_session_id: null; source_session_id: string }[]
  >(db, "reward_account", ["history"]);
  expect(history[0].game_session_id).toBeNull();
  expect(history[0].source_session_id).toBe(session);
  const preservedGame = await rpc<{ total_xp: number }[]>(
    db,
    "reward_account",
    ["game_progress", { session_id: session }],
  );
  expect(preservedGame[0].total_xp).toBe(200);
  await db.exec("reset role");
  await db.query("delete from auth.users where id=$1", [users.alice]);
  expect(
    (
      await db.query("select * from xp_transactions where user_id=$1", [
        users.alice,
      ])
    ).rows,
  ).toHaveLength(0);
});
it("never unlocks game-specific cards without real module validators and rejects ineligible card requests", async () => {
  expect(
    await rpc(db, "unlock_collectible", [users.alice, "first_steps", session]),
  ).toBe(false);
  for (const id of ["mind_reader", "gift_detective", "mystery_solver"])
    expect(
      await rpc(db, "unlock_collectible", [users.alice, id, session]),
    ).toBe(false);
  await expect(
    rpc(db, "unlock_collectible", [users.alice, "missing", session]),
  ).rejects.toThrow(/not found/);
  await login(db, "alice");
  await expect(
    rpc(db, "unlock_collectible", [users.alice, "first_steps", session]),
  ).rejects.toThrow(/permission/);
});
it("rejects malformed level configuration and keeps the prior thresholds intact", async () => {
  await expect(
    db.exec("update level_thresholds set xp_required=50 where level=3"),
  ).rejects.toThrow(/thresholds/);
  expect(
    (
      await db.query<{ xp_required: number }>(
        "select xp_required from level_thresholds where level=3",
      )
    ).rows[0].xp_required,
  ).toBe(250);
  await expect(
    db.exec("delete from level_thresholds where level=1"),
  ).rejects.toThrow(/thresholds/);
});
async function fixtureSession(game: string) {
  await db.query(
    `insert into game_types(id,name,description,category,icon_ref,min_players,availability_status,configuration_schema,lifecycle_operations) values($1,$1,'Fixture','Test','test',1,'available','{"type":"object","properties":{},"required":[],"additionalProperties":false}','{}') on conflict do nothing`,
    [game],
  );
  const id = (
    await db.query<{ id: string }>(
      `insert into game_sessions(game_type_id,host_id,name,configuration,creation_request_id,creation_fingerprint) values($1,$2,'Fixture','{}',gen_random_uuid(),'test') returning id`,
      [game, users.alice],
    )
  ).rows[0].id;
  await db.query(
    `insert into game_session_members(session_id,user_id,role) values($1,$2,'host')`,
    [id, users.alice],
  );
  await db.query("update game_sessions set status='lobby' where id=$1", [id]);
  await db.query("update game_sessions set status='active' where id=$1", [id]);
  return id;
}
it("accumulates XP across game types, awards the first-game bonus only once and validates participation milestones", async () => {
  const other = await fixtureSession("rewards_fixture_two");
  await fixtureSession("rewards_fixture_three");
  await rpc(db, "evaluate_reward_eligibility", [users.alice, session]);
  expect(
    (
      await db.query(
        "select * from user_collectibles where card_id='dedicated_explorer' and user_id=$1",
        [users.alice],
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query(
        "select * from user_achievements where achievement_id='three_sessions' and user_id=$1",
        [users.alice],
      )
    ).rows,
  ).toHaveLength(1);
  await finish();
  await db.query("update game_sessions set status='completed' where id=$1", [
    other,
  ]);
  await process();
  await login(db, "alice");
  const p = await rpc(db, "reward_account", ["progress"]);
  expect(p.total_xp).toBe(300);
  const games = await rpc<{ total_xp: number }[]>(db, "reward_account", [
    "game_progress",
  ]);
  expect(games.map((g) => g.total_xp).sort((a, b) => a - b)).toEqual([
    100, 200,
  ]);
  expect(games.reduce((sum, g) => sum + g.total_xp, 0)).toBe(300);
  await db.exec("reset role");
  expect(
    (
      await db.query(
        "select * from xp_transactions where user_id=$1 and source_event_key='first_game_completed'",
        [users.alice],
      )
    ).rows,
  ).toHaveLength(1);
});
it("unlocks unique-card achievements from actual ownership rather than catalog size", async () => {
  await rpc(db, "evaluate_reward_eligibility", [users.alice, session]);
  expect(
    (
      await db.query(
        "select * from user_achievements where achievement_id='five_cards'",
      )
    ).rows,
  ).toHaveLength(0);
  for (let i = 0; i < 5; i++) {
    await db.query(
      `insert into collectible_cards(id,name,description,rarity,artwork_key,unlock_rule) values($1,'Fixture','Fixture','common','fixture','{"kind":"participated_sessions","count":1}')`,
      [`test_card_${i}`],
    );
    expect(
      await rpc(db, "unlock_collectible", [
        users.alice,
        `test_card_${i}`,
        session,
      ]),
    ).toBe(true);
  }
  await rpc(db, "evaluate_reward_eligibility", [users.alice, session]);
  expect(
    (
      await db.query(
        "select * from user_achievements where achievement_id='five_cards'",
      )
    ).rows,
  ).toHaveLength(1);
});
it("paginates ledger history deterministically without duplicating XP", async () => {
  for (let i = 0; i < 31; i++) {
    const id = await rpc<string>(db, "schedule_activity", [
      session,
      "challenge",
      users.alice,
      null,
      null,
      `history:${i}`,
      {},
    ]);
    await rpc(db, "notification_worker", ["tick"]);
    await rpc(db, "transition_activity", [id, "completed"]);
    await award("activity_completed", users.alice, id);
  }
  await login(db, "alice");
  const page = await rpc<{ id: string; created_at: string }[]>(
    db,
    "reward_account",
    ["history"],
  );
  expect(page).toHaveLength(30);
  const last = page.at(-1)!;
  const next = await rpc<typeof page>(db, "reward_account", [
    "history",
    { before_id: last.id, before_created_at: last.created_at },
  ]);
  expect(next).toHaveLength(1);
  expect(new Set([...page, ...next].map((x) => x.id)).size).toBe(31);
  expect((await rpc(db, "reward_account", ["progress"])).total_xp).toBe(620);
});
it("isolates reward failures from game completion and retries failed awards atomically", async () => {
  await db.exec(
    `update collectible_cards set unlock_rule='{"kind":"total_xp","count":"bad"}' where id='first_steps'`,
  );
  await finish();
  await process();
  expect((await db.query("select * from xp_transactions")).rows).toHaveLength(
    0,
  );
  expect(
    (
      await db.query<{ status: string }>(
        "select status from game_sessions where id=$1",
        [session],
      )
    ).rows[0].status,
  ).toBe("completed");
  expect(
    (
      await db.query<{ attempts: number }>(
        "select attempts from private.reward_events where status='pending'",
      )
    ).rows.every((e) => e.attempts === 1),
  ).toBe(true);
  await db.exec(
    `update collectible_cards set unlock_rule='{"kind":"completed_sessions","count":1,"description":"Complete your first game."}' where id='first_steps';update private.reward_events set next_attempt_at=now()-interval '1 minute'`,
  );
  expect(await process()).toBe(4);
  expect((await db.query("select * from xp_transactions")).rows).toHaveLength(
    4,
  );
});
it("processes completion rewards through the existing activity worker without a new Cron job", async () => {
  await finish();
  const result = await rpc(db, "notification_worker", ["tick"]);
  expect(result.reward_events_processed).toBe(4);
  expect((await db.query("select * from xp_transactions")).rows).toHaveLength(
    4,
  );
});
it("allows account deletion with live session references and existing reward history", async () => {
  await finish();
  await process();
  await db.query("delete from auth.users where id=$1", [users.alice]);
  expect(
    (
      await db.query("select * from xp_transactions where user_id=$1", [
        users.alice,
      ])
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query("select * from user_collectibles where user_id=$1", [
        users.alice,
      ])
    ).rows,
  ).toHaveLength(0);
});

it("keeps RPC bodies private and stores upgrade-safe validator signatures", async () => {
  const queue = await db.query<{ allowed: boolean }>(
    "select has_table_privilege('authenticated','net.http_request_queue','select') as allowed",
  );
  expect(queue.rows[0].allowed).toBe(false);
  const invocation = await db.query<{ allowed: boolean }>(
    "select has_function_privilege('authenticated','private.invoke_notification_dispatcher()','execute') as allowed",
  );
  expect(invocation.rows[0].allowed).toBe(false);
  const functions = await db.query<{ proname: string; prosecdef: boolean }>(
    "select proname,prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('notification_account','reward_account')",
  );
  expect(functions.rows).toHaveLength(2);
  expect(functions.rows.every((row) => !row.prosecdef)).toBe(true);
  const columns = await db.query<{ data_type: string }>(
    "select data_type from information_schema.columns where table_schema='private' and table_name in ('reward_event_registry','reward_milestone_registry') and column_name='validator'",
  );
  expect(columns.rows.map((row) => row.data_type)).toEqual(["text", "text"]);
});
