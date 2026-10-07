export interface EnvReport { errors: string[]; warnings: string[] }
const PLACEHOLDER = /^(changeme|change-me|your[-_ ]|xxx|todo|example|test|secret|password)/i;
/** Checks the production environment before deploy. Reports names only, never values. */
export function checkEnv(e: Record<string, string | undefined>): EnvReport {
  const errors: string[] = [], warnings: string[] = [], v = (k: string) => (e[k] ?? "").trim();
  const need = (k: string, min = 1) => { if (v(k).length < min) errors.push(min > 1 ? `${k} must be set and at least ${min} characters` : `${k} is not set`); else if (PLACEHOLDER.test(v(k))) errors.push(`${k} looks like a placeholder`); };
  need("NEXT_PUBLIC_SUPABASE_URL"); need("NEXT_PUBLIC_SUPABASE_ANON_KEY"); need("SUPABASE_SERVICE_ROLE_KEY"); need("CRON_SECRET", 32); need("SITE_URL");
  if (v("NEXT_PUBLIC_SUPABASE_URL") && !v("NEXT_PUBLIC_SUPABASE_URL").startsWith("https://")) errors.push("NEXT_PUBLIC_SUPABASE_URL must start with https://");
  if (v("SITE_URL") && (!v("SITE_URL").startsWith("https://") || v("SITE_URL").endsWith("/"))) errors.push("SITE_URL must start with https:// and have no trailing slash");
  if (!v("SPORTMONKS_API_KEY") && !v("FOOTBALL_DATA_API_KEY")) errors.push("Set SPORTMONKS_API_KEY or FOOTBALL_DATA_API_KEY, or there is no fixture data");
  if (!v("ADMIN_EMAILS")) warnings.push("ADMIN_EMAILS is empty, so nobody can open /admin");
  if (!v("RESEND_API_KEY")) warnings.push("RESEND_API_KEY is not set: email, signup confirmation and the contact form are off");
  if (v("EMAIL_FROM").includes("resend.dev")) warnings.push("EMAIL_FROM uses resend.dev, which only delivers to your own address. Verify a domain in Resend");
  if (!v("EMAIL_SECRET")) warnings.push("EMAIL_SECRET is not set, so CRON_SECRET signs email links");
  if (!["GROQ_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY", "GEMINI_API_KEY", "NVIDIA_API_KEY"].some(k => v(k))) warnings.push("No language model key is set: AI analysis is off");
  if (!v("THE_ODDS_API_KEY") && !v("ODDSPAPI_API_KEY")) warnings.push("No odds key is set: the market signal is off");
  if (v("GOALGRID_ALLOW_CRESTS") === "false") warnings.push("GOALGRID_ALLOW_CRESTS=false hides provider crest URLs (local crest files still show)");
  return { errors, warnings };
}
