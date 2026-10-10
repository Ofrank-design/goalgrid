import { LEAGUE_REGISTRY, type LeagueSlug } from "./league-registry";
export type LeagueKey = LeagueSlug;
/** Every tracked competition, for league pages, search and menus. Teams are never listed here: they come from the data providers. */
export const LEAGUES: { slug: LeagueKey; name: string; country: string; kind: "league" | "cup" }[] = LEAGUE_REGISTRY.map(({ slug, name, country, kind }) => ({ slug, name, country, kind }));
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
export const searchLeagues = (q: string) => { const n = fold(q); return n.length < 2 ? [] : LEAGUES.filter(l => fold(l.name).includes(n) || fold(l.country).startsWith(n)); };
