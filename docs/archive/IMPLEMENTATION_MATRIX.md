> **Archived, not current.** Written during the build and kept for history. Several statements here are out of date. See [docs/STATUS.md](../STATUS.md) for what is true now.

# GoalGrid Implementation Matrix

| Area | Exists | Integrated | Main remaining verification |
|---|---:|---:|---|
| Football ingestion/providers | Yes | Yes | Provider credentials/quota run |
| Prediction engine | Yes | Yes | Full CI typecheck/tests |
| Model registry | Yes | Yes | Staging DB validation |
| Bounded model selection | Yes | Yes | Production performance monitoring |
| Prediction provenance | Yes | Yes | Staging end-to-end audit |
| Historical backtesting | Yes | Yes | Execute on real staging history |
| Simulation Lab | Yes | Yes | Browser + load QA |
| Five real leagues | Yes | Yes | Provider/licensing verification |
| Real-team-only selection | Yes | Yes | Dynamic season coverage test |
| Match visualization | Yes | Yes | Browser playback QA |
| Season simulation | Yes | Yes | Runtime/load QA |
| Monte Carlo | Yes | Yes | Runtime/load QA |
| Simulation resource governance | Yes | Yes | DB RPC + concurrency staging test |
| Experiment Lab | Yes | Yes | Browser + premium entitlement QA |
| Model comparison | Yes | Yes | Browser + real model data QA |
| Game Intelligence Lab | Yes | Yes | Data-source readiness |
| Community | Yes | Yes | Abuse/security QA |
| Private circles | Yes | Yes | RLS staging tests |
| Saved matches | Yes | Yes | RLS + data freshness QA |
| Challenges | Yes | Yes | Settlement/idempotency QA |
| Reputation/trophies | Yes | Yes | Evaluation edge-case QA |
| Notifications | Yes | Yes | Email provider integration QA |
| Admin Control Plane | Yes | Yes | Admin authorization + DB QA |
| Security controls | Yes | Yes | Pen-test style staging QA |
| Production build | Not certified | — | Clean npm install required |
| Browser QA | Not certified | — | Real browser environment required |
