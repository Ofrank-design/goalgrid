import "server-only";
import { env } from "@/lib/env";
import { acquire } from "../limiter";
import { spendCredits } from "../budget";
import { validateItems } from "../validate";
import { smFixtureSchema } from "../schemas";
import { providerFetch } from "../http";
import { ProviderError, type ProviderAdapter } from "../types";
import { SM_LEAGUES, normalizeSportmonks, type SmFixture } from "./normalize";
import { leagueEntry } from "../../football/league-registry";
import type { LeagueSlug } from "../../../types/football";
import type { HistMatch } from "../../../types/prediction";
const BASE = "https://api.sportmonks.com/v3/football";
/** Primary football-data source. Keep the token in the Authorization header so it never appears in request URLs. */
export const sportmonks: ProviderAdapter<import("../../../types/football").Match[], { date: string }> & { configured(): boolean } = {
  id: "sportmonks",
  configured: () => Boolean(env().SPORTMONKS_API_KEY),
  async fetch({ date }) {
    const key = env().SPORTMONKS_API_KEY; if (!key) throw new ProviderError("sportmonks", "auth", "Not configured");
    await spendCredits("sportmonks"); await acquire("sportmonks");
    const url = `${BASE}/fixtures/date/${date}?include=participants;state;scores;round;venue&filters=fixtureLeagues:${Object.keys(SM_LEAGUES).join(",")}`;
    const { json, latencyMs } = await providerFetch<{ data?: SmFixture[] }>({ provider: "sportmonks", url, headers: { Authorization: key } });
    if (json.data !== undefined && !Array.isArray(json.data)) throw new ProviderError("sportmonks", "bad_response", "Unexpected response shape");
    return { data: normalizeSportmonks(validateItems("sportmonks", json.data ?? [], smFixtureSchema)), meta: { provider: "sportmonks", fetchedAt: new Date().toISOString(), cached: false, latencyMs } };
  },
  async health() { try { await this.fetch({ date: new Date().toISOString().slice(0, 10) }); return { ok: true }; } catch (e) { return { ok: false, detail: (e as Error).message }; } },
};

const DAY = 86_400_000, WINDOW_DAYS = 90, PAGE_CAP = 8;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * A season of finished results for one league, used to fit the models. This is what lets the Danish and Scottish leagues (which
 * football-data.org does not cover) get predictions from Sportmonks alone. Fixtures are read in 90-day windows, page by page,
 * and run through the same normaliser as the daily fixtures so team names match between history and today's matches.
 */
export async function fetchSportmonksSeason(league: LeagueSlug, season: number): Promise<HistMatch[]> {
  const key = env().SPORTMONKS_API_KEY; if (!key) throw new ProviderError("sportmonks", "auth", "Not configured");
  const entry = leagueEntry(league), id = entry?.sm; if (!entry || !id) return [];
  const from = entry.calendarSeason ? Date.UTC(season, 0, 1) : Date.UTC(season, 6, 1);
  const to = Math.min(entry.calendarSeason ? Date.UTC(season, 11, 31) : Date.UTC(season + 1, 5, 30), Date.now());
  const out: HistMatch[] = [];
  for (let a = from; a <= to; a += WINDOW_DAYS * DAY) {
    const b = Math.min(a + (WINDOW_DAYS - 1) * DAY, to);
    for (let page = 1; page <= PAGE_CAP; page++) {
      await spendCredits("sportmonks"); await acquire("sportmonks", 15_000);
      const url = `${BASE}/fixtures/between/${ymd(a)}/${ymd(b)}?include=participants;state;scores&filters=fixtureLeagues:${id}&per_page=50&page=${page}`;
      const { json } = await providerFetch<{ data?: SmFixture[]; pagination?: { has_more?: boolean } }>({ provider: "sportmonks", url, headers: { Authorization: key }, timeoutMs: 15_000 });
      if (json.data !== undefined && !Array.isArray(json.data)) throw new ProviderError("sportmonks", "bad_response", "Unexpected response shape");
      for (const m of normalizeSportmonks(validateItems("sportmonks", json.data ?? [], smFixtureSchema))) {
        if (m.status === "finished" && m.score.home != null && m.score.away != null) out.push({ date: m.kickoffUtc, home: m.home.slug, away: m.away.slug, hg: m.score.home, ag: m.score.away });
      }
      if (!json.pagination?.has_more) break;
    }
  }
  return out;
}