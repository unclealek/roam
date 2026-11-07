# Scope 07.5 — Phase 2B: shared visual and interaction system

## Audit — 4 November 2026

- Welcome/authentication, Home, catalog, Groups and Profile use Phase 1 semantic colors, system typography and native iOS tabs. Welcome has its own decorative background, while most other screens use plain backgrounds.
- Rewards/collectible details and Notifications/preferences still import the legacy `presentation/ui.tsx` and static tokens. Their panels, text, buttons and loading/error states do not follow dark mode consistently.
- Phase 1 `RoamButton` has primary/secondary/destructive compatibility flags but no shared sizes, loading/success state or async guard. Card press feedback already uses Reanimated and system reduced motion.
- Group confirmations and typed account deletion use inline panels. No shared dialog or sheet exists. Native invitation sharing already uses the system share sheet and must remain direct.
- Notification Center displays real owned notifications and validated deep links, but lacks category icons and timestamps. Native notification handling already presents foreground OS banners; an additional in-app foreground push banner would duplicate them. APNs/FCM registration, preferences, quiet hours, delivery and privacy-safe server templates remain untouched.
- Home already loads real notifications, sessions, catalog and groups independently and has contextual session actions. Retain that structure and one dominant action per section.
- `RoamMascot` deliberately has empty approved-art slots. The only existing image files remain the previously rejected generated onboarding image and older icon. Do not wire either as a substitute or generate a new mascot. Supported presentation states can share the approved static asset when supplied.
- Existing Secret Santa create/join/lobby/recipient layouts retain legacy styles. This phase does not redesign their gameplay/reveal screens.

## Plan and visual direction

Preserve electric blue #086BFF, navy #081B58, off-white #FFFAF4, pale blue #DCEEFF and the existing accessible dark palette. Use the system type scale and solid readable surfaces. Standard backgrounds have static pale-blue shapes; elevated forms add quiet surfaces. Celebration and mystery variants use restrained native gradients without continuous animation; mystery stays reserved for future reveal work.

Extend the existing button rather than introducing another button family. Add shared dialog/sheet primitives using React Native Modal, native iOS page sheets and safe fallbacks. Keep native sharing. Add one account-scoped nonblocking feedback host with deduplication and timeouts; avoid duplicating OS notification banners or presenting activity over critical forms/reveals. Migrate existing Rewards/Notifications into the shared theme and reuse existing operations. Apply the same background to Welcome and phase screens. Keep native Liquid Glass navigation and compact glass controls.

Implementation, verification and release results are recorded below as work completes.

## Final 07.5.2B implementation

The supplied seven-image descriptions were available, but the images themselves were not attached in the current message. The audit therefore uses those concrete observations plus fresh application captures; it does not claim a pixel comparison to unseen reference files.

### Layout and navigation

Installed versions: Expo 58.0.21, React Native 0.88.0, Expo Router 58.0.28, react-native-screens 4.30.0 and safe-area-context 5.10.1. iOS already uses `expo-router/native-tabs`; this is genuine system navigation with Liquid Glass on supported iOS, rather than a blur imitation. Existing route names and native triggers are preserved. Android/web keep their existing normal-flow React Navigation bar; no extra navigation dependency or second tab bar was added.

`brand/ui.tsx` removes the fixed 112-point scroll spacer. A flex-constrained first ScrollView uses automatic UIKit content/keyboard insets and one 24-point content gutter. Form wrappers do not add a second KeyboardAvoidingView adjustment; Android uses its existing window resize behavior. Expo Router's installed NativeTabsView applies automatic inset adjustment to the first nested scroll view; native tab/safe-area height is owned by UIKit. The JS fallback bar occupies layout space and already includes the measured safe-area bottom inset. Platform-specific native geometry still requires a device check; browser tests measure final controls against the actual fallback tab bar bounds.

### Components and screens

- Extended `RoamButton`: six variants, three sizes, 44-point minimum target, press/focus feedback, async lock, busy/disabled/success states, accessible labels and retryable error handling. New action-primary tokens preserve electric-blue/white primary buttons in both themes while dark-mode accent text remains light blue.
- `RoamBackground`: standard, form, elevated, celebration and reserved mystery variants; static calm decoration, no continuous animated backgrounds or full-screen blur. Contrast and transparency preferences suppress decoration appropriately.
- Refined existing cards and screen headers with compact spacing, tonal solid surfaces and lighter outlines. Existing system type scales support font scaling.
- Home keeps real independent notification/session/catalog/group resources, adds an actual unread badge and useful empty-state CTA, and presents compact game discovery. No fabricated activity or metrics.
- Groups keeps creation, membership, safe invitation preview and permitted activity unchanged; uses compact cards/member initials, a small Join with Code action and a single-member invitation prompt.
- Games preserves registry and details/setup routes with a smaller neutral game symbol pending approved artwork. Only existing registered games appear.
- Rewards and collectible details now use the shared semantic theme, responsive grid and readable rarity artwork. Refresh is a small ghost action. No XP ledger or reward-awarding changes.
- Profile uses a smaller player header, compact edit action, shared XP progress and wrapping real statistics. Settings remain grouped and sign-out is destructive. Edit Profile has one conventional leading back action, compact initials, focused field styling, unchanged-save disablement, busy state and confirmed-save feedback. No unsupported fields or lifetime-games metric are invented.
- Shared `RoamDialog` supports information, confirmation, destructive, success and error states with accessible focus and async locks. Existing group/member/delete/cancel operations use it. `RoamSheet` uses iOS native page sheets, scrollable safe-area/keyboard handling and Android/web fallback; group picker/profile actions use it. Invitation sharing remains the native share sheet.
- Notifications/preferences use real read/unread/category/time/deep-link data and shared errors/loading. Account-scoped `ToastFeedback` presents one short, deduplicated banner **above** screen content, reserving layout space instead of covering system navigation or keyboard. Reduced-motion transitions and accessibility announcements are included. Critical forms/reveals and active overlays suppress unsolicited activity presentation.
- Native foreground notification policy suppresses OS banners during critical foreground UI only; background banner/list behavior, APNs/FCM delivery, permissions, quiet hours and server templates are preserved. Web activity feedback does not duplicate native OS foreground banners.
- Reuses existing Reanimated and haptics, short press/fade transitions, success haptics and no routine confetti. Secret Santa gameplay/reveal screens are not redesigned.

### Artwork gap

`RoamMascot` keeps the original-asset interface with `welcome`, `peek`, `small` slots and static supported states. All approved standalone slots remain null. Required: approved transparent fuzzy electric-blue mascot exports for welcome, peek and small empty/success states (or one approved static pose that can safely fill those placements), plus approved Secret Santa catalog artwork. The generated onboarding PNG and older app icon are not approved substitutes. Small empty-state mascot slots render nothing while unavailable; the existing welcome reserved space remains. No new character or frames were generated.

### Verification boundaries

302 unit/component tests currently pass. TypeScript and lint checks, combined web/iOS exports and browser captures are being finalized below. Browser fixtures exercise existing client operations without changing hosted data. Physical-device performance, VoiceOver, native Dynamic Type, native keyboard/safe-area/tab geometry, iOS Liquid Glass, Android fallback rendering, system reduced transparency/increase contrast and actual APNs/FCM delivery remain device verification tasks. A signed native build/Apple availability will be reported independently from UI/device proof.

## Release candidate

Version 0.1.0 (6), isolated source `/private/tmp/roam-testflight-20261104-reviewed-build6`, 114 source files. Manifest SHA-256 `2af1d73f35d0ac542c2ead0aeffe31eb676119cde181aa66216d0b2563d6fefa`. See [application file inventory](files-changed.json), [source manifest](../../releases/testflight-0.1.0-build6-manifest.json) and release report when complete. The first local build was intentionally stopped before upload to remove duplicated keyboard adjustment; it is not a submitted build.

Configured platform coverage passes: 95.38% statements, 92.17% branches, 94.38% functions, 97.03% lines. This is coverage of the configured platform module list, including the new foreground presentation policy; it is not a percentage of every UI file. UI component tests and browser scenarios are recorded separately.

Final visual review also corrected the dark feedback-host surround before upload. Earlier local archives were canceled; neither was submitted. The reviewed snapshot above is the release source.

## Updated browser captures

These are React Native Web captures with disposable fixture data, not iOS or physical-device screenshots. Each screen is also captured at width 320 in light/dark with reduced motion. The table links width 430; settings and collection captures are scrolled to demonstrate reachability.

| Screen | Light | Dark |
| --- | --- | --- |
| Home | [Light](screenshots/home-light-430.png) | [Dark](screenshots/home-dark-430.png) |
| Groups | [Light](screenshots/groups-light-430.png) | [Dark](screenshots/groups-dark-430.png) |
| Games | [Light](screenshots/games-light-430.png) | [Dark](screenshots/games-dark-430.png) |
| Rewards | [Light](screenshots/rewards-light-430.png) | [Dark](screenshots/rewards-dark-430.png) |
| Profile | [Light](screenshots/profile-light-430.png) | [Dark](screenshots/profile-dark-430.png) |
| Edit Profile | [Light](screenshots/edit-profile-light-430.png) | [Dark](screenshots/edit-profile-dark-430.png) |
| Profile settings | [Light](screenshots/profile-settings-light-430.png) | [Dark](screenshots/profile-settings-dark-430.png) |
| Collectible clearance | [Light](screenshots/collection-light-430.png) | [Dark](screenshots/collection-dark-430.png) |
| Destructive dialog | [Light](screenshots/confirmation-light-430.png) | [Dark](screenshots/confirmation-dark-430.png) |
| Profile sheet | [Light](screenshots/profile-sheet-light-430.png) | [Dark](screenshots/profile-sheet-dark-430.png) |
| Group sheet | [Light](screenshots/group-sheet-light-430.png) | [Dark](screenshots/group-sheet-dark-430.png) |
| Notification banner | [Light](screenshots/copy-feedback-light-430.png) | [Dark](screenshots/copy-feedback-dark-430.png) |
| Loading button | [Light](screenshots/loading-button-light-430.png) | [Dark](screenshots/loading-button-dark-430.png) |
| Home empty state | [Light](screenshots/empty-state-light-430.png) | [Dark](screenshots/empty-state-dark-430.png) |
| Notification center | [Light](screenshots/notifications-light-430.png) | [Dark](screenshots/notifications-dark-430.png) |

Relative to the supplied descriptions: rewards now shares the dark palette; headers/cards/art regions are smaller; Home emptiness offers an action; Join with Code is compact; Profile stats wrap into columns and settings move upward; Edit Profile uses one leading back control and a dirty-state save; final controls/collectibles are checked against actual fallback tab bounds. Approved illustration use remains blocked by missing assets.

Full browser regression: **53/53 passed** (3.5 minutes), including existing Secret Santa routing/reveal regression coverage without redesigning those screens. Latest targeted component check: **19/19 passed** across shared controls, profile and generic session screens.

Final visually reviewed export passes the same **4/4** light/dark scenarios again (51.5 seconds), including held async save, no-change save disablement, sheets/dialogs, empty state, copied/saved feedback and final-control/collectible clearance. Screenshot hashes and checks are saved in [verification.json](verification.json). Expo Doctor: 19/20; remaining package alignment recommendations are SDK patches and safe-area-context ~5.11.1 versus installed 5.10.1. The tested graph is preserved.

Minimum missing mascot deliverable: the **original approved fuzzy blue character as a transparent PNG**, preserving its two antennae, glossy eyes, hands and texture. Suggested integration path: `assets/brand/roam-mascot.png` (not currently present); one approved static pose can fill all three presentation slots. Separate welcome/peek/small exports are optional. Approved Secret Santa catalog artwork is also absent; the compact neutral gift symbol remains until supplied.

Signed local EAS/Xcode archive succeeded. Actual IPA checks pass: `com.moredata.roam` / 0.1.0 (6), iOS 16.4 minimum, production APNs, Apple sign-in, beta reporting, debugging disabled, unrestricted store provisioning, expected hosted backend and strict code signature. IPA: 18,044,846 bytes; SHA-256 `db353ccc724b58da6c8e2f03512f1fd9d5a076881e6e4194c433b22dffd2e3dc`. Retained in ignored `.release-artifacts/roam-0.1.0-build6.ipa`. Fresh Apple preflight confirms no existing build 6. Upload started once; Apple processing/internal availability remain pending.

Apple accepted the single build 6 upload on 4 November 2026 at **21:23:19 Europe/Helsinki**. Fastlane is waiting for processing; internal availability is not yet claimed. No duplicate upload was made.

## Released — 4 November 2026

Build **0.1.0 (6)** is **VALID / IN_BETA_TESTING** in a fresh direct Apple lookup. Apple build ID: `f6351da6-7c49-4f78-8b52-6fab02e3357c`. Fastlane upload/processing/changelog completed successfully with exit 0. External state remains `READY_FOR_BETA_SUBMISSION`; no external review was submitted. No duplicate binary upload.

Final checks: TypeScript and ESLint pass with zero warnings; 302/302 tests across 39 files; 53/53 full browser regressions; 4/4 repeated final visual scenarios; 19/19 final targeted component checks; web/iOS Hermes exports; signed iOS archive and strict IPA verification. Expo Doctor 19/20 with the documented SDK version-alignment warning. 64 browser captures are saved. Missing original artwork and physical-device checks remain as documented.

Stopped after Scope 07.5.2B. Scope 07.5.3 and Mind Match were not started.
