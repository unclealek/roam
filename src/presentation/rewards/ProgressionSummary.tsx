import { RoamIcon } from "../icons";
import { router } from "expo-router";
import { getPlayerProgress } from "../../platform/rewards/service";
import { useAccountResource } from "../../platform/sessions/useAccountResource";
import { Body, ErrorState } from "../brand/forms";
import { RoamCard, ProgressIndicator } from "../brand/ui";
/** Compact server-backed entry point. The collection stays in Rewards. */
export function ProgressionSummary() {
  const resource = useAccountResource(getPlayerProgress);
  if (resource.error)
    return <ErrorState message={resource.error} retry={resource.refresh} />;
  if (
    !resource.data ||
    typeof resource.data.total_xp !== "number" ||
    typeof resource.data.level !== "number"
  )
    return null;
  const p = resource.data;
  return (
    <RoamCard
      accessibilityLabel={`Your progression: Level ${p.level}, ${p.total_xp} XP. Open Rewards`}
      onPress={() => router.navigate("/rewards")}
    >
      <RoamIcon name="levels" size={32} />
      <Body>
        Level {p.level} · {p.total_xp.toLocaleString()} XP
      </Body>
      <ProgressIndicator current={p.progress} total={1} />
      <Body>
        {p.xp_to_next_level === null
          ? "Highest current level reached"
          : `${p.xp_to_next_level.toLocaleString()} XP to your next level`}{" "}
        · View Rewards
      </Body>
    </RoamCard>
  );
}
