/** Usage: npm run backtest -- history.json [folds]. history.json is an array of { date, home, away, hg, ag }. Prints one line per model and writes backtest-report.json. */
import { readFileSync, writeFileSync } from "node:fs";
import { walkForwardBacktest } from "../src/lib/engine/evaluation/backtest";
const [file, folds] = process.argv.slice(2); if (!file) { console.error("Give a history JSON file."); process.exit(1); }
const r = walkForwardBacktest(JSON.parse(readFileSync(file, "utf8")), { folds: folds ? Number(folds) : 4 });
console.log(`folds ${r.folds.length} | base rates: logLoss ${r.baseline.logLoss} btts ${r.baseline.bttsBrier} over2.5 ${r.baseline.over25Brier}`);
for (const m of [...r.models].sort((a, b) => (a.logLoss ?? 9) - (b.logLoss ?? 9))) console.log(`${m.id.padEnd(30)} ll ${m.logLoss ?? "-"} brier ${m.brier1x2 ?? "-"} btts ${m.bttsBrier ?? "-"} o2.5 ${m.over25Brier ?? "-"} ece ${m.ece ?? "-"} cov ${m.coverage} ms ${m.msPerFit}`);
writeFileSync("backtest-report.json", JSON.stringify(r, null, 2)); console.log("wrote backtest-report.json");
