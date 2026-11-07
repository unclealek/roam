import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRoamTheme } from "../brand/theme";
import { iconTokens } from "./iconTokens";
const aliases = {
  search: "search-outline",
  settings: "settings-outline",
  notifications: "notifications-outline",
  back: "chevron-back",
  close: "close",
  edit: "create-outline",
  share: "share-outline",
  copy: "copy-outline",
  add: "add",
  remove: "remove",
  check: "checkmark",
  lock: "lock-closed-outline",
  calendar: "calendar-outline",
  information: "information-circle-outline",
  help: "help-circle-outline",
  logout: "log-out-outline",
  delete: "trash-outline",
  chevron: "chevron-forward",
} as const;
export type FunctionalIconName =
  keyof typeof aliases | keyof typeof Ionicons.glyphMap;
export function FunctionalIcon({
  name,
  size = 22,
  color,
  disabled = false,
  label,
  accessibilityLabel,
  accessible,
}: {
  name: FunctionalIconName;
  size?: number;
  color?: string;
  disabled?: boolean;
  label?: string;
  accessibilityLabel?: string;
  accessible?: boolean;
}) {
  const { colors } = useRoamTheme();
  const text = accessible === false ? undefined : (accessibilityLabel ?? label);
  const glyph =
    aliases[name as keyof typeof aliases] ??
    (name as keyof typeof Ionicons.glyphMap);
  return (
    <View
      accessible={!!text}
      accessibilityRole={text ? "image" : undefined}
      accessibilityLabel={text}
      accessibilityElementsHidden={!text}
      importantForAccessibility={text ? "yes" : "no-hide-descendants"}
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? iconTokens.disabledOpacity : 1,
      }}
    >
      <Ionicons
        accessible={false}
        name={glyph}
        size={size}
        color={color ?? colors.textSecondary}
      />
    </View>
  );
}
