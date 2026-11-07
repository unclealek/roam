import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useRoamTheme } from "./theme";
export type GlassSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};
/** Solid readable fallback on web/Android; native iOS implementation lives alongside. */
export function GlassSurface({ children, style }: GlassSurfaceProps) {
  const { colors, radius } = useRoamTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
