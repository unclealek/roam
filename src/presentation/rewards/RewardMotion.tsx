import { useEffect, type ReactNode } from "react";
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
/** A short, interruptible reveal. It never captures touches or delays navigation. */
export function RewardMotion({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const visible = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    visible.value = withTiming(1, {
      duration: reduced ? 0 : 260,
      reduceMotion: ReduceMotion.System,
    });
    return () => cancelAnimation(visible);
  }, [reduced, visible]);
  const style = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [
      { translateY: (1 - visible.value) * 8 },
      { scale: 0.98 + visible.value * 0.02 },
    ],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
