import Link from "next/link";
import { Gate } from "@/components/Gate";
import { PageHero } from "@/components/PageHero";
import { SimLab } from "@/components/SimLab";
import { requireUser } from "@/lib/community/api";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { LIMITS } from "@/lib/simulation/server";
import { loadStoredMatch } from "@/lib/simulation/stored";
export const dynamic = "force-dynamic";
export default async function Simulation({ searchParams }: { searchParams: Promise<{ replay?: string }> }) {
  const v = await getViewer(); if (!hasTier(v.tier, "pro")) return <Gate need="pro" signedIn={v.signedIn} title="Simulation Lab" blurb="Run hypothetical matches with real clubs, test scenarios, repeat a match thousands of times and watch it play out on a pitch. Synthetic results only." />;
  const premium = hasTier(v.tier, "premium"), max = premium ? LIMITS.premium.multi : LIMITS.pro.multi, sp = await searchParams, u = sp.replay ? await requireUser() : null, initial = u && sp.replay ? await loadStoredMatch(u.id, sp.replay).catch(() => null) : null;
  return (<><PageHero image="simulation" badge="PRO" title="Simulation Lab" subtitle="Pick two real clubs, set a scenario and watch a completely hypothetical match play out. Synthetic data. Research only." position="50% 60%" />
    <div className="chips"><Link className="chip" href="/simulation/season">Season simulation</Link><Link className="chip" href="/simulation/history">History and replay</Link></div>
    {sp.replay && !initial && <div className="err">That run could not be found, or it is not a stored match.</div>}
    <SimLab maxRuns={max} premium={premium} initial={initial ?? undefined} /></>);
}
