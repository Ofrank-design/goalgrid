# Game Intelligence Lab

Premium page at `/intelligence`. Source spec: `GOALGRID_GAME_INTELLIGENCE_LAB.md`.

## Built
- **Engine** (`src/lib/lab/stats.ts`): summary metrics, configurable distribution buckets with entropy, streak analysis with the longest run expected under independence, rolling mean and spread, autocorrelation with its 95% band, runs test, drift test (two sample KS, first half vs second half), next-after-low vs next-after-high dependency test, robust anomaly flags, change-point scan, two-series comparison (KS and Mann-Whitney), chi-square fit against expected shares you supply. Every analysis returns "Insufficient observations for this analysis" below its minimum sample.
- **Data foundation** (migration `0008_game_lab.sql`): games, sources, append-only deduplicated observations, collection health, analysis runs. Reads are Premium only through RLS; writes are server only.
- **Import** (`POST /api/lab/import`, admin only): validates and normalises rows into the canonical observation, skips duplicates, rejects bad or future-dated rows without repairing them. The `SourceAdapter` interface is where future sources plug in.
- **API** `GET /api/lab/analysis` (Premium only) and the `/intelligence` page, with game, source, range, window and threshold selectors, delayed-data and no-data states.

## Added after the first pass
- **Exports**: `GET /api/lab/export` gives the stored observations as CSV or the analysis as JSON, with game, source, range, engine version, export time and the honesty note. Spreadsheet formulas in cells are neutralised.
- **Saved runs**: `POST/GET /api/lab/runs` and `/intelligence/runs`. A run is computed on the server from stored data (never from numbers the browser sends), keeps the engine version, is never recalculated, and the newest 50 per user are kept.
- **Comparison Lab**: `/intelligence/compare` and `GET /api/lab/compare` (KS and Mann-Whitney between two stored series).

## Added in the third pass
- **Research notes** (`/api/lab/notes`, migration 0012): Premium, private to the author, 500 characters, linkable to a game, range, saved run or metric. Notes never change observations.
- **Ask the Lab** (`/api/lab/ask`): facts are computed on the server from stored data and numbered; the language model sees only those facts and the question. Each answer line must cite fact ids, may use no number that is absent from the facts it cites, and is dropped if it uses forbidden wording ("due", "guaranteed", betting language). If no model is configured or none gives a valid answer, the stored results are shown in plain words instead. Limits: 10 questions per hour, 10-minute cache.
- **Verification framework** (`lib/lab/verify.ts`, `/api/lab/verify`): a source is verified only against a documented scheme registered for it. None are registered, because none were provided, so every source answers "Verification unavailable for this source." The tests use a clearly marked test scheme to prove the VALID, INVALID and UNABLE TO VERIFY paths.

## Not built
- **Live collector and live stream.** No source has been licence-checked. The spec requires checking terms, redistribution and commercial use first, and forbids CAPTCHA bypass and bot evasion.
- **A real verification scheme.** To add one, register its documented algorithm for a source id with `registerScheme`.
- Caching jobs, realtime, model lab.
- RLS tests need a real Postgres.
