# Roam — multiplayer social games platform

Scopes 01–06 provide authentication and profiles, a reusable session engine, groups and invitations, scheduling and notifications, shared rewards, and Secret Santa setup and lobbies. Requirements are in [the master plan](multiplayer-social-games-platform-plan.md); implementation and deployment evidence are in [the work log](WORK_LOG.md).

Secret Santa is the first selectable game. Hosts can configure a standalone or group gift exchange, invite participants and manage its lobby. Scope 07 adds private matching and recipient reveal; optional activity gameplay remains reserved for later scopes. The Scope 07 backend migration is deployed, with hosted early/automatic draws and a disposable 13-user exchange verified. Scope 07 UI is present in source but is not included in the existing native release. The signed native release **0.1.0 (3)** was built and verified locally after the cloud request reached the monthly free iOS build quota. Submission `811ff809-d1f0-4c3a-8dc4-9a520d3ca3fb` finished. At 10:03 UTC on 29 October, Apple confirmed build 3 is `VALID` and `IN_BETA_TESTING` for internal testers. The last user-confirmed installed build is **0.1.0 (2)**, which predates these changes. TestFlight now offers **0.1.0 (3)**.

## Run locally

Use Node 22.13+ or a newer supported LTS, npm, and the committed lockfile.

```sh
npm ci
cp .env.example .env
# Fill in your project's public Supabase URL and publishable key.
npm start
```

Use `npm run ios`, `npm run android`, or `npm run web` for the respective targets. Native OAuth requires a development/standalone build with the `roam` URL scheme; Expo Go is not a substitute for validating OAuth redirects. Roam uses the registered iOS bundle identifier `com.moredata.roam`. The start and iOS commands target Roam’s development client.

Without environment configuration, the app shows a setup state and disables sign-in. It does not create a fake account. Never put a service-role key, OAuth client secret, or database password in an `EXPO_PUBLIC_` variable.

## Supabase setup

Roam uses hosted project `ywpmvqgtiawtkcqxeehf`. Migrations through `20261029102704_secret_santa_matching.sql`, including the optional group vice owner and private Secret Santa draw engine, are deployed. The follow-up migration dry run is up to date. Exposed tables use RLS and restricted grants; privileged operations run behind trusted server functions. The 29 October advisor run reports only the existing Auth leaked-password-protection warning. See [the Scope 07 report](docs/scope-07-review.md) and [the scheduling/rewards deployment report](docs/scope-04-05-deployment.md) for verification boundaries.

The Scope 01 migration creates:

- `profiles` with server timestamps, display-name validation, and one profile per auth user, including existing users.
- Owner-only SELECT/UPDATE RLS. Clients can update only `display_name`; insertion and deletion are managed server-side.
- Transactional `delete_own_account()` RPC. A private privileged implementation verifies the JWT's user and live session; it accepts no target user id and deletes the auth account, cascading to its profile and sessions. Anonymous calls are denied.

Review migrations before applying them to any additional environment. A Docker-backed local Supabase instance can be started using the Supabase CLI; Docker is not installed in the current environment. The database integration tests instead execute the migration in PGlite PostgreSQL with test-only auth schema fixtures. This validates SQL/RLS behavior but does not replace testing against hosted Supabase Auth and PostgREST.

Configure Apple and Google providers in the selected project's Auth settings. Keep their secrets in Supabase/provider settings, outside the app. Register the Supabase callback URL with each provider and allow the app's exact `roam://auth/callback` redirect in Supabase. For web development, also allow the actual origin plus `/auth/callback` (for example `http://localhost:8081/auth/callback`). Apple web OAuth uses a Services ID and requires maintenance of its provider secret. See [Supabase mobile linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google), and [Apple setup](https://supabase.com/docs/guides/auth/social-login/auth-apple).

Native iOS Apple sign-in uses Apple's credential sheet and Supabase ID-token verification with a secure nonce. Google and non-iOS Apple sign-in use browser-based PKCE. OAuth accepts only callbacks matching the expected origin/path, deduplicates callbacks, and restores persisted sessions. Native storage uses SecureStore (OS keychain/keystore), with Unicode-safe chunks and an atomic pointer update so large provider sessions stay below per-item keychain limits; web uses browser local storage, so protect any web deployment against XSS. Native token refresh follows application foreground/background state. No service-role credential is needed by this application.

Deletion removes the platform account. Provider-side token revocation and any future external resources must be addressed before production distribution; this foundation does not store provider refresh tokens. New user-owned tables must define their deletion behavior as they are introduced.

## Structure and scope boundary

- `app/`: Expo Router auth routes and Home, Games, Groups, Rewards, Profile tabs.
- `src/platform/`: Supabase client, schema types, authentication, profiles, games, sessions, groups, notifications and rewards.
- `src/games/secret-santa/`: typed registration, setup validation, lobby service and safe invitation return handling.
- `src/presentation/`: shared design tokens and accessible UI, platform screens and Secret Santa setup/lobby screens.
- `supabase/migrations/`: versioned schema and access controls.
- `tests/`: domain, service, session, screen, and PostgreSQL integration tests.
- `e2e/`: browser flow tests with mocked Supabase responses and a test-only stored session.

Games shows the registered catalog and My Games. The shared session engine owns sessions and participant membership; each game module supplies its own configuration and lifecycle operations. Trusted RPCs derive the actor from authentication, validate settings, lock capacity and transitions, and deduplicate creation with a request UUID and payload fingerprint. Unknown game types are not selectable. See [the Scope 02 review](docs/scope-02-review.md) for the generic engine.

Persistent groups support secure invitation preview/redemption and owner management. Owners may designate an existing member as an optional vice; the vice succeeds when the owner leaves or deletes their account. Without a vice, owners must transfer ownership or delete the group first. Groups with linked game sessions cannot be deleted. See [the Scope 03 review](docs/scope-03-review.md) and [next-release notes](docs/next-release-fixes.md).

Secret Santa has a dedicated atomic setup operation, private settings, secure session invitations and host controls. Group members must explicitly join each game; joining a game never joins its persistent group. Standalone Secret Santa requires a valid session invitation, rather than knowledge of its ID. Scope 07 adds secure single-cycle matching for 3–100 participants, confirmed host early draws, automatic draws after closure, private reveal and My Recipient with a timezone-aware countdown. Assignments are transactional, private and permanent. Matched account deletion preserves anonymous membership and assignment references, flags recovery, and never redraws. Optional activities remain unimplemented. Scope 07 is validated locally and deployed to hosted Supabase. Both host early draw and live minute-Cron automatic matching passed with the same 13 disposable accounts, which were deleted with all fixture data afterward. See [the Scope 07 review](docs/scope-07-review.md).

Home links to persisted notifications and notification preferences. The Rewards tab provides XP, levels, achievements, collectible cards and history. No completion events or rewards are fabricated for unfinished gameplay.

## Validation

```sh
npm run lint
npm run typecheck
npm run test:coverage
npx expo-doctor
npx expo export --platform ios --platform android --output-dir /tmp/roam-native
```

The configured coverage threshold is 80% across the measured platform/game/server modules. UI interactions and database migrations have additional tests. The 29 October release pass repeated all 262 tests across 33 files, all 36 fixture-based browser E2E checks, TypeScript, lint, formatting, Expo compatibility checks and web/iOS exports after compatible Expo patch updates. Hosted verification also confirmed automatic deadline closure through the existing minute Cron job, with one closure notification and one host-attention notification. A further successful Cron run preserved those counts, and all disposable verification rows were removed. These checks do not establish physical-device behavior.

Browser tests use only local fixtures, never real credentials:

```sh
npx playwright install chromium
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_fixture npx expo export --platform web --output-dir /tmp/roam-e2e-web
ROAM_TEST_EXPORT=/tmp/roam-e2e-web npm run test:e2e
```

The test server defaults to `/tmp/roam-scope01-web`; override it with `ROAM_TEST_EXPORT`. Do not deploy this fixture export. Build normally using the intended environment for a real installation.

## Remaining release checks

TestFlight 0.1.0 (2) is installed and the user confirmed native Apple sign-in. The Google provider credential was corrected server-side after an invalid-secret error; successful device sign-in after that repair remains unverified. A local signed build for 0.1.0 (3) succeeded after the cloud free-build quota rejected the request before a cloud job was created; the quota resets on 1 November and no paid plan was purchased. The first local attempt stopped before compilation because Apple's public WWDR G3 intermediate certificate was missing. After verifying and adding that certificate with default trust, the second attempt succeeded from the same snapshot. Signing credentials were not replaced or revoked. The IPA signature, version/build, production push and Apple sign-in entitlements, and hosted backend reference passed verification. Submission finished, and Apple confirmed 0.1.0 (3) is valid and available for internal beta testing on 29 October. Installing it and verifying features on a physical device remain pending. On that build, verify vice succession, native date/time controls, invitation links across authentication, copy/share, lobby management and real push receipt/deep-link behavior. Android physical-device FCM delivery is a separate check.

EAS, APNs and FCM credentials are configured, and the global scheduler/notification Cron jobs are deployed. Actual device push delivery remains unverified. Dependency advisories and native behavior must be assessed using the release-specific evidence; a successful source export is not an installed build.

## Scope 04 — Scheduling & Notifications

See [the Scope 04 implementation and setup report](docs/scope-04-review.md) and [hosted deployment evidence](docs/scope-04-05-deployment.md) for migrations, two global Cron jobs, the deployed notification dispatcher, APNs/FCM/EAS configuration and remaining device checks. Home links to Notifications and Notification settings.

## Scope 05 — Shared Rewards & Collectibles

The Rewards tab includes global/game XP, deterministic levels, achievements, locked/owned collectibles, card details and reward history. See [the Scope 05 completion report](docs/scope-05-review.md) for the migration, evidence validation, idempotency, worker/notification integration, verification and remaining setup. Game-specific verifiers are dormant; no completed events or gameplay rewards are fabricated.

## Scope 06 — Secret Santa setup and lobby

See [the Scope 06 completion report](docs/scope-06-review.md) for the file inventory, deployed migration, trusted setup/lobby operations, deadline enforcement, notification integration, validation and release status. Scope 07 matching and private reveal are now implemented; see [its completion and hosted verification report](docs/scope-07-review.md). Scope 08 and later gameplay have not begun.

## Scope 07.5 Phase 1 — local UI redesign

Welcome/sign-in, Home, Games Catalog and shared navigation now have the electric-blue/light and navy/dark foundation. iOS uses native tabs and supported native glass controls; web/Android retain accessible solid fallbacks. Approved standalone artwork is pending. This source requires a new native build and is not in TestFlight build 4. No backend/gameplay changes or later-phase redesign. See [implementation, files, screenshots and verification](docs/design/scope-07-5-phase1/README.md).
