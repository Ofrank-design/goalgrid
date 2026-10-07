# Technical debt register

P0: critical security or data-integrity risk. P1: serious reliability or architecture issue. P2: maintainability or performance. P3: nice to have. Current as of this commit; `docs/STATUS.md` has the wider picture.

## P0
- None known. The migrations and row level security now run on a clean Postgres in CI (`npm run test:db`), but never against a real Supabase project. Do a staging run before launch.

## P1
- **Cron is daily on Vercel Hobby.** Data between runs is up to a day old unless the optional GitHub Actions refresher or Vercel Pro is used.
- **Refresh job time budget unmeasured on real data.** It must finish within 60 seconds for all leagues with fixtures that day.
- **Signed-in flows lack integration tests.** The smoke test covers refusal and limits only.
- No professional penetration test. No alert when a data provider goes down (the admin page shows status).
- Ask the Lab and every language-model feature depend on configured provider keys; with none they show stored results in plain words.

## P2
- **`useMatchPlayer.ts` (about 600 lines) reads a mutable ref during render** (the animation state), which is why it still carries 25 `react-hooks/refs` warnings. The golden-master test (`tests/golden/`) now makes it safe to redesign: move the animation state to a store read with `useSyncExternalStore`, keep the golden hashes identical, then promote the rule to an error. `MatchPlayer.tsx` and `SimLab.tsx` themselves were split into small views (see `docs/COMPONENTS.md`).
- CSP allows `'unsafe-inline'` scripts and `img-src https:` because of the static homepage; move the homepage into React and add nonces.
- The shared limiter, the engine cache and provider circuit breakers are Postgres or per-instance; if traffic outgrows Postgres counters, move the limiter to Redis behind the same `takeShared` function.
- Unused tables from the paid-plan design: `user_entitlements` and `unlock_attempts` (nothing reads them; kept as history). Drop them in a later migration if you want them gone.
- Duplicate migrations: `0021` repeats `0020` (harmless, kept because it is applied history). Two notification table designs appear in `0015` and `0018`.
- Challenge "correct" counts are inferred from `points > 0`; store the result explicitly.
- Code style: about 100 very long lines in a few files (`ml-extra.ts`, intelligence page, team and league pages). No Prettier.

## P3
- Browser, accessibility and visual regression testing.
- Architecture decision records.
