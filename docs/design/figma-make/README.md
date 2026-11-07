# Roam — Figma Make design target

Reference: https://www.figma.com/make/p7iMN0xWbK07xCvb09eL8N/Untitled

Inspected 5 November 2026: splash, welcome, onboarding, provider entry, profile setup, Home, Groups, Play and Rewards. The prototype guides layout and typography. The user confirmed that Roam’s blue mascot character sheet owns the brand colours; purple is not the brand direction. Existing authentication, authorization, game rules and account data remain the source of truth.

## Design foundations

- Electric blue `#086BFF` actions, pale blue `#DCEEFF` accents, ivory `#FFFAF4` canvas, navy `#081B58` text and fine `#D9E1EC` borders.
- Fredoka headings and Manrope body text, bundled locally with their SIL Open Font Licenses.
- Rounded rectangular buttons, softly rounded outlined cards, compact game and group rows, and a blue initials avatar.
- Penguin with aviator goggles and an orange scarf, reconstructed in native React Native views from the prototype's rendered CSS geometry. Optional image slots remain available for future approved poses.

## Implemented locally

- Tap-to-begin splash, welcome hero, three onboarding pages, and centered provider sign-in entry.
- Shared light/dark theme, typography, buttons, cards, initials avatars and backgrounds.
- Home adventure card and create/join actions, current sessions, groups and game discovery using existing services.
- Groups search and persistent create/join actions, catalogue rows and compact session cards.
- Rewards XP/level summary using existing server-backed progress; existing collections and achievements stay available.
- Native Apple sign-in retains Apple's standard control. Native tab navigation retains system behavior.

The prototype's sample people, groups, game availability, scores, daily challenges and streaks are not production data. Unimplemented games and unsupported reward mechanics have not been advertised as available.

## Validation

- TypeScript and ESLint pass; all 325 unit/integration tests pass (43 files, two workers).
- Web export and iOS Hermes bundle export succeed. The iOS export is not a compiled native binary or a simulator/device validation.
- 12 browser checks pass: onboarding/provider entry, Home/catalogue navigation, groups/profile flows; 320px and 430px, light/dark appearances.
- Contrast checks cover both appearances. Muted text was darkened from the initial lavender palette to preserve 4.5:1 contrast on elevated surfaces.
- Screenshots in `screenshots/` use disposable local fixture data.

## Remaining fidelity work

This is the first implementation pass, not a claim of complete pixel-for-pixel parity. The mascot uses solid native fills rather than all CSS gradients/shadows. Prototype entrance/idle motion, cloud scenery, and additional poses still need refinement. Existing game, account, collection and notification detail screens inherit the new visual foundations but retain their established layouts and behavior. App icon/store artwork is unchanged.

Review the actual iOS app in a simulator/device next, particularly font weight rendering, safe areas, native tabs, and Apple sign-in appearance. No hosted deployment, backend migration, EAS build or TestFlight submission was performed.

## Brand correction — 5 November 2026

Restored blue across shared light/dark tokens, welcome/splash, decorative backgrounds and the Rewards summary to match the supplied Roam character sheet. Earlier screenshots in this folder show the superseded purple pass. The prototype penguin remains temporary artwork; it is not the approved Roam character.
