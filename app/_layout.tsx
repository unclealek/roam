import { useFonts } from "expo-font";
import type { ReactNode } from "react";
import {
  usePathname,
  Stack,
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
} from "expo-router";
import { useAuth, AuthProvider } from "../src/platform/auth/AuthProvider";
import {
  FeedbackProvider,
  isCriticalFeedbackRoute,
} from "../src/presentation/brand/ToastFeedback";
import { NotificationBridge } from "../src/platform/notifications/NotificationBridge";
import { useRoamTheme } from "../src/presentation/brand/theme";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
export { ErrorBoundary } from "expo-router";
export default function RootLayout() {
  const { colors, dark } = useRoamTheme();
  const [fontsLoaded, fontError] = useFonts({
    Manrope: require("../assets/fonts/Manrope.ttf"),
  });
  if (!fontsLoaded && !fontError) return null;
  const theme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme : DefaultTheme).colors,
      primary: colors.brandPrimary,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
    },
  };
  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <AuthProvider>
          <AccountFeedback>
            <NotificationBridge />
            <StatusBar style={dark ? "light" : "dark"} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(account)" />
              <Stack.Screen name="welcome" />
              <Stack.Screen name="sign-in" />
              <Stack.Screen name="auth/callback" />
            </Stack>
          </AccountFeedback>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AccountFeedback({ children }: { children: ReactNode }) {
  const userId = useAuth().session?.user.id;
  const path = usePathname();
  return (
    <FeedbackProvider
      key={userId ?? "signed-out"}
      suppressActivity={isCriticalFeedbackRoute(path)}
    >
      {children}
    </FeedbackProvider>
  );
}
