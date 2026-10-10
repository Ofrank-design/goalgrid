import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHero } from "@/components/PageHero";
import { getPlayer } from "@/lib/football/players";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ team?: string; league?: string }> }) {
  const { id } = await params;
  const hint = await searchParams;
  const player = await getPlayer(decodeURIComponent(id), hint).catch(() => null);
  if (!player) notFound();
  const facts = [["Age", player.age], ["Shirt", player.shirtNumber], ["Appearances", player.stats?.appearances], ["Goals", player.stats?.goals], ["Assists", player.stats?.assists]].filter(([, v]) => v != null);

  return (
    <>
      <PageHero
        image="lounge"
        badge="PLAYER INTELLIGENCE"
        title={player.name}
        subtitle="Player details from the connected football data providers."
        position="50% 58%"
      />
      <div className="card player-profile">
        {player.imageUrl && <img src={player.imageUrl} alt="" width={112} height={112} className="player-photo" />}
        <div>
          <div className="meta">
            {player.position && <span>{player.position}</span>}
            {player.nationality && <span>{player.nationality}</span>}
            {player.teamName && <span>{player.teamName}</span>}
          </div>
          {facts.length > 0 && <div className="meta" style={{ marginTop: 10 }}>{facts.map(([k, v]) => <span key={String(k)}>{k}: {String(v)}</span>)}</div>}
          {player.teamSlug && <Link className="btn sm" href={`/teams/${player.teamSlug}${player.leagueSlug ? `?league=${player.leagueSlug}` : ""}`}>View team</Link>}
        </div>
      </div>
    </>
  );
}
