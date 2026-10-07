# Large components: structure and how to change them safely

## MatchPlayer (`src/components/MatchPlayer.tsx`)
`MatchPlayer.tsx` only composes. All state, the animation loop and every derived value live in `match-player/useMatchPlayer.ts`; each visible block is a small view that takes the hook's result as `v`:
`Scoreboard`, `Stage` (pitch and banners), `Controls`, `WinChances`, `Momentum`, `EventsCard`, `StatsCard`, `Explanation`, plus `TeamTag`, `helpers.ts`, `constants.ts` and `types.ts`. Add a new block by adding a view and reading what it needs from `v`.

## SimLab (`src/components/SimLab.tsx`)
`SimLab.tsx` composes `sim-lab/SimBanner`, `SetupCard` (form), `MatchResult`, `MultiResult`. `sim-lab/useSimLab.ts` holds the form state, the team loader and the two API calls. `SimLab.tsx` still exports `SimLab`, `SimBanner`, `SimRun` and `InitialSimulation`, so existing imports are unchanged.

## The safety net: golden masters (`tests/golden/`)
There are no browser tests, so these two components are protected by golden-master tests. They mount the real component in jsdom with a fake frame clock and a fake API, drive it through scripted playback and every control, and hash the rendered HTML at each checkpoint. They run in `npm test`.
- A failure means the rendered output changed. If you did not mean to change it, fix your change.
- If you **meant** to change what the user sees, review it by eye, then re-record: `GOLDEN_UPDATE=1 npx tsx --test tests/golden/<name>.test.ts`, and commit the new `.golden.json`.
- To see what changed, set `GOLDEN_DUMP=/some/dir` to write the HTML for every checkpoint, then diff against a run from the old code.
- Both golden files were recorded from the version in this commit. The match player recording is from code that already includes the first-render crash fix below.

## History worth knowing
Building the golden master found that `MatchPlayer` threw on its very first render (`previousProbability` was undefined until the reset effect ran), so opening a simulation's match player hit the error screen. It now falls back to the live probabilities for that first frame.
