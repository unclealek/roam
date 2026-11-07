# Roam hybrid icon audit — 5 November 2026

- Expo SDK 58 (`~58.0.21`), React Native 0.88, React 19.3, Expo Router 58. iOS uses NativeTabs with native Liquid Glass; web/Android use JS tabs. Preserve both.
- Existing functional family: Ionicons via `@expo/vector-icons` 15.1.1. Package and underlying vector-icons licenses are present locally. Retain as the documented temporary alternative to Streamline. No approved Streamline assets found.
- No `react-native-svg` dependency yet. Expo's installed compatibility manifest specifies 15.16.0.
- Blue/ivory brand lives in `src/presentation/brand/theme.ts`. Keep the user's blue correction despite the supplied scope's purple wording. Fredoka/Manrope are bundled with licenses.
- Mascot lives in `RoamMascot.tsx`; existing raster artwork in `assets/onboarding/` and app icon remain untouched. This scope does not approve or alter mascot artwork.
- Replace SF Symbols/Ionicons tab identities with five original designs. Replace generic gift/controller/ribbon symbols on branded cards, reward celebrations and achievement details with original game symbols and collectible badges.
- Centralize remaining utility icons (notifications, chevrons, settings, lock, add, close, etc.) through one Ionicons wrapper. Replace group-selector emoji with vector symbols while retaining stored icon keys.
- Existing collectible artwork is code-generated placeholder artwork. Replace its generic text marks with original vector identities; retain rarity semantics and layouts.
- Premium illustration slots: three game identities, completion trophy, reward chest, points, levels, and group/game/reward empty states. None are supplied or licensed in this checkout. Use explicitly documented flat original vector fallbacks, never pretend these are premium 3D assets.
- Mind Match/Secret Agent art can be supplied without advertising unavailable games or adding routes. Rewards and challenges receive presentation support only; no points, streaks or achievements will be invented.
