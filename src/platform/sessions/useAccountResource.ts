import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../auth/AuthProvider";
export function useAccountResource<T>(
  load: () => Promise<T>,
  { retainOnRefresh = false }: { retainOnRefresh?: boolean } = {},
) {
  const userId = useAuth().session?.user.id;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    userId: string | undefined;
    load: (() => Promise<T>) | null;
    attempt: number;
    data: T | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
  }>({
    userId: undefined,
    load: null,
    attempt: 0,
    data: null,
    loading: true,
    refreshing: false,
    error: null,
  });
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      setState((previous) => ({
        userId,
        load,
        attempt,
        data:
          retainOnRefresh &&
          previous.userId === userId &&
          previous.load === load
            ? previous.data
            : null,
        refreshing: Boolean(
          retainOnRefresh &&
          previous.userId === userId &&
          previous.load === load &&
          previous.data,
        ),
        loading: !(
          retainOnRefresh &&
          previous.userId === userId &&
          previous.load === load &&
          previous.data
        ),
        error: null,
      }));
      let timeout: ReturnType<typeof setTimeout>;
      // Bound read feedback only; never retry a mutation or accept late read results.
      const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Read timed out")), 20000);
      });
      void Promise.race([Promise.resolve().then(load), deadline])
        .then((data) => {
          if (active)
            setState({
              userId,
              load,
              attempt,
              data,
              loading: false,
              refreshing: false,
              error: null,
            });
        })
        .catch(() => {
          if (active)
            setState((previous) => ({
              userId,
              load,
              attempt,
              data:
                retainOnRefresh &&
                previous.userId === userId &&
                previous.load === load
                  ? previous.data
                  : null,
              loading: false,
              refreshing: false,
              error:
                "Unable to load this content. Check your connection and try again.",
            }));
        })
        .finally(() => clearTimeout(timeout));
      return () => {
        clearTimeout(timeout);
        active = false;
      };
    }, [userId, load, attempt, retainOnRefresh]),
  );
  return {
    ...(state.userId === userId &&
    (state.attempt === attempt || retainOnRefresh) &&
    state.load === load
      ? state
      : { data: null, loading: true, refreshing: false, error: null }),
    refresh: () => setAttempt((n) => n + 1),
  };
}
