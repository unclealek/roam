/** Compatibility facade for authentication and route fallback states. */
import type { ReactNode } from "react";
import { Text } from "react-native";
import { RoamScreen } from "./brand/ui";
import { useRoamTheme } from "./brand/theme";
export {
  Body,
  RoamCard as Panel,
  RoamButton as Button,
  Loading,
  ErrorState,
  EmptyState,
} from "./brand/ui";
export { Field } from "./brand/forms";
export function Screen({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { colors, type } = useRoamTheme();
  return (
    <RoamScreen>
      <Text
        accessibilityRole="header"
        style={[type.title1, { color: colors.textPrimary }]}
      >
        {title}
      </Text>
      {children}
    </RoamScreen>
  );
}
