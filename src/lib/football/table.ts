import type { HistMatch } from "../../types/prediction";
export interface TableRow { slug: string; p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number; form: ("W" | "D" | "L")[] }
/** The first day of the current season's data. July onwards belongs to the new season. */
export const seasonStart = (now = new Date()) => `${now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1}-07-01`;
const res = (gf: number, ga: number): "W" | "D" | "L" => (gf > ga ? "W" : gf === ga ? "D" : "L");
/** Sorted by points, goal difference, goals scored. Official tie-breaks (head to head and others) differ by league, so the very close ties here can differ from the official table. */
export function computeTable(hist: HistMatch[], since: string): TableRow[] {
  const rows = new Map<string, TableRow>(), get = (s: string) => rows.get(s) ?? (rows.set(s, { slug: s, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [] }), rows.get(s)!);
  for (const m of [...hist].filter(x => x.date >= since).sort((a, b) => a.date.localeCompare(b.date))) for (const [t, gf, ga] of [[m.home, m.hg, m.ag], [m.away, m.ag, m.hg]] as const) {
    const r = get(t), x = res(gf, ga); r.p++; r.gf += gf; r.ga += ga; r.gd = r.gf - r.ga; if (x === "W") { r.w++; r.pts += 3; } else if (x === "D") { r.d++; r.pts += 1; } else r.l++; r.form.push(x); if (r.form.length > 5) r.form.shift();
  }
  return [...rows.values()].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.slug.localeCompare(b.slug));
}
export interface Split { p: number; w: number; d: number; l: number; gf: number; ga: number }
export interface TeamResult { date: string; opponent: string; home: boolean; gf: number; ga: number; result: "W" | "D" | "L" }
export function teamSummary(hist: HistMatch[], isTeam: (slug: string) => boolean, since: string) {
  const empty = (): Split => ({ p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }), home = empty(), away = empty(), results: TeamResult[] = [];
  for (const m of [...hist].filter(x => x.date >= since).sort((a, b) => b.date.localeCompare(a.date))) {
    const h = isTeam(m.home), a = isTeam(m.away); if (!h && !a) continue; const gf = h ? m.hg : m.ag, ga = h ? m.ag : m.hg, x = res(gf, ga), s = h ? home : away;
    s.p++; s.gf += gf; s.ga += ga; if (x === "W") s.w++; else if (x === "D") s.d++; else s.l++; results.push({ date: m.date, opponent: h ? m.away : m.home, home: h, gf, ga, result: x });
  }
  return { home, away, last: results.slice(0, 5), played: results.length };
}
