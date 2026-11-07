import type { RoamIconName } from "./registry";

type IconColor = { ink: string; wash: string; accent: string };
const iconColors: Partial<Record<RoamIconName, IconColor>> = {
  home: { ink: "#315F91", wash: "#E5EFF7", accent: "#79A9D2" },
  groups: { ink: "#317A62", wash: "#E6F2EC", accent: "#7DB79D" },
  play: { ink: "#7653A5", wash: "#EEE8F5", accent: "#B4A0D1" },
  rewards: { ink: "#A36A1D", wash: "#F8EEDD", accent: "#D9AA4E" },
  profile: { ink: "#A65363", wash: "#F7E9EA", accent: "#D7949A" },
  "secret-santa": { ink: "#9A4F47", wash: "#F6E8E3", accent: "#D88E61" },
  "mind-match": { ink: "#A44C82", wash: "#F5E7F0", accent: "#D796BE" },
  "secret-agent": { ink: "#526779", wash: "#E8EEF1", accent: "#9EB3C1" },
  challenge: { ink: "#A36A1D", wash: "#F8EEDD", accent: "#D9AA4E" },
  trophy: { ink: "#A36A1D", wash: "#F8EEDD", accent: "#D9AA4E" },
  points: { ink: "#A36A1D", wash: "#F8EEDD", accent: "#D9AA4E" },
  chest: { ink: "#A36A1D", wash: "#F8EEDD", accent: "#D9AA4E" },
  achievement: { ink: "#7653A5", wash: "#EEE8F5", accent: "#B4A0D1" },
  "challenge-champion": {
    ink: "#A36A1D",
    wash: "#F8EEDD",
    accent: "#D9AA4E",
  },
  "first-game": { ink: "#317A62", wash: "#E6F2EC", accent: "#7DB79D" },
  "team-player": { ink: "#317A62", wash: "#E6F2EC", accent: "#7DB79D" },
  "mind-reader": { ink: "#A44C82", wash: "#F5E7F0", accent: "#D796BE" },
};

export const iconTokens = {
  size: {
    small: 18,
    control: 22,
    navigation: 24,
    card: 32,
    badge: 56,
    hero: 96,
  },
  viewBox: 32,
  disabledOpacity: 0.45,
  stroke: 2,
  colors: iconColors,
} as const;
