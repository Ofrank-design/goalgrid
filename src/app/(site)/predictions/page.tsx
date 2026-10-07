import Link from "next/link";
import { MatchCard } from "@/components/MatchCard";
import { loadDay } from "@/lib/app/data";
import { todayUtc, validDate } from "@/lib/app/format";
import { getViewer } from "@/lib/app/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Predictions | GoalGrid",
  description: "GoalGrid football predictions with probability, confidence and supporting evidence.",
};

export default async function PredictionsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const date = validDate((await searchParams).date) ?? todayUtc();
  const viewer = await getViewer();
  const day = await loadDay(date);
  const items = day.ok ? day.data.items.filter((item) => item.prediction) : [];

  return <main className="predictions-page">
    <section className="prediction-hero">
      <div>
        <div className="si-eb">GOALGRID PREDICTIONS</div>
        <h1>Probability, context and the reasons behind the number.</h1>
        <p className="si-lead">Every prediction is a modelled view of the available evidence, not a promise about what happens next.</p>
      </div>
      <span className={`badge ${viewer.tier}`}>{viewer.tier.toUpperCase()}</span>
    </section>
    <div className="wrap app-public-grid">
      {!day.ok && <div className="err">{day.error}</div>}
      {day.ok && !items.length && <div className="card"><p className="note">No modelled matches are available for {date}.</p><Link href="/dashboard" className="btn sm">Browse matches</Link></div>}
      {items.map((item) => <MatchCard key={item.match.id} item={item} date={date} />)}
    </div>
  </main>;
}
