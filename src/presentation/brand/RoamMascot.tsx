import {
  Image,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from "react-native";

// Optional pose exports can replace the native rendering without changing callers.
export const mascotAssets: Record<
  "welcome" | "peek" | "small",
  ImageSourcePropType | null
> = {
  welcome: null,
  peek: null,
  small: null,
};
/** Native reconstruction of the Figma Make penguin (156 × 180 design units). */
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
  const source = mascotAssets[placement] ?? mascotAssets.welcome;
  const scale = size / 180;
  const shape = (style: ViewStyle, children?: React.ReactNode) => (
    <View style={[{ position: "absolute" }, style]}>{children}</View>
  );
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
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {source ? (
        <Image
          source={source}
          resizeMode="contain"
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <View
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 156,
            height: 180,
            transform: [{ scale }],
            opacity: state === "waiting" ? 0.9 : 1,
          }}
        >
          {shape({
            width: 47,
            height: 18,
            left: 20,
            top: 152,
            borderRadius: 30,
            backgroundColor: "#F2A13F",
            transform: [{ rotate: "-8deg" }],
          })}
          {shape({
            width: 47,
            height: 18,
            right: 20,
            top: 152,
            borderRadius: 30,
            backgroundColor: "#F2A13F",
            transform: [{ rotate: "8deg" }],
          })}
          {shape({
            width: 51,
            height: 91,
            left: 4,
            top: 55,
            borderRadius: 35,
            backgroundColor: "#403057",
            transform: [{ rotate: "32deg" }],
          })}
          {shape({
            width: 51,
            height: 91,
            right: 3,
            top: 55,
            borderRadius: 35,
            backgroundColor: "#403057",
            transform: [{ rotate: "-32deg" }],
          })}
          {shape(
            {
              width: 118,
              height: 137,
              left: 19,
              top: 25,
              borderTopLeftRadius: 62,
              borderTopRightRadius: 62,
              borderBottomLeftRadius: 52,
              borderBottomRightRadius: 52,
              backgroundColor: "#49355F",
            },
            <>
              {shape({
                width: 64,
                height: 58,
                left: 27,
                top: 71,
                borderRadius: 34,
                backgroundColor: "#EDE2F8",
              })}
              {shape(
                {
                  width: 98,
                  height: 84,
                  left: 10,
                  top: 20,
                  borderRadius: 48,
                  backgroundColor: "#FAF6FF",
                },
                <>
                  {[28, 60].map((left) => (
                    <View
                      key={left}
                      style={{
                        position: "absolute",
                        width: 10,
                        height: 14,
                        left,
                        top: 31,
                        borderRadius: 8,
                        backgroundColor: "#202038",
                      }}
                    >
                      <View
                        style={{
                          width: 3,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: "white",
                          left: 3,
                          top: 3,
                        }}
                      />
                    </View>
                  ))}
                  {shape({
                    width: 24,
                    height: 20,
                    left: 37,
                    top: 54,
                    borderRadius: 10,
                    borderWidth: 3,
                    borderColor: "#33233D",
                    backgroundColor: "#7F3F65",
                  })}
                  {shape({
                    width: 21,
                    height: 13,
                    left: 39,
                    top: 44,
                    borderRadius: 9,
                    backgroundColor: "#F59A27",
                  })}
                  {[12, 69].map((left) => (
                    <View
                      key={left}
                      style={{
                        position: "absolute",
                        width: 17,
                        height: 8,
                        top: 51,
                        left,
                        borderRadius: 10,
                        backgroundColor: "#FFC1CB",
                      }}
                    />
                  ))}
                </>,
              )}
              {shape({
                width: 94,
                height: 12,
                left: 12,
                top: -3,
                borderRadius: 8,
                backgroundColor: "#8B5039",
                transform: [{ rotate: "-2deg" }],
              })}
              {[20, 59].map((left, i) => (
                <View
                  key={left}
                  style={{
                    position: "absolute",
                    width: 39,
                    height: 31,
                    left,
                    top: -18,
                    borderRadius: 22,
                    backgroundColor: "#93BFF2",
                    borderWidth: 6,
                    borderColor: "#AD603D",
                    transform: [{ rotate: i ? "8deg" : "-8deg" }],
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 15,
                      borderWidth: 2,
                      borderColor: "#E9A55A",
                    }}
                  />
                </View>
              ))}
              {shape(
                {
                  width: 113,
                  height: 22,
                  left: 4,
                  top: 88,
                  borderRadius: 10,
                  backgroundColor: "#FF9C2F",
                  transform: [{ rotate: "5deg" }],
                },
                shape({
                  width: 24,
                  height: 52,
                  right: 5,
                  top: 11,
                  borderRadius: 9,
                  backgroundColor: "#F58B2D",
                  transform: [{ rotate: "-16deg" }],
                }),
              )}
            </>,
          )}
        </View>
      )}
    </View>
  );
}
