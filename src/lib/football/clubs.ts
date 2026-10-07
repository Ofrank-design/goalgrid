import clubsJson from "../../../public/crests/clubs.json";
import manifestJson from "../../../public/crests/manifest.json";
export type LeagueKey = "premier-league" | "la-liga" | "serie-a" | "bundesliga" | "ligue-1";
export interface Club { key: string; slug: string; name: string; league: LeagueKey }
export const LEAGUES: { slug: LeagueKey; name: string; country: string }[] = [{ slug: "premier-league", name: "Premier League", country: "England" }, { slug: "la-liga", name: "LaLiga", country: "Spain" }, { slug: "serie-a", name: "Serie A", country: "Italy" }, { slug: "bundesliga", name: "Bundesliga", country: "Germany" }, { slug: "ligue-1", name: "Ligue 1", country: "France" }];
export const CLUBS = clubsJson as Club[];
const MANIFEST = manifestJson as Record<string, string>, BY_KEY = new Map(CLUBS.map(c => [c.key, c]));
/** Any known spelling of a team's slug resolves to the same club. */
export const clubBySlug = (slug: string): Club | undefined => { const k = MANIFEST[slug]; return k ? BY_KEY.get(k) : undefined; };
export const sameClub = (a: string, b: string) => Boolean(MANIFEST[a]) && MANIFEST[a] === MANIFEST[b];
export const clubsOf = (league: LeagueKey) => CLUBS.filter(c => c.league === league).sort((a, b) => a.name.localeCompare(b.name));
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
/** Case, accent and punctuation blind search. Names that start with the query rank first. */
export function searchClubs(q: string, limit = 24): Club[] {
  const n = fold(q); if (n.length < 2) return [];
  return CLUBS.map(c => { const f = fold(c.name), s = c.slug.replace(/-/g, " "), score = f.startsWith(n) ? 0 : f.split(" ").some(w => w.startsWith(n)) ? 1 : f.includes(n) || s.includes(n) ? 2 : 9; return { c, score }; }).filter(x => x.score < 9).sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name)).slice(0, limit).map(x => x.c);
}
export const searchLeagues = (q: string) => { const n = fold(q); return n.length < 2 ? [] : LEAGUES.filter(l => fold(l.name).includes(n) || fold(l.country).startsWith(n)); };
