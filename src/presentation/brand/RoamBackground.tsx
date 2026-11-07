import type { ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useRoamTheme } from "./theme";
import backgroundImage from "../../../assets/roam-background.jpg";

export type BackgroundVariant =
  | "standard"
  | "form"
  | "elevated"
  | "celebration"
  | "mystery"
  | "home"
  | "winter"
  | "profile";

export function RoamBackground({
  children,
  variant = "standard",
}: {
  children: ReactNode;
  variant?: BackgroundVariant;
}) {
  const { colors, dark } = useRoamTheme();

  return (
    <View
      testID={`roam-background-${variant}`}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}
      >
        <Image
          source={backgroundImage}
          resizeMode="cover"
          blurRadius={8}
          accessible={false}
          style={{ width: "100%", height: "100%", opacity: dark ? 0.14 : 1 }}
        />
      </View>
      {children}
    </View>
  );
}
