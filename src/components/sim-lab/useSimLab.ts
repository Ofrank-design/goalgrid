import { useEffect, useMemo, useState } from "react";
import { type SimRun, type MultiSimulation, type Preset, type SimLabProps } from "./types";

/** Form state, the team loader and the two API calls. Moved out of the component unchanged. */
export function useSimLab({
  maxRuns,
  premium = false,
  initial,
}: SimLabProps) {
  // The props the form started from; later renders must not re-trigger loading.
  const [start] = useState(initial);
  const [league, setLeagueValue] = useState(
    initial?.league ?? "premier-league",
  );
  const [teams, setTeams] = useState<string[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [home, setHome] = useState(initial?.home ?? "");
  const [away, setAway] = useState(initial?.away ?? "");
  const [chosenScenarios, setChosenScenarios] = useState<string[]>([]);
  const [seed, setSeed] = useState("");
  const [simulation, setSimulation] = useState<SimRun | null>(
    initial?.sim ?? null,
  );
  const [multiSimulation, setMultiSimulation] =
    useState<MultiSimulation | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playedRuns, setPlayedRuns] = useState(0);

  // Changing league clears the teams until the new list arrives.
  function setLeague(next: string) {
    setLeagueValue(next);
    setTeams([]);
    if (!start) {
      setHome("");
      setAway("");
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/simulation/teams?league=${league}`)
      .then((response) => response.json())
      .then((result) => {
        if (cancelled) return;

        if (!result.teams) {
          setMessage(result.error ?? "Teams are unavailable right now.");
          return;
        }

        setTeams(result.teams);
        setPresets(result.presets ?? []);

        if (!start || league !== start.league) {
          setHome(result.teams[0] ?? "");
          setAway(result.teams[1] ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage("Teams are unavailable right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [league, start]);

  const requestBody = useMemo(
    () => ({
      league,
      home,
      away,
      scenario: chosenScenarios,
      ...(seed ? { seed } : {}),
    }),
    [league, home, away, chosenScenarios, seed],
  );

  async function runSimulation(replaySeed?: string) {
    setBusy(true);
    setMessage(null);
    setMultiSimulation(null);

    const response = await fetch("/api/simulation/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        replaySeed ? { ...requestBody, seed: replaySeed } : requestBody,
      ),
    });

    const result: SimRun = await response
      .json()
      .catch(() => ({ error: "Network error." }) as SimRun);

    setBusy(false);

    if (!response.ok || result.error) {
      setMessage(result.error ?? "Could not run the simulation.");
      return;
    }

    setSimulation(result);
    setPlayedRuns((count) => count + 1);
  }

  async function runMultipleSimulations(runs: number) {
    setBusy(true);
    setMessage(null);

    const response = await fetch("/api/simulation/multi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...requestBody, runs }),
    });

    const result: MultiSimulation = await response
      .json()
      .catch(() => ({ error: "Network error." }) as MultiSimulation);

    setBusy(false);

    if (!response.ok || result.error) {
      setMessage(result.error ?? "Could not run the simulation.");
      return;
    }

    setMultiSimulation(result);
  }

  return {
    maxRuns,
    premium,
    initial,
    league,
    setLeague,
    teams,
    setTeams,
    presets,
    setPresets,
    home,
    setHome,
    away,
    setAway,
    chosenScenarios,
    setChosenScenarios,
    seed,
    setSeed,
    simulation,
    setSimulation,
    multiSimulation,
    setMultiSimulation,
    message,
    setMessage,
    busy,
    setBusy,
    playedRuns,
    setPlayedRuns,
    requestBody,
    runSimulation,
    runMultipleSimulations,
  };
}

export type SimLabView = ReturnType<typeof useSimLab>;
