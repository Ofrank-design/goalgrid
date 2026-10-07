import { checkEnv } from "../src/lib/security/envcheck";
const r = checkEnv(process.env as Record<string, string | undefined>);
r.errors.forEach(e => console.error("ERROR  ", e)); r.warnings.forEach(w => console.warn("WARNING", w));
if (r.errors.length) { console.error(`\n${r.errors.length} problem(s) to fix before deploying.`); process.exit(1); } else console.log(`\nEnvironment looks ready.${r.warnings.length ? ` ${r.warnings.length} optional item(s) above.` : ""}`);
