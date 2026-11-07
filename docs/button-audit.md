# Roam button interaction audit — 27 October 2026

## Scope and method

Tested the current Scope 01–05 interface in a fresh Expo web export at a 390 × 844 viewport. The audit uses an isolated HTTP fixture backend, disposable accounts/groups and real browser clicks. It never forwards requests to hosted Supabase. Destructive confirmation paths delete only in-memory test records.

`e2e/button-audit.spec.ts` contains 18 audit scenarios and attaches the actual button/tab/switch click log to each test result. Existing browser regressions run alongside these scenarios. Manual in-app browser checks also reproduced the device-settings exception and verified the corrected visible acknowledgement.

## Fixes

1. **Device notification settings on web:** `Linking.openSettings` was unavailable and threw before the rejection handler ran. The browser now explains where to manage native device permissions; native calls also catch synchronous errors.
2. **Notification actions:** slow read/open requests left buttons active with no busy feedback. Actions now show progress, disable repeat actions, prevent duplicate submissions and expose retryable errors. Notification links to the center do not stack another copy of the same screen. Added explicit Home/settings return buttons.
3. **Invitation refresh:** refreshing the parent resource unmounted the invitation panel and discarded the newly generated plaintext code. Refresh now updates invite status in place, preserving the code, clearing it if revoked and withdrawing stale owner controls after an ownership change.
4. **Cross-device push preferences:** saving browser settings could silently disable push enabled on another device. Browser saves preserve global push preferences and direct permission management to native apps. A denied native installation also preserves existing push authorization for other devices; newly enabling push still requires permission. Native permission branches have focused unit coverage.

## Button coverage

- Apple and Google sign-in attempts, callback error and return path, successful fixture login.
- Home shortcuts, every tab, game catalog/details/back, current and past session links, session settings save and group links.
- Group create/join, every icon and no-icon selection, validation, invitation preview/alternate code/confirm, settings save and return links.
- Member removal, ownership transfer, leave and delete confirmation/cancellation, typed deletion guards, member-only action visibility and failed-load retry.
- Invitation generation and limits, copy, unsupported browser sharing feedback, refresh and revoke.
- Notification read/unread, protected destination navigation, pagination/newest, slow request feedback, failure/retry and return links.
- Every editable browser preference switch, time fields/timezone, invalid input feedback, saving and device settings acknowledgement. Browser push permission switch is intentionally disabled.
- Rewards refresh, history pagination/retry, all five card detail/back controls and load recovery.
- Profile validation/save/busy/error/retry, updated Home greeting, local sign-out even on remote revocation failure, account deletion guard/cancel/fixture confirmation.

## Reproduce

```sh
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test-public-key \
npx expo export --platform web --output-dir /tmp/roam-button-audit-web
ROAM_TEST_EXPORT=/tmp/roam-button-audit-web npx playwright test
```

For manual inspection, run `node scripts/serve-button-audit.cjs` and open `http://127.0.0.1:4174`. Its fake backend uses loopback port 54321. Do not run it against a live backend. The normal app configuration is unchanged.

## Proof boundaries

These checks verify rendered UI acknowledgement, navigation, request contracts, success/error states and guards using fixture responses. They do not prove hosted RLS, migrations, real OAuth providers, native share sheets/clipboard, OS settings, push permission dialogs or APNs/FCM delivery. Native bundles and mocked native permission branches are separate checks, not physical-device proof.

Gameplay controls gated behind future game modules remain unavailable in the real catalog and were not enabled for this audit. No Secret Santa gameplay or Scope 06 was added. No hosted data or credentials were changed.

## Validation

- **32/32 browser E2E tests passed**, including all 18 new audit scenarios and existing Scope 01–05 regressions.
- **221/221 unit/database/native-mock tests passed** across 28 files.
- TypeScript, ESLint and formatting checks passed.
- Fresh web, iOS and Android Metro exports passed.
- No uncaught page errors were recorded in the 18 audit scenarios.
- Fixed device-settings acknowledgement was manually verified; screenshot: `docs/artifacts/button-audit-settings.png`.
- Temporary manual preview server was stopped after verification.

## Files created or modified

- `src/presentation/notifications/NotificationScreens.tsx` — button feedback, return navigation and cross-device preference handling.
- `src/presentation/groups/GroupScreens.tsx` — invitation refresh preserves fresh codes.
- `tests/notification-screens.test.tsx` — native permission regression cases.
- `e2e/button-audit.spec.ts` — 18 interaction audit scenarios.
- `e2e/fixtures/button-audit-backend.cjs` — isolated stateful backend.
- `scripts/serve-button-audit.cjs` — disposable manual preview server.
- `docs/button-audit.md`, `docs/artifacts/button-audit-settings.png`, `WORK_LOG.md` — audit report and evidence.

No database migrations, Edge Functions or Cron configuration changed.
