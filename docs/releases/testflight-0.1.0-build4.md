# Roam TestFlight 0.1.0 (4) — 29 October 2026

## Target and source

Roam `com.moredata.roam`, App Store Connect `6827296384`, Apple team `3Y42VMC42F`. Marketing version remains 0.1.0; build number 4. Live Apple preflight confirmed build 3 is valid and in internal beta testing, with no build 4 present.

Isolated source snapshot: `/private/tmp/roam-testflight-20261029-build4`. Source hashes: [manifest](testflight-0.1.0-build4-manifest.json). The snapshot excludes local environment and credential files. Store profile uses the existing development EAS environment and hosted Roam backend. No Git push or backend deployment is part of this release.

## Included changes

Greeting screen, three skippable onboarding pages, and redesigned returning-player/create-account screens using existing Apple and Google authentication. Includes current Scope 07 Secret Santa matching/reveal UI and the previously prepared Home greeting flash fix. Backend matching was already deployed.

## Verification and status

284 unit tests, TypeScript and ESLint passed. Final full browser regression: **39/39 passed** (1.9 minutes). Sign-out/account-deletion expectations now follow the welcome screen; the rewards audit waits for the refresh button before injecting its next failure to avoid racing the previous screen load. Native signed EAS/Xcode build succeeded. Existing React Native 0.88.0 is preserved; Expo now recommends 0.88.1 and reports a dependency compatibility warning. No dependency upgrade is included.

Using the established local EAS/Xcode workflow because the last release reached the monthly cloud build quota. The initial attempt stopped before compilation because GEM_PATH hid a CocoaPods dependency; retried with the existing Homebrew gem locations restored. No signing credentials changed.

Verified IPA bundle/version/build, hosted backend, signature and actual signed Apple sign-in/production push/beta entitlements. IPA SHA-256: `825b4f9728e0e8677fbf6887a00ffc582958435430ebd075ff0084533d40b6da`. See [IPA verification](testflight-0.1.0-build4-ipa-verification.json). **Uploaded directly to App Store Connect at 18:22:16 UTC on 29 October.** The EAS submission `a5d13356-902f-4000-868c-210389be699f` remained `IN_QUEUE` with no logs, while Expo reported no incident. Canceled that job successfully, then used the existing assigned ASC credential with Fastlane to upload the exact verified IPA directly. Apple accepted the upload; processing/internal availability is pending. No duplicate submission or new signing credential was created. Temporary credential material was removed after the accepted upload. Physical-device onboarding, sign-in callbacks, invitation continuity, reveal behavior and actual push receipt remain unverified.


30 October live preflight resolved processing status: Apple build `cdf6d284-1b5a-433c-848d-22a9a6e705a2` is VALID, unexpired and IN_BETA_TESTING. Physical-device installation remains unverified.
