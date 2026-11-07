import { Redirect } from "expo-router";
import { useAuth } from "../../src/platform/auth/AuthProvider";
import { Screen, ErrorState } from "../../src/presentation/ui";
import { BrandTabs } from "../../src/presentation/navigation/BrandTabs";
export default function TabLayout() {
  const auth = useAuth();
  if (auth.loading) return null;
  if (!auth.session && auth.error)
    return (
      <Screen title="Roam">
        <ErrorState message={auth.error} retry={auth.retry} />
      </Screen>
    );
  if (!auth.session) return <Redirect href="/welcome" />;
  return <BrandTabs />;
}
