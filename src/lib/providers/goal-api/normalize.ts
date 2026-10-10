import type { LeagueSlug, Match, MatchStatus } from "../../../types/football";
import type { MatchStatLine, Pair } from "../../../types/signals";
import { leagueEntry } from "../../football/league-registry";
import { teamSlug } from "../../engine/normalization/teams";
import { num } from "../resolve";

/**
 * GOAL API documents its row shapes only by example, and the provider changes them, so every read here is tolerant: a field that is
 * missing or oddly named gives null (and the model that needed it is marked degraded), never a thrown error or an invented value.
 */
type Row = Record<string, unknown>;
const obj = (v: unknown): Row | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const KICKOFF_KEYS = ["kickoffUtc", "kickoff", "kickoffTime", "startTime", "startsAt", "scheduledAt", "matchDate", "utcDate", "date"] as const;

/** First parseable kickoff timestamp. A bare date with a separate time field is joined; a bare date alone is not trusted as a kickoff. */
export function kickoffOf(r: Row): string | null {
  for (const k of KICKOFF_KEYS) { const s = str(r[k]); if (s && /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) { const t = Date.parse(/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(" ", "T")}Z`); if (Number.isFinite(t)) return new Date(t).toISOString(); } }
  const d = str(r.matchDate ?? r.date), tm = str(r.matchTime ?? r.time); if (d && tm && /^\d{4}-\d{2}-\d{2}$/.test(d) && /^\d{1,2}:\d{2}/.test(tm)) { const t = Date.parse(`${d}T${tm.padStart(5, "0").slice(0, 5)}:00Z`); if (Number.isFinite(t)) return new Date(t).toISOString(); }
  return null;
}
const STATUS: Record<string, MatchStatus> = { NS: "scheduled", TBD: "scheduled", "1H": "live", "2H": "live", HT: "live", ET: "live", FT: "finished", AET: "finished", PEN: "finished", PST: "postponed", CANC: "cancelled", SCHEDULED: "scheduled", LIVE: "live", HALF_TIME: "live", FINISHED: "finished", AFTER_ET: "finished", AFTER_PEN: "finished", AWARDED: "finished", POSTPONED: "postponed", SUSPENDED: "postponed", ABANDONED: "postponed", CANCELLED: "cancelled" };
const ttl = (s: MatchStatus) => (s === "live" ? 30_000 : s === "finished" ? 6 * 3_600_000 : 15 * 60_000);

export function normalizeGoalFixtures(raw: unknown[], slug: LeagueSlug, now = new Date()): Match[] {
  const lg = leagueEntry(slug), out: Match[] = []; if (!lg) return out;
  for (const item of raw) {
    const r = obj(item); if (!r) continue;
    // Live shape: flat fields (homeTeamId, homeTeamName, homeTeamScore, kickoffUtc, matchStatus). The nested form is still accepted.
    const h = obj(r.homeTeam), a = obj(r.awayTeam), kick = kickoffOf(r), id = str(r.id) ?? (typeof r.id === "number" ? String(r.id) : null);
    const hn = str(r.homeTeamName) ?? str(h?.name), an = str(r.awayTeamName) ?? str(a?.name), hid = String(r.homeTeamId ?? h?.id ?? ""), aid = String(r.awayTeamId ?? a?.id ?? "");
    if (!id || !kick || !hn || !an || !hid || !aid) continue;
    const code = String(r.matchStatus ?? r.status ?? "").toUpperCase(), status: MatchStatus = STATUS[code] ?? (String(r.matchLive) === "1" ? "live" : "unknown");
    out.push({ id: `ga:${id}`, league: { slug, name: lg.name, providerId: String(r.leagueId ?? "") }, home: { providerId: hid, name: hn, shortName: null, slug: teamSlug(hn), crestUrl: str(h?.logo) }, away: { providerId: aid, name: an, shortName: null, slug: teamSlug(an), crestUrl: str(a?.logo) },
      kickoffUtc: kick, status, score: { home: num(r.homeTeamScore ?? r.homeScore), away: num(r.awayTeamScore ?? r.awayScore) }, matchday: null, venue: null,
      provenance: { source: "goal-api", retrievedAt: now.toISOString(), sourceTimestamp: null, expiresAt: new Date(now.getTime() + ttl(status)).toISOString() } });
  }
  return out;
}

/** "54%", 54, or a two-sided "11:6" / "11 - 6" string, as a pair. */
function pairOf(v: unknown): Pair {
  if (typeof v === "string") { const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*%?\s*[:\-/]\s*(-?\d+(?:[.,]\d+)?)\s*%?\s*$/.exec(v); if (m) return { home: num(m[1]), away: num(m[2]) }; }
  const o = obj(v); if (o) return { home: num(o.home ?? o.homeTeam ?? o.h), away: num(o.away ?? o.awayTeam ?? o.a) };
  return { home: null, away: null };
}
const NONE: Pair = { home: null, away: null };
const METRICS: { key: keyof Omit<MatchStatLine, "source" | "matchId" | "observedAt">; test: RegExp; not?: RegExp }[] = [
  { key: "possession", test: /possession/i }, { key: "shotsOnTarget", test: /(on.?target|on.?goal)/i, not: /(off|blocked|outside)/i },
  { key: "shots", test: /^(total.?)?(shots|goal.?attempts)$/i }, { key: "passAccuracy", test: /pass.*(acc|percent|%)/i }, { key: "xg", test: /^(x.?g|expected.?goals)$/i },
];

/**
 * Statistics for one fixture, whatever envelope the provider used: a list of `{ name, home, away }` rows, or an object keyed by metric
 * with `{ home, away }` or "11:6" values, or a `{ home: {...}, away: {...} }` split. Anything unrecognised is left null.
 */
export function readGoalStats(data: unknown, matchId: string, observedAt = new Date().toISOString()): MatchStatLine | null {
  const line: MatchStatLine = { source: "goal-api", matchId, possession: { ...NONE }, shots: { ...NONE }, shotsOnTarget: { ...NONE }, passAccuracy: { ...NONE }, xg: { ...NONE }, observedAt };
  const set = (name: string, pair: Pair) => { for (const m of METRICS) if (m.test.test(name.trim()) && !(m.not && m.not.test(name))) { line[m.key] = pair; return; } };
  const root = Array.isArray(data) ? data : obj(data)?.statistics ?? obj(data)?.stats ?? data;
  if (Array.isArray(root)) for (const row of root) { const r = obj(row); const n = str(r?.type ?? r?.name ?? r?.stat ?? r?.metric); if (r && n) set(n, "home" in r || "away" in r ? { home: num(r.home), away: num(r.away) } : pairOf(r.value)); }
  else { const o = obj(root); if (o) {
    const h = obj(o.home ?? o.homeTeam), a = obj(o.away ?? o.awayTeam);
    if (h && a) for (const k of Object.keys(h)) set(k, { home: num(h[k]), away: num(a[k]) }); else for (const [k, v] of Object.entries(o)) set(k, pairOf(v));
  } }
  return [line.possession, line.shots, line.shotsOnTarget, line.passAccuracy, line.xg].some(p => p.home != null || p.away != null) ? line : null;
}

/** Form strings by team from GET /standings/{league}/form. Keys are team slugs; values are "WWDLW" (newest last or first as the provider sends; callers only count results). */
export function readGoalForm(data: unknown): Map<string, string> {
  const out = new Map<string, string>(); if (!Array.isArray(data)) return out;
  for (const item of data) { const r = obj(item), t = obj(r?.team), name = str(t?.name ?? r?.teamName ?? r?.name), form = str(r?.form ?? t?.form ?? r?.recentForm); if (name && form) out.set(teamSlug(name), form.replace(/[^WDLwdl]/g, "").toUpperCase()); }
  return out;
}
export interface Scorer { player: string; team: string | null; goals: number }
/** Top scorers from GET /leagues/{id}/top-scorers. */
export function readGoalScorers(data: unknown): Scorer[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap(item => { const r = obj(item), p = obj(r?.player), name = str(p?.name ?? r?.playerName ?? r?.name), goals = num(r?.goals ?? r?.value ?? r?.total), t = obj(r?.team); return name && goals != null ? [{ player: name, team: str(t?.name ?? r?.teamName), goals }] : []; });
}