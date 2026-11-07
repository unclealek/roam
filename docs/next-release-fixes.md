# Changes after TestFlight 0.1.0 (2)

## Optional group vice owner and account-deletion guidance

**Symptom:** Owners cannot leave a group or delete their account without manually transferring ownership or deleting the group. The account screen needs clearer guidance, and there is no designated successor.

**Change:** Add an optional vice owner selected by the owner from existing members. Automatically transfer ownership to the vice when the owner leaves or deletes their account. Check every owned group before deleting an account, preventing partial transfers. Clear the vice designation when that member leaves, is removed, deletes their account, or becomes owner. Vice owners have ordinary member permissions until succession. A group without a vice still requires manual transfer or deletion before the owner can leave/delete their account. Groups with sessions retain their existing deletion restriction.

Creation explains the policy and offers an optional shortcut to vice setup. A newly created group has only its owner, so invite another member before appointing a vice. Group Members supports appointment/removal, Group Details shows the successor and an owner leave button, and Profile explains account deletion and automatic succession before confirmation.

**Migration:** `supabase/migrations/20261028170737_group_vice_owner_succession.sql` (applied to hosted Roam project `ywpmvqgtiawtkcqxeehf` on 2026-10-28).

**Validation:** TypeScript, lint and formatting passed. 238 tests across 29 files passed; measured platform coverage 97.19% lines, 92.5% branches. Real PostgreSQL concurrent owner/vice departures preserve exactly one owner. Web and iOS exports passed. Full end-to-end regression: **33 passed**, including the new optional vice setup, appointment and departure-warning flow.

**Release status:** Hosted migration applied. Verified vice column, group RLS, public invoker RPC, anonymous RPC denial and private helper execution denial. Advisors show only the pre-existing leaked-password protection warning. App UI is included in released TestFlight 0.1.0 (3); the last user-confirmed installed build is 0.1.0 (2). The signed 0.1.0 (3) IPA was built and verified locally after the free cloud-build quota rejected the request. Submission finished, and Apple confirmed 0.1.0 (3) is valid and available for internal beta testing on 29 October. Physical-device installation and feature checks remain unverified.

**Pending device checks:** With two accounts, appoint/remove a vice, leave as owner, verify succession and permissions, and delete a disposable owner account after checking all its groups have a vice. Confirm no-vice guidance on creation, leaving and deletion. Existing host-account deletion may remove hosted game sessions through the pre-existing cascade; this change preserves the group and does not redesign game host succession.

## Scope 06 — Secret Santa setup and lobby

**Change:** Secret Santa is selectable with 3–100 participants, standalone/group setup, secure session invitations, host controls and automatic server-enforced joining closure. No matching or gameplay. Reuses generic sessions/membership, notifications and the existing minute scheduler.

**Migration:** `20261028182438_secret_santa_setup_lobby.sql`, applied successfully to hosted Roam `ywpmvqgtiawtkcqxeehf` on 2026-10-29. Follow-up migration dry run is up to date. Advisors report only the existing `auth_leaked_password_protection` warning.

**Validation:** Implementation checks passed: 262 tests/33 files, 36 E2E tests, TypeScript/lint/format, web/iOS/Android exports and real PostgreSQL create/join/worker concurrency checks. Existing reward concurrency regression passed. Release checks on 2026-10-29 repeated all 262 tests, all 36 E2E checks, TypeScript/lint/format, Expo compatibility and web/iOS exports after SDK-compatible Expo patch updates. The existing hosted `roam-activities` Cron job automatically closed a disposable lobby at 04:37:00Z after its 04:36:02Z deadline, reaching `insufficient_players` with one closure and one host-attention notification; no manual scheduler run was used. The 04:38:00Z Cron run succeeded with counts unchanged. Fixture account/session/activity/notification rows were removed and zero remaining rows verified.

**Release status:** Backend migration, hosted Cron closure/deduplication proof and fixture cleanup complete. Included in released TestFlight 0.1.0 (3); the last user-confirmed installed build is 0.1.0 (2). Native date/time picker adds a dependency/config plugin requiring a new build. Marketing version remains 0.1.0; build 3 is released to internal TestFlight. The cloud request reached the monthly free iOS quota before a job was created (reset 1 November); no paid plan was purchased. The first local build stopped before compilation because Apple's public WWDR G3 intermediate certificate was absent; its root chain was verified and it was added with default trust, without replacing or revoking signing credentials. The second local signed EAS/Xcode build from the same canonical source snapshot succeeded and IPA verification passed. Submission `811ff809-d1f0-4c3a-8dc4-9a520d3ca3fb` finished; Apple confirmed build 3 is `VALID` and `IN_BETA_TESTING` at 10:03 UTC on 29 October. Physical-device installation and feature checks remain unverified.

**Pending device checks:** Date/time controls, shared invitation link across sign-in, copy/share sheet, independent group joining, deadline closure and actual push/deep-link delivery. See `scope-06-review.md` for full file inventory, design and limitations.

## Scope 07 — Secret Santa matching and recipient reveal (backend deployed, app UI unreleased)

**Symptom:** A ready Secret Santa lobby cannot draw names or privately show a recipient.

**Change:** Secure transactional single-cycle matching for 3–100 members, confirmed host early draw, automatic scheduled draw/retry, permanent membership lock, private persisted reveal/My Recipient with countdown and safe notifications. Matched account deletion preserves anonymous membership/assignment references and surfaces recovery; no redraw. Future activities remain placeholders.

**Migration:** `20261029102704_secret_santa_matching.sql`, applied to hosted Roam `ywpmvqgtiawtkcqxeehf` on 2026-10-29 after approval. Follow-up dry run is up to date, with no new advisor findings; the existing leaked-password-protection warning remains. No new Edge Function or Cron job is required.

**Validation:** 284 automated tests, 37 browser E2E checks, TypeScript, lint, formatting and web/iOS/Android exports passed. Independent PostgreSQL concurrency and disposable 13-person group APIs/reveals/notifications passed; fixture users/group/session and the local fixture database were removed. Hosted verification also passed: 13 real disposable Auth accounts joined a persistent group and two exchanges; early/concurrent draws and all private reveals worked, then live Cron closed the automatic session at 10:56:00Z and matched it at 10:57:00Z without manual worker invocation. Each exchange had 13 unique ready notices and no fake gameplay. All hosted fixtures were deleted, with zero remaining fixture rows verified at 10:57:13Z. See [Scope 07 report](scope-07-review.md) for file inventory, algorithm, privacy and proof boundaries.

**Release status:** Backend deployed and hosted API/Cron exchange verified. Source UI is locally validated. Existing TestFlight 0.1.0 (3) does not contain Scope 07 UI. No version/build bump, native build or submission was made.

**Pending checks:** Build/install the updated UI and verify device reveal, reduced motion, background concealment, offline recovery, actual push receipt and notification navigation. Scope 08 has not begun.

## Remove the startup welcome flash

**Symptom:** Home briefly shows “Welcome to Roam.” while the profile loads, before changing to the personalized greeting.

**Change:** Remove the temporary welcome title. The personalized greeting appears when the profile is available.

**Release status:** Local source change; not included in the existing TestFlight build. Device launch verification remains pending.

## Greeting, onboarding and login screens — build 4

**Change:** Add the illustrated greeting, three skippable onboarding pages, and separate returning/create-account presentations using the existing Apple/Google sign-in. Signed-out tab entry opens welcome. Existing secure provider transports and invitation callbacks remain.

**Validation:** TypeScript, ESLint, 284 unit tests and the final full 39/39 browser regression. Verified signed IPA 0.1.0 (4), identity/backend and actual signed entitlements.

**Release status:** Build 4 includes this flow, Scope 07 UI and Home welcome-flash fix. Local signed build succeeded; verified IPA uploaded to EAS Submit. The stuck EAS submission was canceled; direct upload of the same verified IPA to Apple succeeded at 18:22:16 UTC on 29 October. Apple processing/internal availability is pending. See [release report](releases/testflight-0.1.0-build4.md).

**Pending device checks:** Onboarding/layout on iPhone, Apple/Google callbacks, invitation continuity, private recipient reveal, background behavior and actual push receipt.

## Scope 07.5 / Phase 1 — brand foundation, native navigation, first screens

**Change:** Shared electric-blue/ivory and navy dark theme, system typography, reusable controls/cards and glass header controls; real session/catalog/group sections on Home; registered-only Games Catalog; adaptive Welcome/sign-in; Home/Groups/Play/Rewards/Profile tab order with native iOS tabs and platform fallback. Authentication, matching, sessions, backend and later-phase screen layouts are preserved.

**Assets:** The previous generated mascot and differing app-icon character are not used as approved screen artwork. Missing approved transparent mascot/game illustration exports are documented; responsive replacement slots are in place. Final mascot visual approval remains pending.

**Validation:** TypeScript, ESLint, changed-file formatting and iOS/web exports passed. Full browser suite 45/45 passed. Unit tests and native preview evidence are in the [Phase 1 report](design/scope-07-5-phase1/README.md).

**Release status:** Local source only. New native UI dependencies require a new development/store binary. Existing TestFlight build 4 predates these changes. No build number bump, hosted mutation or submission for this phase.

**Pending device checks:** Actual provider sign-in/deep links, native tabs/glass and haptics, dark appearance, Dynamic Type, VoiceOver, Reduce Motion/Transparency and Increase Contrast. See the report for the simulator harness boundary and screenshots. Stop after Phase 1.

## Sign-in footer and simulator Apple capability — 30 October

**Change:** Removed the redundant existing/new-account toggle from the sign-in screen. Apple and Google already handle account creation and returning users. Welcome entry links and existing route parameters remain compatible.

**Simulator diagnosis:** Native logs showed `AKAuthenticationError -7026` / `ASAuthorizationError 1000` before Supabase verification. The previous simulator launch used a temporary Keychain-only entitlement file, omitting `com.apple.developer.applesignin`. The project entitlement source was already correct. Rebuilt and installed the local simulator binary, verifying the simulated Apple entitlement is `Default`, with Keychain identifiers preserved; no backend/provider or production credential change.

**Validation:** TypeScript, focused ESLint, 17 Apple/OAuth unit tests, and both welcome/navigation browser tests passed. Full Apple authorization must be retried after the corrected native binary is installed; simulator success is not physical-device or TestFlight proof.

**Release status:** Local source and simulator only; no TestFlight upload or build-number bump.

## Scope 07.5 Phase 2 — Groups, invitations and player profile

**Symptom:** Group and profile content still used the older visual system, profile editing was mixed into the identity screen, and group-to-catalog navigation did not retain the group context.

**Change:** Refactor existing group/create/join/detail/member/settings/invitation screens to Phase 1 theme and components. Show permitted member initials and visible active session counts. Preserve ownership/vice-owner rules, safe invitation previews, code generation/copy/share/revoke and optional session-ID join. Carry `groupId` from Group Detail through Games and game details to existing setup. Add a real rewards-based Profile summary with dedicated Edit Profile and Privacy & account routes; preserve notification preferences, guarded deletion and sign-out behavior.

**Backend:** No migrations, RLS changes, deployment, new editable schema fields or reward writes. No new dependency, app version or build-number change.

**Validation/release status:** Local source only. TypeScript, ESLint, 292 unit tests and configured platform/service coverage thresholds pass; web/iOS exports pass. Final browser results and captures are recorded in `docs/design/scope-07-5-phase2/README.md`. These changes have not been built/submitted to TestFlight.

**Pending:** Approved transparent mascot art is still unavailable; the existing clean placeholder remains. No lifetime games-played metric or profile images/bio are exposed by current services, so none are fabricated. Invitation errors retain the backend's safe combined invalid/expired/revoked/exhausted message. Physical-device discovery timed out; real account/multi-user flows, iPhone keyboard/VoiceOver/Dynamic Type, native sharing/copy/haptics, Liquid Glass/accessibility preferences, offline/reconnect and Android checks remain unverified. Phase 3 was not started.
