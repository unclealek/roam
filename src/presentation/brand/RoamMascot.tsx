import { Image, View } from "react-native";
import wave from "../../../assets/onboarding/roam-mascot-wave.png";
import explorer from "../../../assets/onboarding/roam-mascot-explorer.png";
import run from "../../../assets/onboarding/roam-mascot-run.png";

export const mascotAssets = {
  welcome: wave,
  peek: explorer,
  small: wave,
  adventure: run,
};

export function RoamMascot({
  size = 280,
  placement = "welcome",
  accessibilityLabel = "Roam mascot",
  animationState = "idle",
  state = "welcome",
}: {
  size?: number;
  placement?: keyof typeof mascotAssets;
  accessibilityLabel?: string;
  animationState?: "idle" | "entrance";
  state?:
    "welcome" | "curious" | "happy" | "waiting" | "celebrating" | "encouraging";
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={`roam-mascot-${animationState}`}
      style={{
        width: size,
        height: size,
        maxWidth: "100%",
        alignSelf: "center",
      }}
    >
      <Image
        source={mascotAssets[placement]}
        resizeMode="contain"
        style={{
          width: "100%",
          height: "100%",
          opacity: state === "waiting" ? 0.9 : 1,
        }}
      />
    </View>
  );
}
