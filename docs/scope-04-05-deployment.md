# Scope 04–05 hosted deployment

Status: backend, EAS development environment, APNs assignment and Android FCM configuration complete. Actual push delivery is unverified.

## Targets

- Supabase: Roam, `ywpmvqgtiawtkcqxeehf`, eu-west-1, PostgreSQL 17.
- Expo: `@alekille/roam-social-games`, project `65b2d707-2654-4a12-b609-2fee9c9a0a07`.
- iOS bundle / Android package: `com.moredata.roam`.
- Firebase: Roam, `roam-608f6`, project number `254265814493`, free Spark plan. Optional Analytics and Gemini were disabled during creation.
- Firebase Android app: `1:254265814493:android:c51ae2ba2b058c9c2a1a34`.

## Applied migrations

- `20261027090002_scheduling_notifications.sql`
- `20261027134631_shared_rewards_collectibles.sql`
- `20261027181151_harden_notification_reward_rpc_storage.sql`
- `20261028054725_protect_cron_worker_request_credentials.sql`
- `20261028054852_sign_notification_cron_requests.sql`

The follow-up keeps authenticated RPC implementation bodies in the unexposed private schema behind public invoker wrappers. It stores registered validator signatures as text instead of regprocedure columns to support PostgreSQL upgrades. Trusted validators still resolve and validate their private function signature before execution. The final migration dry run reported the remote database up to date. No seeds or role files were deployed.

## Worker and Cron

Deployed `notification-dispatcher`, version 2, status ACTIVE. The handler verifies timestamped HMAC-SHA256 requests using a dedicated random 384-bit worker secret; gateway JWT verification is intentionally disabled. Its secret is stored in Edge Function secrets and Supabase Vault, never client environment variables. Missing/incorrect credentials returned HTTP 401, GET returned 405, and authorized POST returned 200 with zero pending sends/receipts/failures. Valid HMAC requests returned 200; expired and tampered signatures returned 401.

Two global jobs are active at `* * * * *`:

- `roam-activities`: `public.notification_worker('tick')`, including reward event processing.
- `roam-notifications`: Vault-signed pg_net request to the dispatcher through `private.invoke_notification_dispatcher()`.

Both jobs have at least 695 successful run records as verified on 28 October; the database-generated signed request also returned 200 without timeout/error after the transport change; pg_net recorded HTTP 200 without timeout/error. No per-player jobs were created. The hosted queue is owned by supabase_admin and our attempted ACL revocation did not remove its PUBLIC grant. To avoid persisting a secret in that queue, Cron now sends only a short-lived HMAC signature over the timestamp and exact body. Requests older than 120 seconds or more than 30 seconds in the future are rejected. The signing key remains in Vault/Edge secrets and was rotated after switching. The private signing helper denies ordinary user execution; repeated accepted requests still use the existing delivery leases and deduplication. Setup source: `supabase/setup/scope04-cron.sql`.

## EAS and APNs

The development EAS environment already points to the correct Roam backend. Assigned existing Apple-team APNs key `Z477P8M7TX` to Roam; team `3Y42VMC42F`. The key was reused without revoking or modifying its existing application assignment. EAS reports the push key attached to `com.moredata.roam`. Existing ad hoc build credentials remain present. This confirms the EAS assignment, not Apple key validity or notification delivery to a device.

## Verification

- 227 tests passed across 29 test files (97.17% configured line coverage) after the hardening migration.
- PostgreSQL concurrency test passed against every migration: one XP transaction under contention, deduplicated first-game rewards/worker replays, one card and unique notifications.
- TypeScript, ESLint, formatting and Deno worker typecheck passed.
- All 17 public tables have RLS. Worker/award/activity mutation RPCs deny anon and authenticated callers; service_role has execute access. Account RPCs deny anon and preserve authenticated-only access.
- Hosted security/performance advisors report no issues introduced by these scopes. The pre-existing Auth leaked-password-protection warning remains; it was outside this deployment change.

## Android FCM — completed 28 October 2026

User explicitly approved creation and EAS storage of a dedicated FCM credential. Created `roam-expo-fcm@roam-608f6.iam.gserviceaccount.com`, client ID `116305405548769851171`, with only **Firebase Cloud Messaging API admin** selected. No service-account users/admin principals or other project roles were granted.

Generated an RSA-2048 private key in a protected temporary directory and uploaded only its X.509 public certificate to Google. Verified the published certificate matches the local key. Google OAuth issued an access token for the messaging scope. EAS confirmed the private credential was uploaded and assigned to `com.moredata.roam` for **FCM V1**. It is not configured for Play Store submission or legacy FCM.

- Key ID: `cc81fc9105d02b0147f98b84a7796a98d9c416c3`.
- Certificate expiration: **28 October 2027, 06:14:46 UTC**. Rotate and reassign the EAS key before this date.
- FCM `projects.messages.send` with `validate_only=true` returned **200**. No notification was sent; this confirms the account/key/role/API combination works, not device delivery.
- Downloaded the official `google-services.json` through Chrome and checked its project number, project ID, package and Firebase app ID. Stored it as a project-scoped **file** variable named `GOOGLE_SERVICES_JSON` in EAS **development**, with sensitive visibility.
- Verified `app.config.ts` resolves `android.googleServicesFile` from that variable and retains the intended Android package and EAS project ID.
- The FCM account cannot read Firebase management configuration (403); no additional role was granted to work around that. The console download used the owner's existing session instead.
- Temporary private-key and service-account JSON files were removed after EAS assignment and verification. The downloaded Android client config contains public-facing app identifiers and stays in Downloads; server credentials were never placed in the repository or mobile config.

## Remaining device verification

Build/install fresh iOS and Android development clients, then verify real permission prompts, token registration, Expo push tickets/receipts, foreground/background taps and quiet hours. The older development client predates these native modules. Android build signing can be generated by the normal EAS build credential workflow if not already configured. No new native build or store submission was requested or started here.

No push was sent to a real user and no synthetic game-completion rewards were created. The existing development build profiles use the development environment. No preview or production build profile/environment was introduced.

## References

- [Expo FCM v1 credential setup](https://docs.expo.dev/push-notifications/fcm-credentials/).
- [Firebase Android configuration download](https://support.google.com/firebase/answer/7015592).
- [FCM validation-only requests](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send).
