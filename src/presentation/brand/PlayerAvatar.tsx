import { Text, View } from "react-native";
import { useRoamTheme } from "./theme";
export function PlayerAvatar({
  name,
  size = 44,
}: {
  name: string;
  size?: number;
}) {
  const { colors } = useRoamTheme();
  const initials =
    name
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .map((part) => [...part][0] || "")
      .join("")
      .toUpperCase() || "?";
  return (
    <View
      accessible={false}
      style={{
        width: size,
        minHeight: size,
        borderRadius: size * 0.32,
        backgroundColor: colors.actionPrimary,
        alignItems: "center",
        justifyContent: "center",
        padding: 6,
      }}
    >
      <Text
        style={{
          fontFamily: "Manrope",
          fontSize: size > 60 ? 30 : 16,
          fontWeight: "700",
          color: colors.onAction,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}
