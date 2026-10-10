import { shiftDate, todayUtc } from "@/lib/app/format";
import { getFixtures } from "@/lib/engine/ingestion/fixtures";
import { getHistory } from "@/lib/engine/ingestion/history";
import { LEAGUES } from "@/lib/football/clubs";
import { footballData } from "@/lib/providers/football-data";
import { sportmonks } from "@/lib/providers/sportmonks";
import { apiFootball } from "@/lib/providers/api-football";
import { ProviderError } from "@/lib/providers/types";
import type { Match } from "@/types/football";

type Outcome = { ok: true; matches: Match[] } | { ok: false; error: string };

/** Calls one provider directly, so a failure and an empty answer can be told apart. */
async function ask(provider: typeof sportmonks | typeof footballData | typeof apiFootball, date: string): Promise<Outcome> {
  if (!provider.configured()) return { ok: false, error: "key not set" };
  try {
    const { data } = await provider.fetch({ date });
    return { ok: true, matches: data };
  } catch (e) {
    const kind = e instanceof ProviderError ? `${e.kind}${e.status ? ` (HTTP ${e.status})` : ""}` : "error";
    return { ok: false, error: `${kind}: ${(e as Error).message}`.slice(0, 180) };
  }
}

const summary = (o: Outcome) =>
  !o.ok ? <span style={{ color: "#ff5d5d" }}>{o.error}</span>
  : o.matches.length ? <span style={{ color: "#00e676" }}>{o.matches.length} matches</span>
  : <span style={{ color: "#f5b942" }}>0 matches (the provider answered, but with nothing the app keeps)</span>;

/** What each provider returns for today and tomorrow, what the app ends up using, and how much history the models have. */
export async function AdminFixtureCheck() {
  const dates = [todayUtc(), shiftDate(todayUtc(), 1)];
  const providers = [["football-data", footballData], ["sportmonks", sportmonks], ["api-football", apiFootball]] as const;
  const [calls, used, history] = await Promise.all([
    Promise.all(dates.flatMap((date) => providers.map(async ([name, p]) => ({ date, name, out: await ask(p, date) })))),
    Promise.all(dates.map(async (date) => {
      try { return { date, fx: await getFixtures(date) }; } catch (e) { return { date, error: (e as Error).message }; }
    })),
    Promise.all(LEAGUES.map(async (l) => {
      try { return { name: l.name, n: (await getHistory(l.slug)).length }; } catch (e) { return { name: l.name, n: -1, error: (e as Error).message.slice(0, 100) }; }
    })),
  ]);
  return (
    <>
      <h2>Fixture check</h2>
      <div className="card scroll">
        <p className="note">Each provider is called directly, for the dates below (UTC).</p>
        <table>
          <thead><tr><th>DATE</th><th>PROVIDER</th><th>ANSWER</th><th>FIRST MATCHES</th></tr></thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.date + c.name}>
                <td>{c.date}</td><td>{c.name}</td><td>{summary(c.out)}</td>
                <td className="note">{c.out.ok ? c.out.matches.slice(0, 3).map((m) => `${m.home.name} v ${m.away.name}`).join(", ") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card scroll" style={{ marginTop: 12 }}>
        <p className="note">What the app actually uses (the same path the dashboard takes).</p>
        <table>
          <thead><tr><th>DATE</th><th>SOURCE</th><th>MATCHES</th><th>ATTEMPTS</th></tr></thead>
          <tbody>
            {used.map((u) => u.fx ? (
              <tr key={u.date}>
                <td>{u.date}</td><td>{u.fx.source ?? "none"}</td><td className="n">{u.fx.matches.length}</td>
                <td className="note">{u.fx.attempts.map((a) => `${a.provider}: ${a.ok ? `${a.count ?? 0} matches` : a.error}`).join("; ")}{u.fx.stale ? " (stale copy)" : ""}</td>
              </tr>
            ) : (
              <tr key={u.date}><td>{u.date}</td><td colSpan={3} style={{ color: "#ff5d5d" }}>{u.error}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card scroll" style={{ marginTop: 12 }}>
        <p className="note">Finished matches available to fit the models. Predictions need history for the league.</p>
        <table>
          <thead><tr><th>LEAGUE</th><th>HISTORY</th></tr></thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.name}>
                <td>{h.name}</td>
                <td className="n" style={{ color: h.n > 0 ? "#00e676" : "#ff5d5d" }}>{h.n >= 0 ? `${h.n} matches` : h.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
