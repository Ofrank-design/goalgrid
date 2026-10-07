/** CSRF guard for state changing requests. Browsers always send Origin on cross site POSTs, so a mismatch is blocked. A missing Origin (mail clients, scripts) is allowed because it cannot be a browser form attack. */
export function sameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin) return true; if (!host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
export const MAX_BODY_BYTES = 65_536;
