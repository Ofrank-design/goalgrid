> **Archived, not current.** Written during the build and kept for history. Several statements here are out of date. See [docs/STATUS.md](../STATUS.md) for what is true now.

# GoalGrid Build Status

## Scope

This repository has been audited and extended against the GoalGrid master engineering contract supplied in `Pasted markdown(4).md`.

The contract requires evidence-driven predictions, strict separation between real football, GoalGrid intelligence, synthetic simulation and community data, governed model execution, controlled simulation, server-side authorization, RLS, resource limits, notification/community infrastructure, and truthful production validation.

## Implemented

### Football intelligence

- Normalized football-data provider layer.
- League/team/match history ingestion.
- Versioned prediction storage and result evaluation.
- Model registry and bounded active-model ensemble.
- Cross-fit calibration, confidence, disagreement and provenance paths.
- Historical backtesting service and persistent admin backtest records.

### Control plane

- Central `GOALGRID_LIMITS` configuration.
- DB-backed resource limit records.
- Model/provider registry synchronization.
- Feature flags.
- AI budget records.
- Candidate-model cap and active-model cap.
- Per-user concurrent simulation slots with PostgreSQL locking/expiry.

### Simulation Lab

- Pro-gated core Simulation Lab.
- Only real clubs from the supported five leagues are eligible:
  - Premier League
  - La Liga
  - Serie A
  - Bundesliga
  - Ligue 1
- League/team eligibility is resolved from football history rather than a permanent fictional list.
- Real football data is kept separate from synthetic simulation output.
- Match simulation with deterministic seeds.
- Scenario simulation.
- Season simulation.
- Bounded Monte Carlo runs.
- Top-down pitch visualization.
- 22 visual player markers.
- Ball movement and event choreography.
- Tactical and broadcast views.
- Play/pause/1x/2x/4x.
- Skip/restart/replay.
- Live probabilities.
- Momentum.
- xG/statistics.
- Goal/card/substitution/half-time/full-time states.
- Stored replay and exports.
- Simulation sharing with immutable stored-run references.
- Community discovery of shared simulations.
- Resource/runtime/concurrency limits.

### Simulation engine governance

- `runMany()` rejects runs above the central simulation iteration ceiling.
- Season simulation rejects runs above the same hard ceiling.
- Simulation API routes use per-user concurrency slots.
- Long simulation work has explicit runtime ceilings.
- Simulation history is retained for a bounded period.
- Simulation state never writes to official match/result/prediction tables.
- Match event generation reacts to simulated game state: trailing sides receive higher attacking pressure, especially late; leading sides receive lower attacking pressure.

### Experiment / research

- Premium Experiment Lab.
- Named experiments.
- Dataset selector representing the currently implemented league-history dataset.
- GoalGrid weighted-ensemble model path.
- Poisson-strength baseline path.
- Reproducible seed.
- Scenario variants using the same seed.
- Stored experiment run IDs.
- Experiment history/reopen path.
- CSV/JSON export through the existing stored-run export service.
- Premium model comparison route/UI.
- Admin real-football walk-forward backtest route/UI with persistent results.

### Game Intelligence Lab

Remains separate from the football Simulation Lab and continues to use its own statistical-research pages and APIs.

### Community

- Posts and comments.
- Likes/follows.
- Saved matches.
- Private circles.
- Owner member invitations.
- Member-only circle posts.
- Public-feed exclusion for private-circle posts.
- Reporting/moderation controls.
- Community notifications.
- Simulation share discovery.

### Challenges / reputation

- Weekly challenge records.
- Challenge registration.
- Challenge standings derived from stored user predictions.
- Challenge completion notifications.
- Prediction reputation/trophy infrastructure.
- Public profile route.

### Notifications

- Persistent notification records.
- Notification preferences.
- Category preferences.
- In-app read/unread state.
- Server-side deduplication.
- Email delivery bookkeeping.
- Scheduled notification delivery.
- Security notifications retained in-app regardless of ordinary category preference.
- Community, challenge and simulation notification events.

### Operations

- Admin Control Plane.
- Provider health records.
- Resource-limit records.
- Model registry records.
- AI budget records.
- Admin backtesting records.
- Scheduled prediction refresh every 15 minutes.
- Scheduled notification delivery every 5 minutes.
- Scheduled challenge maintenance.
- Scheduled simulation cleanup.

## Corrected architectural issues

- Model-registry status mapping no longer promotes `shadow` or `unvalidated` models to `production`.
- Backtest migration no longer depends on a non-existent `public.admins` table.
- Private-circle posts are explicitly excluded from the public feed view.
- Private-circle post likes/reports verify circle membership.
- Saved-match rate limiting uses a dedicated save action rather than the prediction limiter.
- Experiment records identify the selected dataset/model path rather than being anonymous simulation runs.

## Validation performed

### Source parsing

A TypeScript AST parse was executed across the source tree:

- 285 TypeScript / TSX source files inspected.
- Syntax diagnostics: **0**.

### Dependency validation

The supplied archive contains a partial `node_modules` tree that is not a complete npm installation. `npm ci --offline` fails because required package tarballs are not cached. Therefore a full dependency-backed TypeScript/build/test run cannot be truthfully certified in this environment.

### Browser validation

No browser environment is available in this build environment, so real browser playback/layout QA is **not certified**.

## Production blockers

1. Run `npm ci` with registry access in a normal development/CI environment.
2. Run `npm run typecheck`.
3. Run `npm test`.
4. Run `npm run build`.
5. Apply Supabase migrations `0013` through `0025` to a clean/staging database and verify them as a complete chain.
6. Exercise RLS and authorization against a real Supabase project.
7. Browser-test Simulation Lab playback, Skip/Replay equivalence, responsive behavior and reduced-motion behavior.
8. Verify provider/team/crest/image licensing before public launch.
9. Rotate any credential that has previously been exposed during development.
10. Configure and verify all required provider/API environment variables.

## Known non-core research addendum

The repository still contains isolated fictional-league, generic multiplier, generic risk, alert-test and synthetic backtest routes. These remain protected behind `ENABLE_SIM_ADDENDUM` and are not part of the core football Simulation Lab. They must not be enabled as part of the five-league real-team Simulation Lab without an intentional product/legal review.
