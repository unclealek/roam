import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { loadProfile, type Profile } from "../profiles/service";

type Auth = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  error: string | null;
  retry: () => void;
  reloadProfile: () => Promise<void>;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const revision = useRef(0);
  const reloadProfile = useCallback(async () => {
    const current = ++revision.current;
    await Promise.resolve();
    if (current !== revision.current) return;
    setProfile(null);
    if (!session) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    setError(null);
    try {
      const result = await loadProfile(session.user.id);
      if (current === revision.current) setProfile(result);
    } catch {
      if (current === revision.current)
        setError(
          "Unable to load your profile. Check your connection and retry.",
        );
    } finally {
      if (current === revision.current) setProfileLoading(false);
    }
  }, [session]);
  useEffect(() => {
    const counter = revision;
    let cancelled = false;
    // Defer profile I/O outside the auth notification callback and its session lock.
    void Promise.resolve().then(() => {
      if (!cancelled) return reloadProfile();
    });
    return () => {
      cancelled = true;
      counter.current++;
    };
  }, [reloadProfile]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let changed = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      changed = true;
      if (active) {
        if (!next) setError(null);
        setSession(next);
        setLoading(false);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error: failure }) => {
        if (!active || changed) return;
        if (failure) setError("Unable to restore your session. Please retry.");
        else setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (active && !changed) {
          setError("Unable to restore your session. Please retry.");
          setLoading(false);
        }
      });
    const refresh = (state: string | null | undefined) => {
      if (state === "active") supabase?.auth.startAutoRefresh();
      else supabase?.auth.stopAutoRefresh();
    };
    refresh(AppState.currentState);
    const listener = AppState.addEventListener("change", refresh);
    return () => {
      active = false;
      subscription.unsubscribe();
      listener.remove();
      supabase?.auth.stopAutoRefresh();
    };
  }, [attempt]);
  return (
    <Context.Provider
      value={{
        session,
        profile,
        loading,
        profileLoading,
        error,
        retry: () => {
          setLoading(Boolean(supabase));
          setError(null);
          setAttempt((x) => x + 1);
        },
        reloadProfile,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error("AuthProvider is required.");
  return auth;
}
