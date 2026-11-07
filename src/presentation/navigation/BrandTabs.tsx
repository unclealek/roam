import { Tabs } from "expo-router";
import { RoamIcon } from "../icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoamTheme } from "../brand/theme";
import { selectionFeedback } from "../brand/feedback";
export const tabItems = [
  { name: "index", label: "Home", icon: "home", selected: "home" },
  {
    name: "groups",
    label: "Groups",
    icon: "groups",
    selected: "groups",
  },
  {
    name: "games",
    label: "Play",
    icon: "play",
    selected: "play",
  },
  { name: "rewards", label: "Rewards", icon: "rewards", selected: "rewards" },
  {
    name: "profile",
    label: "Profile",
    icon: "profile",
    selected: "profile",
  },
] as const;
export function BrandTabs() {
  const { colors } = useRoamTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: "Manrope",
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.1,
        },
      }}
    >
      {tabItems.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          listeners={{ tabPress: selectionFeedback }}
          options={{
            title: tab.label,
            tabBarAccessibilityLabel: tab.label,
            tabBarIcon: ({ focused }) => (
              <RoamIcon
                name={tab.icon}
                active={focused}
                size={24}
                color={focused ? undefined : colors.textSecondary}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
