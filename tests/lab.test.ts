import test from "node:test";
import assert from "node:assert/strict";
import { analyse, anomalies, autocorrelation, changePoint, chiSquareFit, chiSquareP, compare, distribution, driftTest, ksTwoSample, runsTest, streaks, summary } from "../src/lib/lab/stats";
import { normalizeBatch } from "../src/lib/lab/observations";
import { rng } from "../src/lib/engine/models/math";
const r = rng(7), iid = (n: number) => Array.from({ length: n }, () => 1 / (1 - r() * 0.99)); // heavy tailed, independent
test("summary: known values", () => { const s = summary([1, 2, 3, 4, 5]); assert.ok(s.status === "ok" && s.mean === 3 && s.median === 3 && s.min === 1 && s.max === 5 && Math.abs(s.sd - 1.5811) < 1e-3); assert.equal(summary([]).status, "insufficient"); });
test("distribution: buckets cover every observation and respect custom edges", () => { const d = distribution([0.5, 1.3, 2.5, 12, 1.0], [1, 2, 10]); assert.ok(d.status === "ok"); if (d.status === "ok") { assert.equal(d.buckets.reduce((a, b) => a + b.count, 0), 5); assert.deepEqual(d.buckets.map(b => b.count), [1, 2, 1, 1]); } });
test("chi-square p-values match tables", () => { assert.ok(Math.abs(chiSquareP(3.841, 1) - 0.05) < 0.002); assert.ok(Math.abs(chiSquareP(9.488, 4) - 0.05) < 0.002); assert.ok(Math.abs(chiSquareP(18.307, 10) - 0.05) < 0.002); });
test("chi-square fit refuses without enough data or valid expectations", () => { assert.equal(chiSquareFit([5, 5], [1, 1]).status, "insufficient"); const ok = chiSquareFit([260, 240], [1, 1]); assert.ok(ok.status === "ok" && ok.p > 0.3); const bad = chiSquareFit([480, 20], [1, 1]); assert.ok(bad.status === "ok" && bad.p < 0.001); });
test("KS: same source not flagged, shifted source flagged", () => { const a = iid(400), b = iid(400), c = iid(400).map(x => x * 1.6); const same = ksTwoSample(a, b), diff = ksTwoSample(a, c); assert.ok(same.status === "ok" && same.p > 0.01); assert.ok(diff.status === "ok" && diff.p < 0.001); assert.equal(ksTwoSample([1, 2], [3, 4]).status, "insufficient"); });
test("runs test: alternating and clustered series are flagged, independent series is not", () => {
  const alt = Array.from({ length: 200 }, (_, i) => (i % 2 ? 5 : 1)), clus = Array.from({ length: 200 }, (_, i) => (i < 100 ? 1 : 5)), a = runsTest(alt), c = runsTest(clus), n = runsTest(iid(500));
  assert.ok(a.status === "ok" && a.p < 0.001 && c.status === "ok" && c.p < 0.001 && n.status === "ok" && n.p > 0.001);
});
test("autocorrelation: detects dependence, quiet for independent data, refuses small samples", () => {
  const dep: number[] = [0]; for (let i = 1; i < 500; i++) dep.push(0.8 * dep[i - 1] + (r() - 0.5)); const d = autocorrelation(dep), n = autocorrelation(iid(500));
  assert.ok(d.status === "ok" && d.lags[0].r > 0.5 && d.lags[0].outsideBand); assert.ok(n.status === "ok" && n.outside <= 3); assert.equal(autocorrelation([1, 2, 3]).status, "insufficient");
});
test("streaks: exact run counts and honest expectation", () => {
  const v = [...Array(10).fill(1), 5, 1, 1, 5, ...Array(5).fill(1), ...Array(20).fill(5)], s = streaks(v, 2); assert.ok(s.status === "ok"); if (s.status === "ok") { assert.equal(s.longest, 10); assert.equal(s.runCount, 3); assert.equal(s.current.type, "at-or-above"); assert.equal(s.current.length, 20); assert.ok(s.expectedLongestIfIndependent! > 0); }
  assert.equal(streaks([1, 2, 3], 2).status, "insufficient");
});
test("anomalies: a planted outlier is flagged first; constant data is handled", () => { const v = iid(300).map(x => Math.min(x, 6)); v[150] = 500; const a = anomalies(v); assert.ok(a.status === "ok" && "flagged" in a && a.flagged[0].index === 150); const c = anomalies(Array(60).fill(2)); assert.ok(c.status === "ok" && "note" in c); });
test("change point: finds a planted shift, stays quiet without one", () => {
  const shifted = [...iid(150), ...iid(150).map(x => x * 3)], q = changePoint(shifted), n = changePoint(iid(300)); assert.ok(q.status === "ok" && Math.abs(q.index - 150) < 25 && q.evidence !== "none"); assert.ok(n.status === "ok" && n.evidence !== "strong");
});
test("compare: identifies a different distribution and refuses tiny samples", () => { const c = compare(iid(300), iid(300).map(x => x * 2)); assert.ok(c.status === "ok" && c.ks.status === "ok" && c.ks.p < 0.001 && c.mannWhitney.p < 0.001); assert.equal(compare([1], [2]).status, "insufficient"); });
test("drift test and full analysis report insufficient data instead of numbers", () => { assert.equal(driftTest(iid(50)).status, "insufficient"); const a = analyse(iid(10)); assert.equal(a.streaks.status, "insufficient"); assert.equal(a.randomness.runs.status, "insufficient"); assert.equal(a.changePoint.status, "insufficient"); assert.equal(a.summary.status, "ok"); });
test("import: validates, parses, dedupes, rejects bad rows and future times, never repairs", () => {
  const now = Date.parse("2026-10-04T12:00:00Z");
  const out = normalizeBatch([{ externalRoundId: "a1", observedAt: "2026-10-04T10:00:00Z", value: "1.85x" }, { externalRoundId: "a1", observedAt: "2026-10-04T10:00:00Z", value: 1.85 }, { observedAt: "2026-10-04T10:01:00Z", value: -3 }, { observedAt: "garbage", value: 2 }, { observedAt: "2026-10-05T10:00:00Z", value: 2 }, { observedAt: "2026-10-04T10:02:00Z", value: "abc" }, { observedAt: "2026-10-04T10:03:00Z", value: 3.2 }], { gameId: "g", sourceId: "s", now });
  assert.equal(out.accepted.length, 2); assert.equal(out.duplicatesInBatch, 1); assert.equal(out.rejected.length, 4); assert.equal(out.accepted[0].value, 1.85); assert.equal(out.accepted[0].rawValue, "1.85x"); assert.equal(out.accepted[0].dataQuality, "observed");
});

import { EXPORT_NOTE, metaOf, observationsCsv, toCsv } from "../src/lib/lab/export";
test("export: CSV is escaped, formulas are neutralised, numbers stay numbers", () => {
  const c = toCsv(["a", "b"], [["=SUM(A1)", 1.5], ["+cmd", -2], ["say \"hi\", ok", "line\nbreak"], ["@x", null]]).split("\r\n");
  assert.equal(c[1], "'=SUM(A1),1.5"); assert.equal(c[2], "'+cmd,-2"); assert.equal(c[3], '"say ""hi"", ok","line\nbreak"'.replace("\n", "\n")); assert.ok(c.join("").includes("'@x,"));
  assert.equal(observationsCsv([1.5, 2], ["t1", "t2"]), "observed_at,value\r\nt1,1.5\r\nt2,2\r\n");
});
test("export metadata carries the honesty note and engine version", () => { const m = metaOf({ game: "g", source: "s", range: "24H", engineVersion: "lab-1.0.0", observations: 5, exportedAt: "2026-10-04T00:00:00Z" }); assert.equal(m.note, EXPORT_NOTE); assert.match(m.note, /Not a prediction/); assert.equal(m.engineVersion, "lab-1.0.0"); });

import { askPrompt, buildLabFacts, cleanQuestion, plainSummary, validateAsk, ASK_SYSTEM } from "../src/lib/lab/ask";
import { clearSchemes, registerScheme, verify } from "../src/lib/lab/verify";
import { createHmac } from "node:crypto";
const sample = iid(300).map(x => Math.min(x, 20));
const facts = buildLabFacts(analyse(sample, { threshold: 2, window: 20 }), { values: sample, range: "24H", window: 20, threshold: 2, delayed: false, lastObservedAt: "2026-10-04T10:00:00Z", partial: 0 });
test("ask: facts come only from the analysis and name the sample, the halves and data freshness", () => {
  assert.ok(facts.length >= 8 && facts[0].id === "F1" && /Sample: 300/.test(facts[0].text)); assert.ok(facts.some(f => /Second half versus first half/.test(f.text)) && facts.some(f => /Data is current/.test(f.text)));
  const late = buildLabFacts(analyse(sample), { values: sample, range: "24H", window: 20, threshold: 2, delayed: true, lastObservedAt: null, partial: 3 }); assert.ok(late.some(f => /currently delayed/.test(f.text)) && late.some(f => /3 observations are marked partial/.test(f.text)));
  assert.match(askPrompt(facts, "what changed?"), /untrusted user text/); assert.match(ASK_SYSTEM, /never invent/i);
});
test("ask: answer lines are kept only if they cite facts, use no invented numbers and avoid forbidden wording", () => {
  const f = [{ id: "F1", text: "Sample: 300 observations over the 24H range." }, { id: "F2", text: "Mean 3.5, median 2.1." }];
  const ok = validateAsk({ lines: [{ text: "There are 300 observations.", facts: ["F1"] }, { text: "The mean is 3.5.", facts: ["F2"] }, { text: "The mean is 9.9.", facts: ["F2"] }, { text: "A result is due soon.", facts: ["F2"] }, { text: "No citation here.", facts: [] }, { text: "Mean 3.5 as shown.", facts: ["F9"] }], limitations: "Based on 300 observations." }, f);
  assert.ok(ok); assert.deepEqual(ok!.lines.map(l => l.text), ["There are 300 observations.", "The mean is 3.5."]); assert.equal(ok!.dropped, 4); assert.equal(ok!.limitations, "Based on 300 observations.");
  assert.equal(validateAsk({ lines: [{ text: "Invented 42.", facts: ["F1"] }] }, f), null); assert.equal(validateAsk("nope", f), null); assert.equal(validateAsk({ lines: [] }, f), null);
  assert.equal(validateAsk({ lines: [{ text: "It is 300.", facts: ["F1"] }], limitations: "Maybe 77 more." }, f)!.limitations, "");
  assert.equal(plainSummary(facts).length, 6); assert.equal(cleanQuestion("hi"), null); assert.equal(cleanQuestion(5), null); assert.equal(cleanQuestion("What changed in the last 500?"), "What changed in the last 500?");
});
test("verify: with no documented scheme the answer is unavailable, never a guess", () => {
  clearSchemes(); const r = verify("any-source", { seed: "a" }, "1.5"); assert.equal(r.status, "UNABLE_TO_VERIFY"); assert.equal(r.message, "Verification unavailable for this source."); assert.equal(r.derived, null); assert.equal(r.match, null);
});
test("verify: a registered documented scheme reproduces a result, flags a mismatch and reports missing inputs", () => {
  registerScheme({ id: "test-hmac", name: "HMAC-SHA256 (test scheme)", documentationUrl: "https://example.test/docs", inputs: ["serverSeed", "clientSeed", "nonce"], derive: i => ({ algorithm: "HMAC-SHA256(serverSeed, clientSeed:nonce), first 8 hex", derived: createHmac("sha256", i.serverSeed).update(`${i.clientSeed}:${i.nonce}`).digest("hex").slice(0, 8) }) }, ["test-source"]);
  const inputs = { serverSeed: "s", clientSeed: "c", nonce: "7" }, want = createHmac("sha256", "s").update("c:7").digest("hex").slice(0, 8);
  const ok = verify("test-source", inputs, want); assert.equal(ok.status, "VALID"); assert.equal(ok.match, true); assert.equal(ok.expected, want); assert.equal(verify("test-source", inputs, "deadbeef").status, "INVALID");
  assert.equal(verify("test-source", { serverSeed: "s" }, want).status, "UNABLE_TO_VERIFY"); assert.equal(verify("other-source", inputs, want).status, "UNABLE_TO_VERIFY"); clearSchemes();
});
