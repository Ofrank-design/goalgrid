> **Archived, not current.** The original phase-by-phase setup notes. See [SETUP.md](../../SETUP.md) for the current steps.

# GoalGrid, Phase 1 setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in. Never commit it. Generate unlock keys with `openssl rand -base64 32`.
3. Create a Supabase project, then run `supabase/migrations/0001_foundation.sql` in its SQL editor.
4. `npm run dev`. `/` serves the homepage, `/api/health` checks the server, `POST /api/unlock` needs a signed-in user.
Rotate every key that has appeared in a chat, email or screenshot before using it here.

## Phase 2
- Run `supabase/migrations/0002_football_core.sql` after 0001.
- Set `SPORTMONKS_API_KEY` and `FOOTBALL_DATA_API_KEY`. Try `GET /api/matches?date=YYYY-MM-DD`.
- `npm test` runs the normalization tests. Check Sportmonks league ids and `include` names against a real response on your plan.
- Club crests from the providers are returned by `/api/matches` by default. Set `GOALGRID_ALLOW_CRESTS=false` to hide them.

## Phase 4 and 5
- `GET /api/predictions?date=YYYY-MM-DD`: 9 models (Poisson, Dixon Coles, Bivariate Poisson, Negative Binomial, Recent Form, Elo, Logistic Regression, Gradient Boosted Trees, Market Consensus), weighted by out of sample log loss. Free gets headline numbers, Pro and above also get the per model breakdown.
- `GET /api/analysis?date=...&id=sm:123`: up to five language models (Groq, Anthropic, OpenRouter, Gemini, NVIDIA) read the same verified facts. Answers are validated, outliers set aside, and the blend is capped at 25% weight. Pro and above only.
- Set the five LLM keys in `.env.local`. Model names can be overridden with `GROQ_MODEL`, `ANTHROPIC_MODEL`, `OPENROUTER_MODEL`, `GEMINI_MODEL`, `NVIDIA_MODEL`.
- `npm test` runs 51 tests.

## Phase 6 (app)
- `/dashboard` Free, `/pro` Pro, `/premium` Premium, `/matches/[id]?date=`, `/leagues/[slug]`, `/sign-in`, `/community` and `/leaderboard` (placeholders).
- Access is checked on the server for every request. Pages never trust the browser about the tier.
- Sign in uses Supabase email and password. In Supabase, add `http://localhost:3000/auth/callback` (and your live domain) to the allowed redirect URLs.

## Models, OddsPapi, community (Phases 4, 7)
- Up to 83 base models run on every match (plus a stacker and a conformal wrapper; see docs/MODELS.md). `GET /api/predictions/match?date=...&id=sm:123` is the single match call: all models, with market odds, forecast weather and kickoff time. Models without data (xG feed, injuries, lineups, tactics, structured news) abstain and are listed.
- Fitting takes about 20 seconds per league on first request, then is cached for 12 hours per server instance. Run on a host that allows long requests (the routes set `maxDuration = 60`) or warm the cache with a scheduled request.
- OddsPapi: set `ODDSPAPI_API_KEY` (optional `ODDSPAPI_BOOKMAKERS`, default `pinnacle`). Its prices are merged with The Odds API by bookmaker. Confirm the La Liga, Serie A, Bundesliga and Ligue 1 tournament ids with `GET /v4/tournaments`.
- Run `supabase/migrations/0004_community.sql`. Set `CRON_SECRET` and optionally `BLOCKED_TERMS` (comma separated). Picks are settled by the evaluate job below.
- `npm test` runs 51 tests.

## Operations (Phase 8)
- Run `supabase/migrations/0005_operations.sql`.
- Set `ADMIN_EMAILS` (comma separated, confirmed accounts only) to open `/admin` and `/admin/moderation`. Everyone else gets a 404.
- `vercel.json` schedules three jobs, all protected by `CRON_SECRET`: refresh (06:00 UTC, fits models and stores predictions), digest (07:30 UTC, match day email) and evaluate (every 3 hours, scores finished matches and settles community picks).
- `/accuracy` is public: every prediction is stored before kickoff and scored afterwards, with calibration.
- Email: set `RESEND_API_KEY`, `SITE_URL` (for links, no trailing slash) and `EMAIL_SECRET` (any long random string). Until you verify a domain in Resend, set `EMAIL_FROM=GoalGrid <onboarding@resend.dev>`, which only delivers to your own address. Signup is double opt in. `EMAIL_DAILY_CAP` defaults to 90 to stay inside the free plan.

## Information pages, crests (Phase 9 session)
- Six pages under the footer: `/about`, `/methodology`, `/responsible-use`, `/privacy`, `/terms`, `/contact`. Their text lives in `src/content/info/*.json` and the contact details in `src/content/site.json`; one layout (`src/components/site/InfoPage.tsx`) renders all six. Hero images are in `public/site`.
- The contact form posts to `/api/contact`, which emails `CONTACT_TO` (default: the first `ADMIN_EMAILS` entry, then the address in `site.json`) through Resend.
- 96 club crests are in `public/crests`, with `manifest.json` mapping team slugs (and common name variants) to files. The app uses a local crest first, then the provider's image, then letters.

## Production hardening (Phase 9)
- Run `supabase/migrations/0006_hardening.sql`. Read `docs/SECURITY.md`, `docs/DEPLOY.md` and `docs/RUNBOOK.md`.
- `npm run check-env` (before deploy), `npm run scan` (credentials), `npm run loadtest -- <url> 20 15` (staging only). CI runs typecheck, tests, scan, audit and build.
- Premium now needs its own `GOALGRID_UNLOCK_KEY_PREMIUM`; the Pro code no longer opens it.

## Leagues, teams, search
- `/leagues`, `/leagues/[slug]` (next fixtures and a standings table), `/teams`, `/teams/[slug]` (season record, last five, home and away split, next matches) and `/search` (teams and leagues). Standings and form are calculated from this season's results, so they need no extra data source. They are cached for 12 hours.
- `public/crests/clubs.json` lists the 96 clubs with their league and display name. A club missing from it has no team page. Promoted or relegated clubs need a crest file and a line in that file.
- Players: there is no player data feed, so there are no player pages and search does not cover players.
- `/sitemap.xml` and `/robots.txt` are generated from `SITE_URL`.
