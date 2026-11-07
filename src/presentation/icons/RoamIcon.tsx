import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import { useRoamTheme } from "../brand/theme";
import { getIconSvg, type RoamIconName, type IconVariant } from "./registry";
import { iconTokens } from "./iconTokens";
export type RoamIconProps = {
  name: RoamIconName;
  size?: number;
  color?: string;
  variant?: IconVariant;
  active?: boolean;
  disabled?: boolean;
  theme?: "brand" | "inverse";
  label?: string;
  accessibilityLabel?: string;
  badge?: boolean;
};
/** Decorative by default: the surrounding control owns its accessible name. */
export function RoamIcon({
  name,
  size = 24,
  color,
  variant = "duotone",
  active,
  disabled = false,
  theme = "brand",
  label,
  accessibilityLabel,
  badge = false,
}: RoamIconProps) {
  const { colors } = useRoamTheme();
  const text = accessibilityLabel ?? label;
  const iconColor = iconTokens.colors[name];
  const ink =
    color ??
    (theme === "inverse"
      ? colors.onAction
      : (iconColor?.ink ?? colors.brandPrimary));
  const xml = getIconSvg(name, {
    ink,
    wash:
      theme === "inverse" ? "#FFFFFF30" : (iconColor?.wash ?? colors.paleBlue),
    accent:
      theme === "inverse"
        ? "#FFFFFF"
        : (iconColor?.accent ?? colors.brandSecondary),
    variant: active === undefined ? variant : active ? "active" : "inactive",
    badge,
  });
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
        flexShrink: 0,
        opacity: disabled ? iconTokens.disabledOpacity : 1,
      }}
    >
      <SvgXml xml={xml} width={size} height={size} accessible={false} />
    </View>
  );
}
