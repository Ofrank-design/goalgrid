import Link from "next/link";
import { Gate } from "@/components/Gate";
import { SeasonSim } from "@/components/SeasonSim";
import { getViewer } from "@/lib/app/session";
import { hasTier } from "@/lib/entitlements";
import { LIMITS } from "@/lib/simulation/server";
export const dynamic = "force-dynamic";
export default async function SeasonPage() {
  const v = await getViewer(); if (!hasTier(v.tier, "pro")) return <Gate need="pro" signedIn={v.signedIn} title="Season simulation" blurb="Simulate a league season thousands of times and see how often each club finishes where." />;
  return (<><div className="row"><div><h1>Season simulation</h1><p className="sub">Monte Carlo over hypothetical seasons. Not a forecast of the real table.</p></div><Link className="btn sm" href="/simulation">Back</Link></div><SeasonSim maxSeasons={hasTier(v.tier, "premium") ? LIMITS.premium.season : LIMITS.pro.season} /></>);
}
