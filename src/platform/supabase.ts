import "react-native-url-polyfill/auto";
import { createSessionStorage } from "./auth/storage";
import type { Database } from "./database.types";
import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const isConfigured = Boolean(
  url && key && !url.includes("YOUR_PROJECT") && !key.includes("REPLACE_ME"),
);
// Web uses browser storage; native sessions use the OS keychain/keystore.
const storage =
  Platform.OS === "web"
    ? {
        getItem: async (name: string) =>
          typeof window === "undefined"
            ? null
            : window.localStorage.getItem(name),
        setItem: async (name: string, value: string) => {
          if (typeof window !== "undefined")
            window.localStorage.setItem(name, value);
        },
        removeItem: async (name: string) => {
          if (typeof window !== "undefined")
            window.localStorage.removeItem(name);
        },
      }
    : createSessionStorage({
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      });
export const supabase = isConfigured
  ? createClient<Database>(url!, key!, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        lock: processLock,
      },
    })
  : null;
export function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}
