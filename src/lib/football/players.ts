import "server-only";
import { cached } from "@/lib/cache";
import { teamSlug } from "@/lib/engine/normalization/teams";
import { fetchFdPerson } from "@/lib/providers/football-data/teams";
import { fetchAfPlayer } from "@/lib/providers/api-football/teams";
import { getSportmonksPlayer } from "@/lib/providers/sportmonks/players";
import { byApiFootball, currentSeason, leagueEntry } from "./league-registry";
import { ageOf } from "./teams-normalize";

export interface PlayerView {
  name: string;
  position: string | null;
  nationality: string | null;
  teamName: string | null;
  teamSlug: string | null;
  leagueSlug: string | null;
  imageUrl: string | null;
  dateOfBirth: string | null;
  age: number | null;
  shirtNumber: number | null;
  stats: { appearances: number | null; goals: number | null; assists: number | null } | null;
}

/** A player from whichever provider the id belongs to: "fd-" football-data.org, "af-" API-Football, anything else Sportmonks. */
export async function getPlayer(id: string, hint: { team?: string; league?: string } = {}): Promise<PlayerView | null> {
  const day = 24 * 3_600_000;
  if (id.startsWith("fd-")) {
    const { value: p } = await cached(`player:${id}`, day, 7 * day, () => fetchFdPerson(id.slice(3)));
    return { name: p.name, position: p.position ?? null, nationality: p.nationality ?? null, teamName: null, teamSlug: hint.team ?? null, leagueSlug: hint.league ?? null, imageUrl: null, dateOfBirth: p.dateOfBirth ?? null, age: ageOf(p.dateOfBirth ?? null), shirtNumber: p.shirtNumber ?? null, stats: null };
  }
  if (id.startsWith("af-")) {
    const entry = hint.league ? leagueEntry(hint.league) : undefined, season = entry ? currentSeason(entry) : currentSeason({ slug: "", name: "", country: "", kind: "league" });
    const { value: row } = await cached(`player:${id}:${season}`, day, 7 * day, () => fetchAfPlayer(id.slice(3), season));
    if (!row) return null;
    const s = row.statistics?.[0], lg = s?.league?.id ? byApiFootball(s.league.id) : undefined;
    return {
      name: row.player.name, position: s?.games?.position ?? null, nationality: row.player.nationality ?? null, teamName: s?.team?.name ?? null,
      teamSlug: s?.team?.name ? teamSlug(s.team.name) : hint.team ?? null, leagueSlug: lg?.slug ?? hint.league ?? null, imageUrl: row.player.photo ?? null,
      dateOfBirth: row.player.birth?.date ?? null, age: row.player.age ?? ageOf(row.player.birth?.date ?? null), shirtNumber: null,
      stats: s ? { appearances: s.games?.appearences ?? null, goals: s.goals?.total ?? null, assists: s.goals?.assists ?? null } : null,
    };
  }
  const p = await getSportmonksPlayer(id);
  return p ? { name: p.name, position: p.position, nationality: p.nationality, teamName: p.teamName, teamSlug: p.teamSlug, leagueSlug: null, imageUrl: p.imageUrl, dateOfBirth: null, age: null, shirtNumber: null, stats: null } : null;
}
