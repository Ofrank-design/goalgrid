# Runbook

## Backups
- Supabase takes daily backups on paid plans, with point in time recovery as an option. On the free plan, take your own: `pg_dump "$DATABASE_URL" -Fc -f goalgrid-$(date +%F).dump` at least weekly, and keep copies off the platform.
- Restore into a fresh project with `pg_restore --no-owner -d "$NEW_DATABASE_URL" goalgrid-DATE.dump`, then re-apply the migrations in order (`npm run test:db` shows the expected end state).
- Practise a restore once before you need one.

## When something fails
| Symptom | Likely cause | What to do |
|---|---|---|
| Dashboard says match data unavailable | Both football providers failing or keys wrong | `/admin` providers table shows the last error kind. Cached data is served for up to an hour. Check keys and quotas. |
| No odds | Odds API monthly credits used (500 free) or OddsPapi quota (250 free) | The market signal turns off by itself. Raise the cache time with `ODDS_CACHE_HOURS`. |
| AI analysis empty | Language model keys missing, a provider down, or answers rejected | `/admin` shows each provider. The forecast falls back to the statistics alone. |
| Emails not arriving | Domain not verified, or the 100 per day cap | Check `email_log`. Verify the domain in Resend. |
| Accuracy page empty | No refresh job has stored predictions yet | Press Refresh predictions in `/admin`. |
| Slow first request | Models being fitted | Normal once after a restart. The morning refresh warms it. |

## Rotate a key
1. Create the new key at the provider. 2. Set it in the host's environment and redeploy. 3. Revoke the old key. 4. Run `npm run scan` to confirm nothing was committed. For `CRON_SECRET` or `EMAIL_SECRET`, in-flight email links signed with the old value stop working, which is acceptable.
If a key has appeared in a chat, email, screenshot or repository, treat it as exposed and rotate it.

## Quotas to remember
football-data.org 10 requests a minute, The Odds API 500 credits a month (about 16 a day is the built in guard), OddsPapi 250 requests, Resend 100 emails a day (cap 90), free Supabase pauses after inactivity.

## Person asks to delete their data
Find their user id in Supabase Authentication, then delete the user. Posts, picks, preferences, likes and entitlements cascade. Remove their address from `email_subscribers` if they subscribed without an account. Reply within one month, as the privacy policy says.

## Moderation
Three distinct reports hide a post automatically. Review the queue in `/admin/moderation`, then Restore or Remove. Every action is logged in `moderation_actions`.

## Provider outages, credits and limits
- **A provider keeps failing.** After 5 failures in a row its circuit opens and calls fail fast for 15 seconds, doubling up to 5 minutes, with one probe call at a time. The circuit is per server instance and heals itself; nothing to reset. Check `/admin` for the last error kind. "Response format changed" means the provider altered its payload: look at the adapter schema in `src/lib/providers/schemas.ts`.
- **A feature went quiet because credits ran out.** Budgets are rolling 24 hours per provider (`PROVIDER_BUDGET_<PROVIDER>`). The error is "Daily credit budget reached" and the feature falls back to cached or no data. Raise the budget or wait.
- **Users report "too many requests".** Limits live in `src/lib/security/ratelimit.ts` (per instance, first line) and the `take_rate_limit` function (shared). If many users share one address they share a bucket. If every request seems to share one bucket, `TRUSTED_PROXY_HOPS` is probably wrong.
- **Pages are slow after a deploy or a cron outage.** `engine_cache` is empty or stale, so requests are fitting models. Run the `refresh` job from `/admin` or call `/api/cron/jobs?job=refresh`.
- **A limiter or cache table grows.** `maintenance` (nightly) prunes `rate_events` and old `engine_cache` rows and expired simulation runs. If it fails, run it by hand with the cron route.
