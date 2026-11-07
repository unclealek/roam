# Scope 04 — Scheduling & Notifications

Implemented locally on 27 October 2026. Remote deployment, Cron activation and real iOS/Android push delivery remain unverified. Scope 05 and game-specific Secret Santa, Mind Match and Secret Agent rules were not implemented.

## Architecture and security

`game_sessions` and `game_session_members` remain the session authority; `groups` / `group_members` remain independent persistent membership models. Existing session/group RPCs and authorization are preserved. The repository was inspected before changes. It contained no existing notification outbox.

The scheduler runs in PostgreSQL using `now()` and `timestamptz` (UTC instants). Clients never authorize activities with their device clock. Available-activity SELECT policies require a current authenticated session, game membership, matching target (or broadcast), active game, unlock time reached, and unexpired deadline. Ordinary clients have no write privileges on activities. Completed activities remain readable to their authorized participants. Payloads accept only a registered `template_key`; private game answers, assignments and messages belong in separate game-owned tables.

Trusted game handlers instantiate `activityService` with a service-role RPC client **after validating their game-specific event and actor**. It exposes `scheduleActivity`, `createTriggeredActivity`, `completeActivity`, and `cancelActivity`. Client `getAvailableActivities` reads through RLS. There is deliberately no client endpoint accepting arbitrary “complete/unlock another user” commands. Event keys are unique per session and replayed input is checked; triggered events use database time and retain their first unlock timestamp. A broadcast activity has one shared completion state; use individually targeted activities for individual completion.

Unlock/expire/cancel processing is bounded (100 rows, hard ceiling 500), uses `FOR UPDATE SKIP LOCKED`, and creates notifications and outbox entries in the same transaction as availability. Per-activity subtransactions roll back failed transitions, record a generic SQLSTATE error, and retry with exponential backoff. Terminal game sessions cancel remaining activities. Locked rows do not stall other workers.

`user_notifications` always persists independently of push permission and preferences. A private template registry contains all eight requested templates and all six categories. It never interpolates private content. The expiring-activity template says “Your challenge is closing soon.” because configurable reminder lead times need not equal tomorrow. Routes are generated on the server. Push payloads contain a notification ID only; the client fetches that owned record and validates its route. Game/group screens still apply their existing authorization.

Delivery tables, device tokens, template registry, reminder policies and rate windows live in `private`. RLS is enabled on every new table; privileges on private data and privileged functions are explicitly revoked from ordinary users. Public worker and activity RPCs are executable only by `service_role`. The Edge Function accepts only a dedicated random worker secret, never ordinary user JWTs or the public key. Secrets are absent from mobile code.

## Files created

- `supabase/migrations/20261027090002_scheduling_notifications.sql`: activity schema, RLS, templates, account and worker RPCs, scheduler, reminders, preferences, token lifecycle, outbox, deliveries and rate windows. The CLI generated the migration; its timestamp was ordered after Scope 03 migrations already dated later than the machine clock.
- `supabase/setup/scope04-cron.sql`: two global one-minute jobs, independent of player/activity counts.
- `supabase/functions/notification-dispatcher/index.ts`: trusted HTTP entrypoint.
- `supabase/functions/notification-dispatcher/dispatcher.ts`: Expo requests and asynchronous receipt polling.
- `supabase/functions/notification-dispatcher/activities.ts`: typed internal game-module API.
- `src/platform/activities/{types,service}.ts`: activity contract and server-authorized reads.
- `src/platform/notifications/{types,routes,service,device,device.native}.ts` and `NotificationBridge.tsx`: preferences/notification APIs, route allowlist, native permission/token management, foreground presentation, cold/background tap responses, refresh and app-resume registration. Web uses in-app notifications without native push APIs.
- `src/presentation/notifications/NotificationScreens.tsx` and `app/(account)/{notifications,notification-settings}.tsx`: authenticated center and settings.
- `app.config.ts`: optional Android Firebase configuration via an EAS file variable.
- `tests/notification-{device,dispatcher,services,screens}.test.*`, `tests/notifications-database.test.ts`, `e2e/notifications.spec.ts`, `scripts/test-notification-concurrency.mjs`.
- This report.

## Files modified

`app/_layout.tsx` mounts the notification response bridge; `app/(tabs)/index.tsx` links to notifications with an unread count; `app/(tabs)/profile.tsx` deactivates the current device before sign-out. `src/platform/database.types.ts` adds client schema contracts. `app.json` adds the notifications plugin and Android package `com.moredata.roam`. `package.json` / lockfile add SDK-compatible `expo-notifications` 58.1.6 and `expo-device`, update `expo-crypto` to its SDK-compatible patch, and update the vulnerable transitive `node-forge` patch. `supabase/config.toml` configures the authenticated worker handler. `tsconfig.json` excludes Deno function sources from the app compiler (Deno checks them separately). `vitest.config.mts` expands coverage to new platform services and dispatcher. `.env.example` / `.gitignore` describe and exclude native credential files. The existing group concurrency script creates a service-role fixture so it can load all migrations. `README.md` and `WORK_LOG.md` link this scope.

## Backend deployment and Cron setup

No remote commands below have been executed. Select and verify the intended Roam project first; do not reuse another application's project. Review the migration and setup SQL before deployment.

1. Apply migrations to that project's staging database using your existing reviewed migration workflow. Regenerate database types against that selected backend afterward. The checked-in types are a local contract.
2. Generate a high-entropy random `NOTIFICATION_WORKER_SECRET`. Set it as a Supabase Edge Function secret. It must never be `EXPO_PUBLIC_*`. Optionally set `EXPO_ACCESS_TOKEN` if enhanced Expo Push Security is enabled; enable it for production and configure the matching Expo token. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are server runtime variables.
3. Deploy `notification-dispatcher` using `supabase functions deploy notification-dispatcher --project-ref <ROAM_REF>`. Its `verify_jwt=false` is intentional: the handler verifies the dedicated secret itself. Requests without the exact secret get 401; non-POST gets 405.
4. Enable Supabase Cron, pg_net and Vault. In Vault store `project_url` (the selected project's HTTPS URL) and `notification_worker_secret` (the same random secret).
5. Run `supabase/setup/scope04-cron.sql`. Named jobs are `roam-activities` and `roam-notifications`, both `* * * * *`. The first runs the database scheduler; the second invokes the dispatcher using Vault credentials. Re-running `cron.schedule` with the same name updates that job. Do not create per-player jobs.
6. Confirm actual job runs in `cron.job_run_details`, inspect `net` HTTP responses, and check `notification_worker('tick')` results. Scheduler errors are retried and stored on activities; monitor `processing_attempts`, `next_attempt_at`, `last_error` and the returned error count.
7. Register reminder policies per game type only when that game supports them. Example, in a trusted migration: `insert into private.reminder_policies(game_type_id,enabled,lead_time,stage) values('<registered_game>',true,interval '1 day','deadline');`. No production game reminder policy is enabled by this scope.

## Delivery semantics

The dispatcher claims a bounded batch of 10 device deliveries, sends at concurrency 5, and uses 10-second provider request timeouts. Database leases use random fencing IDs and two-minute validity. Receipt polling is separately leased and runs in subsequent invocations, initially 15 minutes after acceptance and then every five minutes. Missing receipts become unknown after 24 hours. Receipt success means FCM/APNs accepted the push, **not proof a device displayed or received it**.

Explicit `MessageRateExceeded`, HTTP 429 and HTTP 503 rejection responses retry with exponential backoff, up to six attempts. Invalid tokens are deactivated. Receipt token snapshots prevent a stale response from invalidating a replacement token. Token registration supports multiple installations, replaces an installation's previous token, and records its auth-session association. Tokens associated with deleted auth sessions are removed by FK cascade; explicit sign-out deactivates the installation first.

Expo does not provide exactly-once sends or an idempotency key API. A lost/ambiguous network response or expired in-flight send becomes `unknown` and is **not automatically resent**. This avoids a blind duplicate but can miss an alert; inspect these records manually. Explicit provider rejection is retried. An expired claim that never began sending is safely reclaimable. A retry rechecks permission preferences, device state, activity/session membership, deadline and completion before sending. Notification processing does not block or roll back gameplay.

Initial push events are limited to one logical alert per user per minute; one alert may reach all that user's active devices. Optional reminders are limited to one logical reminder per local calendar day across devices, deduplicated by activity/stage, checked against game policy, preferences, preferred local reminder time, quiet hours and deadline. Preferences use IANA timezones in PostgreSQL, including DST. Equal quiet-hour endpoints silence push all day. Missed preferred times send at the next eligible minute before the deadline; an impossible preferred-time/quiet-hours combination stays deferred until expiry. Preference changes are checked again immediately before sending. Activity pushes also carry the activity deadline as provider expiration. A push already handed to Expo cannot be recalled if completion or a preference change arrives afterward.

## Native iOS / Android configuration

1. The existing EAS project ID is retained. Use your authorized Expo/Apple/Firebase accounts. Do not commit private keys or service account JSON.
2. iOS: confirm the app identifier `com.moredata.roam` and Push Notifications capability. Run `eas credentials --platform ios` and configure an APNs authentication key under the Roam EAS project. Build a new development client after adding `expo-notifications`; an older installed development build cannot load the new native module.
3. Android: register `com.moredata.roam` in Firebase, download that app's `google-services.json`, and supply it with the EAS **file** variable `GOOGLE_SERVICES_JSON` in the development build environment (or a local absolute path). `app.config.ts` uses it as `android.googleServicesFile`. Upload the Firebase service account for **FCM v1** to the Roam project's EAS credentials (`eas credentials --platform android`). The service account is server-side delivery authentication, distinct from the app's Firebase configuration file.
4. Build with `eas build --profile development --platform ios` and `eas build --profile development --platform android`. This scope does not submit to stores or change app versions.
5. On a push-capable iOS and Android development build, sign in, open Home → Notifications → Notification settings, enable push, grant OS permission, and save. Denial cannot be overridden by the toggle. Optional reminders and reward pushes start disabled; quiet hours default to 22:00–08:00. Select a valid IANA timezone explicitly (initial default UTC).
6. Use a trusted staging fixture session/activity to verify foreground, background and terminated-app behavior; cold notification taps; ownership checks; two devices; token replacement; logout; revoked OS permission; deadlines; and completion before reminder. Keep secret content out of fixtures/payloads.

## Verification

- TypeScript app check and Deno Edge Function check passed.
- ESLint and Prettier checks passed. Native config introspection includes the development APNs entitlement; Android notification permission is declared by the installed native library.
- Unit/database/native-mock suite: **190 tests passed** at report creation; coverage includes new platform/dispatcher code, with **96.83% lines, 95.03% statements, 91.57% branches, 92.06% functions** overall. PGlite tests execute SQL migrations and RLS, not text pattern assertions.
- Browser E2E: **11 tests passed**, including existing authentication, game and group flows plus notification unread/read state, preferences, and protected deep links. Browser tests use an intercepted fixture backend; they are not deployed-backend proof.
- Real embedded PostgreSQL, independent connections: concurrent event creation returns one ID; concurrent activity workers skip locked rows and emit one notification; delivery claims and begin-send are exclusive. Existing one-use group invite race also passed against all migrations.
- Expo web, iOS and Android exports passed. Exports prove bundling, not installation, native credentials or device delivery. `expo install --check` and audit are recorded in final checks.
- Tests cover future/due/expired activities, locked reads, event idempotency, failure rollback/backoff, broadcast/targets, preferences, ownership, pagination, IANA zones, DST folds/gaps, quiet/preferred times, reminder limits/completion races, multiple devices, invalid tokens, provider retries/receipts, lease fencing, ambiguous sends, route validation, permission requests, Android channels and response listeners.

## Remaining verification / limitations

The migration and Edge Function are local; neither scheduled backend processing nor real push delivery has been demonstrated in a deployed project. Cron/Vault/pg_net configuration must be activated and observed in staging. APNs and FCM credentials were not provisioned or changed, and no new development clients were built or installed during this scope. The HTTP entrypoint has been Deno-typechecked; real deployed-secret authentication still requires staging verification. Native notification behavior was tested through mocks and bundle export, not physical devices. No claim of confirmed device delivery is made.

Delivery throughput is deliberately conservative and must be capacity-tested for production. Private delivery rows need a production retention/monitoring policy. Reminder policies are disabled until game modules register them. No game-specific events or completion rules are implemented. Do not mark all Scope 04 acceptance criteria verified until the deployment and device checks above pass.

## Documentation checked

- [Expo SDK notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Expo push tickets, receipts and retries](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Scheduled Edge Functions and Vault](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase changelog](https://supabase.com/changelog) and the upcoming TLS cipher change (no scheduler-specific breaking change identified).
