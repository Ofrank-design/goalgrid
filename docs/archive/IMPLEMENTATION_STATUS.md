> **Archived, not current.** Written during the build and kept for history. Several statements here are out of date. See [docs/STATUS.md](../STATUS.md) for what is true now.

# GoalGrid implementation status

This repository is being built against `Pasted markdown(4).md` / the GoalGrid master architecture contract.

## Implemented in the current source tree

- Five-league, real-team Simulation Lab with server-side Pro gating.
- Separate synthetic simulation storage.
- Deterministic seeds, replay, skip, scenario simulation, season simulation and bounded Monte Carlo.
- Tactical/broadcast match visualization with event-driven animation.
- Control-plane resource limits, feature flags, model/provider registry metadata and AI budgets.
- Notification center, preferences and durable delivery bookkeeping.
- Scheduled refresh every 15 minutes and notification delivery every 5 minutes in `vercel.json`.
- Saved matches.
- Private discussion circles with member-only posts.
- Premium Experiment Lab UI.
- Admin Control Plane page/API.

## Verification limits

A clean dependency install is still required before claiming production certification. The supplied archive has an incomplete `node_modules` tree, so full typecheck/test/build execution depends on restoring the declared npm dependencies.

Browser QA also requires a running browser environment.
