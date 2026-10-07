# GoalGrid model library

Source of truth for the catalogue is `GOALGRID_100_MODES.md`. This file records what was actually built and why.

## Numbers
- **83 base models** run per league (`ALL_MODELS`): the original 50, 17 new history based models, and 16 registered models that wait for a data feed.
- **2 meta components** (99 Stacked Meta-Learner, 100 Conformal Prediction Wrapper) live in the ensemble, not in `ALL_MODELS`.
- **15 catalogue entries retired on purpose** as redundant (see `RETIRED` in `models/specialist.ts`). They stay in the registry with the reason.
- 83 + 2 + 15 = 100.

## New models that run on match history
51 Ordinal Logistic, 53 LDA, 54 QDA, 55 RDA, 58 GAM, 60 Elastic Net, 67 Dirichlet-Multinomial Form, 68 Beta-Binomial BTTS, 69 Beta-Binomial Over 2.5, 70 Binomial Clean-Sheet, 76 Hidden Markov Form-State, 77 Kalman Strength, 78 Dynamic Linear Model, 82 Frank, 83 Clayton and 84 Gaussian copulas, 89 Matrix Factorisation.

Notes:
- The in-house boosted trees and neural nets are implementations of the methods, not the named libraries.
- Models 68 to 70 tilt a Poisson score matrix toward a Beta or Binomial estimate. They are scored on 1X2 like every model, so their BTTS, totals and clean sheet skill is **not** measured separately yet.
- QDA and RDA were marked degraded on the synthetic test data. That is the guard working, not a bug; real data decides.

## Waiting for data (registered, abstain, never guess)
xG based: GP regression, quantile regression, quantile forest. Goal minute based: four survival models, Hawkes. In-match timeline: Markov score state. Player, set piece, referee, table pressure, rivalry, manager change and squad continuity models.

## Engine rules added
- **Degraded guard.** A model that scores worse than plain base rates (by 0.03 log loss) on the most recent 20% of matches gets zero weight and is listed as abstaining with the reason.
- **Stacker (99).** A log pool of family averages, fitted only on held out predictions. It is used only if it beats the weighted ensemble by 0.005 log loss on the second half of the held out matches, then blended 50/50.
- **Conformal (100).** Split conformal on held out ensemble predictions, 80% target. The ensemble weights were tuned on the same matches, so real coverage can be a little lower. It is a set of plausible results, never a promise.
- **Registry.** `src/lib/engine/registry.ts` builds the library from the fitted ensemble: status (research, production, degraded, retired), health, whether a model produces a score matrix, last trained time, held out log loss and weight. `GET /api/models?league=...` returns it for Pro and Premium.

## Added after the first pass
- **Per-model calibration.** Isotonic regression per outcome, cross-fitted on the held-out matches: a calibrator is fitted on one half and judged on the other, and kept only if it improves log loss by 0.003 or more. The stacker and conformal wrapper use the cross-fitted predictions. Model weights are still computed from the raw scores.
- **Rolling walk-forward backtest** (`npm run backtest -- history.json`), with BTTS and over 2.5 scored separately for models that produce a score matrix.
- **Prediction versioning** (migration 0010): numbered, append-only versions, written only when a prediction moves by 0.5 points or the engine version changes, and frozen 15 minutes before kickoff. `GET /api/predictions/history` and `/api/predictions/movement` (Pro and Premium).
- **Feature registry and leakage tests**: `features/registry.ts` lists every input with when it becomes known; tests prove features do not change when later results change, that fits ignore test-period results, and that the registry matches the real feature vector.

## Scenarios (third pass)
`GET /api/predictions/[matchId]/scenarios?date=YYYY-MM-DD&scenario=a,b&homeAttack=0.95` (Premium). The weighted score matrix is re-weighted by m_home^x * m_away^y and renormalised; for a Poisson matrix that equals scaling its rates. Only "home advantage removed" is computed from the match itself. The other presets (striker or keeper out, rain, fatigue, rest) are **illustrative assumptions** and are labelled that way in the response, because GoalGrid has no player level data. Effects multiply and are kept between 0.5 and 1.5. It never changes the real prediction.

Correction: I earlier said the scenario spec was missing. The endpoint is named in `GOALGRID_100_MODES.md` but its behaviour is described in `GOALGRID_SIMULATION.md` (sections 31 and 32), which I had not read. The full Simulation Lab in that file (quick match, season simulator, Monte Carlo, strategy research) is not built.

## Not built yet
- Calibration of the weights themselves, and per-market calibration.
- Backtests are not scheduled or stored; they run from the script.
- `data-quality` and per-model `performance` endpoints, and lineup impact (no lineup data).
