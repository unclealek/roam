// Verify only the requested fixture's notifications and owner reward projections.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
const fixture = JSON.parse(
  await readFile("docs/artifacts/fortest-fixture.json", "utf8"),
);
const dir = await mkdtemp(join(tmpdir(), "fortest-actions-"));
const literal = (v) => "'" + v.replaceAll("'", "''") + "'";
async function sql(query) {
  const file = join(dir, "query.sql");
  await writeFile(file, query, { mode: 0o600 });
  let raw;
  try {
    raw = execFileSync(
      "supabase",
      [
        "db",
        "query",
        "--linked",
        "--project-ref",
        fixture.project,
        "--file",
        file,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000 },
    );
  } catch {
    throw new Error("Live check failed; sensitive diagnostics suppressed");
  }
  return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)).rows;
}
try {
  const [actor] = await sql(
    `select id from auth.sessions where user_id=${literal(fixture.owner_id)}::uuid order by created_at desc limit 1`,
  );
  assert(actor?.id);
  const claims = JSON.stringify({
    sub: fixture.owner_id,
    session_id: actor.id,
    role: "authenticated",
  });
  const rows = await sql(`begin;
 do $$ begin perform set_config('request.jwt.claims',${literal(claims)},true); end $$;
 set local role authenticated;
 do $$ declare notice uuid; original timestamptz; result jsonb; begin
 select id,read_at into strict notice,original from public.user_notifications where user_id=auth.uid() and related_session_id=${literal(fixture.session_id)}::uuid and template_key='secret_santa_created';
 perform public.notification_account('read',jsonb_build_object('id',notice,'read',true));
 assert (select read_at is not null from public.user_notifications where id=notice), 'Read state failed';
 perform public.notification_account('read',jsonb_build_object('id',notice,'read',false));
 assert (select read_at is null from public.user_notifications where id=notice), 'Unread state failed';
 result:=public.reward_account('dashboard','{}');
 assert result ? 'progress' and result ? 'collectibles' and result ? 'history', 'Reward dashboard missing fields';
 end $$;
 select jsonb_build_object('read_unread',true,'reward_dashboard',true,'notices',(select jsonb_agg(jsonb_build_object('template',template_key,'route',route)) from public.user_notifications where related_session_id=${literal(fixture.session_id)}::uuid)) as verification;
 rollback;`);
  const verification = rows[0].verification;
  assert.equal(
    verification.notices.filter(
      (n) => n.template === "secret_santa_player_joined",
    ).length,
    7,
  );
  assert.equal(
    verification.notices.filter((n) => n.template === "secret_santa_created")
      .length,
    1,
  );
  assert(
    verification.notices.every(
      (n) => n.route === `/session/${fixture.session_id}`,
    ),
  );
  fixture.checks.push(
    "Eight real lifecycle notices (created + seven joins) use the correct session link",
  );
  fixture.checks.push(
    "Owner notification mark-read and mark-unread work; verification transaction rolled back",
  );
  fixture.checks.push("Owner reward dashboard loads through authenticated RPC");
  const delivery = await sql(
    `select status,count(*)::integer as count from private.notification_outbox where notification_id in (select id from public.user_notifications where related_session_id=${literal(fixture.session_id)}::uuid) group by status`,
  );
  fixture.notification_delivery = delivery;
  await writeFile(
    "docs/artifacts/fortest-fixture.json",
    JSON.stringify(fixture, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      read_unread: true,
      reward_dashboard: true,
      session_notices: 8,
      correct_session_links: true,
      outbox: delivery,
    }),
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
