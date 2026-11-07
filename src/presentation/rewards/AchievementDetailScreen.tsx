import { rewardHint } from "../copy";
import { useCallback } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AchievementBadge, resolveAchievementIcon } from "../icons";
import { getAchievements } from "../../platform/rewards/service";
import { useAccountResource } from "../../platform/sessions/useAccountResource";
import {
  Body,
  Button,
  Screen,
  Panel,
  Loading,
  ErrorState,
  EmptyState,
} from "../brand/forms";
import { useRoamTheme } from "../brand/theme";
import { RoamMascot } from "../brand/RoamMascot";
export default function AchievementDetailScreen() {
  const { achievementId } = useLocalSearchParams<{ achievementId: string }>();
  const { colors, type } = useRoamTheme();
  const load = useCallback(
    async () =>
      (await getAchievements()).find((item) => item.id === achievementId) ??
      null,
    [achievementId],
  );
  const r = useAccountResource(load);
  return (
    <Screen title={r.data?.name ?? "Achievement"} backTo="/rewards">
      {r.loading ? (
        <Loading label="Loading achievement…" />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.refresh} />
      ) : r.data ? (
        <Panel>
          <AchievementBadge
            name={resolveAchievementIcon(r.data.id)}
            state={r.data.earned_id ? "unlocked" : "locked"}
            size={112}
            label={`${r.data.name} badge`}
          />
          <Text
            accessibilityRole="header"
            style={[type.title1, { color: colors.textPrimary }]}
          >
            {r.data.name}
          </Text>
          <RoamMascot
            placement="small"
            size={120}
            state={r.data.earned_id ? "happy" : "curious"}
          />
          <Body>{rewardHint(r.data.id, r.data.description)}</Body>
          <Body>
            {r.data.unlocked_at
              ? `Earned ${new Date(r.data.unlocked_at).toLocaleDateString()}`
              : "Locked · Keep playing to unlock."}
          </Body>

          {r.data.game_type_id ? (
            <Body>Game: {r.data.game_type_id.replaceAll("_", " ")}</Body>
          ) : null}
        </Panel>
      ) : (
        <EmptyState
          title="Achievement not found"
          message="Return to Rewards to see your achievements."
        />
      )}
      <Button
        label="Back to rewards"
        onPress={() => router.dismissTo("/rewards")}
      />
    </Screen>
  );
}
