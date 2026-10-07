import test from "node:test";
import assert from "node:assert/strict";
import { calibrationBins, evaluate, summarize } from "../src/lib/ops/eval";
import { signToken, verifyToken } from "../src/lib/ops/tokens";
import { buildDigest, esc } from "../src/lib/ops/digest";
test("evaluate: outcome, log loss, brier and goal markets", () => {
  const e = evaluate({ home: 0.6, draw: 0.25, away: 0.15, btts: 0.4, over25: 0.7 }, 2, 0);
  assert.equal(e.outcome, "home"); assert.ok(Math.abs(e.logLoss + Math.log(0.6)) < 1e-9); assert.ok(Math.abs(e.brier - (0.16 + 0.0625 + 0.0225)) < 1e-9); assert.ok(e.correct && e.bttsCorrect === true && e.over25Correct === false);
  assert.ok(!evaluate({ home: 0.2, draw: 0.3, away: 0.5, btts: null, over25: null }, 1, 1).correct); assert.equal(evaluate({ home: 0.2, draw: 0.3, away: 0.5, btts: null, over25: null }, 1, 1).bttsCorrect, null);
});
test("summary and calibration", () => {
  const mk = (pf: number, ok: boolean) => ({ correct: ok, log_loss: -Math.log(ok ? pf : 0.2), brier: 0.5, btts_correct: ok, over25_correct: null, p_home: pf, p_draw: 0.2, p_away: 0.8 - pf });
  const rows = [mk(0.7, true), mk(0.7, true), mk(0.7, false), mk(0.45, true)], s = summarize(rows);
  assert.equal(s.n, 4); assert.equal(s.accuracy, 0.75); assert.equal(s.over25Accuracy, null); assert.equal(summarize([]).n, 0);
  const b = calibrationBins(rows), hi = b.find(x => x.lo === 0.7)!; assert.equal(hi.n, 3); assert.ok(Math.abs(hi.actual! - 2 / 3) < 1e-9); assert.equal(b.find(x => x.lo === 0.4)!.n, 1);
});
test("tokens: valid, wrong kind, tampered, expired", () => {
  const t = signToken("confirm", "a@b.com", "secret", 1000, 5000);
  assert.equal(verifyToken(t, "confirm", "secret", 5500), "a@b.com"); assert.equal(verifyToken(t, "unsub-sub", "secret", 5500), null); assert.equal(verifyToken(t, "confirm", "other", 5500), null);
  assert.equal(verifyToken(t, "confirm", "secret", 6001), null); assert.equal(verifyToken(t.slice(0, -2) + "xx", "confirm", "secret", 5500), null); assert.equal(verifyToken("garbage", "confirm", "secret"), null);
});
test("digest: escapes team names and carries the unsubscribe link and the risk note", () => {
  const d = buildDigest([{ league: "PL", home: "A <b>&</b>", away: "B", kickoffUtc: "2026-10-03T14:00:00Z", probs: [0.5, 0.3, 0.2], score: "2-1" }], "2026-10-03", "https://x.test/u?t=1", "https://x.test");
  assert.ok(d.html.includes("A &lt;b&gt;&amp;&lt;/b&gt;") && !d.html.includes("<b>&</b>")); assert.ok(d.html.includes("https://x.test/u?t=1") && d.text.includes("Unsubscribe:") && d.text.includes("not guarantees")); assert.equal(esc(`"'`), "&quot;&#39;"); assert.ok(d.subject.includes("1 prediction for"));
});
