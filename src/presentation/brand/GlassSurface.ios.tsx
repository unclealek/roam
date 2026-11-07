import { View } from "react-native";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import type { GlassSurfaceProps } from "./GlassSurface";
import { useRoamTheme } from "./theme";
import { useAccessibilityPreferences } from "./useAccessibilityPreferences";
export function GlassSurface({ children, style }: GlassSurfaceProps) {
  const { colors, dark, radius } = useRoamTheme();
  const { reduceTransparency, increaseContrast } =
    useAccessibilityPreferences();
  const glass =
    !reduceTransparency &&
    !increaseContrast &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable();
  const shape = { borderRadius: radius.card, overflow: "hidden" as const };
  return glass ? (
    <GlassView
      glassEffectStyle="regular"
      colorScheme={dark ? "dark" : "light"}
      style={[shape, style]}
    >
      {children}
    </GlassView>
  ) : (
    <View
      style={[
        shape,
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
