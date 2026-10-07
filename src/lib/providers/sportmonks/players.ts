import "server-only";

import { env } from "@/lib/env";
import { acquire } from "../limiter";
import { spendCredits } from "../budget";
import { providerFetch } from "../http";

const BASE = "https://api.sportmonks.com/v3/football";

export interface PlayerSearchResult {
  id: string;
  name: string;
  position: string | null;
  nationality: string | null;
  teamName: string | null;
  teamSlug: string | null;
  imageUrl: string | null;
}

type RawPlayer = {
  id?: number | string;
  name?: string | null;
  display_name?: string | null;
  common_name?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  image_path?: string | null;
  position?: { name?: string | null } | string | null;
  nationality?: { name?: string | null } | string | null;
  current_team?: { name?: string | null; short_code?: string | null; slug?: string | null } | null;
  team?: { name?: string | null; short_code?: string | null; slug?: string | null } | null;
};

const textValue = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  }
  return null;
};

const slugify = (value: string | null) =>
  value ? value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : null;

function normalizePlayer(raw: RawPlayer): PlayerSearchResult | null {
  if (raw.id == null) return null;
  const composedName = [raw.firstname, raw.lastname].filter(Boolean).join(" ").trim();
  const name = raw.display_name?.trim() || raw.name?.trim() || raw.common_name?.trim() || composedName;
  if (!name) return null;

  const team = raw.current_team ?? raw.team ?? null;
  const teamName = typeof team?.name === "string" && team.name.trim() ? team.name.trim() : null;
  return {
    id: String(raw.id),
    name,
    position: textValue(raw.position),
    nationality: textValue(raw.nationality),
    teamName,
    teamSlug: team?.slug ?? slugify(teamName),
    imageUrl: typeof raw.image_path === "string" && raw.image_path.trim() ? raw.image_path : null,
  };
}

/** Search Sportmonks players server-side so the public search never exposes provider credentials. */
export async function searchSportmonksPlayers(query: string, limit = 8): Promise<PlayerSearchResult[]> {
  const term = query.trim().slice(0, 60);
  const key = env().SPORTMONKS_API_KEY;
  if (term.length < 2 || !key) return [];

  await spendCredits("sportmonks"); await acquire("sportmonks");
  const { json } = await providerFetch<{ data?: RawPlayer[] }>({
    provider: "sportmonks",
    url: `${BASE}/players/search/${encodeURIComponent(term)}?include=position;nationality;currentTeam&per_page=${limit}`,
    headers: { Authorization: key },
  });

  return (json.data ?? [])
    .map(normalizePlayer)
    .filter((player): player is PlayerSearchResult => Boolean(player))
    .slice(0, limit);
}

export async function getSportmonksPlayer(id: string): Promise<PlayerSearchResult | null> {
  const key = env().SPORTMONKS_API_KEY;
  if (!key || !/^\d+$/.test(id)) return null;

  await spendCredits("sportmonks"); await acquire("sportmonks");
  const { json } = await providerFetch<{ data?: RawPlayer }>({
    provider: "sportmonks",
    url: `${BASE}/players/${encodeURIComponent(id)}?include=position;nationality;currentTeam`,
    headers: { Authorization: key },
  });

  return normalizePlayer(json.data ?? {});
}
