# Scope 07.5.3 — Secret Santa experience

Implemented locally. No hosted database changes, deployments, matching changes, permission changes, or new gameplay.

## Screens and navigation

- Game details: availability and player count, accessible creation/join actions, mystery gift motif, three-step explanation, clearly upcoming activities and Roam tagline.
- Create/edit: four steps (your game, gift exchange, activities, review), retained values, group selection and group summary, existing validation, inline step errors, idempotent creation key and duplicate-request guard. Editing uses the existing native sheet.
- Lobby: themed opaque cards, participant initials and host identification, server-anchored countdown, existing private one-time invitation code/copy/native sharing, authorized host controls and confirmation dialogs.
- Draw: confirmation with fresh server eligibility check, pending-request presentation and actual `drawing` state. No client matching or success before server confirmation. Failed draws offer refresh; no redraw action.
- Assignment ready: celebration background and explicit recipient action without a name.
- Reveal/My Recipient: closed gift, secure tap-to-reveal operation, short gift/sparkle motion and success haptic, persistent server reveal on revisits, exchange details/countdown/session name, privacy hiding while backgrounded.
- Existing routes remain in place. Home, session redirects and notification links continue to resolve the actual session. Lobby refreshes on focus, every 15 seconds while active, and when the app resumes. Refresh preserves open lobby UI and the transient invitation code, with account/loader isolation.

## Reuse and components

Reused Phase 2B forms, fields, cards, buttons, background variants, progress indicator, modal dialog, native sheet, feedback provider, theme tokens and haptics. Reused all Secret Santa services, invitations, validation, group listing and secure assignment operations. Existing native Liquid Glass navigation remains; contextual explanation uses GlassSurface with its accessible platform fallbacks. Content cards remain opaque.

Added `SantaExperience.tsx`: MysteryGift, SantaMoment, ParticipantIdentity, SantaHowItWorks. Motion uses existing Reanimated with system Reduce Motion. Button press feedback is shared; creation, copy and successful reveal use success haptics. No new dependencies or heavy background animation.

## Artwork

No approved mascot export or Secret Santa illustration is registered. `RoamMascot.tsx` explicitly marks existing generated onboarding/icon art as unapproved and leaves its slots null. No replacement mascot was invented or used. The gift and sparkle use the existing Ionicons library. Approved mascot integration remains dependent on approved artwork being supplied/registered.

## Files

- `app/(account)/game/[gameId].tsx`
- `src/presentation/secret-santa/SantaExperience.tsx` (new)
- `src/presentation/secret-santa/SantaScreens.tsx`
- `src/presentation/secret-santa/SantaRecipient.tsx`
- `src/presentation/secret-santa/DateField.tsx`
- `src/presentation/secret-santa/DateField.native.tsx`
- `src/platform/sessions/useAccountResource.ts` (opt-in retention during refresh; other callers retain prior behavior)
- `tests/secret-santa-screens.test.tsx`
- `tests/secret-santa-recipient.test.tsx`
- `tests/account-resource.test.tsx`
- `e2e/secret-santa.spec.ts`
- This report and screenshots under `docs/artifacts/scope-07.5.3/`.

## Validation

- TypeScript: passed.
- ESLint: passed without warnings.
- Full unit/component/database suite: 307 tests in 39 files passed using `npm test -- --maxWorkers=4`. One earlier unrestricted concurrent run hit the pre-existing groups database setup's 10-second timeout while export/browser work ran; the bounded-worker full run passed.
- Browser suite: five flows cover creation/edit/review, group selection, preview/join, host controls, insufficient-player close/extend/cancel, draw confirmation, pending drawing, hidden assignment, private reveal, continue/revisit/reload, auth gating, 320px dark theme and reduced motion. Browser backend responses are fixtures, not hosted proof.
- Web production export: passed with test-only local endpoint credentials.
- iOS simulator: installed Roam launched on booted iPhone 18 Pro, Secret Santa deep link opened, updated introduction visually verified. Metro remains running on localhost:8081.
- Existing database matching/privacy tests ran locally; no hosted writes or physical-device tests performed.

## Remaining verification and limitations

- Approved mascot/illustration exports are missing; no substitute used.
- Native share sheet, actual clipboard behavior, VoiceOver traversal, maximum Dynamic Type, native Reduce Transparency/high contrast, Android runtime, light/dark device coverage and native haptics need device checks. Browser reduced-motion/dark/small-screen evidence is narrower than native accessibility proof.
- Complete multi-account hosted draw, notification delivery and real interruption/reconnection on physical devices remain unverified this scope. Existing notification routes/services were preserved, not redeployed.
- UI timeouts release pending controls after 20 seconds. A timed-out operation may still complete server-side; copy instructs users to refresh before retrying. Server locking/idempotency remains authoritative.
- No future activity gameplay, platform-wide mascot animation, Scope 07.5.4 or Scope 08 was implemented.

## Screenshots

These browser captures use test fixtures. They are viewport captures of scrollable screens, not physical-device evidence.

1. [Introduction, dark/small](artifacts/scope-07.5.3/santa-introduction-dark-small.png)
2. [Setup](artifacts/scope-07.5.3/santa-setup.png)
3. [Lobby with participants](artifacts/scope-07.5.3/santa-ready-for-draw.png)
4. [Ready for draw](artifacts/scope-07.5.3/santa-ready-for-draw.png)
5. [Draw confirmation](artifacts/scope-07.5.3/santa-draw-confirmation.png)
6. [Drawing](artifacts/scope-07.5.3/santa-drawing.png)
7. [Assignment ready](artifacts/scope-07.5.3/santa-assignment-ready.png)
8. [Recipient reveal](artifacts/scope-07.5.3/secret-santa-recipient.png)
9. [My Recipient after reload](artifacts/scope-07.5.3/santa-my-recipient.png)
10. [iOS simulator introduction](artifacts/scope-07.5.3/simulator-introduction.png)
