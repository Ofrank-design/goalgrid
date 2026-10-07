import test from "node:test";
import assert from "node:assert/strict";
import { buildMarket, findOddsEvent } from "../src/lib/engine/normalization/odds";
import { normalizeOpenMeteo } from "../src/lib/providers/open-meteo/normalize";
import { normalizeOpenWeather } from "../src/lib/providers/openweather/normalize";
import { normalizeNewsApi } from "../src/lib/providers/newsapi/normalize";
import { normalizeSerp, dedupeNews } from "../src/lib/providers/serpapi/normalize";
import { normalizeFootballData } from "../src/lib/providers/football-data/normalize";
const NOW = new Date("2026-10-01T10:00:00Z");
const mk = (h: number, d: number, a: number, ov?: number, un?: number) => ({ key: "b", title: "B", last_update: "", markets: [{ key: "h2h", outcomes: [{ name: "Brighton and Hove Albion", price: h }, { name: "Draw", price: d }, { name: "Chelsea", price: a }] },
  ...(ov ? [{ key: "totals", outcomes: [{ name: "Over", price: ov, point: 2.5 }, { name: "Under", price: un!, point: 2.5 }] }] : [])] });
const ev = { id: "e", sport_key: "soccer_epl", commence_time: "2026-10-01T19:00:00Z", home_team: "Brighton and Hove Albion", away_team: "Chelsea", bookmakers: [mk(2, 3.5, 4, 1.9, 1.95), mk(2.1, 3.4, 3.8)] };
const match = normalizeFootballData([{ id: 5, utcDate: "2026-10-01T19:00:00Z", status: "TIMED", homeTeam: { id: 1, name: "Brighton & Hove Albion FC" }, awayTeam: { id: 2, name: "Chelsea FC" }, competition: { id: 1, code: "PL", name: "PL" } }], NOW)[0];
test("odds: event matching across naming styles", () => { assert.ok(findOddsEvent([ev], match)); assert.equal(findOddsEvent([{ ...ev, commence_time: "2026-10-03T19:00:00Z" }], match), undefined); });
test("odds: margin removed, probabilities sum to 1, best price kept", () => {
  const m = buildMarket(ev, NOW)!, s = m.impliedProbabilities.home + m.impliedProbabilities.draw + m.impliedProbabilities.away;
  assert.ok(Math.abs(s - 1) < 0.001); assert.equal(m.bookmakers, 2); assert.equal(m.bestOdds.home, 2.1); assert.ok(m.averageOverround > 0 && m.averageOverround < 0.1);
  assert.ok(Math.abs(m.goals25!.over + m.goals25!.under - 1) < 0.001);
  assert.equal(buildMarket({ ...ev, bookmakers: [] }, NOW), null);
});
test("open-meteo: nearest hour, rejects distant forecast", () => {
  const r = { hourly: { time: ["2026-10-01T18:00", "2026-10-01T19:00"], temperature_2m: [14, 13], relative_humidity_2m: [60, 65], wind_speed_10m: [9, 11], precipitation_probability: [10, 20] } };
  const w = normalizeOpenMeteo(r, "2026-10-01T19:10:00Z", NOW)!; assert.equal(w.tempC, 13); assert.equal(w.rainChancePct, 20); assert.equal(normalizeOpenMeteo(r, "2026-10-05T19:00:00Z", NOW), null);
});
test("openweather: converts m/s to km/h and pop to percent", () => {
  const w = normalizeOpenWeather({ list: [{ dt: Date.parse("2026-10-01T18:00:00Z") / 1000, main: { temp: 12.5, humidity: 70 }, wind: { speed: 5 }, pop: 0.35 }] }, "2026-10-01T19:00:00Z", NOW)!;
  assert.equal(w.windKmh, 18); assert.equal(w.rainChancePct, 35);
});
test("news: normalize both providers and dedupe", () => {
  const a = normalizeNewsApi({ data: [{ uuid: "1", title: "Arsenal win big", url: "u1", source: "BBC", published_at: "2026-10-01T08:00:00Z", description: "x".repeat(300) }] });
  const b = normalizeSerp({ news_results: [{ title: "Arsenal Win Big!", link: "u2", source: { name: "Sky" }, date: "10/01/2026, 09:00 AM, +0000 UTC" }] });
  assert.equal(a[0].snippet!.length, 200); assert.equal(b[0].source, "Sky"); assert.equal(dedupeNews([...a, ...b]).length, 1);
});
