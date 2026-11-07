import { Image, View } from "react-native";
import { RoamIcon } from "./RoamIcon";
import { illustrationManifest, type IllustrationName } from "./illustrations";
export function RoamIllustration({
  name,
  size = 96,
  label,
  theme = "brand",
}: {
  name: IllustrationName;
  size?: number;
  label?: string;
  theme?: "brand" | "inverse";
}) {
  const asset = illustrationManifest[name];
  const approved = asset.status === "approved" && asset.source && asset.license;
  return (
    <View
      testID={
        approved ? "illustration-approved" : "illustration-vector-fallback"
      }
      accessible={!!label}
      accessibilityRole={label ? "image" : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {approved ? (
        <Image
          source={asset.source!}
          resizeMode="contain"
          style={{ width: size, height: size }}
          accessible={false}
        />
      ) : (
        <RoamIcon name={asset.fallback} size={size} theme={theme} />
      )}
    </View>
  );
}
