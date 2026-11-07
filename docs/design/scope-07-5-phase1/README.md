# Scope 07.5 — Phase 1

## Implementation and boundaries

The existing Expo Router application is preserved. Welcome/onboarding/sign-in, authenticated Home and Games Catalog share a warm off-white/electric-blue theme with deep navy dark appearance, system typography, flexible text, consistent controls and responsive cards. No backend, authentication transport, database, scheduling, matching, rewards or game service was changed. Secret Santa setup/lobby/draw/reveal, group management and Rewards layouts are left for later phases. Their existing legacy content styling remains; the surrounding navigation follows system appearance.

Home loads notifications, sessions, catalog and groups independently through the existing account-scoped resource hook. It shows up to three ongoing sessions and three groups, with links to the full existing destinations. Contextual session labels derive from the real generic status. No fabricated completion percentage is shown: the summary service does not expose activity progress. Catalog entries are filtered by the existing registry/service. Only Secret Santa is currently registered; no standalone Mind Match/Secret Agent or fictional future cards are added. Game details remain accessible even when a catalog entry is not playable, displaying the existing availability/permission handling.

## Inspection and design decisions

- Installed: Expo 58.0.21, React Native 0.88.0, Router 58.0.28, Screens 4.30.0, Reanimated 4.7.1, Worklets 0.13.0.
- Entry routes: `/welcome`, `/sign-in`, `/auth/callback`. Protected tabs and account routes retain their authentication gates and pending Secret Santa invitation behavior.
- Home: `app/(tabs)/index.tsx`; catalog: `app/(tabs)/games.tsx`. Existing `/games` links remain valid; only the tab label becomes Play.
- Existing static tokens remain for later-phase screens. New semantic tokens are re-exported from `tokens.ts`; phase screens use `useRoamTheme()` and follow the OS appearance live. `app.json` enables automatic appearance. The root navigation theme and status bar adapt too.
- Palette: electric blue `#086BFF`, navy `#081B58`, secondary `#66B8FF`, pale `#DCEEFF`, ivory `#FFFAF4`. Dark surfaces use `#09132D`, `#111F40`, `#192B51`; action blue brightens for contrast. Typography uses the native system font, with no disabled font scaling or single-line truncation of essential text. Body and button color pairs have automated WCAG 4.5:1 contrast checks.
- Layout: greeting/actions → current games → discovery → groups. Catalog uses a single prominent registered-game card, rather than copying reference mockups that imply unsupported games. Artwork is intentionally not fabricated.

## Mascot and illustration assets

**Approved standalone mascot exports are missing.** The provided photos are the identity reference, not usable transparent production artwork. `assets/onboarding/roam-mascot.png` was generated in the previous work and is not treated as approved. `assets/icon.png` contains an older differing character. Neither is used as the mascot in these screens. The app icon itself is unchanged.

`RoamMascot` has `size`, `placement`, `accessibilityLabel` and optional `animationState` props. `mascotAssets` is the sole replacement point for welcome, peek and small exports. Until supplied, it reserves responsive pale-blue artwork space and exposes no misleading image label. It stays static; no invented mascot or substitute icon is shown. The `entrance` state is reserved until approved art can be reviewed. The welcome artwork is therefore **not final brand sign-off**.

Approved Secret Santa artwork is also missing. Its card uses a neutral gift symbol, clearly separate from the mascot. Replace this with approved artwork in a future asset pass; no generated game illustration is used.

## Native Liquid Glass and fallbacks

- iOS: `expo-router/native-tabs` (`NativeTabs`, SDK 58 API) provides the real UIKit tab bar. System Liquid Glass on iOS 26+ is native, not a blur imitation. Earlier iOS uses the native standard material. Selected SF Symbols and text use the theme's blue; tabs are Home, Groups, Play, Rewards, Profile.
- Android/web: existing Expo Router JavaScript tabs with Ionicons, solid readable themed background and safe-area padding. No duplicate bar.
- Headers: `GlassSurface.ios.tsx` uses Expo `GlassView` for compact navigation controls only, gated by both runtime/compiled glass availability checks. Android/web use the solid counterpart.
- Reduce Transparency and Increase Contrast: header controls begin opaque until preferences resolve and switch to solid when either is enabled. Listeners respond to subsequent changes. UIKit owns iOS 26 tab accessibility behavior; `blurEffect`/background overrides only control older iOS native materials. This system distinction is intentional.
- Haptics: best-effort native selection feedback on tabs and card actions; unavailable hardware/errors do not block navigation. No web vibration.
- Motion: short Reanimated card press feedback uses `ReduceMotion.System`; native navigation supplies platform transitions. No looping mascot motion or extra animation framework.
- Added SDK-compatible `expo-glass-effect`, `expo-haptics`, `expo-system-ui`, plus direct `@expo/vector-icons` dependency. **A new native development/store build is required. Build 4 does not contain Phase 1.** No release/version bump, TestFlight upload or deployment was performed for this phase.

Verified API references: [Expo native tabs](https://docs.expo.dev/router/advanced/native-tabs/), [SDK 58 native tab props](https://docs.expo.dev/versions/v58.0.0/sdk/router/native-tabs/), [SDK 58 GlassEffect](https://docs.expo.dev/versions/v58.0.0/sdk/glass-effect/). Installed declarations were checked alongside the official documentation.

## Files created

- `src/presentation/brand/theme.ts`: palettes, typography, layout and theme hook.
- `src/presentation/brand/ui.tsx`: themed screen/header/button/card/section/loading/error/empty/progress primitives.
- `src/presentation/brand/RoamMascot.tsx`: approved-asset slots and clean placeholder.
- `src/presentation/brand/GlassSurface.tsx`, `.ios.tsx`: solid and native glass controls.
- `src/presentation/brand/useAccessibilityPreferences.ts`, `feedback.ts`: native preferences and haptics.
- `src/presentation/brand/GroupCard.tsx`, `SessionCard.tsx`: real summary presentations.
- `src/presentation/navigation/BrandTabs.tsx`, `.ios.tsx`: shared destinations and native iOS tabs.
- `tests/brand-components.test.tsx`, `tests/fixtures/brand-native-mocks.tsx`: asset safeguards, disabled controls, contrast and native rendering adapters.
- `e2e/brand-phase1.spec.ts`: appearance/phone-size/data/navigation checks.
- This report and `screenshots/`: retained browser captures using explicitly disposable test data.

## Files modified

- `app/_layout.tsx`, `app.json`: adaptive navigation/status appearance.
- `app/(tabs)/_layout.tsx`: preserved auth gate, shared navigation.
- `app/(tabs)/index.tsx`, `games.tsx`: Home and catalog.
- `app/welcome.tsx`, `app/sign-in.tsx`, `src/presentation/welcome/WelcomeUI.tsx`: shared theme, approved-asset placeholder, existing provider entry.
- `src/presentation/games/GameCard.tsx`, `MyGames.tsx`, `src/presentation/tokens.ts`: themed registered-game/session cards and semantic theme exports.
- `package.json`, `package-lock.json`: native UI dependencies.
- `tests/game-screens.test.tsx`, `tests/screens.test.tsx`: native rendering mocks and registered-only catalog expectations.
- `e2e/games.spec.ts`, `e2e/foundation.spec.ts`, `e2e/button-audit.spec.ts`: Play tab label and removal of fictional future-game expectations.
- `README.md`, `docs/welcome-flow.md`, `docs/next-release-fixes.md`, `WORK_LOG.md`: current design pointers and local implementation/release boundaries.

## Verification

- TypeScript, ESLint and changed-file formatting: passed.
- Final unit suite: **287/287 passed across 36 files**, including three new asset/control/contrast checks.
- Full browser suite: **45/45 passed**, including six new light/dark and 320px/430px checks. Existing real-provider callbacks are represented by fixtures in this suite.
- iOS Hermes export: passed. Web export: passed.
- Screenshots: `screenshots/phase1-home-{light,dark}-{320,430}.png`, corresponding catalog captures, and welcome/login light/dark captures. Browser captures use test fixtures, not player activity. ScrollView screenshots show the viewport; scroll to see subsequent Home sections.
- Native simulator preview: **unsigned Release build succeeded** with Xcode/iOS Simulator SDK 27.1; launched on the available iPhone 18 Pro iOS 27 simulator. Reviewed actual UIKit floating tabs, SF Symbols, selected blue tint and native header glass in light and dark. Captures: `screenshots/phase1-native-tabs-light.png` and `phase1-native-tabs-dark.png`. The preview app was removed and light appearance restored after capture. Isolated harness at `/private/tmp/roam-phase1-native-preview`, bundle `com.moredata.roam.phase1preview`, does not load accounts or gameplay. It exists only to inspect actual UIKit tabs/GlassView on the available simulator. It is not production source and not an end-to-end native app verification.

## Remaining verification / limitations

Supply and review approved transparent mascot and Secret Santa illustration assets. Verify the new app build on small/large physical iPhones, native system light/dark, larger Dynamic Type, VoiceOver, Reduce Motion, Reduce Transparency and Increase Contrast. Verify Apple and Google sign-in, invitation continuity, actual haptics and native glass on supported hardware. Android navigation/dark appearance remains a device check. Shared navigation changes surround later-phase screens, whose content layouts and legacy styling intentionally remain unchanged.

Phase 1 only. No later-phase gameplay or Rewards redesign.
