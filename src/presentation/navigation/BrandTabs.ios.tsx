import { navigationAssets } from "../icons/navigationAssets";
import { NativeTabs } from "expo-router/native-tabs";
import { useRoamTheme } from "../brand/theme";
import { selectionFeedback } from "../brand/feedback";
import { useAccessibilityPreferences } from "../brand/useAccessibilityPreferences";

export function BrandTabs() {
  const { colors } = useRoamTheme();
  const { reduceTransparency, increaseContrast } =
    useAccessibilityPreferences();
  // UIKit owns Liquid Glass on iOS 26+ and observes system accessibility settings.
  // Earlier iOS versions use a standard native material, or opaque accessibility fallback.
  return (
    <NativeTabs
      tintColor={colors.brandPrimary}
      iconColor={{
        default: colors.textSecondary,
        selected: colors.brandPrimary,
      }}
      labelStyle={{
        default: { color: colors.textSecondary },
        selected: { color: colors.brandPrimary },
      }}
      backgroundColor={colors.surface}
      blurEffect={
        reduceTransparency || increaseContrast ? "none" : "systemMaterial"
      }
      disableTransparentOnScrollEdge
    >
      <NativeTabs.Trigger
        name="index"
        accessibilityLabel="Home"
        listeners={{ tabPress: selectionFeedback }}
      >
        <NativeTabs.Trigger.Icon
          src={navigationAssets.home}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="groups"
        accessibilityLabel="Groups"
        listeners={{ tabPress: selectionFeedback }}
      >
        <NativeTabs.Trigger.Icon
          src={navigationAssets.groups}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Groups</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="games"
        accessibilityLabel="Play"
        listeners={{ tabPress: selectionFeedback }}
      >
        <NativeTabs.Trigger.Icon
          src={navigationAssets.play}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Play</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="rewards"
        accessibilityLabel="Rewards"
        listeners={{ tabPress: selectionFeedback }}
      >
        <NativeTabs.Trigger.Icon
          src={navigationAssets.rewards}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Rewards</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="profile"
        accessibilityLabel="Profile"
        listeners={{ tabPress: selectionFeedback }}
      >
        <NativeTabs.Trigger.Icon
          src={navigationAssets.profile}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
