# Roam TestFlight 0.1.0 (3) — 29 October 2026

## Source and target

- App: Roam, `com.moredata.roam`; App Store Connect `6827296384`, Apple team `3Y42VMC42F`.
- Version remains `0.1.0`; build number is `3`. Apple confirmed build `2` is valid and in internal beta testing before this release attempt.
- Isolated source: `/private/tmp/roam-scope06-testflight-20261029-build3`.
- Source manifest: [testflight-0.1.0-build3-manifest.json](testflight-0.1.0-build3-manifest.json), 84 files. SHA-256 of the manifest file: `0e666e163c04b911b0b70f802a52b6fbd242ed6aec107b7790628932384b8b1c`.
- Store profile `testflight` intentionally uses the development EAS environment pointing to Roam's hosted beta backend. No local environment or credential files are included in the source archive. No GitHub push was performed.

## Included changes

Scope 06 Secret Santa setup, secure session invitations, group or standalone lobbies, host management and automatic joining closure. Matching and all later gameplay remain unimplemented. Includes the previously deployed vice-owner feature and account-deletion guidance, the native date/time picker, SDK 58 recommended patch updates, and TypeScript exclusions for generated validation reports.

## Backend deployment

- Applied `20261028182438_secret_santa_setup_lobby.sql` to Roam `ywpmvqgtiawtkcqxeehf`; follow-up dry run reports the database is up to date.
- Verified catalog availability (3–100 players, no start operation), settings RLS, invoker public RPC, denied anonymous access and denied ordinary access to the generic privileged implementation and worker configuration tables.
- Existing minute jobs `roam-activities` and `roam-notifications` remain active. This scope needs no additional Edge Function or Cron job.
- Advisors report no new issues; existing leaked-password protection warning remains.
- Hosted automatic closure succeeded without manually invoking the worker: the disposable lobby deadline was `04:36:02.448652Z`, and Cron closed it at `04:37:00.028421Z` on 29 October. The activity completed and the lobby became `insufficient_players`; closure and host-attention notifications were each recorded once. A further Cron run at `04:38:00Z` left those notification counts at one. The disposable account, session, activities and notifications were deleted, with zero remaining fixture rows verified. No real user's data was used.

## Validation

- TypeScript, ESLint, Prettier and Expo dependency compatibility passed. The local store build also passed all 20 Expo Doctor checks.
- 262 tests passed across 33 files; coverage 96.77% lines, 95.10% statements, 91.99% branches and 93.49% functions.
- 36 final browser E2E tests passed, including the button audit and Secret Santa setup/host/invitation flows.
- Independent PostgreSQL Secret Santa and rewards concurrency tests passed.
- Final web and iOS Hermes exports passed. Android export passed during Scope 06 implementation.

## Release status

**Released to internal TestFlight.** EAS submission [`811ff809-d1f0-4c3a-8dc4-9a520d3ca3fb`](https://expo.dev/accounts/alekille/projects/roam-social-games/submissions/811ff809-d1f0-4c3a-8dc4-9a520d3ca3fb) finished. At **10:03:42 UTC on 29 October**, live Apple status confirmed **0.1.0 (3)** is `VALID`, `IN_BETA_TESTING`, and unexpired. The existing internal `Team (Expo)` group was requested. External status is `READY_FOR_BETA_SUBMISSION`; no external beta review or App Store publication was requested. See [saved Apple status](testflight-0.1.0-build3-apple-status.json).

The cloud request reached the monthly free iOS build quota before creating a build job. Built the same source locally using [Expo's local workflow](https://docs.expo.dev/build-reference/local-builds/), Xcode 27.1, CocoaPods 1.17.0 and isolated Fastlane 2.241.2. No paid plan was purchased. The first local attempt stopped before compilation because Apple's WWDR G3 intermediate was absent; downloaded it from [Apple PKI](https://www.apple.com/certificateauthority/), verified the existing Apple Root CA chain and installed it with default trust. No signing credential was replaced or revoked. The second attempt succeeded.

The signed IPA is 17,727,046 bytes, SHA-256 `f30adcada7c8de1f339b73f929f7e17ec5afea40da2a2f18f627a67b0419c07b`. Verified bundle/version/build, minimum iOS 16.4, production APNs and Apple sign-in in the actual signed entitlements, beta reports, disabled debugging, no device UDID restriction and the Roam backend reference in bundled JavaScript. `codesign --verify --deep --strict` passed. See [IPA verification](testflight-0.1.0-build3-ipa-verification.json). The temporary signing keychain/profile and disposable native build directories were removed. Source snapshot, IPA, dSYM archive and logs are retained locally; the IPA and symbols are `/private/tmp/roam-0.1.0-build3.ipa` and `/private/tmp/roam-0.1.0-build3.dSYM.zip`.

The optional test-notes API field was rejected before submission scheduling because it requires an Enterprise Expo plan. Retried without that optional metadata and successfully submitted the exact verified IPA. Test instructions are below.

## Device checks after installation

Check native date/time selection, safe invitation preview and joining, copy/share, lobby management and deadline closure on physical devices. Check vice-owner succession and account-deletion guidance. Google sign-in after its server configuration repair, push receipt/background handling and invitation links across sign-in still require physical-device verification. Bundling, signing and Apple processing alone do not prove those behaviors.
