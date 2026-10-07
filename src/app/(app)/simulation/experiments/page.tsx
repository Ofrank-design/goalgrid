import { Gate } from "@/components/Gate";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { ExperimentLab } from "@/components/ExperimentLab";

export default async function Experiments({ searchParams }: { searchParams: Promise<{ replay?: string }> }) {
  const v = await getViewer(), sp = await searchParams;
  return hasTier(v.tier, "premium") ? <ExperimentLab replayId={sp.replay} /> : <Gate need="premium" signedIn={v.signedIn} title="Experiment Lab" blurb="Run reproducible simulation variants with the same seed and compare assumptions." />;
}
