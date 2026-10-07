# Status

The single place that says what is true. If another document disagrees with this one, this one wins (or fix the other).

## What CI proves on every push
- Types compile, lint has 0 errors, 142 tests pass (unit tests plus two golden-master suites for the match player and simulation lab), no credentials in the repo, no high severity dependency advisories.
- The production build succeeds and a **smoke test** of the built app passes: pages render with security headers, signed-out visitors are refused on user routes, admin routes return 404 to non-admins, cross-site and oversized writes are blocked, cron needs its secret, errors do not leak internals, and rate limits trip per client (including against forged headers).
- All 29 migrations apply to a clean Postgres, and security assertions hold: every table has row level security, `anon` and `authenticated` hold no write grants (also for tables created later), the public feed works and hides private circles, notification de-duplication works, slots and limiters behave.

## What is built
Match data and predictions (up to 83 models, stacker, conformal wrapper), accuracy tracking with frozen pre-kickoff predictions, simulation lab (capped at 1,000 runs), community (posts, circles, challenges, picks), notifications, lab tools, admin and moderation, email digest. See the other docs in this folder for each area.

## How the expensive work is kept off the request path
The cron `refresh` job fits the ensembles and stores each match's prediction and each league's model library in `engine_cache`. Request handlers read those rows. If a row is missing or stale they fit on demand as a fallback and write the result back. Predictions for matches that have started are frozen. Interactive Premium tools (model comparison, scenario lab) still fit on demand, guarded by per-user limits and concurrency slots.

## Not verified, and not done
- **Not run against a real Supabase project.** CI uses plain Postgres with a stand-in for Supabase's roles and `auth` schema. The real gateway, Auth, storage and email templates are untested. Do a staging run before launch.
- **Signed-in flows are not covered by the smoke test** (it checks refusal, not success). Sign-up, posting, picks and settlement have unit tests for their logic only.
- **Ensemble timing on real data is unmeasured.** About 3 seconds per league on synthetic data; the refresh job has 60 seconds, so a day with many leagues could time out. Watch the first cron runs.
- **Cron runs once a day on Vercel Hobby.** `vercel.json` has two daily jobs (refresh, daily). Fresher data needs `.github/workflows/cron.yml` or Vercel Pro. See `docs/DEPLOY.md`.
- **Everything is free.** Pro and Premium tools are open to every signed-in user: no payments, no access codes (the database helpers `is_pro()` and `is_premium()` now mean "signed in"). Heavy tools are protected by per-account rate limits and concurrency slots instead of plans. If paid plans ever return, change `currentTier()` and those two SQL functions.
- **Lint warnings (73)** are tracked, not hidden: `react-hooks/refs` (25) and `set-state-in-effect` in `useMatchPlayer.ts`, plus `no-explicit-any` elsewhere. See `docs/TECH_DEBT.md`.
- **CSP** still allows `'unsafe-inline'` scripts and `img-src https:` because the homepage is a 330 KB static HTML file served by rewrite, outside React.
- **No Prettier** and no end-to-end browser tests. Accessibility and browser behaviour have not been reviewed.
