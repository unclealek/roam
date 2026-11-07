# Roam TestFlight 0.1.0 (5) — 30 October 2026

Phase 1 and Phase 2 visual implementation: shared brand theme, native Liquid Glass navigation/fallbacks, Welcome/Home/catalog, Groups/create/join/details/members/invitations and Profile/edit/privacy. Secure group services, rewards data and authentication remain intact. Phase 2B is not included.

App `com.moredata.roam`, ASC `6827296384`, Apple team `3Y42VMC42F`. Live Apple preflight confirms build 4 is VALID and IN_BETA_TESTING and no build 5 exists. Marketing version remains 0.1.0; build increments to 5. Source Expo and native metadata are synchronized; the isolated managed snapshot regenerates native iOS with current dependencies.

Source: `/private/tmp/roam-testflight-20261030-build5-attempt2`; 107 files. Manifest SHA-256 `82e5dfb058f3d8005cf72e1f586357956a0d378264807a0cffc9884a42af488f`. See `testflight-0.1.0-build5-manifest.json`.

## Validation and status

292 unit tests across 37 files, configured coverage thresholds, TypeScript, ESLint, changed-file formatting and combined web/iOS Hermes export pass. Full browser regression: **49/49 passed** (2.6 minutes). Signed IPA and Apple status will be recorded after completion. Existing Expo compatibility warning recommends React Native 0.88.1; installed 0.88.0 is retained as in the previous released build. Release repair: the initial local attempt stopped before compilation because the manifest pinned `@expo/vector-icons` 15.0.2 while both the lockfile package and installed/tested tree were 15.1.1. The pin now matches 15.1.1; offline `npm ci --dry-run --ignore-scripts` passes. No installed dependency version was changed.

Build uses the established local EAS/Xcode workflow and existing remote credentials, with the `testflight` store profile/development EAS environment and hosted Roam beta backend. The App Store connector has no connected team; no new connector setup or credential rotation is needed for the existing workflow. No paid cloud-build plan, Git push or backend deployment is part of this release.

## Known limitations / what to test

Approved standalone mascot art is still missing. Existing Phase 1 placeholder is preserved; no generated substitute. Profile supports display name only; lifetime games-played metric and avatar/bio fields are not invented. Invitation errors retain the safe combined backend response.

On physical devices verify authentication/callback continuity, group creation/preview/join/duplicate membership, permitted member actions, copying/sharing/canceling invitations, group-aware game setup, profile editing, XP/rewards links, notification preferences, sign-out/deletion, small/large text, light/dark, safe areas/keyboard, reduced motion/transparency and native Liquid Glass. Compilation/upload/Apple processing do not prove these checks.


## 4 November continuation

Temporary archive/log files from 30 October were no longer available. Live Apple preflight still lists build 4 as the newest valid internal build; no build 5 was uploaded. Restored the existing assigned EAS submission credential and isolated Fastlane 2.241.2 tooling. Added the already installed Expo Font 58.0.11 as a direct dependency to satisfy the icon package peer requirement; lockfile dry-run passes. No installed dependency version changed. Fresh source snapshot: `/private/tmp/roam-testflight-20261104-build5`; 107 files; manifest SHA-256 `df1d47da2bb5667725d84bb69eca937a593f817db52b2c55393b18e4c27b616f`.

Fresh TypeScript, 292 unit tests and web/iOS exports pass. Final browser/IPA/upload evidence follows below when complete.


4 November: fresh browser regression **49/49 passed**. Local EAS/Xcode archive succeeded. Verified actual signed IPA identifier/version/build, code signature, Apple sign-in, production APNs, beta reports, disabled debugging, unrestricted store provisioning and expected hosted backend. IPA SHA-256 `7f8d44f76e04376a9b7b51d7600eb5e78fe907d4f8d4f3f9d4f5b267f65466c0`; 18,032,942 bytes. See `testflight-0.1.0-build5-ipa-verification.json`. A copy is retained in ignored `.release-artifacts/roam-0.1.0-build5.ipa` so it survives temporary-file cleanup. Upload started with existing assigned credentials; Apple processing/internal availability are still pending. Expo Doctor passes 19/20 checks; its remaining check recommends newer SDK patch packages and safe-area-context 5.11.x. This release preserves the tested package graph; no native peer dependency is missing.

**Released to internal TestFlight on 4 November.** Apple accepted the upload at 15:28:17 Europe/Helsinki. Fresh direct Apple lookup confirms build `f4198c5c-09fb-4318-9a2a-d9f07cffd210` is VALID and IN_BETA_TESTING. See saved Apple status. Fastlane successfully set the test notes, then its post-upload distribution path attempted an external beta review and failed because required external-review metadata was absent. No external review was submitted; external state remains READY_FOR_BETA_SUBMISSION. No binary was re-uploaded. The second release workflow now uses upload-only `skip_submission`, relying on the existing automatic internal group and separately verifying Apple status. Installed-device checks are still pending.
