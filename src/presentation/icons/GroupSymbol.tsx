import { RoamIcon } from "./RoamIcon";
import { FunctionalIcon, type FunctionalIconName } from "./FunctionalIcon";
/** Keep persisted group keys stable while replacing emoji presentation. */
export function GroupSymbol({
  iconKey,
  size = 24,
}: {
  iconKey: string | null;
  size?: number;
}) {
  const utility: Record<string, FunctionalIconName> = {
    coffee: "cafe-outline",
    planet: "planet-outline",
    heart: "heart-outline",
    sparkles: "sparkles-outline",
  };
  return iconKey && utility[iconKey] ? (
    <FunctionalIcon name={utility[iconKey]} size={size} />
  ) : (
    <RoamIcon name="groups" size={size} />
  );
}
