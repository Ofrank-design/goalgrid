# GoalGrid setup

## Run it locally
1. `npm ci`
2. Copy `.env.example` to `.env.local` and fill it in. Never commit it. Generate secrets with `openssl rand -base64 32`. Rotate any key that has ever appeared in a chat, email or screenshot.
3. Create a Supabase project and apply **every** file in `supabase/migrations/` in order (`supabase db push`, or paste them into the SQL editor one by one). They are numbered `0001` to `0029` and later files depend on earlier ones.
4. In Supabase, add `http://localhost:3000/auth/callback` (and your live domain) to the allowed redirect URLs.
5. `npm run dev`. `/api/health` checks the server.

Required settings: the three Supabase values, and in production `CRON_SECRET` and `SITE_URL`. There are no access codes: every tool is free for every signed-in user. The app refuses to start in production if a required setting is missing. `npm run check-env` lists problems by name without printing values.

## Checks
| Command | What it does |
|---|---|
| `npm run typecheck`, `npm run lint`, `npm test` | Types, lint (0 errors required; warnings are tracked), unit tests and the golden-master UI tests (see `docs/COMPONENTS.md`) |
| `npm run scan`, `npm audit --audit-level=high` | Credential scan and dependency advisories |
| `npm run build` then `npm run smoke` | Production build, then a smoke test of auth, limits, origin, body size and cron against the built app |
| `npm run test:db` | Applies all migrations to a **scratch local** Postgres and runs the security assertions (needs `psql`; refuses non-local databases) |

CI runs all of these (see `.github/workflows/ci.yml`).

## Where to read next
`docs/STATUS.md` (what works and what does not), `docs/DEPLOY.md`, `docs/RUNBOOK.md`, `docs/SECURITY.md`, `docs/MODELS.md`, `docs/SIMULATION.md`, `docs/LAB.md`, `docs/TECH_DEBT.md`, `docs/COMPONENTS.md`. Older build notes are in `docs/archive/` and are not current.
