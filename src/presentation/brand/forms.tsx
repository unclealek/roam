import { useState, type ReactNode } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { router } from "expo-router";
import { useRoamTheme } from "./theme";
import { FunctionalIcon } from "../icons";
import { RoamScreen, RoamButton } from "./ui";
export { Body, ErrorState, EmptyState, Loading, RoamCard as Panel } from "./ui";
export function Screen({
  title,
  children,
  backTo = "/groups",
  refreshing,
  onRefresh,
}: {
  title: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  backTo?: "/groups" | "/profile" | "/" | "/rewards" | "/games";
}) {
  const { colors, type } = useRoamTheme();
  return (
    <View style={{ flex: 1 }}>
      <RoamScreen
        background="form"
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              title === "Edit Profile" ? "Back to Profile" : "Go back"
            }
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace(backTo)
            }
            style={{
              minWidth: 44,
              minHeight: 44,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <FunctionalIcon
              name="chevron-back"
              size={24}
              color={colors.textPrimary}
            />
          </Pressable>
          <Text
            accessibilityRole="header"
            style={[type.title2, { color: colors.textPrimary, flex: 1 }]}
          >
            {title}
          </Text>
        </View>
        {children}
      </RoamScreen>
    </View>
  );
}
export function Button({
  danger = false,
  secondary = false,
  ...props
}: Parameters<typeof RoamButton>[0] & { danger?: boolean }) {
  return (
    <RoamButton {...props} secondary={secondary || danger} danger={danger} />
  );
}
export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const { colors, type, radius } = useRoamTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={[type.headline, { color: colors.textPrimary }]}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        style={[
          type.body,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: error
              ? colors.error
              : focused
                ? colors.brandPrimary
                : colors.border,
            borderRadius: radius.control,
            padding: 16,
            minHeight: 54,
          },
          props.style,
        ]}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          style={[type.caption, { color: colors.error }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
