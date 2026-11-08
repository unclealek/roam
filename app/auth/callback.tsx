import { pendingSantaInvitation } from "../../src/games/secret-santa/pending-invitation";
import { useEffect, useState } from "react";
import { Redirect, router } from "expo-router";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { useAuth } from "../../src/platform/auth/AuthProvider";
import { finishSignIn } from "../../src/platform/auth/sign-in";
import { Button, ErrorState, Loading, Screen } from "../../src/presentation/ui";
export default function Callback() {
  const { session } = useAuth();
  const [error, setError] = useState(false);
  const url = Linking.useURL();
  useEffect(() => {
    const callback =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.href
        : url;
    if (!callback || session) return;
    void finishSignIn(callback).catch(() => setError(true));
  }, [url, session]);
  useEffect(() => {
    if (session && Platform.OS === "web" && typeof window !== "undefined")
      window.history.replaceState(null, "", "/auth/callback");
  }, [session]);
  if (session)
    return <Redirect href={(pendingSantaInvitation() || "/") as never} />;
  return (
    <Screen title="Signing in">
      {error ? (
        <ErrorState message="Your Roam sign-in didn’t finish. Go back to sign in and try again." />
      ) : (
        <Loading label="Signing in…" />
      )}
      <Button
        label="Back to sign in"
        onPress={() => router.replace("/sign-in")}
      />
    </Screen>
  );
}
