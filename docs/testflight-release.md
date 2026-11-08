# Roam TestFlight release — 2026-10-28

## Target and source

- App: Roam (`com.moredata.roam`), App Store Connect ID `6827296384`.
- Version: **0.1.0 (2)**. App Store Connect reported no existing TestFlight builds before this submission.
- EAS store profile: `testflight`; uses the development EAS environment and the existing hosted Roam backend intentionally for beta testing.
- Apple team: `3Y42VMC42F`; App Store provisioning profile `QC684S75CF`; existing distribution certificate reused.
- Isolated source snapshot: `/private/tmp/roam-testflight-20261028-build2`.
- Source manifest: `releases/testflight-0.1.0-build2-manifest.json`. Manifest digest (sorted JSON): `3a8364568d269d56c87cb3d7c5e84893ef77824ed951f5659922b25163c63e5f`.
- No Git repository push was performed.

## Changes prepared for this release

Includes Scopes 01–05, the button audit fixes, notification registration and delivery integration, and shared rewards. No Secret Santa gameplay or Scope 06.

Added a store build/submission profile, pinned the correct App Store Connect target, and set build number 2. Updated Expo, Auth Session, Dev Client, Router and Web Browser to SDK 58 recommended patch versions. `.easignore` excludes credentials, local environment files, test artifacts and backend files from the upload.

## Validation

- TypeScript, ESLint and Prettier: passed.
- Unit tests: **227 passed across 29 files**.
- `expo install --check`: passed after compatible patch updates.
- iOS production JavaScript/Hermes export: passed (1,706 modules).
- Icon: square, no alpha channel; Expo generates native icon sizes.
- EAS public backend environment checked against Roam project `ywpmvqgtiawtkcqxeehf`.
- Apple login and store provisioning profile creation completed successfully.

## Release status

- EAS build: `21df29d0-a533-4c2c-bd57-345e26c225c5`.
- First attempt `e3fcdad0-7797-47f0-a45b-8f529aa74a0f` failed before dependency installation because `/tmp` and its canonical `/private/tmp` path produced an incorrect relative project root. Retried using the canonical path with unchanged source.
- Existing App Store Connect API key `WA4NP87H3G` assigned to Roam for EAS Submit.
- Cloud build **FINISHED**. IPA metadata verified as `com.moredata.roam`, version `0.1.0`, build `2`, minimum iOS `16.4`.
- Embedded store profile verified: production APNs, Sign in with Apple, beta reports enabled, debugging disabled, no device UDID restriction.
- EAS submission `95ef7825-7f8d-4e71-b59e-432e01e15d6d` was initially queued; live recheck on 29 October confirmed it **FINISHED**. Internal group `Team (Expo)` was created by EAS.
- Apple confirmed build **0.1.0 (2)** is `VALID`, internal state `IN_BETA_TESTING`, unexpired. The user has installed this build. An earlier Apple status lookup failed with a server error, but that uncertainty is resolved by this fresh check.

The current release is [TestFlight 0.1.0 (3)](releases/testflight-0.1.0-build3.md), confirmed valid and available for internal beta testing on 29 October.

## Pending device checks

Install this exact build from TestFlight and check authentication callbacks, groups/invitations, notifications and settings, rewards, sign-out and account deletion. Verify permission prompts, foreground/background push handling and deep links on a physical iPhone. APNs configuration and a successful build/upload alone do not prove push delivery. Android physical-device FCM delivery remains a separate development-build check.

## Google sign-in configuration repair — 2026-10-28

- User reported Google sign-in returned “Sign-in was not completed” while native Apple sign-in worked.
- Hosted Auth logs for the iPhone callback at 17:58:37 Europe/Helsinki showed `invalid client: The provided client secret is invalid`. Google was enabled and its client ID and Supabase callback URI matched the Google Cloud web client.
- With explicit user approval, copied the existing enabled Google OAuth client secret from project `roam-512819` into the matching Roam Supabase provider. Dashboard confirmed “Successfully updated settings”. No new credential was created and nonce checks remain enabled. Secret not stored in repository.
- No mobile code or binary change; the installed TestFlight build can retry immediately. Full Google sign-in after the repair still requires the user to retry on the physical device.
- Configuration evidence: `artifacts/google-provider-configured.png` (secret masked).

## Current candidate — 7 November 2026

[Roam 0.1.1 (10)](releases/app-store-0.1.1-build10.md) was uploaded to App Store Connect. Apple processing is required before it becomes available in TestFlight. This candidate has not been submitted for App Review or released publicly. The prior verified TestFlight release is [Roam 0.1.0 (8)](releases/testflight-0.1.0-build8.md).
