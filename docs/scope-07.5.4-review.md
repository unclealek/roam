# Scope 07.5.4 — Rewards, notifications and engagement polish

Implemented locally on 5 November 2026. Stopped at Scope 07.5.4. No reward engine, notification dispatcher, Secret Santa matching, database schema, RLS or hosted data changes were made. No Mind Match gameplay, Scope 07.5.5 or Scope 08 work was started.

## Audit and implementation choices

Reused the existing `reward_account` and `notification_account` services, authenticated account-resource hook, Scope 05 progression/achievement/card data, notification permission and token lifecycle, native push observer, Phase 2B theme/forms/cards/buttons/backgrounds, feedback host, Liquid Glass tabs, Reanimated and haptics. Profile already provides accurate XP progress, achievement/card counts and an entry to Rewards, so it remains the compact existing summary. Home now adds a compact progression entry backed by the existing progress RPC.

The backend has no level titles, achievement-specific XP amount, or mark-all-read operation. Those values/actions were not invented. Existing card artwork is code-based branded placeholder art; the collection shows rarity in text as well as color, locked/collected states and real unlock dates.

## Screens and components

- **Rewards:** responsive level/XP header, next-level progress, all/collected/locked filters, dated collectibles, navigable achievement previews and unlock dates, compact new-player copy, real XP and collectible history, refresh and resume recovery.
- **Collectible detail:** existing protected full-screen route and artwork, rarity, description, condition, earned date and associated game when present. Missing cards keep their safe fallback.
- **Achievement detail:** new protected `/achievement/[achievementId]` route using the existing achievement projection. It shows description/condition, lock state, date and associated game; unknown IDs show an empty state.
- **Notifications:** date groups, explicit read/unread state, category/icon, message/time and destination label. Pull-to-refresh and an accessible refresh button reuse the same list operation. Read/unread remains server-backed and now has brief confirmation haptics.
- **Preferences:** grouped update categories and quiet-time fields, accurate checking/allowed/off-or-unavailable permission copy, existing timezone/quiet-hours validation, settings entry point and once-per-form explicit permission request guard.
- **Home/Profile:** compact real progression on Home; existing detailed Profile summary retained. Full collection remains in Rewards.

New reusable pieces: `RewardCelebration`, `useRewardEngagement`, `ProgressionSummary`, `useResumeRefresh`, and account-scoped presentation acknowledgment. Shared screens gained optional pull-to-refresh; account resources gained a separate refreshing state.

## Celebrations and acknowledgment

- XP feedback displays only the positive difference between confirmed server snapshots. It is dismissible and expires after five seconds.
- Genuine level increases get a short blue celebration background, restrained static particles, an icon, and an immediately available Continue action.
- Newly earned achievement instances show their name and description. No unsupported XP amount is attached.
- Newly confirmed collectibles start concealed, then reveal existing artwork on an explicit tap with the shared short opacity/scale transition.
- Reanimated honors system Reduce Motion; feedback never awards XP or unlocks anything. Haptics occur once per newly confirmed batch; native accessibility announcements describe the new batch.
- Acknowledgment is committed before presentation. It stores only account-scoped XP/level watermarks and acknowledged reward IDs, not names, descriptions, secrets or assignments. Native storage uses the existing chunked SecureStore adapter; web uses localStorage for this non-secret metadata. Storage failures degrade to runtime memory.
- Initial history loads remain silent; repeated delivery, refresh, remount/reload, stale lower progression and account switching do not replay previously acknowledged events. Tests cover parallel observations and corrupted/unavailable storage.
- Leaving Rewards clears presentations and releases banner suppression. Backgrounded presentations hide and release suppression; animations do not run continuously while inactive. Resume refreshes only the focused screen, with no new polling loop.

## Notifications and navigation

Extended the existing native observer with a foreground-receipt callback; there is no second delivery pipeline. Foreground system banners are suppressed in favor of the existing account-scoped feedback host. Only a fetched owned notification with an enabled category can produce the generic in-app notice, and read notices stay silent. Deduplication uses notification IDs. Critical routes, detail views and active celebrations suppress interruptions. Background system notification behavior remains available.

Push content still supplies only a notification ID. Both center navigation and push taps resolve an authenticated fetched record. Existing `card:<id>` and `achievement:<id>:<scope>` event references can resolve to the appropriate protected detail route; malformed references fall back to Rewards. Route validation rejects external URLs, query strings and path traversal. Secret Santa notifications keep the authorized session route, whose existing redirect loads current server state. No private recipient data is added to previews.

## Mascot and artwork

The original approved fuzzy blue mascot is still not registered: shared asset slots are null, and existing onboarding/icon files are explicitly marked unapproved for substitution. No mascot was generated or substituted. The reusable interface now supports encouraging as well as happy/curious/waiting/celebrating states and falls back among registered approved static assets if a particular placement is missing. Rewards, achievement/card details and empty notifications are wired to that interface, but display no invented character while approved artwork is unavailable.

## Files added or modified

- `app/(tabs)/index.tsx`
- `app/(account)/achievement/[achievementId].tsx` (new)
- `src/platform/rewards/acknowledgments.ts` (new)
- `src/platform/rewards/acknowledgment-storage.ts` and `.native.ts` (new)
- `src/platform/notifications/NotificationBridge.tsx`
- `src/platform/notifications/device.ts` and `device.native.ts`
- `src/platform/notifications/presentation.ts` and `routes.ts`
- `src/platform/sessions/useAccountResource.ts`
- `src/presentation/rewards/RewardsScreen.tsx` and `CardDetailScreen.tsx`
- `src/presentation/rewards/AchievementDetailScreen.tsx` (new)
- `src/presentation/rewards/RewardEngagement.tsx` (new)
- `src/presentation/rewards/ProgressionSummary.tsx` (new)
- `src/presentation/notifications/NotificationScreens.tsx`
- `src/presentation/brand/forms.tsx`, `ui.tsx`, `RoamMascot.tsx`, `feedback-policy.ts`
- `src/presentation/brand/useResumeRefresh.ts` (new)
- `tests/reward-engagement.test.ts`, `reward-celebrations.test.tsx`, `notification-destinations.test.ts` (new)
- `tests/reward-screens.test.tsx`, `notification-device.test.ts`, `notification-presentation.test.ts`
- `e2e/rewards.spec.ts`, `e2e/notifications.spec.ts`, `vitest.config.mts`
- This report and `docs/artifacts/scope-07.5.4/` screenshots.

## Verification

- TypeScript: passed.
- ESLint: passed without warnings.
- Unit/component/database suite: **321 tests in 42 files passed**, including existing reward/privacy/matching tests.
- Configured coverage suite: **95.47% statements, 92.01% branches, 94.24% functions, 97.35% lines**, passing configured 80% thresholds. This is coverage of the configured service/domain files, not a claim of complete UI coverage.
- Playwright: **11 flows passed** across rewards, notifications and Secret Santa. Includes acknowledgment after reload, achievement details, unknown card fallback, authentication gates, reduced-motion/dark 320px viewport and Secret Santa regression.
- Production web/iOS/Android exports passed. Native exports prove bundling, not Android runtime/device behavior.
- iPhone 18 Pro simulator: clean Metro reload and updated real-account Rewards layout visually verified. Simulator left on Rewards; Metro remains on localhost:8081.
- Browser screenshots and celebration examples use fixture responses. No XP or collectibles were fabricated on the hosted account, and the existing ForTest group/lobby was not changed by this scope.

## Remaining verification and limitations

- Approved mascot exports remain missing; artwork integration cannot be visually completed without them.
- Real push receipt/deduplication on iOS/Android hardware, OS permission interactions, VoiceOver traversal, maximum Dynamic Type, native Reduce Transparency/high contrast, haptic feel, Android runtime and real interruption timing still require physical-device checks.
- The simulator verified real zero-XP presentation; positive reward celebrations were verified with component/browser fixtures and local database tests, not a new hosted completed-game award.
- No bulk mark-all-read control was added because the backend does not support it. No new level title or achievement XP was invented.
- Browser storage clearing or unavailable persistence affects acknowledgment durability; initial snapshots still seed silently, and runtime memory deduplicates until restart.

## Screenshots

Browser examples use fixtures; the native screenshot uses the real account.

1. [Rewards overview](artifacts/scope-07.5.4/rewards-overview.png)
2. [Collectible collection](artifacts/scope-07.5.4/collectible-collection.png)
3. [Collectible details](artifacts/scope-07.5.4/collectible-details.png)
4. [XP feedback](artifacts/scope-07.5.4/scope0754-xp.png)
5. [Level-up celebration](artifacts/scope-07.5.4/scope0754-level-up.png)
6. [Achievement unlock](artifacts/scope-07.5.4/scope0754-achievement.png)
7. [Notification center](artifacts/scope-07.5.4/scope0754-notification-center.png)
8. [Notification preferences](artifacts/scope-07.5.4/scope0754-notification-preferences.png)
9. [Collectible reveal](artifacts/scope-07.5.4/scope0754-collectible-reveal.png)
10. [Achievement details](artifacts/scope-07.5.4/scope0754-achievement-details.png)
11. [Dark small-screen Rewards](artifacts/scope-07.5.4/scope0754-rewards-dark-small.png)
12. [iOS simulator Rewards](artifacts/scope-07.5.4/rewards-simulator.png)
