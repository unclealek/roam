# Roam 0.1.0 (6) — Scope 07.5.2B

Final shared UI and targeted actual-screen polish. User authorized TestFlight release and stopping before Scope 07.5.3. Phase 2 build 5 is already VALID / IN_BETA_TESTING. This build preserves authentication, groups, game registry/routes, reward ledger and hosted backend operations.

## Source and preparation

Isolated snapshot: `/private/tmp/roam-testflight-20261104-reviewed-build6`, 114 files. Manifest SHA-256 `2af1d73f35d0ac542c2ead0aeffe31eb676119cde181aa66216d0b2563d6fefa`. Bundle `com.moredata.roam`, team `3Y42VMC42F`, ASC app `6827296384`. Existing EAS `testflight` store profile and established hosted Roam beta backend. No cloud quota purchase, Git publication or backend deployment.

The initial local build was stopped before upload to eliminate duplicate keyboard inset handling. The final snapshot lets UIKit ScrollView own native form keyboard adjustment; Android retains window resize. Build number remains 6 because nothing was uploaded from the canceled build.

## Validation

TypeScript, lint and web/iOS Hermes export pass. 302 tests across 39 files pass. Configured platform coverage: 95.38% statements, 92.17% branches, 94.38% functions, 97.03% lines. Full browser verification and signed archive/upload/Apple availability evidence will be appended after completion.

## Limitations and device verification

Approved transparent mascot welcome/peek/small poses and approved Secret Santa catalog artwork are missing. No replacement character generated or wired. No fabricated games, activity, rewards or profile fields. Physical-device VoiceOver/Dynamic Type, small/large iPhone tab geometry, keyboard, Reduce Motion/Transparency, Increase Contrast, iOS Liquid Glass and Android rendering/performance still require verification. APNs/FCM device receipt is not proved by signing, upload or Apple processing. Existing Secret Santa gameplay/reveal screens are not redesigned.

See [full implementation report](../design/scope-07-5-phase2b/README.md), [file inventory](../design/scope-07-5-phase2b/files-changed.json) and [screenshots](../design/scope-07-5-phase2b/screenshots).

Final visual review also corrected the dark feedback-host surround before upload. Earlier local archives were canceled; neither was submitted. The reviewed snapshot above is the release source.

Signed local EAS/Xcode archive succeeded. Actual IPA checks pass: `com.moredata.roam` / 0.1.0 (6), iOS 16.4 minimum, production APNs, Apple sign-in, beta reporting, debugging disabled, unrestricted store provisioning, expected hosted backend and strict code signature. IPA: 18,044,846 bytes; SHA-256 `db353ccc724b58da6c8e2f03512f1fd9d5a076881e6e4194c433b22dffd2e3dc`. Retained in ignored `.release-artifacts/roam-0.1.0-build6.ipa`. Fresh Apple preflight confirms no existing build 6. Upload started once; Apple processing/internal availability remain pending.

Apple accepted the single build 6 upload on 4 November 2026 at **21:23:19 Europe/Helsinki**. Fastlane is waiting for processing; internal availability is not yet claimed. No duplicate upload was made.

## Released — 4 November 2026

Build **0.1.0 (6)** is **VALID / IN_BETA_TESTING** in a fresh direct Apple lookup. Apple build ID: `f6351da6-7c49-4f78-8b52-6fab02e3357c`. Fastlane upload/processing/changelog completed successfully with exit 0. External state remains `READY_FOR_BETA_SUBMISSION`; no external review was submitted. No duplicate binary upload.

Final checks: TypeScript and ESLint pass with zero warnings; 302/302 tests across 39 files; 53/53 full browser regressions; 4/4 repeated final visual scenarios; 19/19 final targeted component checks; web/iOS Hermes exports; signed iOS archive and strict IPA verification. Expo Doctor 19/20 with the documented SDK version-alignment warning. 64 browser captures are saved. Missing original artwork and physical-device checks remain as documented.

Stopped after Scope 07.5.2B. Scope 07.5.3 and Mind Match were not started.
