# Simulation Lab

Source spec: `GOALGRID_SIMULATION.md`. Pro and Premium only. Everything here is synthetic and labelled SIMULATION, SYNTHETIC DATA, HYPOTHETICAL RESULT, NOT A LIVE MATCH PREDICTION.

## Built
- **Seeded engine** (`src/lib/simulation`): reproducible random numbers (same seed, same match), Poisson sampling, score draws from the score matrix. Engine and model versions are stored with every run.
- **Quick match**: the final score is drawn from the same weighted score matrix as the real predictions (optionally tilted by a scenario). Goals, shots, shots on target, corners, cards, possession, a clock with stoppage time, half time and full time are generated to agree with that score. Statistics other than goals are synthetic and not calibrated to real match data.
- **Live chances**: computed minute by minute from the current score and time left. They never use the future of the simulated match.
- **Playback**: play, pause, fast forward, skip to result and restart, run in the browser from the server's stored timeline. The browser never calculates the result.
- **Multiple simulations**: 10, 100 and 1,000 runs (Pro and Premium), with the 95% sampling error shown for every count.
- **Scenario Lab**: reuses the scenario maths (home advantage removal is computed; other presets are labelled illustrative assumptions).
- **Season simulation and Monte Carlo**: hypothetical double round robin among the league's current teams from the strength model: expected points, average position, title, top four and bottom three shares. Pro up to 200 seasons, Premium up to 2,000.
- **History** (`simulation_runs`, migration 0013): each run stored as produced with configuration, seed, versions and result. Newest 100 kept.
- **Isolation**: separate table, no reads or writes of predictions, picks, leaderboards, trophies or fixtures, enforced by a test that scans the code. Simulations never become predictions, records or challenge results.
- **Security**: the browser can send teams, scenarios and an optional starting seed. It cannot send the score, probabilities or a seed after execution. Teams must belong to the chosen league. Rate limits apply.

## Match player (this pass)
- **Pitch and players**: 22 numbered players on a top-down pitch (`PitchSvg`), moving smoothly. Formation, ball position, possession, attack, defence and counter phases, the score, and the clock decide where each player stands (`visual.ts: positionsFor`). A team that is behind late pushes forward and one that is ahead sits deeper.
- **Events drive the visuals**: the engine's events go through `choreograph()`, which turns each goal, shot, corner, card and substitution into a ball path and a short sequence of passes. Goals end in the net, saved shots end at the keeper, wide shots miss. The animation holds the clock for each event, then continues. The simulation maths was not changed to make the visuals work; a test confirms a match is identical whether or not it is visualised.
- **Team identity from data**: colours, short name and crest come from `src/content/teams-visual.json` and the crest pack for all 96 clubs, never from the match. Clashing kits are fixed for the away side. Unknown teams get stable colours from their slug. Colours are approximate home-kit colours.
- **Camera**: Tactical (top-down) and Broadcast (angled).
- **Live panels**: win chances with trend arrows and a line chart, momentum bar for the last 10 minutes and a 5-minute momentum chart, event feed, statistics at full time, goal / card / substitution / half-time banners, and a "Why this result?" summary built only from simulation numbers.
- **Controls**: play, pause, 1×, 2×, 4×, skip (jumps to the final state immediately), restart. Respects reduced-motion settings.
- **Substitutions**: 3 to 5 per side in the second half, shown by shirt number and role ("OFF #7 RW, ON #13"). No player names, because GoalGrid has no lineup or player data.
- **Replay and reproduce**: the history page replays a stored match exactly; "Reproduce with seed" reruns the same seed and settings. If the engine version changed, the page says so.
- **Exports and report** (Premium): CSV and JSON export of a stored run, and a printable report page with seed, versions, assumptions and limitations.
- Engine version is now sim-1.1.0 (substitutions and pitch positions were added to the event data, which changes the random sequence versus 1.0.0).

## Known limits
- Formations are illustrative, picked from the team slug. They are not the clubs' real formations.
- Live chances use the score and time left only. Shots, xG, possession, cards, team strength and tactical state do not yet influence them. Adding that needs effect sizes that have to be fitted to real data, so none were invented.
- Statistics other than goals are synthetic.
- Not visually tested in a browser (none available where this was built). The pitch layout was rendered to an image and checked; animation timing, the broadcast camera and mobile layout still need a real look.

## Built but switched off (addendum)
Fictional league, generic multiplier simulator, risk education calculator, constrained backtest, alert-test generator and strategy sharing exist with tests, and their routes return 404 until `ENABLE_SIM_ADDENDUM=true`. There is no UI for them. Migration 0014 adds their tables. The multiplier simulator is generic and fictional, never imitates a named game, and never advises staking.

## Not built
- UI for experiments, model comparison and the addendum tools (APIs exist for experiments and model comparison).
- Tactical inputs as data (lineups, injuries), custom experiment configuration UI, community sharing of simulations, notifications and challenges.
- Run migrations 0013 and 0014 before deploying.
