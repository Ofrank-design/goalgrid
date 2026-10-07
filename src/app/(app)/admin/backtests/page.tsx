import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/ops/admin";
import { getLeagueModels } from "@/lib/engine/predictions";
import { AdminBacktestPanel } from "@/components/AdminBacktestPanel";
export const dynamic = "force-dynamic";
export default async function AdminBacktestsPage(){
  if (!(await getAdmin())) notFound();
  const r = await getLeagueModels("premier-league").catch(() => null);
  const models = (r?.registry ?? []).filter(x => x.kind === "base" && x.status !== "retired").map(x => ({ id:x.id, name:x.name, family:String(x.family), status:x.status }));
  return <AdminBacktestPanel initialModels={models}/>;
}
