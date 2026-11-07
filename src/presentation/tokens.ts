export const tokens = {
  color: {
    background: "#EFF4FC",
    surface: "#FFFFFF",
    ink: "#17254A",
    muted: "#506183",
    primary: "#394BB5",
    accent: "#D9E5FF",
    border: "#C6D2E8",
    danger: "#A7243D",
  },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
  radius: { control: 12, panel: 24 },
  type: { title: 36, heading: 23, body: 17, label: 15 },
} as const;

// Phase 1 semantic theme; legacy screens keep their existing layout and palette.
export { palettes, layout, typography, useRoamTheme } from "./brand/theme";
