# Roam 0.1.0 (8) — Home design refresh

## Target and source

- App: Roam, `com.moredata.roam`; App Store Connect `6827296384`, Apple team `3Y42VMC42F`.
- Source: isolated snapshot of the workspace at commit `c689ba522c35fd008a989db3bb53187126a4a1b8`.
- EAS build profile: `testflight`, store distribution, hosted development environment.
- No backend migrations or hosted data/configuration changes were made for this release.

## Included changes

- Added the branded Home background, a consistent notification/profile header, three illustrated game previews, player avatars and capacity progress for continuing games, and a compact Your Groups section.
- Integrated the five supplied images on the Rewards XP card, Play cards, Profile background, Home cards, and Groups cards.
- Upcoming Mind Match and Secret Agent previews remain clearly marked Coming soon and are not actionable.

## Validation

- TypeScript, ESLint, Prettier, Expo iOS export: passed.
- Unit tests: **338 passed across 45 files**.
- Home browser acceptance: **6 passed** across light/dark appearance and narrow/wide viewports.
- Signed EAS store build completed for iOS.

## Release status

- EAS build: [`a25a7037-9705-4470-990b-c1f98a15fc0e`](https://expo.dev/accounts/alekille/projects/roam-social-games/builds/a25a7037-9705-4470-990b-c1f98a15fc0e).
- EAS submission: [`69d5bac0-29a4-434d-8e7c-4e4731e2fa91`](https://expo.dev/accounts/alekille/projects/roam-social-games/submissions/69d5bac0-29a4-434d-8e7c-4e4731e2fa91).
- Apple confirmed build **0.1.0 (8)** is `VALID` and `IN_BETA_TESTING`; it is available for internal TestFlight testing. External state is `READY_FOR_BETA_SUBMISSION`; no external beta review or App Store release was requested.
- TestFlight "What to Test" notes were not added because EAS restricts changelog submission to its Enterprise plan.
- Installation and feature checks on a physical device remain unverified.
