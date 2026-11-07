# Scope 06 — Secret Santa setup and lobby

Implemented locally on 28 October 2026; the migration was deployed to hosted Roam on 29 October 2026 after user authorization. Automatic joining closure through the hosted Cron job is verified. Scope 07, matching, assignments, Mind Match gameplay, Secret Agent gameplay and Secret Missions are not implemented. The signed native release **0.1.0 (3)** was built and verified locally after the cloud free-build quota rejected the request. Submission `811ff809-d1f0-4c3a-8dc4-9a520d3ca3fb` finished. Apple confirmed build 3 is `VALID` and `IN_BETA_TESTING` at 10:03 UTC on 29 October.

## Inspection and plan

Reviewed the game registry, generic session creation/locking/RLS, persistent group membership and invitation implementation, existing scheduler and reward wrapper, notification templates/outbox/preferences, Expo Router account layout, UI primitives/design tokens and test fixtures. Reused these boundaries instead of adding another session, participant, notification queue or Cron system. Checked current Supabase RLS guidance and Expo SDK package compatibility.

Implemented module-owned settings and trusted lifecycle operations first, reusable session invitation storage and activity handler dispatch next, then typed client services and dedicated screens. Verified SQL permissions, atomicity, delayed workers, concurrency, UI flows and prior-scope regression.

## Files created

- `supabase/migrations/20261028182438_secret_santa_setup_lobby.sql`
- `src/games/secret-santa/types.ts`, `service.ts`, `currencies.json`, `pending-invitation.ts`
- `src/presentation/secret-santa/SantaScreens.tsx`, `DateField.tsx`, `DateField.native.tsx`
- `app/(account)/game/secret_santa/create.tsx`, `join.tsx`, `lobby/[sessionId].tsx`
- `tests/secret-santa-config.test.ts`, `secret-santa-service.test.ts`, `secret-santa-database.test.ts`, `secret-santa-screens.test.tsx`
- `e2e/secret-santa.spec.ts`
- `scripts/test-secret-santa-concurrency.mjs`
- `docs/artifacts/secret-santa-lobby.png` (test-only fixture screenshot), this report.
- `docs/releases/testflight-0.1.0-build3.md`, source manifest, IPA verification and Apple-status JSON evidence.

## Files modified

- `src/games/secret-santa/index.ts`, `config.ts`: playable catalog metadata (3–100), dedicated setup route and strict settings validation. Generic configuration remains an empty object; game-specific values live in their own settings record.
- `src/platform/database.types.ts`: typed module RPC contract.
- `src/platform/sessions/service.ts`: custom-experience modules use their dedicated setup screen rather than the generic creation form.
- `app/(account)/game/[gameId].tsx`: details, create and join entry points.
- `app/(account)/session/[sessionId].tsx`: owned Secret Santa notifications/session links open the dedicated lobby when the server returns Secret Santa settings. Legacy generic projections retain their generic screen.
- `src/presentation/groups/GroupScreens.tsx`: group gift-exchange discovery and creation; independent explicit joining. Generic creation form remains for modules without a dedicated flow.
- `src/presentation/games/MyGames.tsx`: remove obsolete coming-soon copy.
- `app/(account)/_layout.tsx`, `app/sign-in.tsx`, `app/auth/callback.tsx`: preserve only a validated, fixed invitation route across sign-in. No arbitrary return URL accepted.
- `package.json`, `package-lock.json`, `app.json`: SDK-compatible native date/time picker/config plugin, recommended Expo SDK 58 patch updates, and iOS build 3.
- `tsconfig.json`: exclude generated coverage/build/test reports to prevent a validation race.
- `tests/catalog.test.ts`, `registry.test.ts`, `game-screens.test.tsx`, `group-screens.test.tsx`: update catalog expectations and retain generic engine regressions.
- `e2e/games.spec.ts`, `button-audit.spec.ts`, `groups.spec.ts`, `fixtures/button-audit-backend.cjs`: playable setup expectations and new read-only group lobby fixture endpoint.
- `README.md`, `docs/next-release-fixes.md`, `docs/testflight-release.md`, `WORK_LOG.md`: current implementation, deployment, release status and validation.

## Migration and atomic creation

The single new migration activates the existing `secret_santa` catalog row, minimum 3 and initial maximum 100. Hosts may configure capacity from 3 to 100. It creates `secret_santa_settings` with dates, timezone, budget/currency, activity switches, capacity, phase and timestamps. Settings are readable only to session participants under RLS and are never writable through ordinary client table access.

Private tables: session invitation hashes/metadata, immutable creation-request fingerprints, recognized currency codes, and migration-controlled activity/notification eligibility handlers. Each has RLS with no ordinary-user table grants. These extend the shared platform boundaries; there is no second participant table or notification outbox.

The public `secret_santa_lobby` RPC is SECURITY INVOKER and calls an authenticated private module handler. The actor always comes from a live Supabase session. Creation takes a per-actor/request transaction advisory lock, validates settings, invokes generic transactional session creation, inserts settings, keeps the host membership, transitions draft to lobby, creates an invitation, schedules closure/reminder, and records safe notifications in one transaction. Failed settings writes roll back the generic session too. A matching request replay returns the existing lobby, while changed settings under the same key are rejected. Plain invitation codes are returned only on generation and are not stored; a lost creation response can be recovered through My Games, then the host can generate another invitation.

## Authorization and invitations

Only participants can see private lobby/settings/participants. Group members may discover a safe group-lobby summary and explicitly join it; group membership never enrolls them automatically. A session invitation to a group game does not bypass the separate group membership requirement. Joining standalone sessions requires a valid session invitation; knowing a session UUID is insufficient.

Invitations use two random UUIDv4 values (244 random bits), SHA-256 storage, safe preview, explicit confirmation, deadline-based expiry and host revocation. Preview omits host identity, participant identities, group data and private settings. Preview/redeem share Scope 03's persistent 20-attempt/five-minute per-account budget. Expected failures return values so the counter cannot be rolled back by a bad guess. Repeated joins are idempotent while joining is open. Capacity checks and membership inserts hold the session row lock.

Only the host may edit permitted settings, remove a non-host participant, create/revoke invitations, close joining early, extend an insufficient lobby or cancel. Membership and settings lock at closure or the actual deadline, even before a worker updates the phase. Generic public join/update/start/leave/cancel operations are intercepted by the module adapter so they cannot bypass these rules; the old privileged generic implementation is denied to ordinary callers. In particular, the generic start API cannot activate or draw a Secret Santa session.

## Lifecycle and deadline enforcement

Generic status stays `lobby` while module phases move from `joining_open` to `ready_for_draw` (3+ participants) or `insufficient_players` (<3), recording actual `joining_closed_at`. No active gameplay or draw transition is added. `joining_closed` is also a supported closed phase, used for cancellation; generic status becomes `cancelled` then.

All deadlines are timestamptz/UTC and server authorization uses `clock_timestamp()`. The exchange date remains a DATE plus a separately validated IANA timezone; it must be strictly later than the local calendar date of the deadline in that timezone. Device clocks affect presentation/early client checks only and cannot authorize a late join. Budget is optional, positive, bounded and limited to two decimal places; currency must be in the bundled recognized ISO-code catalog. It is not a payment.

A joining-close scheduled activity and, when there is enough lead time, a one-day closing reminder use the existing scheduled activity table. Registered private lifecycle handlers extend the existing bounded scheduler, retaining SKIP LOCKED, per-event subtransactions, exponential failure backoff and existing reward processing. The existing minute Cron/notification worker executes them without the app open. No new Cron job or Edge Function is required. Migration asserts its scheduler extension matches the installed base definition.

Closure is idempotent under host/worker retries; unique notification keys prevent repeats. Joining after the deadline is rejected regardless of worker delay. An insufficient lobby can reopen with a validated future deadline before the exchange date, without changing other locked settings, or be cancelled. Reopening schedules a new activity generation and requires fresh invitation codes when old codes have expired. Ready lobbies remain locked and cannot reopen in this scope.

## Notifications and UI

Registers all eight requested templates using existing game-update/reminder preferences, quiet hours and safe content. Participant joins notify the host in-app with push suppressed, avoiding one push per join. Creation and invitation generation also use in-app records without unnecessary self-push. Closing pushes one generic closure alert; readiness is additionally persisted in-app without a second immediate push. Insufficient-player alerts go to the host. Link-generated invitations have no known recipient until accepted, so no speculative recipient push is sent. Optional closing reminders use the existing reminder preference (disabled by default). A reusable migration-owned notification eligibility guard rechecks the closing reminder at queue claim and immediately before provider send, so quiet hours and retries cannot carry it past the deadline or send it to a removed participant. Overdue reminder activities are cancelled without emitting a stale alert.

UI includes Secret Santa details, standalone/group setup and selection, invitation preview/confirmation, lobby, invitation sharing/copy/revocation, edit form, participant management, early closure, extension and cancellation. Native date/time pickers and web date controls are provided. Server time anchors the visible countdown; the server remains authoritative. Exchange dates display as date-only strings with timezone, preserving their calendar meaning. Confirmation panels protect host destructive actions. Matching/activity availability is explained without offering gameplay buttons.

Invitation codes are transient host UI state and can be copied or shared through the native share sheet. `roam://game/secret_santa/join?code=...` is the supported installed-app link. A validated fixed destination survives the sign-in flow in memory; preview and confirmation still run afterward. HTTPS universal links and a public install landing page are not added.

## Validation

- 262 unit/database/UI/native-mock tests passed across 33 files.
- Coverage: 96.77% lines, 95.10% statements, 91.99% branches, 93.49% functions across the configured platform/game/server set.
- 36 browser E2E tests passed, including all prior button-audit/regression tests and three Secret Santa flows.
- TypeScript, ESLint and Prettier passed; Expo dependency compatibility check passed.
- Web, iOS and Android exports passed.
- Release verification on 29 October repeated all 262 tests across 33 files, all 36 browser E2E checks, TypeScript, ESLint, formatting, Expo compatibility checks and web/iOS exports after SDK-compatible Expo patch updates. The Android export result above remains the implementation-pass evidence.
- A disposable hosted lobby had joining deadline `2026-10-29T04:36:02.448652Z` and was closed automatically at `04:37:00.028421Z` by the existing successful `roam-activities` Cron run. Its closure activity completed at `04:37:00.038503Z`; phase became `insufficient_players`, with exactly one `secret_santa_joining_closed` and one `secret_santa_insufficient_players` notification. The successful 04:38:00Z Cron run preserved those counts. The scheduler was not manually invoked for this proof. The fixture account, session, activities and notifications were deleted, with zero remaining rows verified.
- Independent PostgreSQL transactions verified concurrent idempotent creation, capacity contention, duplicate closure and two simultaneous deadline workers. One lobby/settings/invitation is created, capacity holds, closure notification is emitted once, and no session starts/draw occurs.
- Existing real PostgreSQL reward concurrency regression passed against all migrations including this scope.
- SQL tests cover malformed dates/budget/currency/timezone, transactional rollback after generic creation, group/session membership independence, repeated joins, host-only controls, edit/remove/close/extend/cancel, delayed workers, sufficient/insufficient automatic closure, expiry/revocation, rate limits, RLS, low-level bypasses, request replay mismatch, and notification deduplication and quiet-hours-delayed reminder expiry. Client tests include timezone/DST calendar comparisons and safe invitation return routes.

Browser tests use intercepted fixtures; SQL tests use disposable local databases. Exports prove bundling, not physical-device installation, native picker behavior or push receipt delivery.

## Deployment and limitations

After the user authorized migration deployment and TestFlight release, `20261028182438_secret_santa_setup_lobby.sql` was applied successfully to Roam `ywpmvqgtiawtkcqxeehf` on 29 October. The follow-up migration dry run is up to date. Hosted advisors report only the existing `auth_leaked_password_protection` warning. No new Edge Function, Cron job or credential is required; this migration extends the existing scheduler/dispatcher boundaries.

The existing hosted Cron job automatically closed a disposable insufficient-player lobby and emitted each expected notification once, as recorded above. A further successful minute run verified deduplication. Fixture cleanup is complete and zero remaining verification rows were confirmed.

The new native date/time picker requires an updated build. Marketing version remains 0.1.0 and released build number is 3. The cloud build request was rejected before a job was created because the monthly free iOS quota was exhausted; it resets on 1 November. No paid plan was purchased. The first local build stopped before compilation because Apple's public WWDR G3 intermediate certificate was missing. Its downloaded certificate passed `security verify-cert` against Apple's root chain and was added to the login keychain with default trust; no signing credentials were replaced or revoked. The second local signed EAS/Xcode build succeeded from the same canonical source snapshot without app code changes. Verified the actual IPA signature, bundle/version/build, production push and Apple sign-in entitlements, beta eligibility and correct hosted backend. Submission finished, and Apple confirmed 0.1.0 (3) is valid and available for internal beta testing on 29 October. Physical-device installation and feature checks remain unverified. See [release evidence](releases/testflight-0.1.0-build3.md). The last user-confirmed installed build was 0.1.0 (2); update through TestFlight to install build 3.

Real-device date/time selection, native share/copy, invitation links across Apple/Google authentication, and actual notification receipt/deep-link behavior remain device checks. Session refresh is focus/manual rather than realtime presence. Currency recognition is a bundled snapshot and can be updated by a future migration. Existing host-account deletion cascade semantics are unchanged. There are no assignments, draw, eligibility overrides after closure, fabricated completions or XP, reward verifier activation, Secret Santa gameplay or Scope 07 work.
