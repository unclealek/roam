import type { ImageSourcePropType } from "react-native";
import type { RoamIconName } from "./registry";
type IllustrationSlot = {
  path: string;
  width: number;
  height: number;
  fallback: RoamIconName;
  status: "requires-approved-asset" | "approved";
  source: ImageSourcePropType | null;
  license: string | null;
};
const slot = (
  name: string,
  fallback: RoamIconName,
  size = 512,
): IllustrationSlot => ({
  path: `assets/illustrations/${name}.png`,
  width: size,
  height: size,
  fallback,
  status: "requires-approved-asset",
  source: null,
  license: null,
});
/** Keep approved local artwork and documented vector fallbacks in one registry. */
export const illustrationManifest = {
  "secret-santa": slot("secret-santa", "secret-santa"),
  "mind-match": slot("mind-match", "mind-match"),
  "secret-agent": slot("secret-agent", "secret-agent"),
  "completion-trophy": slot("completion-trophy", "trophy"),
  "reward-chest": slot("reward-chest", "chest"),
  points: slot("points", "points"),
  levels: slot("levels", "levels"),
  "empty-groups": slot("empty-groups", "groups"),
  "empty-games": slot("empty-games", "play"),
  "empty-rewards": slot("empty-rewards", "chest"),
} as const;
export type IllustrationName = keyof typeof illustrationManifest;
