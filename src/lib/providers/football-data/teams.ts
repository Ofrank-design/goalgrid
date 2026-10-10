import "server-only";
import { env } from "@/lib/env";
import { acquire } from "../limiter";
import { providerFetch } from "../http";
import { ProviderError } from "../types";
import { fdPlayer, normalizeFdTeams, type FdTeam, type SquadPlayer, type TeamInfo } from "../../football/teams-normalize";

const BASE = "https://api.football-data.org/v4";
const get = async <T,>(path: string) => {
  const key = env().FOOTBALL_DATA_API_KEY; if (!key) throw new ProviderError("football-data", "auth", "Not configured");
  await acquire("football-data", 20_000);
  return (await providerFetch<T>({ provider: "football-data", url: `${BASE}${path}`, headers: { "X-Auth-Token": key }, timeoutMs: 15_000 })).json;
};

/** Every team in a competition with its crest and, when the plan includes it, the squad. */
export async function fetchCompetitionTeams(code: string, season: number): Promise<TeamInfo[]> {
  const json = await get<{ teams?: FdTeam[] }>(`/competitions/${encodeURIComponent(code)}/teams?season=${season}`);
  if (!Array.isArray(json.teams)) throw new ProviderError("football-data", "bad_response", "Unexpected response shape");
  return normalizeFdTeams(json.teams);
}
export async function fetchFdSquad(teamId: string): Promise<SquadPlayer[]> {
  const json = await get<FdTeam>(`/teams/${encodeURIComponent(teamId)}`);
  return (json.squad ?? []).flatMap((p) => fdPlayer(p) ?? []);
}
export interface FdPersonDetail { id: number; name: string; firstName?: string | null; lastName?: string | null; dateOfBirth?: string | null; nationality?: string | null; position?: string | null; shirtNumber?: number | null }
export const fetchFdPerson = (id: string) => get<FdPersonDetail>(`/persons/${encodeURIComponent(id)}`);
