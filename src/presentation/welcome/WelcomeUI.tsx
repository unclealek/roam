import type { ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoamTheme } from "../brand/theme";
import { RoamBackground } from "../brand/RoamBackground";
import { RoamMascot } from "../brand/RoamMascot";
export { RoamButton as WelcomeButton } from "../brand/ui";
export function WelcomeFrame({ children }: { children: ReactNode }) {
  return (
    <RoamBackground>
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "transparent",
          overflow: "hidden",
        }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </RoamBackground>
  );
}
export function Mascot({ peek = false }: { peek?: boolean }) {
  const { width } = useWindowDimensions();
  return (
    <View style={{ paddingVertical: 8 }}>
      <RoamMascot
        size={Math.min(width - 56, peek ? 280 : 330)}
        placement={peek ? "peek" : "welcome"}
      />
    </View>
  );
}
export function useWelcomeStyles() {
  const { colors, dark, type } = useRoamTheme();
  return {
    colors,
    dark,
    styles: StyleSheet.create({
      title: { ...type.largeTitle, color: colors.textPrimary },
      body: { ...type.body, color: colors.textSecondary },
      link: {
        ...type.callout,
        color: colors.textPrimary,
        textAlign: "center",
        textDecorationLine: "underline",
        paddingVertical: 14,
        minHeight: 48,
      },
      headingBlock: { gap: 12 },
      footer: { gap: 12, marginTop: "auto", paddingTop: 16 },
    }),
  };
}
const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
});
