import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
/** Resume only while focused. No interval or continuous network polling. */
export function useResumeRefresh(refresh: () => void) {
  const callback = useRef(refresh);
  useEffect(() => {
    callback.current = refresh;
  }, [refresh]);
  useFocusEffect(
    useCallback(() => {
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") callback.current();
      });
      return () => listener.remove();
    }, []),
  );
}
