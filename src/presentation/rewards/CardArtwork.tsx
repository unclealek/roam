import { StyleSheet, View } from "react-native";
import type { Rarity } from "../../platform/rewards/types";
import { AchievementBadge, resolveAchievementIcon } from "../icons";
import { useRoamTheme } from "../brand/theme";
const palettes: Record<Rarity, { paper: string; ink: string }> = {
  common: { paper: "#E4ECFF", ink: "#394BB5" },
  uncommon: { paper: "#D9F0E8", ink: "#225F50" },
  rare: { paper: "#ECE3FF", ink: "#684397" },
  legendary: { paper: "#FFF0CC", ink: "#805A15" },
};
/** Bundled code artwork placeholders: stable references, no remote image dependency. */
export function CardArtwork({
  artworkKey,
  rarity,
  locked = false,
}: {
  artworkKey: string;
  rarity: Rarity;
  locked?: boolean;
}) {
  const palette = palettes[rarity] ?? palettes.common;
  return (
    <View
      accessibilityLabel={`${locked ? "Locked collectible" : "Collectible"} artwork`}
      accessibilityRole="image"
      style={[styles.art, { backgroundColor: palette.paper }]}
    >
      <View
        style={[
          styles.orbit,
          { borderColor: palette.ink, opacity: locked ? 0.14 : 0.28 },
        ]}
      />
      <View
        style={[
          styles.inner,
          { borderColor: palette.ink, opacity: locked ? 0.14 : 0.28 },
        ]}
      />
      <AchievementBadge
        name={resolveAchievementIcon(artworkKey)}
        size={86}
        state={locked ? "locked" : "unlocked"}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  art: {
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  orbit: {
    position: "absolute",
    width: "76%",
    height: "76%",
    borderWidth: 1,
    borderRadius: 150,
    transform: [{ rotate: "-25deg" }],
  },
  inner: {
    position: "absolute",
    width: "54%",
    height: "54%",
    borderWidth: 1,
    borderRadius: 12,
    transform: [{ rotate: "35deg" }],
  },
  mark: { fontSize: 64, fontWeight: "600" },
  caption: {
    position: "absolute",
    bottom: 14,
    fontSize: 11,
    letterSpacing: 0,
    fontWeight: "700",
  },
});
export function useCardStyles() {
  const { colors, type } = useRoamTheme();
  return StyleSheet.create({
    heading: { ...type.title2, fontWeight: "700", color: colors.textPrimary },
    label: { ...type.caption, color: colors.textSecondary },
    rarity: {
      fontSize: 12,
      letterSpacing: 1,
      textTransform: "uppercase",
      fontWeight: "700",
      color: colors.brandPrimary,
    },
  });
}
