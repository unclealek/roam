import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

export function useAccessibilityPreferences() {
  // Start opaque until native preferences have loaded.
  const [reduceTransparency, setTransparency] = useState(true);
  const [increaseContrast, setContrast] = useState(false);
  useEffect(() => {
    let active = true;
    if (Platform.OS === "web") {
      const contrast =
        typeof matchMedia === "function"
          ? matchMedia("(prefers-contrast: more)")
          : null;
      const transparency =
        typeof matchMedia === "function"
          ? matchMedia("(prefers-reduced-transparency: reduce)")
          : null;
      const update = () => {
        setContrast(contrast?.matches ?? false);
        setTransparency(transparency?.matches ?? false);
      };
      update();
      contrast?.addEventListener("change", update);
      transparency?.addEventListener("change", update);
      return () => {
        contrast?.removeEventListener("change", update);
        transparency?.removeEventListener("change", update);
      };
    }
    if (Platform.OS === "ios") {
      void AccessibilityInfo.isReduceTransparencyEnabled()
        .then((v) => {
          if (active) setTransparency(v);
        })
        .catch(() => {});
      void AccessibilityInfo.isDarkerSystemColorsEnabled()
        .then((v) => {
          if (active) setContrast(v);
        })
        .catch(() => {});
    } else if (Platform.OS === "android") {
      void AccessibilityInfo.isHighTextContrastEnabled()
        .then((v) => {
          if (active) setContrast(v);
        })
        .catch(() => {});
    }
    const transparency = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setTransparency,
    );
    const contrast = AccessibilityInfo.addEventListener(
      Platform.OS === "ios"
        ? "darkerSystemColorsChanged"
        : "highTextContrastChanged",
      setContrast,
    );
    return () => {
      active = false;
      transparency.remove();
      contrast.remove();
    };
  }, []);
  return { reduceTransparency, increaseContrast };
}
