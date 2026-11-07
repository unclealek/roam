import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  RoamIcon,
  type RoamIconName,
  FunctionalIcon,
  type FunctionalIconName,
} from "../icons";
import { useRoamTheme, motion } from "./theme";
import { GlassSurface } from "./GlassSurface";
import { selectionFeedback } from "./feedback";
export type ButtonVariant =
  "primary" | "secondary" | "outline" | "ghost" | "destructive" | "glass";
export function RoamButton({
  label,
  accessibilityLabel = label,
  icon,
  actionIcon,
  onPress,
  variant,
  size = "large",
  secondary = false,
  danger = false,
  disabled = false,
  loading = false,
  success = false,
}: {
  label: string;
  accessibilityLabel?: string;
  icon?: RoamIconName;
  actionIcon?: FunctionalIconName;
  onPress: () => void | Promise<void>;
  variant?: ButtonVariant;
  size?: "small" | "medium" | "large";
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  success?: boolean;
}) {
  const { colors, type, radius } = useRoamTheme();
  const [pending, setPending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const selected =
    variant ?? (danger ? "destructive" : secondary ? "outline" : "primary");
  const busy = loading || pending;
  const unavailable = disabled || busy;
  const filled = selected === "primary" || selected === "destructive";
  const ink =
    selected === "primary"
      ? colors.onAction
      : filled
        ? colors.onPrimary
        : selected === "ghost"
          ? colors.brandPrimary
          : colors.textPrimary;
  function animate(value: number) {
    scale.set(
      withTiming(value, {
        duration: motion.press,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }
  async function invoke() {
    if (unavailable || running.current) return;
    running.current = true;
    setError("");
    try {
      if (selected === "primary" || selected === "destructive")
        selectionFeedback();
      const result = onPress();
      if (result && typeof result.then === "function") setPending(true);
      if (result && typeof result.then === "function") await result;
    } catch {
      if (mounted.current)
        setError("Unable to complete this action. Please try again.");
    } finally {
      running.current = false;
      if (mounted.current) setPending(false);
    }
  }
  const control = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: unavailable, busy }}
      aria-busy={busy}
      disabled={unavailable}
      onPress={() => void invoke()}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPressIn={() => animate(0.98)}
      onPressOut={() => animate(1)}
      style={({ pressed }) => ({
        minHeight: size === "small" || size === "medium" ? 44 : 50,
        borderRadius: radius.control,
        paddingHorizontal: size === "small" ? 12 : size === "medium" ? 6 : 18,
        paddingVertical: size === "medium" ? 8 : 10,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: size === "medium" ? 8 : 10,
        backgroundColor:
          selected === "primary"
            ? pressed
              ? colors.actionPrimaryPressed
              : colors.actionPrimary
            : selected === "destructive"
              ? colors.error
              : selected === "secondary"
                ? colors.paleBlue
                : selected === "outline"
                  ? colors.surface
                  : "transparent",
        borderWidth: focused ? 2 : selected === "outline" ? 1 : 0,
        borderColor: focused ? colors.brandPrimary : colors.border,
        opacity: unavailable ? 0.5 : pressed && !filled ? 0.65 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={ink} />
      ) : success ? (
        <FunctionalIcon
          accessible={false}
          name="checkmark"
          color={ink}
          size={20}
        />
      ) : null}
      {!busy && !success && icon ? (
        <RoamIcon
          name={icon}
          size={size === "medium" ? 18 : 20}
          color={ink}
          theme={filled ? "inverse" : "brand"}
        />
      ) : !busy && !success && actionIcon ? (
        <FunctionalIcon name={actionIcon} size={20} color={ink} />
      ) : null}
      <Text
        style={[
          type.button,
          {
            color: ink,
            textAlign: "center",
            flexShrink: 1,
            ...(size === "medium" ? { fontSize: 15, lineHeight: 21 } : {}),
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View>
      <Animated.View style={animated}>
        {selected === "glass" ? (
          <GlassSurface>{control}</GlassSurface>
        ) : (
          control
        )}
      </Animated.View>
      {error ? (
        <Text
          accessibilityRole="alert"
          style={[type.caption, { color: colors.error, marginTop: 8 }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
