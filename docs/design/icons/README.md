# Roam hybrid icon system — implementation review

Implemented 5–6 November 2026. Brand remains Roam blue/ivory; mascot source and assets are unchanged. No animations, gameplay rules, reward calculations, account logic, authentication code or database changes were introduced.

## Delivered

- 21 original SVG identities on one 32-unit grid: five navigation icons, three game identities, reward symbols, six achievement identities and supporting artwork. See `icon-family.png`.
- One type-safe `RoamIcon` API with size/color, selected/inactive/filled/duotone, disabled, inverse and automatic light/dark support. Decorative icons are hidden from assistive technology; labelled icons expose one accessible image.
- `FunctionalIcon` centralizes Ionicons. All direct third-party icon imports in presentation code now live in that adapter. Search/settings/notifications/navigation/form/overlay actions share one family.
- Custom tab icons for JS tabs; generated 24pt @1x/@2x/@3x native image pairs retain native iOS tabs and Liquid Glass. No navigation routes or labels changed.
- `AchievementBadge` supports unlocked, locked, progress, compact and detail sizes. Existing server identities have explicit mappings; unfamiliar keys get a safe original badge.
- `RoamIllustration` supports approved local raster assets and explicit original-vector fallbacks. It requires a supplied asset, approved status and license evidence before switching to premium artwork.
- Persisted group icon keys still work; their emoji rendering was replaced with original group art or matching functional vectors.
- Existing Home/group/game/Secret Santa/reward/profile/settings/notification presentation integrated. Future game identities and streak/daily-challenge/history symbols are reusable without inventing unsupported games, data or product features.

## Usage

```tsx
<RoamIcon name="home" size={24} variant="active" />
<FunctionalIcon name="settings" size={22} />
<AchievementBadge name="team-player" state="locked" size={56} label="Team Player locked" />
<RoamIllustration name="secret-santa" size={96} label="Mystery gift" />
```

Use an accessible label on standalone meaningful artwork. Inside a labelled button, leave artwork decorative. Do not add touch handlers to icons; the surrounding control owns its action, disabled state and touch target.

Run `npm run icons:export` after changing registry geometry. This regenerates original SVG files, native tab PNGs and the contact sheet. `react-native-svg` 15.16.0 is the version specified by the installed Expo compatibility manifest. `@resvg/resvg-js` is development-only and is not bundled into the app.

## Files changed

- `src/presentation/icons/`: central API, original registry, functional adapter, achievement badges, group symbols, illustration slots, native asset mapping and icon tokens.
- `assets/icons/`, `assets/illustrations/README.md`, `scripts/design/export-icons.mjs`: generated source/raster assets, premium destinations and repeatable export.
- `src/presentation/navigation/BrandTabs{,.ios}.tsx`: original tab identities while preserving the existing navigation implementations.
- `src/presentation/brand/{ui,RoamButton,AdventureCard,GroupCard,SessionCard,forms,overlays,ToastFeedback}.tsx`: shared branded/functional integration and compact icon/button spacing.
- `src/presentation/{games,groups,rewards,profile,notifications,secret-santa}/`: game illustration slots, reward badge integration, group selector rendering, settings/action icons. Only presentation is changed.
- `app/(tabs)/index.tsx`: branded section icons and explicit empty-state illustration slots.
- `package.json`, `package-lock.json`, iOS CocoaPods/project generated integration: SVG runtime and development-only exporter.
- Icon tests plus existing group/rewards browser selectors updated to the textual icon labels and existing tap-to-begin onboarding flow.

## Verification

- TypeScript and ESLint pass without warnings.
- Full unit/integration suite: 335 tests in 45 files pass. Focused checks after the final contrast/spacing refinements: 30 tests pass.
- Icon coverage run: 90.32% statements/lines, 90.62% branches, 88.88% functions; above the 80% thresholds. Native asset tests verify all 30 PNG dimensions, selected/inactive differences, and SVG/source consistency.
- 19 distinct browser scenarios pass across the scope's checks: light/dark at 320/430px, tabs/catalogue, groups/profile, invitations, rewards/collectibles/protected links, and the explicit custom SVG tab-selection test. Local fixture data only; screenshots in `screenshots/`.
- Web export and Android Hermes bundle export succeed. Android emulator/physical-device rendering remains pending.
- iOS simulator native build succeeds with `RNSVG` linked. Isolated native rendering check confirms original SVGs at 24px, selected/inactive raster tab exports, game artwork, and all six locked/unlocked badges. `screenshots/native-icon-check.png` records the check without account data. Native authenticated tab navigation and real provider sign-in were not re-tested; browser equivalents pass. Physical iOS remains pending.
- The local simulator binary uses Xcode's simulator entitlement handling with the existing Apple sign-in/notification entitlements plus simulator-only application/keychain identifiers in a temporary file. No production signing settings or authentication source changes were made for the icon system.

## Asset and license status

Read [ASSET-MANIFEST.md](ASSET-MANIFEST.md) for every original asset and all ten missing premium illustration destinations, dimensions and licensing status. Original vector artwork is implemented. Ionicons is the existing MIT-licensed utility fallback with retained notices. No Streamline/IconScout purchase, scrape or unlicensed download was performed. No premium illustration is represented as approved or bundled.

No EAS build, TestFlight upload or hosted deployment was performed.
