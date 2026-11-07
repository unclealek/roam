import { View } from "react-native";
import { RoamIcon } from "./RoamIcon";
import type { RoamIconName } from "./registry";
import { useRoamTheme } from "../brand/theme";
import { FunctionalIcon } from "./FunctionalIcon";
export function AchievementBadge({
  name,
  state = "unlocked",
  size = 56,
  progress = 0,
  label,
}: {
  name: RoamIconName;
  state?: "locked" | "unlocked" | "progress";
  size?: number;
  progress?: number;
  label?: string;
}) {
  const { colors } = useRoamTheme();
  const value = Math.round(
    Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)) * 100,
  );
  return (
    <View
      accessible={!!label}
      accessibilityRole={label ? "image" : undefined}
      accessibilityLabel={label}
      style={{ width: size, minHeight: size, alignItems: "center", gap: 4 }}
    >
      <RoamIcon
        name={name}
        badge
        size={size}
        color={state === "locked" ? colors.textSecondary : colors.brandPrimary}
        variant={state === "locked" ? "inactive" : "duotone"}
      />
      {state === "locked" ? (
        <View
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            borderRadius: 12,
            padding: 3,
            backgroundColor: colors.surface,
          }}
        >
          <FunctionalIcon name="lock" size={Math.max(12, size * 0.22)} />
        </View>
      ) : null}
      {state === "progress" ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Achievement progress"
          accessibilityValue={{ min: 0, max: 100, now: value }}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          style={{
            width: size,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.paleBlue,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${value}%`,
              height: 4,
              backgroundColor: colors.brandPrimary,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
