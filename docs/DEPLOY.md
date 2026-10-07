# Deploying GoalGrid

## 1. Supabase
1. Create a project. Apply every file in `supabase/migrations/` in order (`0001` to `0029`), with `supabase db push` or the SQL editor. Run `npm run test:db` against a scratch local database first if you can.
2. Authentication, URL configuration: set Site URL to your domain and add `https://YOUR_DOMAIN/auth/callback` (and `http://localhost:3000/auth/callback` for development) to the redirect list.
3. Authentication: keep email confirmation on, set a minimum password length of 8 or more, and turn on multi factor authentication for admin accounts.
4. Copy the project URL, anon key and service role key. The service role key never goes in client code.

## 2. Resend
Add and verify your domain (SPF and DKIM records), then set `EMAIL_FROM` to an address on it. Until then `onboarding@resend.dev` delivers only to your own address.

## 3. Host (Vercel)
1. Import the repository. Set every variable from `.env.example`. Required: the Supabase keys, `CRON_SECRET` (32+ random characters), `SITE_URL` (https, no trailing slash) and one football data key. There are no access codes to set. Generate secrets with `openssl rand -base64 32`.
2. Run `npm run check-env` locally against the same values. It lists problems by name and never prints values.
3. **Cron on Vercel Hobby.** Hobby cron can run a job at most once a day, with timing only guaranteed within the hour, and a faster schedule fails the deploy. `vercel.json` therefore has two daily jobs, both protected by `CRON_SECRET` (Vercel sends it as the bearer token): **refresh** at 04:00 UTC (fits the models and stores predictions and model libraries) and **daily** at 07:30 UTC (digest, email notifications, accuracy evaluation and pick settlement, weekly challenge, maintenance). The `daily` job has a 45 second budget, skips what does not fit and reports it. Because refresh runs once a day, predictions can be up to a day old before kickoff. To refresh every 15 minutes for free, enable `.github/workflows/cron.yml` (set the repository variable `SITE_URL` and secret `CRON_SECRET`) and set `STORED_PREDICTION_MAX_AGE_MINUTES=45`. On Pro you can instead put the 15-minute schedules back in `vercel.json`.
4. Rate limiting: on Vercel the client address comes from the platform's headers. On any other host set `TRUSTED_PROXY_HOPS` to the number of proxies in front of the app, and set `RATE_LIMIT_SALT`. Getting the hop count wrong makes limits key on the proxy's address or on a forgeable one.
5. Provider credit budgets are shared across instances and default to odds-api 16, serpapi 3, newsapi 90 per rolling 24 hours. Set `PROVIDER_BUDGET_<PROVIDER>` to match your plans (for example `PROVIDER_BUDGET_SPORTMONKS`); `0` removes a cap.

## 4. After the first deploy
- The app refuses to start in production if a required setting is missing; the deploy log names it.
- Watch the first few `refresh` runs in `/admin`: the job must finish inside 60 seconds. Until it has run once, request handlers fit models on demand (slower first views).
- `GET /api/health` returns ok.
- `GET /api/health/ready` with the bearer token shows the database answering and which providers are configured.
- Sign up, confirm the email, set a username, and open the Pro and Premium tools (no code needed).
- Open `/admin` (your email must be in `ADMIN_EMAILS`) and press Refresh predictions, then Send test digest.
- Open `/accuracy`. It fills in as matches finish.
- Point an uptime monitor at `/api/health/ready` with the bearer header.

## 5. Load check (staging only)
`npm run loadtest -- https://staging.example.com/api/matches 20 15` reports requests per second and p50, p95 and p99 latency. Expect 429 responses beyond the per-IP limits, which proves the limiter works. Tell your data providers before testing against live endpoints.
