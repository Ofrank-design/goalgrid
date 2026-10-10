import test from "node:test";
import assert from "node:assert/strict";
import { resolveTeam, sameTeam, teamSimilarity } from "../src/lib/football/team-resolver";
import { ThrottleQueue } from "../src/lib/providers/queue";
import { crestOf, type TeamInfo } from "../src/lib/football/teams-normalize";

test("resolver: different spellings of one club match", () => {
  const same: [string, string][] = [["Manchester United FC", "Manchester United"], ["Man United", "Manchester United"], ["Manchester Utd", "Manchester United FC"], ["Tottenham Hotspur FC", "Tottenham"], ["Wolverhampton Wanderers FC", "Wolves"], ["Brighton & Hove Albion FC", "Brighton"], ["Bayern München", "FC Bayern Munich"], ["Paris Saint-Germain FC", "Paris Saint Germain"], ["Atlético de Madrid", "Atletico Madrid"], ["Internazionale Milano", "Inter"], ["Borussia Mönchengladbach", "Borussia Monchengladbach"], ["manchester-city", "man-city"]];
  for (const [a, b] of same) assert.ok(sameTeam(a, b), `${a} = ${b}`);
});
test("resolver: different clubs never match", () => {
  const diff: [string, string][] = [["Manchester City", "Manchester United"], ["Real Madrid", "Real Sociedad"], ["Athletic Club", "Atletico Madrid"], ["Arsenal", "Chelsea"], ["Inter", "AC Milan"], ["Leeds United", "Newcastle United"], ["Borussia Dortmund", "Borussia Monchengladbach"], ["Sheffield United", "Sheffield Wednesday"]];
  for (const [a, b] of diff) assert.ok(!sameTeam(a, b), `${a} != ${b}`);
});
test("resolver: picks the best candidate or none", () => {
  const list = [{ name: "Manchester United FC", id: 1 }, { name: "Manchester City FC", id: 2 }, { name: "Newcastle United FC", id: 3 }];
  assert.equal(resolveTeam("Man United", list)?.id, 1); assert.equal(resolveTeam("Man City", list)?.id, 2); assert.equal(resolveTeam("Nobody Rovers", list), null);
  assert.equal(teamSimilarity("Arsenal", "Arsenal FC"), 1);
});
test("throttle queue: jobs start at least the gap apart, in order, and one failure does not stop the rest", async () => {
  let clock = 0; const starts: number[] = [], slept: number[] = [];
  const q = new ThrottleQueue(6500, () => clock, async (ms) => { slept.push(ms); clock += ms; });
  const out = await Promise.allSettled([1, 2, 3].map((n) => q.run(async () => { starts.push(clock); if (n === 2) throw new Error("boom"); return n; })).flat());
  assert.deepEqual(out.map((r) => r.status), ["fulfilled", "rejected", "fulfilled"]);
  assert.deepEqual(starts, [0, 6500, 13000]); assert.ok(starts.every((s, i) => i === 0 || s - starts[i - 1] >= 6500));
});
test("crest lookup is matched loosely and returns the provider's url", () => {
  const teams = [{ slug: "manchester-united", crestUrl: "https://c/mu.png" }] as TeamInfo[];
  assert.equal(crestOf(teams, "man-united"), "https://c/mu.png"); assert.equal(crestOf(teams, "chelsea"), null);
});
