import { PlayerAvatar } from "./PlayerAvatar";
import { RoamButton } from "./RoamButton";
import { RoamBackground, type BackgroundVariant } from "./RoamBackground";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  RoamIcon,
  RoamIllustration,
  type RoamIconName,
  FunctionalIcon,
  type FunctionalIconName,
} from "../icons";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useRoamTheme, typography as type } from "./theme";
import { GlassSurface } from "./GlassSurface";
import { selectionFeedback } from "./feedback";
export { RoamButton } from "./RoamButton";

export function RoamScreen({
  children,
  background = "standard",
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode;
  background?: BackgroundVariant;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <RoamBackground variant={background}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.screen}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </RoamBackground>
  );
}
export function RoamHeader({
  title,
  subtitle,
  eyebrow,
  profileName,
  profileAction,
  action,
  actionLabel,
  icon = "notifications-outline",
  badgeCount = 0,
}: {
  title: string;
  badgeCount?: number;
  subtitle?: string;
  eyebrow?: string;
  profileName?: string;
  profileAction?: () => void;
  action?: () => void;
  actionLabel?: string;
  icon?: FunctionalIconName;
}) {
  const { colors } = useRoamTheme();
  return (
    <View style={styles.header}>
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? (
          <Text
            style={{
              ...type.caption,
              color: colors.textSecondary,
            }}
          >
            {eyebrow}
          </Text>
        ) : null}
        {title ? (
          <Text
            accessibilityRole="header"
            style={[type.title1, { color: colors.textPrimary }]}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[type.body, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? (
        <GlassSurface>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={action}
            style={({ pressed }) => ({
              minWidth: 48,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.55 : 1,
            })}
          >
            <FunctionalIcon name={icon} size={23} color={colors.textPrimary} />
            {badgeCount > 0 ? (
              <View
                accessible={false}
                style={{
                  position: "absolute",
                  top: 5,
                  right: 5,
                  minWidth: 16,
                  borderRadius: 8,
                  backgroundColor: colors.actionPrimary,
                  paddingHorizontal: 3,
                }}
              >
                <Text
                  style={{
                    color: colors.onAction,
                    fontSize: 10,
                    textAlign: "center",
                  }}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </GlassSurface>
      ) : null}
      {profileName && profileAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          onPress={profileAction}
          style={{ minWidth: 44, minHeight: 48, justifyContent: "center" }}
        >
          <PlayerAvatar name={profileName} size={44} />
        </Pressable>
      ) : null}
    </View>
  );
}
export function RoamCard({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  backgroundImage,
  backgroundImageOpacity = 0.68,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  backgroundImage?: ImageSourcePropType;
  backgroundImageOpacity?: number;
}) {
  const { colors, radius, elevation } = useRoamTheme();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const animate = (value: number) => {
    scale.set(
      withTiming(value, {
        duration: 120,
        reduceMotion: ReduceMotion.System,
      }),
    );
  };
  const body = (
    <View
      style={{
        padding: 18,
        gap: 12,
      }}
    >
      {children}
    </View>
  );
  const content = (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        ...elevation,
      }}
    >
      {backgroundImage ? (
        <ImageBackground
          source={backgroundImage}
          resizeMode="cover"
          imageStyle={{ opacity: backgroundImageOpacity }}
        >
          {body}
        </ImageBackground>
      ) : (
        body
      )}
    </View>
  );
  return (
    <Animated.View style={style}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          onPressIn={() => animate(0.985)}
          onPressOut={() => animate(1)}
          onPress={() => {
            selectionFeedback();
            onPress();
          }}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
    </Animated.View>
  );
}
export function SectionHeading({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: RoamIconName;
}) {
  const { colors } = useRoamTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 8,
      }}
    >
      {icon ? <RoamIcon name={icon} size={24} /> : null}
      <Text
        accessibilityRole="header"
        style={[type.title2, { color: colors.textPrimary, marginTop: 8 }]}
      >
        {children}
      </Text>
    </View>
  );
}
export function Body({ children }: { children: ReactNode }) {
  const { colors } = useRoamTheme();
  return (
    <Text style={[type.body, { color: colors.textSecondary }]}>{children}</Text>
  );
}
export function Loading({ label = "Loading…" }: { label?: string }) {
  const { colors } = useRoamTheme();
  return (
    <View style={{ paddingVertical: 18, gap: 12 }}>
      <ActivityIndicator color={colors.brandPrimary} />
      <Text
        accessibilityLiveRegion="polite"
        style={[type.callout, { color: colors.textSecondary }]}
      >
        {label}
      </Text>
    </View>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  const { colors } = useRoamTheme();
  return (
    <RoamCard>
      <Text
        accessibilityRole="alert"
        style={[type.body, { color: colors.error }]}
      >
        {message}
      </Text>
      {retry ? (
        <RoamButton label="Try again" onPress={retry} secondary />
      ) : null}
    </RoamCard>
  );
}
export function EmptyState({
  title,
  message,
  illustration,
}: {
  title: string;
  message?: string;
  illustration?: "empty-games" | "empty-groups" | "empty-rewards";
}) {
  const { colors } = useRoamTheme();
  return (
    <RoamCard>
      {illustration ? <RoamIllustration name={illustration} size={80} /> : null}
      <Text
        accessibilityRole="header"
        style={[type.headline, { color: colors.textPrimary }]}
      >
        {title}
      </Text>
      {message ? <Body>{message}</Body> : null}
    </RoamCard>
  );
}
export function ProgressIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const { colors } = useRoamTheme();
  const safeTotal = Math.max(1, total);
  const value = Math.max(0, Math.min(current, safeTotal));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Progress to next level"
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={value}
      accessibilityValue={{ min: 0, max: safeTotal, now: value }}
      style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.paleBlue,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${(value / safeTotal) * 100}%`,
          height: "100%",
          backgroundColor: colors.brandPrimary,
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: {
    padding: 22,
    gap: 18,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    // UIKit adds the native tab/safe-area inset. JS tabs occupy normal layout space.
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    marginTop: 8,
  },
  button: {
    minHeight: 54,
    borderRadius: 100,
    paddingHorizontal: 22,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
