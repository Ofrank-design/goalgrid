/** Patterns for credentials that must never be committed. Used by the scan script and the CI check. */
export const PATTERNS: [string, RegExp][] = [
  ["Anthropic key", /sk-ant-[A-Za-z0-9_-]{20,}/], ["OpenRouter key", /sk-or-v1-[A-Za-z0-9]{20,}/], ["Groq key", /gsk_[A-Za-z0-9]{20,}/], ["NVIDIA key", /nvapi-[A-Za-z0-9_-]{20,}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/], ["Google OAuth style key", /AQ\.Ab[A-Za-z0-9_-]{20,}/], ["Resend key", /re_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/], ["TheStatsAPI key", /fapi_[A-Za-z0-9]{20,}/],
  ["Supabase JWT", /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/], ["Private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Assigned secret", /\b[A-Z0-9_]*(?:API_KEY|SERVICE_ROLE_KEY|SECRET|UNLOCK_KEY[A-Z_]*)[ \t]*=[ \t]*["']?[A-Za-z0-9._\/+=-]{20,}["']?/],
];
export function scanText(text: string): string[] { return PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name); }
