import { router } from "expo-router";
import { Text, View, type ImageSourcePropType } from "react-native";
import { RoamMascot } from "./RoamMascot";
import { RoamButton } from "./RoamButton";
import { useRoamTheme } from "./theme";
import { RoamCard } from "./ui";

export function AdventureCard({
  backgroundImage,
}: {
  backgroundImage: ImageSourcePropType;
}) {
  const { colors, type, radius } = useRoamTheme();
  return (
    <View testID="home-adventure-card">
      <RoamCard backgroundImage={backgroundImage}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text
            accessibilityRole="header"
            style={[
              type.headline,
              {
                flex: 1,
                color: colors.textPrimary,
                fontSize: 22,
                lineHeight: 28,
                letterSpacing: -0.5,
              },
            ]}
          >
            Your next adventure starts here.
          </Text>
          <RoamMascot size={92} placement="adventure" />
        </View>
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            padding: 4,
            borderRadius: radius.card,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flex: 1 }}>
            <RoamButton
              label="Create group"
              size="medium"
              onPress={() => router.push("/group/create")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <RoamButton
              label="Join group"
              size="medium"
              variant="ghost"
              onPress={() => router.push("/group/join")}
            />
          </View>
        </View>
      </RoamCard>
    </View>
  );
}
