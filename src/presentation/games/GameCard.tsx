import { ImageBackground, Text, View } from "react-native";
import { FunctionalIcon, RoamIllustration } from "../icons";
import { router } from "expo-router";
import type { CatalogGame } from "../../platform/games/service";
import { RoamCard } from "../brand/ui";
import { useRoamTheme } from "../brand/theme";
import playController from "../../../assets/play-controller.jpg";
export function GameCard({
  game,
  groupId,
}: {
  game: CatalogGame;
  groupId?: string;
}) {
  const { definition, metadata } = game;
  const { colors, type } = useRoamTheme();
  const isSecretSanta = definition.id === "secret_santa";
  const availability =
    metadata.availability_status === "available"
      ? "Available"
      : metadata.availability_status === "coming_soon"
        ? "Coming soon"
        : "Unavailable";
  return (
    <RoamCard
      onPress={() =>
        router.push(
          groupId
            ? { pathname: definition.routes.details, params: { groupId } }
            : definition.routes.details,
        )
      }
      accessibilityLabel={`View ${metadata.name}`}
      accessibilityHint={`${metadata.description} ${availability}. Opens game details.`}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View
          style={{
            width: 72,
            height: 90,
            borderRadius: 16,
            backgroundColor: isSecretSanta ? colors.surfaceElevated : undefined,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isSecretSanta ? (
            <RoamIllustration name="secret-santa" size={56} />
          ) : (
            <ImageBackground
              source={playController}
              resizeMode="cover"
              accessible={false}
              style={{ width: 72, height: 90 }}
            />
          )}
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {metadata.category}
          </Text>
          <Text
            accessibilityRole="header"
            style={[type.title2, { fontSize: 22, color: colors.textPrimary }]}
          >
            {metadata.name}
          </Text>
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {isSecretSanta
              ? "Give a little mystery. Share a lot of joy."
              : metadata.description}
          </Text>
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {metadata.max_players === null
              ? `${metadata.min_players}+ players`
              : `${metadata.min_players}–${metadata.max_players} players`}{" "}
            · {availability}
          </Text>
        </View>
        <FunctionalIcon
          accessible={false}
          name="chevron-forward-circle"
          size={28}
          color={colors.textPrimary}
        />
      </View>
    </RoamCard>
  );
}
