import "server-only";
import { env } from "@/lib/env";
import { acquire } from "../limiter";
import { spendCredits } from "../budget";
import { providerFetch } from "../http";
import { ProviderError } from "../types";
import { normalizeAfSquad, normalizeAfTeams, type AfSquadPlayer, type AfTeamRow, type SquadPlayer, type TeamInfo } from "../../football/teams-normalize";

const BASE = "https://v3.football.api-sports.io";
type Body<T> = { response?: T[]; errors?: unknown };
async function get<T>(path: string): Promise<T[]> {
  const key = env().API_FOOTBALL_KEY; if (!key) throw new ProviderError("api-football", "auth", "Not configured");
  await spendCredits("api-football"); await acquire("api-football");
  const { json } = await providerFetch<Body<T>>({ provider: "api-football", url: `${BASE}${path}`, headers: { "x-apisports-key": key }, timeoutMs: 15_000 });
  const e = json.errors, reasons = Array.isArray(e) ? e.map(String) : e && typeof e === "object" ? Object.values(e).map(String) : [];
  if (reasons.length) throw new ProviderError("api-football", "bad_response", `API-Football: ${reasons.join("; ").slice(0, 160)}`);
  if (!Array.isArray(json.response)) throw new ProviderError("api-football", "bad_response", "Unexpected response shape");
  return json.response;
}

export const fetchAfLeagueTeams = async (leagueId: number, season: number): Promise<TeamInfo[]> => normalizeAfTeams(await get<AfTeamRow>(`/teams?league=${leagueId}&season=${season}`));
export async function fetchAfSquad(teamId: string): Promise<SquadPlayer[]> {
  const rows = await get<{ players?: AfSquadPlayer[] }>(`/players/squads?team=${encodeURIComponent(teamId)}`);
  return normalizeAfSquad(rows[0]?.players ?? []);
}
export interface AfPlayerDetail {
  player: { id: number; name: string; age?: number | null; nationality?: string | null; photo?: string | null; birth?: { date?: string | null } | null; height?: string | null };
  statistics?: { team?: { id: number; name: string; logo?: string | null }; league?: { id: number; name?: string }; games?: { position?: string | null; appearences?: number | null }; goals?: { total?: number | null; assists?: number | null } }[];
}
export const fetchAfPlayer = async (id: string, season: number) => (await get<AfPlayerDetail>(`/players?id=${encodeURIComponent(id)}&season=${season}`))[0] ?? null;
