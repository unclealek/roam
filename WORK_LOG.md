# Multiplayer Social Games Platform — Work Log

Created: 26 October 2026

## Purpose

Track implementation progress, decisions, validation evidence, and outstanding work for this project.

The requirements and scope acceptance criteria are defined in [the master implementation plan](multiplayer-social-games-platform-plan.md).

## Current status

- Master plan saved in the workspace.
- Scopes 01–06 are implemented; matching and later gameplay have not begun.
- Supabase migrations through Scope 06 are deployed to `ywpmvqgtiawtkcqxeehf`; the latest migration dry run is up to date. Advisors report only the existing Auth leaked-password-protection warning.
- TestFlight 0.1.0 (2) is installed; the user confirmed native Apple sign-in. Google credentials were repaired server-side, with the device retry still unverified.
- Hosted Scope 06 automatic closure is verified through the existing Cron job. The signed 0.1.0 (3) IPA was built and verified locally after the free cloud-build quota rejected the request. Submission finished, and Apple confirmed 0.1.0 (3) is valid and available for internal beta testing on 29 October. Physical-device installation and new-feature validation remain unverified.

## Scope tracker

| Scope | Work                          | Status                                                                            |
| ----- | ----------------------------- | --------------------------------------------------------------------------------- |
| 01    | Platform foundation           | Implemented and deployed; broader device checks remain                            |
| 02    | Game catalog & session engine | Implemented and deployed                                                          |
| 03    | Groups & invitations          | Implemented and deployed; vice-owner UI in TestFlight 0.1.0 (3)                   |
| 04    | Scheduling & notifications    | Deployed with Cron, worker and credentials; real push delivery unverified         |
| 05    | Shared rewards & collectibles | Implemented and deployed; game-specific rewards remain dormant                    |
| 06    | Secret Santa game setup       | Deployed; hosted Cron closure verified; released in internal TestFlight 0.1.0 (3) |
| 07    | Secret Santa matching         | Not started                                                                       |
| 08    | Mind Match                    | Not started                                                                       |
| 09    | Discover the Secret Agent     | Not started                                                                       |
| 10    | Secret missions & messages    | Not started                                                                       |
| 11    | Game experience & finale      | Not started                                                                       |
| 12    | Security, testing & release   | Not started                                                                       |

## Working process

1. Inspect the repository and current migrations before each scope.
2. Identify existing functionality that can be reused.
3. Present a short implementation plan.
4. Implement only the requested scope.
5. Record changes, validation results, unresolved issues, and acceptance status here.

Mark a scope complete only when its acceptance criteria have been verified. Record local implementation, backend deployment, distribution, and device verification separately.

## Decisions

- Use a modular platform/presentation structure and Expo Router.
- Use Roam as a working app name with a game-neutral blue/indigo design system.
- Use native iOS Apple ID-token sign-in with nonce verification; Google and non-iOS Apple use browser-based PKCE. Native sessions use secure storage.
- Profiles are private to their owner; clients can update only display names.
- Account deletion is a transactional self-only RPC, with privilege elevation isolated in a private schema and a live-session check.
- Games contains the registered catalog and My Games. Groups and Rewards are implemented; Secret Santa setup/lobbies are selectable.
- Scope 02 uses a static typed client registry and a matching trusted database schema/operation registry.
- Draft sessions are private. Secret Santa uses dedicated setup, independently authorized group joining and secure standalone session invitations; only participants see private lobby details. Other modules retain the generic engine.
- Session writes use trusted RPCs, live-session checks, row locks, configuration validation, and idempotent creation request IDs. Host deletion cascades to hosted sessions; participant deletion removes memberships.

## Blockers and open questions

- The authorized Supabase CLI targets Roam `ywpmvqgtiawtkcqxeehf`; migrations through Scope 06 are deployed and the migration dry run is up to date. Public data access uses RLS and restricted grants. The management connector previously lacked permission for this project.
- Hosted advisors report only the existing Auth leaked-password-protection warning. Local independent PostgreSQL concurrency checks pass; hosted Scope 06 closure through the existing Cron job and deduplication on its next run are verified. Fixture cleanup is complete, with zero remaining verification rows.
- The user confirmed native Apple sign-in in TestFlight 0.1.0 (2). Google credentials were repaired; successful device retry remains unverified. Broader native callback, persistence, deletion and new Scope 06 flows still need device checks.
- Provider-side token revocation must be addressed before production distribution.
- Earlier dependency checks reported upstream Expo CLI/node-forge advisories; consult fresh release evidence before relying on that historical count. Compatible Expo patch updates passed the 29 October test and export checks; no forced SDK downgrade was applied.

## Activity

### 26 October 2026 — Project preparation

- Saved the supplied master implementation plan as `multiplayer-social-games-platform-plan.md`.
- Created this work log for the upcoming implementation.
- Validation: confirmed the saved master plan matches the supplied attachment exactly.
- Implementation, migrations, deployments, and release validation remain pending.

### 26 October 2026 — Scope 01 implementation

- Requested scope: reusable app shell and account system only.
- Repository inspection: only the master plan and work log existed; no app, migrations, or working functionality was replaced.
- Changes: Expo SDK 58 / React Native / TypeScript foundation, Expo Router, five shared tabs, Apple/Google PKCE sign-in, persistent sessions with bounded Unicode-safe keychain chunks, lifecycle-aware token refresh, profile editing, confirmed account deletion, and shared loading/empty/error UI.
- Database: versioned profiles migration with auth-user creation/backfill, server timestamps, owner-only RLS, column grants, and transactional deletion with live-session verification. No remote database was changed.
- Tests: 55 passing unit, service, session lifecycle, component, and PostgreSQL integration tests. The PostgreSQL tests run the actual migration against PGlite with a test-only auth schema and roles.
- Coverage: above the enforced 80% thresholds for statements, branches, functions, and lines across auth/profile modules. Screen interactions and database behavior are tested separately.
- Browser evidence: two passing Playwright tests using local mocked backend responses. Covers signed-out route protection, stored-session restoration, tab navigation, profile editing, confirmation, and deletion followed by sign-out. These fixtures do not prove real OAuth or hosted API behavior.
- Checks: ESLint and TypeScript pass; Expo Doctor passes 20/20 checks; web, iOS, and Android Metro exports succeed. Exports are bundle validation, not native builds or device proof.
- Visual review: inspected a mobile-viewport Home screenshot and increased tab bar spacing to prevent label clipping.
- Security review: no client service-role secret; PKCE callback matching; stale async profile results ignored; cross-user/anonymous database access denied in tests. Deletion requires a live caller-owned session and cascades profile/session removal.
- Deployment/release: none. No Git commit, push, backend deployment, EAS build, or submission performed.
- Acceptance: locally demonstrated with tests and browser fixtures; live sign-in, native session persistence, and production-backend behavior remain unverified.
- Next step: user review of Scope 01. Do not begin Scope 02 without a new instruction.

### 26 October 2026 — Scope 02 implementation

- Request preserved in `scope-02-game-catalog-session-engine.md`; detailed file list and review notes in `docs/scope-02-review.md`.
- Inspection: reused Scope 01 auth, navigation, tokens, shared UI, and PostgreSQL fixtures. No app rebuild or dependency changes.
- Changes: typed game registry, strict configuration schemas/validators, Secret Santa coming-soon catalog/details, My Games, protected generic session details, and role-aware controls. No production create-session action is enabled.
- Database: `20261026185245_game_catalog_session_engine.sql` adds game types, sessions, and memberships; FKs/indexes/unique constraints; owner/member RLS; trusted CRUD/join/leave/lobby/start/cancel RPCs; configuration and lifecycle enforcement; per-host creation idempotency.
- Extensibility: developer-only second module runs through unchanged registry/services and the same isolated PostgreSQL engine. It is absent from app code and production seed data.
- Validation: 114 passing tests across 13 files and six passing fixture-based browser flows. Tests cover the entire transition matrix, server validation, duplicate membership, capacity, host/member permissions, visibility, retries, UI states, and Scope 01 regressions. Coverage remains above 80% in all enforced metrics.
- Checks: lint and TypeScript pass without warnings; web/iOS/Android Metro exports pass. Mobile catalog screenshot visually reviewed.
- Boundaries: PGlite executes both migrations with test auth roles; browser tests mock backend responses. No real OAuth, hosted API, advisor, independent-connection concurrency, or device proof is claimed.
- Release/deployment: none. Existing upstream dependency advisories remain; no commit, push, migration deployment, or EAS action performed.
- Outstanding: configure the intended Supabase/providers, review/apply migrations, run hosted API/advisors/concurrency checks, and verify native navigation and accounts on devices. Review the open-lobby and host-deletion policies before rollout.
- Scope exclusions: no groups/invitations, rewards, scheduler, matching, Mind Match, missions, or Secret Santa gameplay.
- Next step: review Scope 02. Do not begin Scope 03 without a new instruction.

### 26 October 2026 — Supabase connection configuration

- Added the supplied project URL and publishable key to the Git-ignored `.env` (permissions 600). No JWT secret was stored in application files.
- Read-only live verification: Auth settings returned HTTP 200; Apple and Google providers are disabled. Profiles, game types, sessions, and membership endpoints each returned HTTP 404/PGRST205.
- Management connector calls for this project returned permission denied. No remote migrations, provider changes, or secret rotations were performed.
- The shared legacy JWT secret should be rotated/revoked using Supabase's signing-key workflow; never place it in the mobile bundle.
- Remaining: grant the connector access to this project, apply/review the prepared migrations, configure Apple/Google providers and native redirects, and verify real device sign-in.

### 26 October 2026 — Live Roam setup and native launch

- Confirmed CLI access to project `ywpmvqgtiawtkcqxeehf` (Roam, ACTIVE_HEALTHY) despite the connector's project-access restriction. The public/private app schema was empty before deployment.
- A dry run listed only the two tested Scope 01–02 migrations; both were then applied successfully. Verified migration history, all four tables with RLS enabled, Secret Santa still Coming soon, and zero exposed app RPCs marked SECURITY DEFINER.
- Baseline advisors flagged the pre-existing `public.rls_auto_enable()` event-trigger helper as executable by client roles. Added and applied `20261026194636_restrict_rls_maintenance_function.sql`, revoking only client execute permissions. Its event-trigger behavior is preserved.
- Security/performance advisors after deployment: no warnings or errors. The hardening regression test passes both with and without the helper, and confirms automatic RLS still works. Lint and TypeScript pass.
- Native preview: booted iPhone 18 Pro, installed Expo Go SDK 58, launched Roam through Metro on port 8082, and inspected a native screenshot. The sign-in screen renders; an iOS Apple Account Verification system dialog covers part of it. This is not proof of successful Roam OAuth or a standalone/development build.
- OAuth remains incomplete: Apple and Google are disabled and need provider credentials plus native callback configuration. No provider secret, user password, service-role key, or shared JWT secret was stored or used. Signing-key rotation/revocation is still pending.
- No real user accounts, groups, sessions, or gameplay data were created. Scope 03 has not started.

### 26 October 2026 — Sign-in connection diagnosis

- Live checks supersede the earlier provider status: Supabase Auth responds successfully and both providers are enabled. Apple authorization returns `Unsupported provider: missing OAuth secret`; its OAuth client secret is still missing.
- Google authorization redirects to the real Google login page with the Roam Supabase callback. This verifies initial connectivity only; successful account login and callback completion remain unverified.
- The native preview runs in Expo Go. This OAuth flow requires an installed Roam development build with a registered native scheme; native application identifiers and build setup remain outstanding.
- Replaced the misleading blanket connection error with safe, actionable messages. Expo Go now shows the development-build requirement and disables unsupported sign-in attempts; installed builds retain OAuth access. Raw server responses are not exposed.
- Validation: 118 tests passed, lint passed, TypeScript passed. No provider settings or secrets changed, and no successful real-user login is claimed.

## Entry template

Use the following structure for future implementation entries:

### Date — Scope and outcome

- Requested scope:
- Changes:
- Decisions and reasons:
- Validation performed and results:
- Acceptance criteria verified:
- Outstanding issues or blockers:
- Deployment and release status:
- Next step:

### 26 October 2026 — Native Apple sign-in

- User confirmed Apple registration after selecting `com.roam.mobile`. Configured this iOS bundle identifier, `usesAppleSignIn`, and the Expo Apple authentication plugin.
- iOS Apple sign-in now uses the native Apple button and credential sheet, then Supabase `signInWithIdToken`. A fresh secure nonce is hashed for Apple and supplied unmodified to Supabase. Cancellation is harmless; missing tokens, unavailable devices, and verification failures have safe messages. Only email scope is requested; existing profile editing remains the source for display names.
- iOS Apple bypasses the browser OAuth flow and its missing-client-secret failure. Google and non-iOS OAuth behavior are preserved. Expo Go support for native Apple does not establish the registered app audience; acceptance must use a signed Roam build with the matching client ID.
- Validation: 124 tests passed; lint passed; TypeScript passed; Expo public config resolves the iOS identifier and plugin; iOS JavaScript export passed. This is not an IPA build or a successful device login.
- Dependency audit: four high-severity advisories in the Expo CLI / code-signing / node-forge dependency chain. No forced breaking dependency update applied.
- Pending: signed Roam build and real-device login, hosted Apple Client IDs verification (`com.roam.mobile`), and Google callback acceptance. No hosted auth settings or secrets changed.

### 26 October 2026 — Expo Go Apple verification diagnosis

- User confirms Supabase includes `com.roam.mobile`, and the failed attempt was inside Expo Go. Expo Go has a different native Apple identity from an installed Roam binary; setting the Expo project bundle ID does not change the host app identity. Exact rejected token audience was not inspected.
- Corrected the previous misleading Client IDs fallback. Expo Go attempts now explain the signed Roam build requirement before requesting Apple credentials. Installed-build errors distinguish audience and nonce failures without exposing tokens or raw server responses.
- No changes to hosted Apple Client IDs, and no Expo-wide audience added. A signed Roam installation and successful real login remain pending.

### 26 October 2026 — App icon and first device-build preparation

- Added the supplied Roam blue mascot logo unchanged as `assets/icon.png`; verified square 1254 × 1254 opaque PNG and wired the Expo app icon.
- Installed SDK-compatible `expo-dev-client` and added development/device and development/simulator EAS profiles. Kept the native Apple identity `com.roam.mobile`; introspected configuration confirms the `Default` Apple sign-in entitlement.
- Created and linked Expo project `@alekille/roam-social-games` (`65b2d707-2654-4a12-b609-2fee9c9a0a07`) and configured its development environment with the public Supabase URL and publishable key only. No private Supabase signing secret uploaded.
- Validation: 127 tests passed, lint passed, TypeScript passed; resolved icon, identifier, and Apple entitlement verified.
- First non-interactive device build stopped because no matching remote signing credentials exist. Interactive setup is waiting for the user's response to Apple's standard/exempt encryption declaration. Automatic approval review rejected answering this declaration on the user's behalf; confirmation requested. Signing setup and test-device registration are still pending.
- No build uploaded/compiled, no IPA produced, no installed Roam or successful real-user login verified. Setup instructions recorded in `docs/ios-development-build.md`.

- User explicitly confirmed answering Yes to Apple’s standard/exempt encryption question; the answer was applied. Signing setup now asks to log in to the Apple Developer account. Automatic approval review rejected initiating account login without explicit authorization; user authorization requested. No password or verification code requested in chat.

### 26 October 2026 — Apple account authenticated; bundle ownership blocker

- User authorized Apple login and selected the Kelvin Aliche provider. Authentication succeeded using the local Keychain; no credentials were copied into chat or source.
- Apple Developer team resolved as Kelvin Aliche (Individual), `3Y42VMC42F`; App Store Connect provider selected was Kelvin Aliche (`129558423`).
- Apple rejected registration/linking of `com.roam.mobile`: the bundle identifier is not available to this developer team. Build command exited before upload/compilation. This does not identify the owning team, and the app identifier has not been changed.
- Requested the exact registered Roam App ID and selected Developer Team ID to resolve the mismatch without inventing a replacement identity. User-confirmed encryption exemption is now persisted as `ITSAppUsesNonExemptEncryption: false`.

### 26 October 2026 — Corrected registered bundle identifier

- User supplied the actual Apple identifier `com.moredata.roam`. Updated app config, safe auth messages, and development-build instructions accordingly. Apple accepted the identifier under team `3Y42VMC42F`; capabilities synchronized without changes. Reused the existing valid team distribution certificate without revoking or replacing it.
- Validation: 127 tests passed; lint and TypeScript passed. Supabase must include the corrected client ID; hosted configuration has not been changed.
- Internal distribution requires test-device registration. Automatic approval review required specific consent, which the user supplied for their own iPhone. Proceeding to the registration link; no IPA has yet been compiled.

### 26 October 2026 — Registered iPhone and submitted development build

- Confirmed the user's iPhone registered through the Expo device link and selected that device for internal distribution.
- Apple created an active ad hoc profile for `com.moredata.roam` on team `3Y42VMC42F`; the existing distribution certificate was reused unchanged.
- Uploaded the project and submitted EAS development build `fbc12ee5-bf5d-43e1-a0e9-689d1a8f1e9d`: https://expo.dev/accounts/alekille/projects/roam-social-games/builds/fbc12ee5-bf5d-43e1-a0e9-689d1a8f1e9d
- Build completion, installation, and real Apple login are not yet verified. This is an internal development build, not a TestFlight submission.

- EAS build `fbc12ee5-bf5d-43e1-a0e9-689d1a8f1e9d` finished successfully: iOS development build 0.1.0 (1), bundle `com.moredata.roam`, installable IPA available. Registered-iPhone installation and real login remain unverified. Development Metro server running on port 8083 (session 81504). No TestFlight submission performed.

### 27 October 2026 — Replace Expo Go with native Roam simulator client

- User explicitly requested using Roam’s own simulator build instead of Expo Go.
- Updated default start and iOS scripts to use `--dev-client`; clarified the registered bundle ID in README.
- Validation: 127 tests passed, lint passed, TypeScript passed.
- Submitted iOS simulator build `730f9b66-dabb-4f77-a9cb-e11f154be227` with `development-simulator`, bundle `com.moredata.roam`, user-supplied app icon, and public Supabase development settings. No physical-device build or TestFlight submission is implied.
- Pending build completion, installation on iPhone 18 Pro simulator, and native screen verification. Development server remains available on port 8083.

- Simulator build `730f9b66-dabb-4f77-a9cb-e11f154be227` finished successfully. Downloaded through authenticated EAS CLI and installed on iPhone 18 Pro simulator as `com.moredata.roam`; stopped Expo Go and launched Roam’s development client against Metro port 8083.
- Verified through Device Hub UI: Roam’s own mascot icon and development launcher; accepted Open in Roam, dismissed first-run developer help, and inspected the live sign-in screen. Apple and Google buttons are enabled and no Expo Go requirement is shown. Sign-in itself was not completed during this replacement task.
- Simulator UI on this Xcode version is provided by Device Hub (`com.apple.dt.Devices`), not a standalone Simulator.app. Use Device Hub for subsequent simulator interactions.

### 27 October 2026 — Scope 03: Groups & Invitations

- Implemented persistent private groups, validated creation, My Groups, explicit invitation preview/confirmation, member/owner views, settings, transfer/removal/leave/deletion, and native code sharing/copy support using the existing design system.
- Prepared `20261027090000_groups_invitations.sql` locally: member-only RLS, server-generated hashed codes, expiry/revocation/usage limits, persistent per-user throttling, transactional management/redemption, and optional group sessions. Hosted project `ywpmvqgtiawtkcqxeehf` was not changed.
- Session membership stays independent: joining/leaving/removal does not enroll or remove players. Existing session participants retain access under their game rules. Group deletion is blocked when sessions exist. Account deletion clearly requires owners to transfer/delete groups first.
- Validation: 160 tests passed; lint, TypeScript, formatting, web/iOS/Android Metro exports passed. Configured platform coverage: 97.28% lines and 93.62% branches. All nine mocked-HTTP browser flows passed, including original auth/catalog/session regressions.
- Independently verified concurrent redemption with two real PostgreSQL 17 connections in a disposable loopback cluster: both contended at the group lock, exactly one redeemed the one-use code, use count remained 1, and exactly one membership was added. Temporary server stopped after test.
- Added `expo-clipboard`; native copying requires rebuilding the development client. Deferred module loading protects older clients, where native sharing remains available. No new native build or physical-device verification performed.
- Full created/modified file inventory, security decisions, validation commands, and pending hosted/native checks are in `docs/scope-03-review.md`. Scope 04 not started.

### 27 October 2026 — Scope 03 hosted migration applied

- User explicitly requested migration application. Verified the authenticated CLI targets healthy Roam project `ywpmvqgtiawtkcqxeehf`; the Supabase connector lacks access to this project.
- Confirmed the three prior migrations and existing group-null constraint, then applied only `20261027090000_groups_invitations.sql` using `--skip-vault`, without seed/role updates.
- Verified all seven app tables have RLS, unique group memberships, group session FK with deletion restricted, denied direct client writes/invitation enumeration, and authenticated-only group RPC grants.
- Resolved five security-advisor warnings in a follow-up `20261027090001_group_rpc_private_implementations.sql`, moving privileged bodies into private behind unchanged public invoker wrappers. The focused group/session tests passed (32 tests).
- Final security/performance advisors returned no issues. A final dry run reported the remote database is up to date with no migrations pending. No native build, device flow, or Git push is implied.

## Scope 04 — Scheduling & Notifications (2026-10-27)

Implemented server-authoritative activity scheduling, private push outbox/delivery pipeline, typed trusted game API, templates, reminder policies, preference management, device lifecycle, notification center and safe notification links. See [completion report](docs/scope-04-review.md). Remote deployment, Cron activation, APNs/FCM credential setup and actual device push remain pending. Scope 05 is excluded.

Scope 04 verification: 190 unit/database/native-mock tests passed; configured coverage 96.83% lines / 95.03% statements / 91.57% branches / 92.06% functions. All 11 browser E2E tests passed, including prior scopes. Independent PostgreSQL scheduler/delivery race checks and the existing group invite race passed. App typecheck, Deno check, ESLint, formatting, Expo dependency compatibility and dependency audit passed (zero vulnerabilities). Web/iOS/Android exports passed; APNs entitlement confirmed through native config introspection. Real deployment/Cron/device proof remains pending.

## Scope 05 — Shared Rewards & Collectibles (2026-10-27)

Implemented the configurable XP ledger and levels, server-verified reward service, collectible and achievement eligibility, durable completion/participation event processing through the existing Scope 04 worker, reward notification deduplication, Rewards tab, card details, and reduced-motion-aware Reanimated notices. See [completion report](docs/scope-05-review.md) for the full file list, migration, calculations and proof boundaries. Game-specific cards/definitions remain dormant, no player rewards are seeded, and Scope 06 is excluded. No remote migration/deployment or credential changes were made.

Scope 05 verification: 219 tests passed across 28 files; configured coverage 97.09% lines / 95.48% statements / 92.23% branches / 93.05% functions. All 14 browser E2E tests passed, including existing scopes and actual web animation completion/reduced-motion navigation. Visually inspected Rewards, the card grid and card details. Independent PostgreSQL reward concurrency checks passed, along with existing scheduler/delivery and group invite races against all migrations. TypeScript, Deno, ESLint, formatting and Expo dependency compatibility checks passed; dependency audit found zero vulnerabilities. Web/iOS/Android exports passed. Remote migration, live worker/Cron proof, installed native animation behavior and real reward push delivery remain unverified.

## Button interaction audit (2026-10-27)

Audited the available Scope 01–05 controls using 18 new disposable-browser scenarios and manual in-app browser verification. Fixed web device-settings exceptions, missing busy feedback/duplicate prevention on notification actions, invitation refresh discarding a fresh code, and browser/native-denied preference saves disabling push on other devices. Added notification return navigation. No hosted data or credentials changed; destructive flows used only in-memory fixtures. Future gameplay remains gated.

Validation: all 32 browser E2E tests and 221 unit/database/native-mock tests passed; TypeScript, ESLint, formatting, and web/iOS/Android exports passed. Native OS/share/permission/push behavior and live Supabase/OAuth remain unverified by this fixture audit. See `docs/button-audit.md` for coverage, changed files, reproduction and screenshot evidence. Temporary audit preview stopped.

## Scope 04–05 hosted deployment (27–28 October 2026)

User explicitly authorized migrations, notification worker deployment, Cron and native push credential configuration. Applied Scope 04 and Scope 05 migrations to healthy Roam project `ywpmvqgtiawtkcqxeehf`, plus follow-up migrations `20261027181151_harden_notification_reward_rpc_storage.sql` and `20261028054725_protect_cron_worker_request_credentials.sql`. Public account RPCs retain their contracts behind private privileged implementations; reward validator signatures are upgrade-safe text; An attempted pg_net queue ACL revocation was ineffective on the hosted supabase_admin-owned table; the final Cron transport instead uses short-lived HMAC-SHA256 signatures so queued headers do not expose the shared worker secret. Deployed dispatcher v1 with dedicated secret in Edge secrets and Vault. Both global minute Cron jobs are active and have hundreds of successful runs; scheduled dispatcher HTTP responses are 200. Missing/wrong worker secret returns 401, GET 405. All public tables have RLS; privileged mutation functions deny ordinary users. No seeds or fake completed game events were introduced.

EAS points to the correct backend. Assigned existing same-team APNs key to Roam without revoking other app assignments. Created Firebase project `roam-608f6` on free Spark and registered Android `com.moredata.roam`. FCM server credentials are not yet configured: prepared a dedicated `roam-expo-fcm` identity; browser security confirmation requested before creating persistent service-account/key access and storing it in EAS. Firebase config download did not yield a retrievable file, so EAS GOOGLE_SERVICES_JSON remains pending. No native builds or real pushes were sent.

Validation: 227 tests, PostgreSQL reward race test, TypeScript, ESLint, formatting and Deno check passed. Added and deployed `20261028054852_sign_notification_cron_requests.sql`, dispatcher v2 and worker-key rotation. Hosted advisors have only the pre-existing Auth leaked-password warning. Temporary worker-secret files removed after server storage verified. Full report and exact remaining work: `docs/scope-04-05-deployment.md`.

### 28 October — FCM credentials connected after explicit approval

Created dedicated `roam-expo-fcm@roam-608f6.iam.gserviceaccount.com` with only Cloud Messaging API admin selected. Generated a protected local RSA key, uploaded its public certificate to Google, verified its public key, and uploaded the service-account private credential directly to EAS. EAS confirms FCM V1 assignment to `com.moredata.roam`; Google OAuth and FCM validation-only requests returned 200. No push was actually sent.

Downloaded official Firebase Android client configuration through Chrome, validated the project/package/app IDs and set EAS development `GOOGLE_SERVICES_JSON` as a sensitive project file variable. App config resolves the file correctly. Removed temporary private-key/credential JSON after verification. Certificate must be rotated before 28 October 2027. APNs/FCM configuration is complete; new native development builds and real device push behavior remain unverified. Updated `docs/scope-04-05-deployment.md` with exact evidence and limits.

## 2026-10-28 — TestFlight release preparation and store build

- Added `testflight` store build/submission profiles for Roam App Store Connect app `6827296384`; retained version 0.1.0 and selected build 2 after live status showed no prior TestFlight builds.
- Updated five Expo SDK 58 packages to compatible patches. TypeScript, lint, formatting, all 227 tests/29 files, dependency checks and iOS production export passed.
- Created store profile `QC684S75CF` and assigned existing EAS Submit API key. Reused existing distribution certificate/APNs key.
- Built isolated source snapshot successfully: EAS `21df29d0-a533-4c2c-bd57-345e26c225c5`. IPA metadata and production APNs/Apple sign-in/store entitlements verified. First attempt failed due macOS temporary-directory canonical path mismatch; corrected without source changes.
- Submission `95ef7825-7f8d-4e71-b59e-432e01e15d6d` is queued, no reported error; no duplicate scheduled. Apple processing/tester installation and physical-device push remain unverified. See `docs/testflight-release.md`.

## 2026-10-28 — Google OAuth callback repair

Hosted Auth logs identified an invalid Google client secret during the iPhone OAuth callback. Verified the Google web client ID and callback URI, then with explicit user approval saved its existing enabled secret in Supabase; dashboard confirmed success. No app code change/rebuild, no new secret generated. Physical-device retry remains pending. See `docs/testflight-release.md`.

## 2026-10-28 — Optional group vice owner

Implemented optional successor designation, atomic succession when an owner leaves/deletes their account, and no-vice guardrails. Owners alone appoint/remove a vice from existing members; vice retains member permissions until promotion. Added creation setup note/shortcut, group member controls, successor/leave UI and account deletion copy. Existing groups default to no vice; group/session deletion protections unchanged.

New migration: `20261028170737_group_vice_owner_succession.sql`, prepared but not applied remotely. Updated typed group service/contracts, account messages, PGlite tests, UI/service tests, Playwright group flow and real PostgreSQL concurrency runner. 238 tests passed; TypeScript/lint/format passed; platform coverage 97.19% lines. Concurrent owner and vice departures retained one owner. See `docs/next-release-fixes.md` for release/device status. No new TestFlight build, version bump or Scope 06.

Final vice-owner verification: all 33 Playwright end-to-end checks passed (including existing button audit), iOS/web exports passed, and final unit/database run passed 238 tests across 29 files. Migration remains unapplied; installed TestFlight 0.1.0 (2) is unchanged.

## 2026-10-28 — Hosted vice-owner migration applied

User authorized pushing the migration. Dry run listed only `20261028170737_group_vice_owner_succession.sql`, applied successfully to Roam `ywpmvqgtiawtkcqxeehf`. Follow-up dry run is up to date. Read-only hosted checks verified vice column, RLS enabled, public RPC SECURITY INVOKER, anonymous execution denied and private base helper denied to authenticated clients. Advisors returned only the existing leaked-password protection warning. No real user accounts or groups were modified by verification. TestFlight build 2 remains unchanged; updated UI still needs an app release.

## 2026-10-28 — Scope 05 re-audit

The user repeated Scope 05; audited existing implementation rather than creating duplicate schema/services. Existing engine satisfies XP, levels, game/session totals, trusted verifiers, cards, scoped achievements, protected UI, notifications and reduced motion. Read-only hosted checks confirmed 5 cards, 5 achievements, 5 reward definitions, 8 levels, 2 active Cron workers, reward RLS and denied client award/unlock execution. All 238 tests/29 files passed with 97.19% measured line coverage; independent PostgreSQL reward concurrency passed. Fixed a flaky Playwright assertion to target visible card-detail copy rather than duplicate hidden screen text; all 3 reward E2E tests passed. Updated `docs/scope-05-review.md` to reflect actual deployment/TestFlight/credential status. No new feature migration, deployment, player award, TestFlight build or Scope 06 work. Physical-device reward animation/push still requires real game events.

## 2026-10-28 — Scope 06 Secret Santa setup and lobby

Implemented module settings, atomic/idempotent lobby creation, secure hashed session invitations, independent group/session joining, host edit/remove/close/extend/cancel controls, and automatic joining closure through registered handlers in the existing scheduler. Server time rejects late joins before a delayed worker updates phase. Generic start cannot draw or activate Secret Santa. Added native/web date controls, group selection, lobby/preview/confirmation and safe sign-in invitation return routing.

Migration `20261028182438_secret_santa_setup_lobby.sql` is local only. No deployment, new Cron/Edge Function, native release or version bump. 262 tests/33 files and all 36 E2E regressions passed; measured lines 96.77%. TypeScript/lint/format/Expo compatibility and web/iOS/Android exports passed. Real PostgreSQL verified concurrent create, capacity and deadline workers; reward concurrency regression passed. See `docs/scope-06-review.md` and `docs/next-release-fixes.md`. Stop at Scope 06: no matching, assignments or later gameplay.

## 2026-10-29 — Scope 06 migration deployed; TestFlight release in preparation

The user authorized all pending migrations and a TestFlight release. Applied `20261028182438_secret_santa_setup_lobby.sql` successfully to Roam `ywpmvqgtiawtkcqxeehf`. The follow-up migration dry run is up to date; security/performance advisors report only the existing `auth_leaked_password_protection` warning. The migration reuses the deployed minute scheduler and notification dispatcher; no new Cron job, Edge Function or credential is needed.

After SDK-compatible Expo patch updates, all 262 tests across 33 files and all 36 fixture E2E checks passed again, along with TypeScript, ESLint, formatting, Expo dependency compatibility and web/iOS exports. The earlier implementation pass's Android export and independent PostgreSQL concurrency results remain recorded above; they are distinct from this fresh release pass.

Hosted Cron proof: a disposable lobby's deadline was `2026-10-29T04:36:02.448652Z`. The existing `roam-activities` job succeeded and automatically closed joining at `04:37:00.028421Z`, then completed the scheduled activity at `04:37:00.038503Z`. The lobby reached `insufficient_players`, and `secret_santa_joining_closed` / `secret_santa_insufficient_players` each had exactly one notification. The scheduler was not manually invoked. The next Cron run at 04:38:00Z succeeded and notification counts remained one. The fixture account, session, activities and notifications were deleted; zero remaining rows were verified.

Marketing version remains 0.1.0, and iOS build number is now 3. The cloud request was rejected before creating a build job because the monthly free iOS quota was exhausted (reset 1 November); no paid plan was purchased. The first local EAS build failed before compilation because Apple's public WWDR G3 intermediate certificate was absent. Downloaded Apple's public G3 certificate, verified its root chain with `security verify-cert`, and added it to the login keychain with default trust. No signing credentials were replaced or revoked. The second local signed EAS/Xcode build succeeded from the same canonical source snapshot without app code changes. IPA signature, bundle/version/build, production push and Apple sign-in entitlements, beta eligibility and hosted backend reference passed verification. Submission `811ff809-d1f0-4c3a-8dc4-9a520d3ca3fb` finished; Apple confirmed build 3 is `VALID` and `IN_BETA_TESTING` at 10:03 UTC on 29 October. Physical-device installation and feature checks remain unverified. Vice-owner controls and Scope 06 are included in TestFlight 0.1.0 (3); the last user-confirmed installed build is 0.1.0 (2). Physical-device date/time selection, copy/share, invitation links across authentication and actual push/deep-link behavior remain unverified. No Scope 07 matching or later gameplay was started.

Updated README, Scope 06 review, next-release notes and this current-status section to remove obsolete early-scope placeholder and undeployed-backend claims while preserving dated implementation history.

## 2026-10-29 — Scope 07 matching and private reveal implemented locally

Reviewed prior session/module/membership/invitation/scheduling/notification/RLS/deletion/presentation infrastructure and current Supabase documentation, then presented the implementation plan. Implemented `20261029102704_secret_santa_matching.sql`: cryptographic Fisher–Yates single-cycle draw, atomic assignments/activation/notices, persistent failure/retry, automatic scheduled draw and confirmed early draw, authorized own-recipient retrieval/reveal and account deletion tombstones. Added recipient UI and persistent server reveal with countdown, enabled future activity placeholders, generic notifications and immutable membership after draw. No Scope 08 gameplay.

Validation: 284 tests across 35 files, 37 browser E2E checks, TypeScript, lint and formatting passed. Platform/game/server instrumentation: 96.79% lines, 91.99% branches. Web/iOS/Android exports passed. Independent local PostgreSQL verifies concurrent host and automatic draws, locked late joins, safe retries and reward concurrency regression. A disposable group of 13 dummy participants joined through real APIs, drew, privately revealed/revisited and generated 13 deduplicated alerts; disposable session/group/accounts were deleted, with zero fixture accounts confirmed, and the full local database removed. Screenshots inspected after navigation and animation completion.

The migration has not been applied to hosted Roam; saved deployment approval boundary remains in effect. Hosted Cron/advisors/13-user fixture, real push receipt and physical-device UI remain unverified. No TestFlight build/submission or version/build change. Full file inventory and security/transaction explanation: `docs/scope-07-review.md`.

## 2026-10-29 — Scope 07 deployed and hosted 13-user exchange verified

The user explicitly approved applying the migration and verifying the hosted exchange. The Supabase connector denied access, so used the authenticated CLI. Inspected hosted migration/module state and active minute Cron jobs; dry run contained only Scope 07 and there were zero existing ready lobbies. Applied `20261029102704_secret_santa_matching.sql` to Roam `ywpmvqgtiawtkcqxeehf`; follow-up dry run is up to date. Before/after advisors show only the existing leaked-password-protection warning, no new findings. Hosted permission checks confirm assignment RLS, no client SELECT/internal-draw permission, no anonymous lobby execution and private-only definer helpers.

Added `scripts/verify-secret-santa-hosted.mjs`, explicitly gated for authorized hosted fixture creation/deletion. It retrieves API credentials only into process memory, creates 13 disposable Auth users with live sessions, builds a persistent group via invitations and joins all 13 through module APIs. Verified two exchanges: concurrent host early draws converge (10:54:37Z), while a separate session is closed by real Cron after its 10:55:27.947Z deadline (10:56:00.106891Z) and matched/activated at 10:57:00.041886Z. Successful `roam-activities` runs 4890/4892 supply live scheduler proof; the harness never calls the worker/scheduler manually. All 13 recipients form one cycle, privately reveal and revisit, and each exchange has exactly 13 generic ready alerts. Forbidden host/member/anonymous/direct-table paths and replay deduplication passed. No downstream gameplay was created.

At 10:57:13Z cleanup verified zero fixture users, sessions, profiles, memberships, notifications, identity references, games, assignments, activities and groups; temporary fixture manifests were removed. Safe machine-readable evidence is saved in `docs/artifacts/scope-07-hosted-verification.json`, with advisor snapshot alongside. No credentials or private relationships are written to files/logs. Lint/TypeScript/formatting passed for the new harness. Existing 284 tests/37 browser checks and web/iOS/Android exports remain the application validation; app implementation was unchanged in this deployment turn. Updated README, release notes and Scope 07 report to distinguish deployed backend from unreleased UI. No native build/submission or version bump; physical-device and actual push checks remain pending. Stop at Scope 07.

### 29 October — Welcome flow and TestFlight build 4

Implemented greeting, three onboarding pages and redesigned account entry with generated mascot asset. Preserved Apple/Google sign-in and callbacks. Isolated source snapshot and manifest; signed local 0.1.0 (4) IPA verified for signature, identity, entitlements and hosted backend. 284 unit tests, TypeScript, lint and final 39/39 browser checks passed. React Native patch recommendation remains a warning, with existing 0.88.0 preserved. Verified IPA uploaded to EAS Submit; submission `a5d13356-902f-4000-868c-210389be699f` is IN_QUEUE. Apple availability/device checks remain pending. No backend deployment or Git push. See `docs/releases/testflight-0.1.0-build4.md`.

### 29 October — Recover stuck build 4 submission

Live EAS lookup confirmed build 4 remained IN_QUEUE with no logs and Apple listed only builds 2/3. Canceled EAS submission successfully, then uploaded the exact verified IPA directly using the existing assigned ASC API credential and Fastlane. Apple accepted the binary at 18:22:16 UTC. Apple listing/processing/internal availability remain pending. Temporary local ASC credential material removed. No replacement build or credential rotation.

### 29 October — Scope 07.5 Phase 1

Implemented shared electric-blue/light and navy/dark brand theme, reusable screen/header/control/card/mascot components, genuine native iOS tabs and glass controls with fallbacks, real-data Home and registered-only Games Catalog, and themed Welcome/sign-in. Existing authentication, backend, services, game sessions/matching and later-phase screen layouts preserved. Approved standalone artwork is missing; generated onboarding artwork is no longer consumed and clean replacement slots are documented. TypeScript/lint/format, 45 browser checks and iOS/web exports passed; unit suite and isolated native simulator preview evidence recorded in `docs/design/scope-07-5-phase1/README.md`. Native dependencies need a new build; no release/deployment or later-phase work.

Phase 1 final evidence: 287/287 unit tests, 45/45 browser tests, TypeScript/ESLint/format and iOS/web exports passed. Isolated unsigned Release native preview built and launched on iPhone 18 Pro iOS 27 simulator; native glass tabs/header controls and light/dark reviewed and captured. Preview app removed after captures; no real account/provider/game/device verification is implied. Approved mascot/game artwork and physical-device checks remain pending.

### 30 October — Scope 07.5 Phase 2

Refactored existing Groups/create/join/detail/members/settings/invitation UI to Phase 1 brand components. Added permitted member initials/visible session counts, safe duplicate-membership preview, native share result acknowledgement, reduced-motion feedback and a group-aware Games → details → setup route. Profile now summarizes actual Scope 05 progression and links to dedicated Edit Profile, Notifications, Rewards and Privacy & account screens; existing deletion and sign-out behavior is preserved. Group-only gift-exchange presentation moved beside group screens; Secret Santa gameplay screens remain unchanged. No backend/schema/dependency/release changes. Approved mascot asset remains missing and the existing placeholder is retained. See `docs/design/scope-07-5-phase2/README.md` for file inventory, validation evidence and device limitations.
