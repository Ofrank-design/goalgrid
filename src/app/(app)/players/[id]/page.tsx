import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHero } from "@/components/PageHero";
import { getSportmonksPlayer } from "@/lib/providers/sportmonks/players";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getSportmonksPlayer(id).catch(() => null);
  if (!player) notFound();

  return (
    <>
      <PageHero
        image="lounge"
        badge="PLAYER INTELLIGENCE"
        title={player.name}
        subtitle="Verified player information from the connected football-data provider."
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
          {player.teamSlug && <Link className="btn sm" href={`/teams/${player.teamSlug}`}>View team</Link>}
        </div>
      </div>
    </>
  );
}
