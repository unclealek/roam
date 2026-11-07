import { useColorScheme } from "react-native";

export const palettes = {
  light: {
    actionPrimary: "#294F7A",
    actionPrimaryPressed: "#203F63",
    onAction: "#FFFFFF",
    brandPrimary: "#325D8B",
    brandPrimaryPressed: "#274A70",
    brandSecondary: "#A9BDCF",
    background: "#F7F5F0",
    surface: "#FFFEFC",
    surfaceElevated: "#F0EEE8",
    textPrimary: "#1C2838",
    textSecondary: "#5C6877",
    border: "#E4E0D8",
    success: "#176E53",
    warning: "#865000",
    error: "#B12740",
    onPrimary: "#FFFFFF",
    paleBlue: "#E7EEF4",
  },
  dark: {
    actionPrimary: "#315F91",
    actionPrimaryPressed: "#254B75",
    onAction: "#FFFFFF",
    brandPrimary: "#A9C5E0",
    brandPrimaryPressed: "#C1D5E8",
    brandSecondary: "#88A7C4",
    background: "#171D25",
    surface: "#202833",
    surfaceElevated: "#28313C",
    textPrimary: "#F4F1EA",
    textSecondary: "#B9C1CB",
    border: "#3A4551",
    success: "#8AE0BD",
    warning: "#FFD18B",
    error: "#FF9AAE",
    onPrimary: "#24282D",
    paleBlue: "#293746",
  },
} as const;
export const layout = {
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { control: 14, card: 20, pill: 100 },
  elevation: {
    shadowColor: "#1C2838",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
} as const;
export const typography = {
  largeTitle: {
    fontFamily: "Manrope",
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "700",
    letterSpacing: -0.9,
  },
  title1: {
    fontFamily: "Manrope",
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  title2: {
    fontFamily: "Manrope",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headline: {
    fontFamily: "Manrope",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
  },
  body: { fontFamily: "Manrope", fontSize: 16, lineHeight: 25 },
  callout: { fontFamily: "Manrope", fontSize: 15, lineHeight: 23 },
  caption: { fontFamily: "Manrope", fontSize: 13, lineHeight: 19 },
  button: {
    fontFamily: "Manrope",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
  },
} as const;
export const motion = {
  press: 100,
  entrance: 180,
  feedbackTimeout: 4500,
} as const;
export function useRoamTheme() {
  const dark = useColorScheme() === "dark";
  return {
    colors: dark ? palettes.dark : palettes.light,
    dark,
    ...layout,
    type: typography,
  };
}
