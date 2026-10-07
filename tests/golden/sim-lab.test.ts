import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { simulateMatch } from "../../src/lib/simulation/match";
import { SimLab, type SimRun } from "../../src/components/SimLab";
import { click, frames, hash, installDom, mount, settle, setValue, type Trace } from "./harness";

/** Golden master for the simulation lab form, with a deterministic fake API. GOLDEN_UPDATE=1 re-records; GOLDEN_DUMP=dir writes the HTML. */
const GOLDEN = path.join(__dirname, "sim-lab.golden.json");
const poisson = (l: number, k: number) => Math.exp(-l) * l ** k / Array.from({ length: k }, (_, i) => i + 1).reduce((a, b) => a * b, 1);
const M = (() => { const m = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => poisson(1.6, i) * poisson(1.2, j))), s = m.flat().reduce((a, b) => a + b, 0); return m.map(r => r.map(v => v / s)); })();
const xg = { home: 1.6, away: 1.2 };
const summary = (shift: number) => ({ home: 0.44 - shift, draw: 0.27, away: 0.29 + shift, btts: 0.55, over25: 0.51 + shift, xgHome: 1.6 - shift * 3, xgAway: 1.2 + shift * 3 });
const presets = [{ id: "home-striker-out", label: "Home striker unavailable", kind: "assumption", note: "An adjustable assumption." }, { id: "heavy-rain", label: "Heavy rain", kind: "derived", note: "Measured from history." }];
const teams = ["arsenal", "chelsea", "liverpool", "everton", "fulham"];
const json = (data: unknown, ok = true) => ({ ok, json: async () => data });

function fakeApi() {
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: { body?: string }) => {
    const u = String(url), body = init?.body ? JSON.parse(init.body) : {};
    if (u.startsWith("/api/simulation/teams")) return json({ teams: u.includes("la-liga") ? ["real-madrid", "barcelona", "sevilla"] : teams, presets });
    if (u === "/api/simulation/match") {
      const seed = body.seed ?? "SEEDA", sim = simulateMatch(M, xg, seed), n = (body.scenario ?? []).length;
      return json({ ...sim, id: `run-${seed}`, baseline: summary(0), scenario: summary(0.02 * n), engineVersion: "engine-test",
        applied: (body.scenario ?? []).map((id: string) => ({ id, label: id, kind: "assumption", mh: 0.9, ma: 1 })) });
    }
    if (u === "/api/simulation/multi") return json({ runs: body.runs, seed: body.seed ?? "SEEDA", home: { count: body.runs * 0.44, probability: 0.44, margin: 0.03 }, draw: { count: body.runs * 0.27, probability: 0.27, margin: 0.03 }, away: { count: body.runs * 0.29, probability: 0.29, margin: 0.03 }, btts: { probability: 0.55, margin: 0.03 }, over25: { probability: 0.51, margin: 0.03 }, topScores: [{ score: "1-1", count: 12, probability: 0.12 }, { score: "2-1", count: 10, probability: 0.1 }], note: "Sampling error shown." });
    return json({ error: "unexpected request " + u }, false);
  };
}

type Scenario = { name: string; props: () => Parameters<typeof SimLab>[0]; drive: (v: Awaited<ReturnType<typeof mount>>, snap: (l: string) => void) => Promise<void> };
async function clickEveryButton(v: Awaited<ReturnType<typeof mount>>, snap: (l: string) => void, round: string) {
  const labels = v.buttons().map(b => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim().replace(/\s+/g, " "));
  for (let i = 0; i < labels.length; i++) {
    const b = v.buttons()[i]; if (!b || b.disabled) { snap(`${round}-${i}-disabled`); continue; }
    await click(b); await settle(); await frames(20); snap(`${round}-${i}-${labels[i]}`);
  }
}
const scenarios: Scenario[] = [
  { name: "fresh-lab", props: () => ({ maxRuns: 1000, premium: true }), drive: async (v, snap) => {
    snap("loading"); await settle(); snap("teams-loaded");
    const sel = () => [...document.querySelectorAll("select")] as HTMLSelectElement[];
    await setValue(sel()[0], "la-liga"); await settle(); snap("league-changed");
    await setValue(sel()[1], "sevilla"); await setValue(sel()[2], "barcelona"); snap("teams-chosen");
    await setValue(document.querySelector("input")! as HTMLInputElement, "MYSEED1"); snap("seed-typed");
    for (const round of ["r1", "r2", "r3"]) await clickEveryButton(v, snap, round);
  } },
  { name: "opened-from-history-with-old-engine", props: () => { const sim = { ...simulateMatch(M, xg, "OLDRUN"), id: "run-OLDRUN", baseline: summary(0), scenario: summary(0.04), applied: [{ id: "heavy-rain", label: "Heavy rain", kind: "derived", mh: 0.95, ma: 0.95 }], engineVersion: "engine-old" } as SimRun; return { maxRuns: 1000, premium: false, initial: { sim, league: "premier-league", home: "arsenal", away: "chelsea", engineVersion: "engine-old", currentEngine: "engine-test" } }; }, drive: async (v, snap) => {
    snap("initial"); await settle(); snap("teams-loaded"); for (const round of ["r1", "r2"]) await clickEveryButton(v, snap, round);
  } },
];
for (const sc of scenarios) test(`sim lab renders identically: ${sc.name}`, async () => {
  fakeApi(); const dom = installDom(), trace: Trace = {};
  const dumpDir = process.env.GOLDEN_DUMP && path.join(process.env.GOLDEN_DUMP, "simlab-" + sc.name); if (dumpDir) fs.mkdirSync(dumpDir, { recursive: true });
  const v = await mount(dom, SimLab, sc.props());
  await sc.drive(v, l => { const h = v.html(); trace[l] = hash(h); if (dumpDir) fs.writeFileSync(path.join(dumpDir, l.replace(/[^\w.+-]+/g, "_") + ".html"), h); });
  await v.root.unmount();
  const golden: Record<string, Trace> = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, "utf8")) : {};
  if (process.env.GOLDEN_UPDATE) { golden[sc.name] = trace; fs.writeFileSync(GOLDEN, JSON.stringify(golden, null, 1) + "\n"); return; }
  assert.ok(golden[sc.name], "no golden recorded (run with GOLDEN_UPDATE=1 on known-good code)");
  const bad = Object.keys({ ...golden[sc.name], ...trace }).filter(k => golden[sc.name][k] !== trace[k]);
  assert.deepEqual(bad, [], `rendering changed at: ${bad.slice(0, 6).join(", ")}${bad.length > 6 ? ` (+${bad.length - 6} more)` : ""}`);
  assert.ok(new Set(Object.values(trace)).size >= 12, "interaction produced too few distinct renders");
});
