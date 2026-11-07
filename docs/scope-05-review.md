# Scope 05 — Shared Rewards & Collectibles

Implemented on 27 October 2026 and re-audited on 28 October 2026 against the repeated Scope 05 request. Scope 05 was already implemented, deployed and included in TestFlight 0.1.0 (2); this audit preserves it rather than introducing a duplicate rewards engine. No Secret Santa gameplay or Scope 06 work is included. Real reward push delivery remains unverified.

## Inspection and approach

Reviewed the existing Expo SDK 58 app, Expo Router layouts, design tokens, UI primitives, Supabase migrations/RLS, authenticated session membership, scheduled activities, notification templates/outbox, account-scoped resource hook, and existing database/browser test fixtures before implementation. Checked the current Supabase RLS guidance/changelog and Expo's SDK-compatible Reanimated documentation. Existing authentication, profiles, groups, invitations, scheduling and notification infrastructure are retained.

Progression is a shared platform service. It observes genuine session/activity state transitions, verifies evidence on the server, records XP once, evaluates eligibility, and uses the existing notification infrastructure. It does not fabricate completion events, seed player rewards, or activate unfinished games.

## Created files

- `supabase/migrations/20261027134631_shared_rewards_collectibles.sql`
- `supabase/functions/_shared/rewards.ts`
- `src/platform/rewards/types.ts`
- `src/platform/rewards/service.ts`
- `src/platform/rewards/presentation.ts`
- `src/presentation/rewards/RewardsScreen.tsx`
- `src/presentation/rewards/CardDetailScreen.tsx`
- `src/presentation/rewards/CardArtwork.tsx`
- `src/presentation/rewards/RewardMotion.tsx`
- `app/(account)/collectible/[cardId].tsx`
- `tests/rewards-database.test.ts`
- `tests/reward-services.test.ts`
- `tests/reward-screens.test.tsx`
- `tests/reward-motion.test.tsx`
- `e2e/rewards.spec.ts`
- `scripts/test-reward-concurrency.mjs`
- This completion report.

## Modified files

- `app/(tabs)/rewards.tsx`: replaces the reserved screen with shared progression.
- `src/platform/database.types.ts`: read-only rewards table and account RPC contracts.
- `src/platform/notifications/routes.ts`: permits the exact protected `/rewards` destination.
- `package.json`, `package-lock.json`: SDK-compatible Reanimated 4.7.1 and Worklets 0.13.0.
- `vitest.config.mts`: includes the new reward platform/server services in coverage.
- `tests/screens.test.tsx`: mocks the native animation boundary for the existing screen tests.
- `e2e/foundation.spec.ts`: existing fixture now serves the read-only rewards dashboard contract.
- `README.md`, `WORK_LOG.md`: implementation/setup links and verification results.

The working tree was already untracked before the original scope. This re-audit made no new schema or feature changes: it corrected a browser test selector to target visible card-detail text and refreshed this report. No Git push, new migration, new EAS build, or player reward mutation was performed during the re-audit.

## Database migration

The CLI-generated migration adds all six requested reward tables:

- `reward_definitions`: configurable XP amounts and activation, with optional game overrides.
- `xp_transactions`: immutable earned-XP ledger with user/session/game attribution, definition, amount, canonical source, original source-session ID, timestamp and unique idempotency key.
- `collectible_cards`: definitions, rarity, bundled artwork reference, optional game type and unlock rule.
- `user_collectibles`: one copy of a card per player, earned date and source.
- `achievement_definitions`: global, game or session scope and eligibility criteria.
- `user_achievements`: scoped unique unlocks, with a stable scope key that survives session deletion.

It also adds `level_thresholds` and private event/verifier registries, player lock rows, and a durable reward-event queue. Indexes support user history pagination, game/session XP aggregation, owned cards/achievements and pending events. Every new table has RLS; exposed catalogs are read-only to authenticated users, player-owned rows are readable only by their intended active authenticated user, and private tables have no ordinary-user grants.

Historical session deletion clears nullable references but retains earned XP and the original immutable source-session ID. Account erasure deletes that user's progression data. Ledger mutations/deletes otherwise fail, including accidental privileged SQL updates; this is an earned-XP ledger, not a balance clients can edit. No XP spending, clawback or compensation system is introduced.

## XP and level calculations

Global XP is `SUM(xp_transactions.amount)` for one user. Game XP sums the **same rows** filtered by `game_type_id`; session progress optionally filters by the immutable source-session ID, including after session deletion. No second “global XP” transaction is created. The global total therefore accumulates across games without counting game totals again.

Seeded example definitions are migration-owned configuration:

| Event                         |  XP | Initial status                            |
| ----------------------------- | --: | ----------------------------------------- |
| First game completed          | 100 | Active, once per player                   |
| Activity completed            |  20 | Active, once per proven targeted activity |
| Correct Mind Match prediction |  80 | Inactive, verifier absent                 |
| Secret Mission completed      |  40 | Inactive, verifier absent                 |
| Session finished              | 100 | Active, once per player/session           |

The first-game definition is a **bonus** in addition to the session-finish definition: the example first completed session earns 200 XP; later completed sessions earn 100, plus eligible activity rewards. These are independently configurable definitions, not constants in client/game code. A game-specific override wins over the global definition; an inactive override suppresses the global fallback. Missing/inactive definitions award no XP, while independently eligible cards/achievements can still unlock. Changing a definition never rewrites ledger amounts or retroactively duplicates awards.

Level is the greatest configured level whose required XP is at most total earned XP. Seed thresholds are 0, 100, 250, 500, 850, 1,300, 1,850 and 2,500 XP for levels 1–8. Progress is `(totalXP - currentThreshold) / (nextThreshold - currentThreshold)`. The current top level has full progress and no next threshold; XP continues accumulating. Database constraints require ordered, contiguous levels beginning at level 1 / 0 XP. Totals are bounded to JavaScript's safe integer range. Levels are calculated on read; there is no level-calculation job.

## Trusted services and proof

Mobile functions in `src/platform/rewards/service.ts` provide `getPlayerProgress`, `getGameProgress`, `getPlayerCollectibles`, `getCard`, `getAchievements`, `getRewardHistory` and `getRewardDashboard`. All use one authenticated, read-only account RPC that derives the actor from the current verified Supabase session. A supplied user ID cannot select another player's progress.

Trusted game handlers instantiate `rewardService` from `supabase/functions/_shared/rewards.ts` with a server service-role RPC client. Its operations are:

- `awardXpForEvent({userId, event, sessionId, sourceId?})`
- `evaluateAchievements(userId, sessionId?)` (also evaluates eligible cards)
- `unlockCollectible(userId, cardId, sessionId?)` (checks eligibility and updates dependent achievements)

No API accepts an XP amount or a caller-selected idempotency key. SQL resolves the event through a migration-owned registry and executes only an approved private function with the required UUID signature and boolean return type. It validates actual session membership and event state:

- A completed-session event requires a real completed session and participant membership.
- An activity event requires a completed targeted activity belonging to that user and session, with valid completion/unlock/deadline timestamps.
- A broadcast activity's single shared completion is **not** proof that every participant completed it; it does not award individual XP.
- The internal participation event requires membership in an active/completed session. It has no XP definition; it evaluates participation eligibility only.
- Unregistered events, absent verifiers, wrong game types, foreign recipients and unproven IDs cannot produce XP.

The privileged public RPCs are executable by `service_role` only. They are not mobile award endpoints. RLS, revoked write grants and explicit function EXECUTE revocations prevent ordinary users from inserting XP, editing definitions, awarding collectibles or invoking eligibility/worker functions. Game-specific verifiers must be implemented against authoritative game tables in their later scopes; accepting a client “correct/completed” flag is not an allowed verifier.

## Idempotency and concurrency

A private player row lock serializes awards and eligibility evaluation for that user. Canonical keys are generated from the registered event and its configured scope:

- First-game bonus: event + user ID.
- Session reward: event + session ID.
- Activity reward: event + verified activity ID.

The ledger also has independent unique source-event/source-ID constraints. A retry returns the original transaction and immutable amount. Cards have unique `(user_id, card_id)` ownership. Achievements have unique user/definition/scope keys, including session IDs for session-scoped awards. Notification keys derive from the XP transaction, level, card, or scoped achievement. Different request IDs cannot produce an extra award for the same proven source.

The queue uses bounded batches (100 by default, maximum 500), row locks with `SKIP LOCKED`, per-event subtransactions and exponential retry backoff. A failure rolls back XP, unlocks and notification enqueue for that event, records a generic SQLSTATE error and retries later. Game state has already committed independently. Missing/inactive XP definitions are skipped rather than retried forever; re-enabling a definition does not automatically backfill skipped queue events. A trusted handler can explicitly re-evaluate still-valid sources under a reviewed policy.

## Collectibles and achievements

All five requested cards are registered: First Steps, Mind Reader, Gift Detective, Mystery Solver and Dedicated Explorer. Rarities cover common, uncommon, rare and legendary. First Steps requires a completed game. Dedicated Explorer requires participation in active/completed sessions across three game types. Game-specific cards and the full-series achievement have **no registered milestone verifier yet** and cannot unlock until their real logic exists. No fake game catalog entries are added just to satisfy foreign keys; reserved game associations live in the private verifier registry until those game types are registered.

Generic eligibility supports completed-session counts, participation counts, distinct game types, total XP, unique owned cards and registered milestones. Achievement definitions support global, game and session scope; the five requested example achievements are present. A registered milestone validator receives the user/session and must prove its game condition. Game-scoped definitions filter the relevant game; session-scoped definitions use the particular session. Catalog size alone never satisfies card ownership achievements.

Future game integration requires a reviewed migration that registers the real game type, implements the corresponding private verification functions, binds their `regprocedure` references, activates the appropriate definitions, and sets card/achievement game associations/rules as appropriate. This scope intentionally contains no prediction, preference-discovery, mission or activity-series gameplay.

## Scheduling and notifications integration

Genuine session activation queues eligibility evaluation. Genuine session completion queues first-game and session-finish events for current participants. Genuine targeted activity completion queues the activity reward. Inserts of fabricated completed rows are not seeded or backfilled.

The migration wraps Scope 04's existing database scheduler and drains the reward queue from the existing `roam-activities` worker tick. It refreshes the worker definition to invalidate old cached function lookups. No new Cron job, Edge HTTP endpoint or secret is needed. Existing Scope 04 deployments must still be activated as described in that scope's runbook.

In-app reward notifications use the existing `user_notifications` and private outbox. Card unlocks use `reward_unlocked`; XP, level and achievement events add generic `xp_earned`, `level_up` and `achievement_earned` templates. Notifications route to the protected Rewards tab. Push data continues to contain only the owned notification ID; no private game content is added. Existing reward-push preferences remain **disabled by default**, and the existing dispatcher applies permissions/preferences, quiet hours, throttling, token checks, leases and receipts. A repeated evaluation does not enqueue another copy of the same reward notification.

## UI and animations

The Rewards tab shows total XP, level, next-level progress, game totals, recent achievements, locked achievements, owned/locked cards and paginated XP history. Card details show bundled artwork, name, rarity, description, unlock conditions and the server-provided earned date. The card return action dismisses to the Rewards tab instead of stacking a duplicate tab navigator.

`CardArtwork` is a stable artwork-key renderer with geometric placeholder illustrations using existing design tokens and rarity palettes; final artwork can replace it without blocking this scope. Unknown artwork keys have a safe fallback.

XP-earned, level-up, card-unlocked and achievement-earned notices are based on actual differences between consecutive server snapshots for the same account. Initial historical data does not replay as new rewards. Reanimated provides short, interruptible reveals using system reduced-motion settings, with zero-duration animation when reduced motion is enabled. Notices do not capture input, open modals or delay navigation. Progress refreshes on screen focus or the explicit refresh button; no realtime publication is required.

## Deployment and remaining limitations

1. The rewards migration `20261027134631_shared_rewards_collectibles.sql` and RPC/signature hardening migration `20261027181151_harden_notification_reward_rpc_storage.sql` were applied in the earlier authorized deployment. Read-only hosted checks now confirm five collectible cards, five achievements, five reward definitions and eight levels.
2. Existing `roam-activities` and `roam-notifications` Cron jobs are active. Hosted checks confirm RLS on XP/owned collectible/owned achievement tables and deny authenticated execution of XP-award and card-unlock RPCs. Do not fabricate completion events to demonstrate rewards.
3. TestFlight 0.1.0 (2) contains the rewards UI and required native modules. APNs and FCM credentials were configured in the earlier authorized deployment. This does not prove physical-device reward animations, reduced-motion behavior or reward push delivery; these remain device checks.
4. Game-specific milestone verifiers remain dormant until their actual game modules are implemented. Ordinary users may therefore see zero XP and locked cards.
5. Checked-in TypeScript database types are maintained contracts; generated type regeneration remains a future maintenance step. See `scope-04-05-deployment.md` and `testflight-release.md` for deployment history.

The current production catalog still reserves future gameplay. Normal players are expected to have zero XP and locked gameplay cards until real eligible events exist. No backfill or fabricated demo awards are shipped. Full-series and game-specific milestone validators remain intentionally dormant. Pending rewards depend on retained source state: deleting a session before processing removes its pending queue rows; removing membership can invalidate an unprocessed event. Earned ledger entries remain intact when sessions are removed. Ledger aggregates and catalog evaluation should be profiled before very large production datasets; no denormalized balance cache, retention policy, reward revocation, XP spending, trading or duplicate-card inventory is introduced.

## Verification

Verified results from the 28 October re-audit:

- **238 unit/database/UI/native-mock tests passed** across 29 files, including the vice-owner regression added after the original rewards scope.
- TypeScript, ESLint and Prettier passed.
- Coverage: **97.19% lines, 95.47% statements, 92.5% branches, 93.19% functions** over the configured platform/server coverage set.
- Independent PostgreSQL reward concurrency check passed against all current migrations: one ledger award, one first-game bonus, one card and unique notification events under concurrent requests and worker replay.
- Hosted read-only checks verified catalogs, active workers, RLS and denial of privileged award/unlock RPCs to authenticated clients.
- Rewards browser tests re-run against the latest web export. An intermittent strict-mode selector matched hidden and visible copies of “Complete your first game”; it now explicitly targets visible text. **All 3 rewards browser E2E tests passed after this selector correction.**
- Existing full regression preceding this audit: 33 browser E2E tests passed; web/iOS exports passed. Those exports and tests do not prove physical-device rewards delivery.

Final results are also recorded in `WORK_LOG.md`. Coverage includes the new client/server reward services and change-detection code. SQL tests execute migrations, functions and RLS in PGlite. The concurrency script uses independent connections to a disposable loopback PostgreSQL instance, not the app's remote Supabase project. Browser E2E uses an intercepted fixture backend and is not deployed-backend proof. Native exports prove bundling, not installation or device animation/push delivery.

Tests cover levels, global/game/session totals, active/inactive/missing definitions, canonical reward replay, game overrides, state verification, reserved verifiers, cards/achievements, scopes, notification deduplication/preferences, ledger immutability and deletion behavior, pagination, concurrent requests, queue failures/retries, owned reads, forbidden writes, card navigation and reduced motion. Existing scopes are included in the regression suite.

Sources checked: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase changelog](https://supabase.com/changelog), [Expo Reanimated setup](https://docs.expo.dev/versions/latest/sdk/reanimated/).
