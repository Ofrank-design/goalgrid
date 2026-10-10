/**
 * The ID cross-reference: the one place that says how each provider names a competition.
 * It holds no teams, fixtures or tables. Those always come from the providers; this only translates ids.
 *
 * To add a competition, add one row. Every provider list, the odds mapping, the league pages and the
 * simulation menus read from here.
 *   fd    football-data.org competition code
 *   af    API-Football league id
 *   sm    Sportmonks league id (a plan only returns the leagues it covers)
 *   odds  The Odds API sport key
 *   op    OddsPapi tournament id
 *   ts    TheStatsAPI competition: its ids are strings (comp_3039), so we pin one only where known and otherwise
 *         find it by country code and name, once, and cache it (cc = ISO country code, name = competition name)
 *   ga    GOAL API league: its league ids are internal, so it is found by country and name, once, and cached
 *   bb    Big Balls league code, the value its ?league= parameter takes (see GET /v1/leagues)
 *   image has a badge in /public/leagues
 *   calendarSeason  the season is one calendar year (Brazil), not August to May
 *   kind  "cup" competitions mix clubs or nations from several leagues, so they are predicted but not simulated
 */
export interface LeagueEntry {
  readonly slug: string;
  readonly name: string;
  readonly country: string;
  readonly kind: "league" | "cup";
  readonly fd?: string;
  readonly af?: number;
  readonly sm?: number;
  readonly odds?: string;
  readonly op?: number;
  readonly ts?: { readonly cc: string; readonly name: string; readonly id?: string };
  readonly ga?: { readonly country: string; readonly name: string };
  readonly bb?: string;
  readonly image?: boolean;
  readonly calendarSeason?: boolean;
}

export const LEAGUE_REGISTRY = [
  { slug: "premier-league", name: "Premier League", country: "England", kind: "league", fd: "PL", af: 39, sm: 8, odds: "soccer_epl", op: 17, image: true, ts: { cc: "GB-ENG", name: "Premier League", id: "comp_3039" }, ga: { country: "England", name: "Premier League" }, bb: "epl" },
  { slug: "la-liga", name: "LaLiga", country: "Spain", kind: "league", fd: "PD", af: 140, sm: 564, odds: "soccer_spain_la_liga", op: 8, image: true, ts: { cc: "ES", name: "LaLiga" }, ga: { country: "Spain", name: "LaLiga" }, bb: "laliga" },
  { slug: "serie-a", name: "Serie A", country: "Italy", kind: "league", fd: "SA", af: 135, sm: 384, odds: "soccer_italy_serie_a", op: 23, image: true, ts: { cc: "IT", name: "Serie A" }, ga: { country: "Italy", name: "Serie A" }, bb: "serie-a" },
  { slug: "bundesliga", name: "Bundesliga", country: "Germany", kind: "league", fd: "BL1", af: 78, sm: 82, odds: "soccer_germany_bundesliga", op: 35, image: true, ts: { cc: "DE", name: "Bundesliga" }, ga: { country: "Germany", name: "Bundesliga" }, bb: "bundesliga" },
  { slug: "ligue-1", name: "Ligue 1", country: "France", kind: "league", fd: "FL1", af: 61, sm: 301, odds: "soccer_france_ligue_one", op: 34, image: true, ts: { cc: "FR", name: "Ligue 1" }, ga: { country: "France", name: "Ligue 1" }, bb: "ligue-1" },
  { slug: "championship", name: "EFL Championship", country: "England", kind: "league", fd: "ELC", af: 40, sm: 9, odds: "soccer_efl_champ" },
  { slug: "eredivisie", name: "Eredivisie", country: "Netherlands", kind: "league", fd: "DED", af: 88, sm: 72, odds: "soccer_netherlands_eredivisie" },
  { slug: "primeira-liga", name: "Primeira Liga", country: "Portugal", kind: "league", fd: "PPL", af: 94, sm: 462, odds: "soccer_portugal_primeira_liga" },
  { slug: "brasileirao", name: "Brasileirão Série A", country: "Brazil", kind: "league", fd: "BSA", af: 71, sm: 648, odds: "soccer_brazil_campeonato", calendarSeason: true },
  { slug: "danish-superliga", name: "Danish Superliga", country: "Denmark", kind: "league", af: 119, sm: 271 },
  { slug: "scottish-premiership", name: "Scottish Premiership", country: "Scotland", kind: "league", af: 179, sm: 501, odds: "soccer_spl" },
  { slug: "champions-league", name: "UEFA Champions League", country: "Europe", kind: "cup", fd: "CL", af: 2, sm: 2, odds: "soccer_uefa_champs_league" },
  { slug: "european-championship", name: "European Championship", country: "Europe", kind: "cup", fd: "EC", af: 4, odds: "soccer_uefa_european_championship" },
  { slug: "world-cup", name: "FIFA World Cup", country: "World", kind: "cup", fd: "WC", af: 1, odds: "soccer_fifa_world_cup" },
] as const satisfies readonly LeagueEntry[];

export type LeagueSlug = (typeof LEAGUE_REGISTRY)[number]["slug"];

const BY_SLUG = new Map<string, LeagueEntry>(LEAGUE_REGISTRY.map((l) => [l.slug, l]));
export const leagueEntry = (slug: string): LeagueEntry | undefined => BY_SLUG.get(slug);
export const isLeagueSlug = (slug: string): slug is LeagueSlug => BY_SLUG.has(slug);

/** Every slug, in a shape zod's z.enum accepts. */
export const LEAGUE_SLUGS = LEAGUE_REGISTRY.map((l) => l.slug) as unknown as [LeagueSlug, ...LeagueSlug[]];
/** Domestic leagues: the ones the simulation lab, season simulator and standings can work on. */
export const DOMESTIC_SLUGS = LEAGUE_REGISTRY.filter((l) => l.kind === "league").map((l) => l.slug) as unknown as [LeagueSlug, ...LeagueSlug[]];

export const byFootballData = (code: string) => LEAGUE_REGISTRY.find((l) => "fd" in l && l.fd === code);
export const byApiFootball = (id: number) => LEAGUE_REGISTRY.find((l) => "af" in l && l.af === id);
export const byBigBalls = (code: string) => LEAGUE_REGISTRY.find((l) => "bb" in l && l.bb === code);
export const bySportmonks = (id: number) => LEAGUE_REGISTRY.find((l) => "sm" in l && l.sm === id);

/** Start year of the season that is running on `now`. European seasons start in July or August; Brazil's runs January to December. */
export function currentSeason(entry: LeagueEntry, now = new Date()): number {
  const y = now.getUTCFullYear();
  return entry.calendarSeason ? y : now.getUTCMonth() >= 6 ? y : y - 1;
}
