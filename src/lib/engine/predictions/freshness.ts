/**
 * How old a stored scheduled prediction may be before a request refits it. The default of 26 hours suits a once-a-day refresh (Vercel Hobby) with a few hours of slack.
 * If you refresh every 15 minutes (see .github/workflows/cron.yml or a Pro plan) predictions are in practice always fresher than this; set
 * STORED_PREDICTION_MAX_AGE_MINUTES=45 to make a missed run fall back to refitting quickly.
 */
const configured = Number(process.env.STORED_PREDICTION_MAX_AGE_MINUTES);
export const STORED_MAX_AGE_MS = (Number.isFinite(configured) && configured > 0 ? configured : 26 * 60) * 60_000;

/**
 * Whether a stored prediction can be served instead of refitting models.
 * - Once a match has kicked off (or is live or finished) the stored prediction is frozen and is always served, so what we show is what we said beforehand.
 * - Before kickoff it must come from the current engine version and be recent.
 */
export function storedIsUsable(
  row: { engineVersion: string; builtAt: string },
  match: { status: string; kickoffUtc: string },
  engineVersion: string,
  now = Date.now(),
  maxAgeMs = STORED_MAX_AGE_MS,
): boolean {
  if (match.status !== "scheduled" || Date.parse(match.kickoffUtc) <= now) return true;
  const age = now - Date.parse(row.builtAt);
  return row.engineVersion === engineVersion && Number.isFinite(age) && age >= 0 && age <= maxAgeMs;
}
