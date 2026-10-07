import { getViewer } from "@/lib/app/session";
import { AppNavClient } from "@/components/AppNavClient";

export async function AppNav() {
  const viewer = await getViewer();
  return <AppNavClient signedIn={viewer.signedIn} />;
}
