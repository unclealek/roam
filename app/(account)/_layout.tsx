import { useEffect } from "react";
import { rememberSantaInvitation } from "../../src/games/secret-santa/pending-invitation";
import {
  Redirect,
  Stack,
  useGlobalSearchParams,
  usePathname,
} from "expo-router";
import { useAuth } from "../../src/platform/auth/AuthProvider";
import { ErrorState, Screen } from "../../src/presentation/ui";
export default function AccountLayout() {
  const auth = useAuth();
  const params = useGlobalSearchParams();
  const pathname = usePathname();
  useEffect(() => {
    if (!auth.session && pathname === "/game/secret_santa/join")
      rememberSantaInvitation(params.code);
  }, [auth.session, pathname, params.code]);
  if (auth.loading) return null;
  if (!auth.session && auth.error)
    return (
      <Screen title="Roam">
        <ErrorState message={auth.error} retry={auth.retry} />
      </Screen>
    );
  if (!auth.session) return <Redirect href="/sign-in" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
