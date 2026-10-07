# GoalGrid

**AI football intelligence for people who want to understand the match, not just see a pick.**

GoalGrid combines real football data, statistical models, machine learning, AI-assisted analysis, prediction history, controlled simulation, and a football community in one platform.

> **Clear on the surface. Deep when you need it.**

GoalGrid shows probabilities, evidence, confidence, uncertainty and context. It does not promise that any football outcome is certain.

---

## The product at a glance

| Area | What it does |
|---|---|
| **Football** | Fixtures, results, teams, players, leagues, match centres and live views |
| **Predictions** | 1X2, scores, BTTS, Over/Under, confidence and model context |
| **Intelligence** | Model consensus, calibration, provenance, data quality and prediction history |
| **Simulation Lab** | Pro-only hypothetical football matches, scenarios and seasons using real clubs |
| **Game Intelligence Lab** | Premium statistical research, distributions, anomalies, randomness and experiments |
| **Community** | Match discussion, predictions, follows, likes, saved matches and private circles |
| **Challenges** | Verified prediction competitions, scoring, leaderboards and trophies |

---

## Football Intelligence

GoalGrid starts with real football data and builds an evidence chain around it.

```text
Providers
   ↓
Normalized football data
   ↓
Features + context
   ↓
Eligible models
   ↓
Ensemble
   ↓
Calibration
   ↓
Confidence
   ↓
Versioned prediction
   ↓
Official result
   ↓
Evaluation
```

The platform can use form, home/away strength, expected goals, lineups, injuries, weather, news and market context when verified data is available.

Expensive analysis is generated and stored server-side rather than triggered on every page request.

---

## Prediction Engine

GoalGrid maintains a governed model registry rather than blindly running every model on every match.

Model families include:

- Poisson and Dixon-Coles
- Elo and team-strength models
- Expected-goals models
- Logistic / tree-based models where data supports them
- Specialist lineup, injury, tactical and competition models
- LLM-supported reasoning and consensus

Models move through controlled states such as research, shadow, candidate, production, degraded and retired.

A prediction preserves the important evidence needed to explain **what GoalGrid knew, when it knew it, and which model set produced the result**.

---

## Match Intelligence

The intended experience is:

**See the match → see the probability → understand why → inspect the models → open the deeper context.**

Users can compare their own view with GoalGrid's view, inspect prediction movement and review how predictions performed after real results arrive.

Prediction records become immutable after the relevant cutoff and scoring is performed server-side.

---

# Simulation Lab — Pro

Simulation Lab is GoalGrid's controlled hypothetical football environment.

It uses **real clubs from exactly five supported leagues**:

**Premier League · La Liga · Serie A · Bundesliga · Ligue 1**

There are no fictional football clubs or fictional football leagues in the core Simulation Lab.

```text
Real competition
      ↓
Real eligible teams
      ↓
GoalGrid team intelligence
      ↓
Scenario
      ↓
Simulation engine
      ↓
Hypothetical match
```

### Virtual match experience

A simulation can visually play like a football match tracker:

- football pitch
- 22 player representations
- team colours and approved crests where available
- formations and movement
- ball movement
- attacks, passes and shots
- saves and goals
- cards and substitutions
- halftime and fulltime
- accelerated match clock
- xG, momentum and probability movement

Controls include **play, pause, 1×, 2×, 4×, skip, restart and replay**.

Skipping a match jumps to the same deterministic final state as watching it through.

### Season simulation

Users can simulate a supported league season and explore:

- matchweeks and standings
- points and goal difference
- form
- expected finish
- champion probability
- top-four probability
- relegation probability
- Monte Carlo outcome distributions

Simulation output is stored separately from real football data and can never become an official result.

---

# Game Intelligence Lab — Premium

Game Intelligence Lab is separate from the football match simulator.

It is GoalGrid's statistical research workspace for stored observations and experiments.

It supports:

**distributions · streaks · randomness tests · dependency analysis · anomalies · change points · historical exploration · verification · saved runs · experiments · model comparison · exports**

It describes observed data and research results. It does not turn statistical anomalies into accusations or guarantees.

---

# Community

GoalGrid's community is built around football discussion and measurable prediction history.

Users can:

- discuss matches and fixtures
- publish predictions
- comment, like and follow
- save matches
- share simulations
- join challenges
- use private circles
- build reputation and earn trophies
- compete on verified leaderboards

Community content is never silently treated as official football data.

Booking codes, slips and user claims remain unverified unless a dedicated verification workflow establishes otherwise.

---

# Challenges & Reputation

GoalGrid can score predictions after real matches are settled.

Baseline scoring:

```text
1X2             3 points
BTTS             2 points
Over/Under 2.5   2 points
Exact score      8 points
```

Leaderboards are server-generated. Losing predictions cannot be deleted, locked predictions cannot be edited, and users cannot write their own correctness, points, trophies or verification state.

---

# Search & Navigation

Global search covers:

**Teams · Players · Leagues · Community**

Results route into the relevant GoalGrid page rather than dead-end cards.

The main navigation provides direct pathways for:

**Home · Matches · Predictions · Leagues · Teams · Pricing · Analytics · Live**

Inside the app, users also have dedicated areas for Pro, Premium, Simulation Lab, Game Intelligence Lab, Community, Challenges, Notifications and administration.

Search is available from the navigation and supports **⌘K / Ctrl+K** as a shortcut.

---

# Free · Pro · Premium

### Free

**Understand the match.**

Core fixtures, results, basic probabilities, teams, leagues, context and community access.

### Pro

**Understand why.**

Advanced probability intelligence, model comparison, deeper match context and **Simulation Lab**.

### Premium

**Explore the intelligence.**

The deepest model, research and AI-assisted analysis layer, including **Game Intelligence Lab**, advanced experiments and deeper simulation capabilities.

Pricing lives on the dedicated `/pricing` page rather than taking space on the homepage.

---

# Architecture

```text
                        GOALGRID
                           │
          ┌────────────────┼────────────────┐
          │                │                │
     Football Data     User Data       Control Plane
          │                │                │
          └────────────────┼────────────────┘
                           ↓
                    Feature Engine
                           ↓
                    Model Registry
                           ↓
                 Eligibility + Health
                           ↓
                       Ensemble
                           ↓
                      Calibration
                           ↓
                       Prediction
                      ↙          ↘
                Analysis      Simulation
                      ↘          ↙
                         User
```

Real football data, GoalGrid intelligence, simulation data and community data remain separate domains.

---

# Security & Trust

GoalGrid is layered:

```text
UI
↓
Middleware
↓
Server action / API
↓
Authentication
↓
Authorization
↓
Validation
↓
Rate limiting
↓
RLS
↓
Database constraints
↓
Audit where required
```

Private provider credentials, LLM keys and service-role keys stay server-side.

Client-controlled roles, entitlements, scoring, trophies, verification states and prediction correctness are never trusted.

GoalGrid does not use language such as **guaranteed win, sure bet, fixed match, guaranteed profit or 100% certainty**.

---

# Resource Governance

GoalGrid is designed to scale without turning every request into an expensive job.

Limits govern:

- simulation iterations and concurrency
- runtime and queue depth
- model execution count
- AI requests and token budgets
- community activity and uploads
- raw event retention

The principle is:

> **Better evidence + better calibration + better explanation + controlled compute.**

---

# Stack

- Next.js
- React
- TypeScript
- Supabase Auth
- PostgreSQL
- Supabase RLS
- Server-side provider adapters
- Trigger.dev/background jobs where durable execution is useful
- CSS-first interaction and animation

---

# Development

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run scan
npm run build
```

Environment setup:

```bash
cp .env.example .env.local
```

Never place private credentials in `NEXT_PUBLIC_*` variables or source code.

---

# Documentation

This root `README.md` is the **single public product README**.

Operational engineering references that are useful during development remain under `docs/` so the public README stays focused on the product rather than becoming a maintenance manual.

---

# GoalGrid's North Star

GoalGrid is not trying to win by having the longest feature list.

It is trying to make football intelligence **understandable, inspectable, reproducible and useful**.

**Simple on the surface. Deep underneath. Controlled by evidence. Honest about uncertainty.**
