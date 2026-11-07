# Roam 0.1.0 (7) — Scope 07.5.5 device-testing beta

User explicitly authorized TestFlight upload on 5 November 2026 and asked to retain the dummy group and users. No hosted data cleanup, user deletion, matching run, backend migration or configuration change is included. Existing ForTest/dummy resources remain available.

## Source and validation

Isolated source: `/private/tmp/roam-testflight-20261105-scope0755-build7`, 123 application/config files. Manifest: `testflight-0.1.0-build7-manifest.json`, SHA-256 `a6750cfe3e7762db76c966de192cd036cc6badd3da5230659575f8ee63025f70`. Snapshot excludes native folders so EAS Prebuild synchronizes the current Expo configuration and plugins. Workspace Expo/iOS build metadata synchronized to 7; marketing version remains 0.1.0. No dependency upgrades.

Includes Secret Santa experience, Rewards/notifications polish and final design stabilization through 07.5.5. The [QA report](../scope-07.5.5-review.md) records 325 passing automated tests, 59 full browser tests, 9 reviewed-export browser flows, passing production exports and a native Debug simulator compile. TypeScript/lint rerun for release preparation. Existing SDK dependency alignment warnings, missing approved mascot exports and pending physical-device/Android verification remain documented; this beta is for device testing, not App Store release certification.

Target: `com.moredata.roam`, ASC `6827296384`, team `3Y42VMC42F`. Existing EAS `testflight` profile, development environment and hosted Roam backend reused. Apple preflight confirmed build 6 VALID / IN_BETA_TESTING and build 7 absent. Build uses established local EAS/Xcode signing; upload uses existing Fastlane/ASC credential. No credential rotation, external beta review or App Store submission requested.

## Release status

Signed local EAS/Xcode archive succeeded. IPA verification passed: 18,059,345 bytes, SHA-256 `fb735f38d9cbe000306666e0434550a972f9f7a5bd1427374ccedeafc7f7ad61`; iOS 16.4 minimum, production APNs, Apple sign-in, beta reporting, debugging disabled, unrestricted store provisioning, expected hosted backend and strict code signature. IPA retained in ignored `.release-artifacts/roam-0.1.0-build7.ipa`. Fresh Apple pre-upload lookup confirms build 7 absent. One upload is starting; processing and internal TestFlight availability are not yet claimed.

## Released — 5 November 2026

Apple accepted the single upload at 14:45:53 Europe/Helsinki; processing and testing-note update completed at 14:48:33. Fresh Apple lookup confirms **0.1.0 (7): VALID / IN_BETA_TESTING**. Apple build ID: `2b1a90b7-e5c0-4c5d-903a-bdaa07fbd83e`. Internal TestFlight availability is verified. External state remains `READY_FOR_BETA_SUBMISSION`; no external beta review or App Store submission was performed.

The dummy group and users were preserved: no backend cleanup or user deletion was executed. Install build 7 in TestFlight for the pending device checks. Actual installation, VoiceOver, push receipt and hardware testing remain unverified until tested on the device.
