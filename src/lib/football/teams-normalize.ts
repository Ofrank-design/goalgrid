import { teamSlug } from "../engine/normalization/teams";
import { sameTeam } from "./team-resolver";

/** A player as the providers describe them. The id is prefixed with the provider ("fd-", "af-") so a player page knows where to look. */
export interface SquadPlayer {
  id: string;
  name: string;
  position: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  shirtNumber: number | null;
  photoUrl: string | null;
}
export interface TeamInfo {
  source: "football-data" | "api-football";
  providerId: string;
  slug: string;
  name: string;
  shortName: string | null;
  crestUrl: string | null;
  venue: string | null;
  founded: number | null;
  squad: SquadPlayer[];
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/* ---- football-data.org ---- */
interface FdPerson { id?: number; name?: string; position?: string | null; dateOfBirth?: string | null; nationality?: string | null; shirtNumber?: number | null }
export interface FdTeam { id: number; name: string; shortName?: string | null; crest?: string | null; venue?: string | null; founded?: number | null; squad?: FdPerson[] }

export const fdPlayer = (p: FdPerson): SquadPlayer | null =>
  p.id == null || !str(p.name) ? null : { id: `fd-${p.id}`, name: p.name!.trim(), position: str(p.position), nationality: str(p.nationality), dateOfBirth: str(p.dateOfBirth), shirtNumber: num(p.shirtNumber), photoUrl: null };

export function normalizeFdTeams(raw: FdTeam[]): TeamInfo[] {
  return raw.flatMap((t) => !t?.id || !str(t.name) ? [] : [{
    source: "football-data" as const, providerId: String(t.id), slug: teamSlug(t.name), name: t.name.trim(), shortName: str(t.shortName), crestUrl: str(t.crest),
    venue: str(t.venue), founded: num(t.founded), squad: (t.squad ?? []).flatMap((p) => fdPlayer(p) ?? []),
  }]);
}

/* ---- API-Football ---- */
export interface AfTeamRow { team: { id: number; name: string; code?: string | null; logo?: string | null; founded?: number | null }; venue?: { name?: string | null } | null }
export function normalizeAfTeams(raw: AfTeamRow[]): TeamInfo[] {
  return raw.flatMap((r) => !r?.team?.id || !str(r.team.name) ? [] : [{
    source: "api-football" as const, providerId: String(r.team.id), slug: teamSlug(r.team.name), name: r.team.name.trim(), shortName: str(r.team.code), crestUrl: str(r.team.logo),
    venue: str(r.venue?.name), founded: num(r.team.founded), squad: [],
  }]);
}
export interface AfSquadPlayer { id?: number; name?: string; age?: number | null; number?: number | null; position?: string | null; photo?: string | null }
export const normalizeAfSquad = (raw: AfSquadPlayer[]): SquadPlayer[] =>
  raw.flatMap((p) => p.id == null || !str(p.name) ? [] : [{ id: `af-${p.id}`, name: p.name!.trim(), position: str(p.position), nationality: null, dateOfBirth: null, shirtNumber: num(p.number), photoUrl: str(p.photo) }]);

/** Shown on the page in a steady order: goalkeepers, defenders, midfielders, attackers, then anyone else. */
const ORDER = [/goal/i, /def|back/i, /mid/i, /attack|forward|offence|striker|wing/i];
export const positionRank = (p: string | null) => { const i = ORDER.findIndex((r) => p && r.test(p)); return i < 0 ? ORDER.length : i; };
export const sortSquad = (s: SquadPlayer[]) => [...s].sort((a, b) => positionRank(a.position) - positionRank(b.position) || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999) || a.name.localeCompare(b.name));
export const ageOf = (dob: string | null, now = new Date()) => { if (!dob) return null; const t = Date.parse(dob); if (Number.isNaN(t)) return null; return Math.floor((now.getTime() - t) / (365.25 * 86_400_000)); };

/** The provider's crest for a team slug, matched loosely so "man-united" finds "manchester-united". */
export const crestOf = (teams: readonly Pick<TeamInfo, "slug" | "crestUrl">[], slug: string): string | null => teams.find((t) => sameTeam(t.slug, slug))?.crestUrl ?? null;
