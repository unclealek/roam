# Roam hybrid icon asset manifest

Brand: electric blue/ivory from `src/presentation/brand/theme.ts`, following the user's explicit brand correction. No mascot changes or new animations.

## Original Roam artwork — implemented

All paths below are newly authored original vector geometry in `src/presentation/icons/registry.ts`, exported with `npm run icons:export`. They contain no third-party pack paths. Original in-app artwork; no external asset license dependency.

| Asset | Category | SVG path (`assets/icons/originals/`) | Intended screen | Intended size | Status |
|---|---|---|---|---|---|
| Home | Navigation | `home.svg` | Home tab | 24pt | Implemented |
| Groups | Navigation | `groups.svg` | Groups tab, group sections and cards | 24–48pt | Implemented |
| Play | Navigation | `play.svg` | Play tab, sessions, game empty state | 24–80pt | Implemented |
| Rewards | Navigation | `rewards.svg` | Rewards tab, profile reward entry | 24pt | Implemented |
| Profile | Navigation | `profile.svg` | Profile tab | 24pt | Implemented |
| Secret Santa | Game | `secret-santa.svg` | Catalogue, sessions, gift/lobby/reveal presentation | 32–96pt | Implemented vector fallback |
| Mind Match | Game | `mind-match.svg` | Future catalogue/game identity | 32–96pt | Implemented; game availability unchanged |
| Secret Agent | Game/badge | `secret-agent.svg` | Future game identity, achievement badge | 32–112pt | Implemented; game availability unchanged |
| Roam Points | Reward | `points.svg` | XP summary and XP reward notice | 32–48pt | Implemented; existing XP naming/calculations preserved |
| Levels | Reward | `levels.svg` | Progression and level-up notice | 32–48pt | Implemented |
| Streaks | Reward | `streaks.svg` | Reusable future streak presentation | 24–64pt | Component ready; no unsupported streak data shown |
| First Game | Badge | `first-game.svg` | Achievements, collectible/detail artwork | 48–112pt | Implemented |
| Team Player | Badge | `team-player.svg` | Achievements, compact/detail artwork | 48–112pt | Implemented |
| Mind Reader | Badge | `mind-reader.svg` | Collectibles, compact/detail artwork | 48–112pt | Implemented |
| Challenge Champion | Badge | `challenge-champion.svg` | Achievements, compact/detail artwork | 48–112pt | Implemented |
| Game Night Legend | Badge | `game-night-legend.svg` | Achievements, compact/detail artwork | 48–112pt | Implemented |
| General achievement | Badge | `achievement.svg` | Unknown future achievement keys | 48–112pt | Implemented safe fallback |
| Trophy | Illustration fallback | `trophy.svg` | Completion artwork slot | 48–96pt | Implemented vector fallback |
| Chest | Illustration fallback | `chest.svg` | Reward/empty reward artwork slot | 48–96pt | Implemented vector fallback |
| Daily challenge | Branded utility | `challenge.svg` | Future daily-challenge presentation | 24–64pt | Component ready; no new challenge logic |
| Reward/game history | Branded utility | `history.svg` | Reusable history presentation | 24–48pt | Component ready |

`AchievementBadge` wraps these identities in an original inset shield silhouette. Locked states preserve the badge identity and add a lock; unlocked, featured/large, compact and progress presentations use the same API. Existing backend keys are explicitly mapped; no achievement definitions, eligibility or point logic were changed.

For native iOS tabs: `assets/icons/navigation/{home,groups,play,rewards,profile}-{inactive,active}.png`, with `@2x` and `@3x` companions (24/48/72px). These are generated from the same original SVG registry, not a separate pack. UIKit template tinting preserves Liquid Glass and theme colors.

## Functional family — integrated

| Asset family | Source | Path | Intended screens | Sizes | License status | Implementation |
|---|---|---|---|---|---|---|
| Search, settings, notifications, back, close, edit, share, copy, add/remove, check, lock, calendar, info/help, logout/delete, chevrons | Existing Ionicons through `@expo/vector-icons` 15.1.1 | `src/presentation/icons/FunctionalIcon.tsx`; bundled Ionicons font | Header, forms, groups, invitations, profile, privacy, notifications, overlays | 18/20/22/24pt | MIT; official Ionic license and local package notices retained in `licenses/` | All direct third-party presentation imports centralized in this component |
| Streamline | Preferred future licensed replacement | Adapter can replace `FunctionalIcon.tsx` | Functional actions | Same size contract | No approved pack or redistribution permission supplied | Not downloaded; Ionicons remains the consistent fallback |

Official Ionicons license: https://github.com/ionic-team/ionicons/blob/main/LICENSE . Package notices: `licenses/Ionicons-MIT.txt`, `licenses/expo-vector-icons-MIT.txt`, `licenses/react-native-vector-icons-MIT.txt`. No assertion is made about rights to an unsupplied Streamline or IconScout pack.

## Premium illustrations — all require approved assets

No approved IconScout assets were found. Every slot below is registered in `src/presentation/icons/illustrations.ts`; the source and license remain null. `RoamIllustration` renders the documented original flat vector until status, source and license evidence are all supplied.

| Asset | Preferred source | Exact destination | Intended use | Required dimensions | License/status | Current fallback |
|---|---|---|---|---|---|---|
| Wrapped mystery gift | IconScout, approved licensed asset | `assets/illustrations/secret-santa.png` | Secret Santa hero/card/lobby/reveal | 512×512 RGBA PNG | Missing; authorization unverified | Original gift vector |
| Connection brain | IconScout, approved licensed asset | `assets/illustrations/mind-match.png` | Mind Match hero/card | 512×512 RGBA PNG | Missing; authorization unverified | Original brain vector |
| Secret mission | IconScout, approved licensed asset | `assets/illustrations/secret-agent.png` | Secret Agent hero/card | 512×512 RGBA PNG | Missing; authorization unverified | Original mission vector |
| Completion trophy | IconScout, approved licensed asset | `assets/illustrations/completion-trophy.png` | Future completion/results hero | 512×512 RGBA PNG | Missing; authorization unverified | Original trophy vector |
| Reward chest | IconScout, approved licensed asset | `assets/illustrations/reward-chest.png` | Reward reveal/empty rewards | 512×512 RGBA PNG | Missing; authorization unverified | Original chest vector |
| Points artwork | IconScout, approved licensed asset | `assets/illustrations/points.png` | Large XP reward notice | 512×512 RGBA PNG | Missing; authorization unverified | Original points vector |
| Level artwork | IconScout, approved licensed asset | `assets/illustrations/levels.png` | Large level notice | 512×512 RGBA PNG | Missing; authorization unverified | Original level vector |
| Group empty state | IconScout, approved licensed asset | `assets/illustrations/empty-groups.png` | Home/Groups with no groups | 512×512 RGBA PNG | Missing; authorization unverified | Original groups vector |
| Game empty state | IconScout, approved licensed asset | `assets/illustrations/empty-games.png` | Home/Play with no sessions | 512×512 RGBA PNG | Missing; authorization unverified | Original play vector |
| Reward empty state | IconScout, approved licensed asset | `assets/illustrations/empty-rewards.png` | Future empty rewards presentation | 512×512 RGBA PNG | Missing; authorization unverified | Original chest vector |

Core achievement badges remain original. Premium decorative badge illustrations, if later supplied, need a separate recorded slot and license review; they must not replace the six original achievement identities.

### Supplying approved artwork

Place each transparent PNG at its exact destination. In its manifest entry set `source: require('../../../assets/illustrations/<name>.png')`, `status: 'approved'`, and a `license` reference to the retained purchase/authorization record (asset ID, vendor, license type, permitted app distribution). Keep private purchase details out of the public UI and source control. Verify the particular supplied asset's permission; a vendor subscription alone is not treated as evidence. Do not add missing-file imports before the file exists.

Keep one consistent rounded clay/soft-3D set, lighting and perspective. Do not download paid assets automatically. Vector fallbacks are deliberately flat symbols and are not presented as premium 3D artwork.
