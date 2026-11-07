# ForTest fixture and notifications/rewards checks — 5 November 2026

Created on the existing Roam hosted project at the user's request. No schema, RLS, matching logic or app behavior changed.

## Persistent test setup

- Group: ForTest (`a3016620-e44c-4cab-823c-ce1ca46b2590`).
- Owner: Kelvin, plus seven new dummy accounts named ForTest Player 01 through ForTest Player 07 (eight members total).
- Sample game: ForTest Secret Santa (`f0fb17f3-5e59-4a63-9d2f-73a6bd1ea1a4`). All eight members are already enrolled.
- Joining remains open, with a seven-day joining deadline and a fourteen-day exchange date; EUR 25 suggested budget, Europe/Helsinki timezone. Future activities disabled.
- No names drawn, no private assignments created, no fake XP awarded. Test data is retained for the user to explore.
- Created accounts use non-deliverable example.invalid addresses, unique random passwords held only in memory, and a ForTest fixture metadata marker. Passwords, tokens, emails and API keys were not written to the manifest or logs. No existing account's credentials were changed.
- Owner operations used existing RPCs under a scoped authenticated database role and an existing owner session context. Each dummy signed in through real hosted Auth and redeemed the normal invitation and session join APIs.

## Verification

- 61 automated tests across eight files passed: notifications/rewards database behavior, services, screens, dispatcher and device registration logic.
- Five Playwright browser tests passed: notification read/unread/settings; protected notification links; reward refresh/level/card/achievement presentation; card navigation; reduced motion; protected reward links. These browser tests use fixture responses, not hosted responses.
- Hosted API: all seven real authenticated test accounts read notifications and reward dashboards; first_steps remains locked and XP is zero; unknown card returns null; preferences saved and were restored; direct client XP awarding is denied; foreign reward reads return no rows.
- Hosted role/RPC: owner reward dashboard reads correctly. Actual newly created session notification toggled read/unread within a rolled-back verification transaction, leaving original state intact.
- Hosted lifecycle: one game-created notice and seven player-joined notices exist, all with the correct session route. Actual notification center visually verified in the iOS simulator.
- Rewards screen visually checked in the simulator. New group and eight-player lobby verified from server state.
- No positive hosted reward award was forced: no eligible completed-game event has happened. Positive earning, level, achievement and collectible logic is covered by local database tests; browser earning presentation uses mocks.
- Push delivery is not established by these checks. The fixture's inspected notification outbox entries were cancelled; no physical-device/APNs receipt proof was obtained.

## Evidence

- `artifacts/fortest-fixture.json`: fixture IDs and verified checks; no credentials.
- `artifacts/fortest/notifications-simulator.png`
- `artifacts/fortest/rewards-simulator.png`
- `artifacts/fortest/lobby-simulator.png`
- `scripts/setup-fortest.mjs`: explicit guarded setup; refuses duplicate ForTest creation.
- `scripts/verify-fortest-actions.mjs`: scoped verification of existing fixture actions.

The simulator is left on the ForTest Secret Santa lobby. To revisit: Groups → ForTest, or Home → ForTest Secret Santa. Draw names when ready; this permanently locks the exchange and cannot be redrawn.
