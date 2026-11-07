import { CreateGroup } from "../../../src/presentation/groups/GroupScreens";
import { useAuth } from "../../../src/platform/auth/AuthProvider";
export default function Page() {
  const userId = useAuth().session?.user.id;
  return <CreateGroup key={userId} />;
}
