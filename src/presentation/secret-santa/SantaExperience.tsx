import { useEffect, type ReactNode } from "react";
import { Text, View } from "react-native";
import { RoamIllustration } from "../icons";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { RoamBackground } from "../brand/RoamBackground";
import { useRoamTheme } from "../brand/theme";
import { Body, Loading } from "../brand/ui";
import { GlassSurface } from "../brand/GlassSurface";

/** Short finite motion; presentation never determines the draw result. */
export function MysteryGift({ opened = false }: { opened?: boolean }) {
  const { colors } = useRoamTheme();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(
      withTiming(opened ? 1 : 0, {
        duration: 220,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [opened, progress]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -progress.value * 8 },
      { rotate: `${progress.value * -8}deg` },
    ],
  }));
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={opened ? "Opened gift" : "Wrapped mystery gift"}
      style={{ alignItems: "center", padding: 24 }}
    >
      <Animated.View style={style}>
        <View
          style={{
            borderRadius: 24,
            padding: 24,
            backgroundColor: colors.surfaceElevated,
          }}
        >
          <RoamIllustration name="secret-santa" size={90} />
        </View>
      </Animated.View>
    </View>
  );
}
export function SantaMoment({
  kind,
  children,
}: {
  kind: "welcome" | "drawing" | "ready" | "reveal";
  children?: ReactNode;
}) {
  const { colors, type } = useRoamTheme();
  const title = {
    welcome: "Draw names for a gift exchange",
    drawing: "Secret Santa draw",
    ready: "Your assignment is ready",
    reveal: "Open your assignment",
  }[kind];
  return (
    <View style={{ borderRadius: 28, overflow: "hidden" }}>
      <RoamBackground variant={kind === "ready" ? "celebration" : "mystery"}>
        <View style={{ padding: 24, gap: 16 }}>
          <MysteryGift />
          <Text
            accessibilityRole="header"
            style={[type.title1, { color: colors.textPrimary }]}
          >
            {title}
          </Text>
          {kind === "drawing" ? (
            <Body>You can come back when the draw is complete.</Body>
          ) : null}
          {kind === "drawing" ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 18,
                padding: 12,
              }}
            >
              <Loading label="Drawing names…" />
            </View>
          ) : null}
          {children}
        </View>
      </RoamBackground>
    </View>
  );
}
export function ParticipantIdentity({
  name,
  host,
}: {
  name: string;
  host: boolean;
}) {
  const { colors, type } = useRoamTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        paddingVertical: 8,
      }}
    >
      <View
        accessible={false}
        style={{
          borderRadius: 24,
          minWidth: 44,
          minHeight: 44,
          padding: 10,
          backgroundColor: colors.paleBlue,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={[type.headline, { color: colors.brandPrimary }]}>
          {Array.from(name.trim())[0]?.toUpperCase() || "?"}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.headline, { color: colors.textPrimary }]}>
          {name}
          {host ? " · Host" : ""}
        </Text>
        <Body>Joined</Body>
      </View>
    </View>
  );
}
export function SantaHowItWorks() {
  const { colors, type } = useRoamTheme();
  return (
    <>
      <GlassSurface style={{ padding: 16, gap: 8 }}>
        <Text
          accessibilityRole="header"
          style={[type.headline, { color: colors.textPrimary }]}
        >
          How it works
        </Text>
        <Body>1. Invite players.</Body>
        <Body>2. Draw names.</Body>
        <Body>3. Give a gift to the person you draw.</Body>
      </GlassSurface>
    </>
  );
}
