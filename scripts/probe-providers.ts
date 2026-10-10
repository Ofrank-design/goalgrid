export {};
/**
 * Live check of every provider key, using read-only endpoints (account, model or status calls where the provider has them, so almost
 * nothing is spent). Prints status and a short error message only, never keys or data.   npm run probe   (reads .env.local)
 */
type Hdr = Record<string, string>;
const e = process.env, today = new Date().toISOString().slice(0, 10);
const results: string[] = [];
 
const brief = (j: unknown): string => {
  const o = (j && typeof j === "object" ? j : {}) as Record<string, unknown>, err = o.error ?? o.errors ?? o.message;
  const pick = (v: unknown): string => (typeof v === "string" ? v : v && typeof v === "object" ? JSON.stringify(v) : "");
  return pick(err).replace(/\s+/g, " ").slice(0, 140);
};
const shape = (v: unknown, d = 0): unknown => Array.isArray(v) ? [v.length ? shape(v[0], d) : "empty"] : v && typeof v === "object" && d < 3 ? Object.fromEntries(Object.entries(v).slice(0, 25).map(([k, x]) => [k, shape(x, d + 1)])) : typeof v;
 
async function check(name: string, key: string | undefined, url: string, headers: Hdr = {}, opts: { showShape?: boolean } = {}) {
  if (!key) { results.push(`SKIP  ${name}  (no key in .env.local)`); return; }
  try {
    const r = await fetch(url, { headers }), j = (await r.json().catch(() => null)) as unknown, note = brief(j);
    // API-Football answers 200 and reports a bad key in `errors`, so a 200 with an error message still counts as a failure.
    const ok = r.ok && !(note && /token|key|subscription|access|limit|denied|invalid/i.test(note));
    results.push(`${ok ? "OK   " : "FAIL "} ${name}  HTTP ${r.status}${note ? `  ${note}` : ""}${opts.showShape && ok ? `\n      ${JSON.stringify(shape(j))}` : ""}`);
  } catch (err) { results.push(`FAIL  ${name}  ${(err as Error).message}`); }
}
 
async function main() {
  const q = encodeURIComponent;
  console.log("Checking providers...\n");
  // Football data
  await check("Supabase (service role)", e.SUPABASE_SERVICE_ROLE_KEY && e.NEXT_PUBLIC_SUPABASE_URL, `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, { apikey: e.SUPABASE_SERVICE_ROLE_KEY ?? "", Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}` });
  await check("football-data.org", e.FOOTBALL_DATA_API_KEY, "https://api.football-data.org/v4/competitions/PL", { "X-Auth-Token": e.FOOTBALL_DATA_API_KEY ?? "" });
  await check("Sportmonks", e.SPORTMONKS_API_KEY, `https://api.sportmonks.com/v3/football/leagues/271`, { Authorization: e.SPORTMONKS_API_KEY ?? "" });
  await check("API-Football", e.API_FOOTBALL_KEY, "https://v3.football.api-sports.io/status", { "x-apisports-key": e.API_FOOTBALL_KEY ?? "" });
  const tsKey = e.THE_STATS_API_KEY ?? e.STATS_PROVIDER_API_KEY;
  await check("TheStatsAPI", tsKey, `https://api.thestatsapi.com/api/football/competitions?per_page=1`, { Authorization: `Bearer ${tsKey}` });
  await check("GOAL API", e.GOAL_API_KEY, `https://api.goal-api.com/v1/fixtures/date/${today}?limit=2`, { Authorization: `Bearer ${e.GOAL_API_KEY}` }, { showShape: true });
  await check("Big Balls", e.BIG_BALLS_API_KEY, `https://api.bigballsdata.com/v1/matches?sport=football&league=epl&date=${today}&limit=2`, { Authorization: `Bearer ${e.BIG_BALLS_API_KEY}` });
  // Odds
  await check("The Odds API", e.THE_ODDS_API_KEY, `https://api.the-odds-api.com/v4/sports?apiKey=${q(e.THE_ODDS_API_KEY ?? "")}`);
  await check("OddsPapi", e.ODDSPAPI_API_KEY, `https://api.oddspapi.io/v4/participants?sportId=10&apiKey=${q(e.ODDSPAPI_API_KEY ?? "")}`);
  // Weather and news
  await check("OpenWeather", e.OPENWEATHER_API_KEY, `https://api.openweathermap.org/data/2.5/forecast?lat=51.5&lon=-0.12&cnt=1&appid=${q(e.OPENWEATHER_API_KEY ?? "")}`);
  await check("TheNewsAPI", e.NEWS_API_KEY, `https://api.thenewsapi.com/v1/news/all?api_token=${q(e.NEWS_API_KEY ?? "")}&search=football&language=en&limit=1`);
  await check("SerpAPI", e.SERPAPI_API_KEY, `https://serpapi.com/account?api_key=${q(e.SERPAPI_API_KEY ?? "")}`);
  // Email
  await check("Resend", e.RESEND_API_KEY, "https://api.resend.com/domains", { Authorization: `Bearer ${e.RESEND_API_KEY}` });
  // Language models (model-list calls, no tokens spent)
  await check("Groq", e.GROQ_API_KEY, "https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${e.GROQ_API_KEY}` });
  await check("Anthropic", e.ANTHROPIC_API_KEY, "https://api.anthropic.com/v1/models?limit=1", { "x-api-key": e.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" });
  await check("OpenRouter", e.OPENROUTER_API_KEY, "https://openrouter.ai/api/v1/auth/key", { Authorization: `Bearer ${e.OPENROUTER_API_KEY}` });
  await check("Gemini", e.GEMINI_API_KEY, "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { "x-goog-api-key": e.GEMINI_API_KEY ?? "" });
  await check("NVIDIA", e.NVIDIA_API_KEY, "https://integrate.api.nvidia.com/v1/models", { Authorization: `Bearer ${e.NVIDIA_API_KEY}` });
 
  console.log(results.join("\n"));
  const bad = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`\n${results.length - bad - results.filter((r) => r.startsWith("SKIP")).length} ok, ${bad} failed, ${results.filter((r) => r.startsWith("SKIP")).length} skipped`);
}
 
main();