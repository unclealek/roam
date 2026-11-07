# Scope 07.5 — Phase 2: Groups, invitations and player profile

## Implementation

Refactored existing group routes rather than adding parallel group flows. Groups now uses the Phase 1 off-white/electric-blue and navy/dark tokens, system typography, responsive cards and native-glass header controls with opaque accessibility/platform fallbacks. Existing native iOS tabs and Android/web tabs are unchanged.

- **Groups:** Your Groups header, approved copy, create/join actions, real member counts, initials and visible active generic game-session counts. Each card loads permitted details through the existing `get_group` RPC. This is one additional request per group; no bulk private-profile query or new backend API. Details failures retain the group card with retry. Empty state uses the existing approved-asset slot.
- **Create and settings:** keyboard-avoiding forms, inline empty-name feedback, existing server/service validation, disabled/busy controls, compact icon choices and optional vice-owner shortcut. No image upload or new field. Groups persist independently of games. Existing vice setup can open Members immediately after creation when explicitly selected; normal creation opens Group Detail.
- **Group detail:** primary Play a Game, secondary Invite Friends, description/count, initialled member preview with owner/vice roles, full Members route, authorized settings, active/past generic sessions, existing open gift exchanges, optional session-ID join, and confirmed leave behavior. Generic session results are restricted by the existing RPC to sessions the caller belongs to. Zero visible sessions does not claim that no private sessions exist.
- **Members:** permitted display names and initials, owner/vice/member roles, existing owner-only confirmed appointment/removal/ownership transfer. A vice remains an ordinary member until succession.
- **Invitations:** existing code-generation/expiry/use-limit/revocation flow, selectable code, clipboard, native share API, safe preview and explicit join confirmation. Existing members see an Open group action instead of redundant redemption when membership data is available; the server remains the final authority. Success/copy/share feedback uses best-effort haptics and a short Reanimated fade with system reduced motion. Canceled sharing produces no success claim; reported sharing never claims delivery. Codes remain in screen memory, outside URLs/logs/storage. No group invitation URL is established, so sharing uses the existing code-based message.
- **Profile:** owner profile, initials, real level/XP/next-level progress, earned achievement count, owned card count and actual joined groups. Resource failures show retry rather than fabricated zero balances. Rewards details stay in the existing Rewards tab.
- **Edit Profile:** new dedicated route around the existing display-name service and validation, with save acknowledgement and Back to Profile. No photo/bio schema support exists.
- **Privacy & account:** dedicated working destination explaining visible information and preserving the existing guarded account-deletion flow. Notifications links to the existing preferences route. Sign-out retains push-device disable then Supabase sign-out; auth gates handle the transition.

## Navigation

Existing `/groups`, `/group/create`, `/group/join`, `/group/[groupId]`, `/members`, `/settings`, `/invites` routes remain. Play a Game passes `groupId` through `/games` → `/game/[gameId]` → existing game setup. Setup still validates membership server-side. Catalog entry without group context remains unchanged. Added `/edit-profile` and `/privacy` under the existing authenticated account stack. Profile opens Rewards through tab navigation. Shared back controls pop history with a sensible Groups/Profile fallback for direct links.

No backend, RLS, migrations, auth transport, dependencies, version numbers, matching/draw/reveal logic, hosted deployment or release changed. Phase 3 has not started.

## Reused and new components

Reused `RoamScreen`, `RoamHeader`, `RoamButton`, `RoamCard`, `SectionHeading`, `Body`, `ProgressIndicator`, error/loading/empty states, `RoamMascot`, `GlassSurface`, `useRoamTheme`, `selectionFeedback`, `useAccountResource`, and all existing services.

New shared `brand/forms.tsx` supplies keyboard-safe account/group screen wrappers and themed fields; `brand/PlayerAvatar.tsx` supplies safe initials. `GroupCard` gains optional permitted details. Internal group summary/member rows and profile stat/settings rows stay small. The former group-only Secret Santa fragment is moved to `groups/GroupLobbies.tsx`, retaining its old export as a re-export; Secret Santa screens themselves are unchanged.

## File inventory

Created:
- `src/presentation/brand/forms.tsx`, `PlayerAvatar.tsx`
- `src/presentation/groups/GroupLobbies.tsx`
- `src/presentation/profile/ProfileScreens.tsx`, `PrivacyScreen.tsx`
- `app/(account)/edit-profile.tsx`, `privacy.tsx`
- `tests/profile-phase2.test.tsx`, `e2e/brand-phase2.spec.ts`
- This report and `screenshots/`.

Modified:
- `src/presentation/groups/GroupScreens.tsx`
- `src/presentation/brand/ui.tsx`, `GroupCard.tsx`
- `src/presentation/games/GameCard.tsx`
- `src/presentation/secret-santa/SantaScreens.tsx` (group fragment re-export only)
- `app/(tabs)/groups.tsx` remains the original route wrapper; no changes required.
- `app/(tabs)/profile.tsx`, `games.tsx`; `app/(account)/game/[gameId].tsx`
- `tests/group-screens.test.tsx`, `screens.test.tsx`, `secret-santa-screens.test.tsx`, `fixtures/brand-native-mocks.tsx`
- `e2e/groups.spec.ts`, `foundation.spec.ts`, `button-audit.spec.ts`
- `WORK_LOG.md`, `docs/next-release-fixes.md`.

## Verification

- TypeScript and ESLint passed on final source.
- Changed source/test files passed Prettier checks.
- `npm run test:coverage`: **292/292 tests across 37 files passed**. Configured platform/service coverage: 95.12% statements, 91.99% branches, 93.60% functions, 96.79% lines. These percentages apply to the configured coverage include list, not every presentation file.
- Final combined web and iOS Hermes export passed (`/tmp/roam-phase2-final-export`), with dummy local test configuration. This proves bundling, not a signed native build or hosted integration.
- Final full browser regression: **49/49 passed** (2.6 minutes), including four new 320px/430px light/dark Phase 2 navigation/identity scenarios.

Browser fixtures are disposable local data and never represent hosted players. Screenshots show scroll viewports; lower sections are reached by scrolling. Browser captures verify layout, not UIKit or physical-device behavior.

## Known limitations and required device checks

- **Approved mascot artwork is still missing.** Phase 1 explicitly rejects `assets/onboarding/roam-mascot.png` and the older icon as substitutes. The existing pale-blue asset placeholder remains; no character was invented. Final mascot brand sign-off remains blocked until approved transparent assets are supplied.
- Only display name is editable. Profile/group image uploads and bios are unsupported; no decorative upload controls were added.
- No authoritative lifetime games-played metric is exposed by the current services across the generic session engine and separate Secret Santa experience. It is omitted. Joined groups and rewards are real supported metrics. No online presence, appearance preference or support destination was invented.
- Invitation errors deliberately remain the backend's combined invalid/expired/revoked/exhausted message. The backend does not safely distinguish these cases; no new error oracle or full/closed status was fabricated.
- Profile and group data come from existing client services. Hosted multi-account creation/join/management/edit checks were not performed in this phase. Local database tests cover existing authorization; browser services are fixtures.
- Physical-device discovery using `xcrun devicectl list devices` timed out initializing CoreDeviceService. No physical iPhone testing is claimed. Verify real iPhone small/large layouts, keyboard avoidance, VoiceOver/Dynamic Type, Reduce Motion/Transparency/Increase Contrast, native share cancellation/success, clipboard, haptics, offline/reconnect, real multi-account flows, sign-out and native Liquid Glass on a new build. Android remains a device check too.
- Existing installed TestFlight builds do not prove these local UI changes are shipped. No build/submission/version bump was made.


## Subsequent authorized release

The user then authorized Phase 2 TestFlight followed by Phase 2B and a second TestFlight build. Phase 2 is packaged as 0.1.0 (5); see `../../releases/testflight-0.1.0-build5.md` for signing/upload/Apple status. The release repairs an existing manifest/lock mismatch by pinning the already installed and tested vector-icons 15.1.1 and synchronizes Expo/native build metadata. This is separate from Phase 2B implementation.
