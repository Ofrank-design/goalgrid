import { makeRng, poissonSample } from "./rng";
/** Synthetic alert-test generator and a constrained rule evaluator. Rules are plain JSON conditions; nothing the user types is ever run as code. */
export const FAMILIES = ["provider_outage", "odds_change", "lineup_confirmation", "prediction_movement", "queue_backlog", "high_comment_volume", "rate_limit_spike"] as const;
export type Family = (typeof FAMILIES)[number];
export interface TestEvent { t: number; family: Family; severity: number; injected: boolean }
export interface AlertRule { family: Family; minSeverity: number; count: number; withinMinutes: number }
/** A quiet background of low severity events with a few controlled incidents injected at known times, so a rule can be checked against ground truth. */
export function generateEvents(seed: string, o: { minutes: number; incidents: number; families?: Family[] }): { events: TestEvent[]; incidents: { family: Family; startMinute: number; size: number }[] } {
  const r = makeRng(seed), fam = o.families?.length ? o.families : [...FAMILIES], events: TestEvent[] = [], incidents: { family: Family; startMinute: number; size: number }[] = [];
  for (const f of fam) { const n = poissonSample(r, o.minutes / 30); for (let i = 0; i < n; i++) events.push({ t: Math.round(r() * o.minutes * 10) / 10, family: f, severity: 1 + Math.floor(r() * 3), injected: false }); }
  for (let k = 0; k < o.incidents; k++) { const family = fam[Math.floor(r() * fam.length)], start = Math.floor(r() * Math.max(1, o.minutes - 10)), size = 4 + Math.floor(r() * 4); incidents.push({ family, startMinute: start, size }); for (let i = 0; i < size; i++) events.push({ t: start + Math.round(r() * 5 * 10) / 10, family, severity: 7 + Math.floor(r() * 4), injected: true }); }
  return { events: events.sort((a, b) => a.t - b.t), incidents };
}
export function validateRule(x: Partial<AlertRule>): string | null { if (!x.family || !(FAMILIES as readonly string[]).includes(x.family)) return "Choose an event family."; if (!(x.minSeverity! >= 1 && x.minSeverity! <= 10)) return "Minimum severity is 1 to 10."; if (!Number.isInteger(x.count) || x.count! < 1 || x.count! > 50) return "Count is 1 to 50."; if (!(x.withinMinutes! >= 1 && x.withinMinutes! <= 120)) return "Window is 1 to 120 minutes."; return null; }
/** Fires when at least `count` events of the family at or above `minSeverity` happen inside any `withinMinutes` window. Returns the first firing time of each separate burst. */
export function evaluate(events: TestEvent[], rule: AlertRule): { firedAt: number[] } {
  const m = events.filter(e => e.family === rule.family && e.severity >= rule.minSeverity).map(e => e.t).sort((a, b) => a - b), fired: number[] = []; let lastFire = -Infinity;
  for (let i = rule.count - 1; i < m.length; i++) if (m[i] - m[i - rule.count + 1] <= rule.withinMinutes && m[i] - lastFire > rule.withinMinutes) { fired.push(m[i]); lastFire = m[i]; }
  return { firedAt: fired };
}
/** Scores a rule against the injected incidents: how many it caught, how late, and how many alerts had no incident behind them. */
export function score(rule: AlertRule, events: TestEvent[], incidents: { family: Family; startMinute: number; size: number }[]) {
  const { firedAt } = evaluate(events, rule), mine = incidents.filter(i => i.family === rule.family), caught = mine.map(i => { const hit = firedAt.find(t => t >= i.startMinute && t <= i.startMinute + 5 + rule.withinMinutes); return hit == null ? null : Math.round((hit - i.startMinute) * 10) / 10; });
  const matched = new Set(caught.filter(x => x != null).map((_, k) => k)); const falseAlerts = firedAt.filter(t => !mine.some(i => t >= i.startMinute && t <= i.startMinute + 5 + rule.withinMinutes)).length;
  return { alerts: firedAt.length, incidentsForFamily: mine.length, caught: caught.filter(x => x != null).length, detectionDelayMinutes: caught, falseAlerts, missed: mine.length - matched.size };
}
