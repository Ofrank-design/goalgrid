import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { scanText } from "../src/lib/security/secrets";
const SKIP = new Set(["node_modules", ".next", ".git", "crests", "site", "brand"]), EXT = /\.(ts|tsx|js|mjs|json|md|sql|css|html|yml|yaml|txt|env|example)$/;
let bad = 0;
(function walk(dir: string) {
  for (const f of readdirSync(dir)) {
    if (SKIP.has(f)) continue; const p = join(dir, f), st = statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (f === ".env.local" || /^\.env\.(production|development)(\.local)?$/.test(f)) { console.error(`${p}: environment file must not be committed`); bad++; continue; }
    if (!EXT.test(f) && f !== ".env.example" || st.size > 3_000_000 || p.endsWith("secrets.ts")) continue;
    const hits = scanText(readFileSync(p, "utf8")); if (hits.length) { console.error(`${p}: ${hits.join(", ")}`); bad++; }
  }
})(process.cwd());
if (bad) { console.error(`\n${bad} file(s) look like they contain credentials.`); process.exit(1); } else console.log("No credentials found.");
