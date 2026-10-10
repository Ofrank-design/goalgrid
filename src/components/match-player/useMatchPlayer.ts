import type { MatchPlayerProps } from "./types";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { deriveLive, liveProbs } from "@/lib/simulation/match";
import { explainResult } from "@/lib/simulation/explain";
import { along, choreograph, formationFor, isBeatEvent, kits, positionsFor, shirtNumber, teamVisual, type Beat, type Phase, type Pt, type TeamVisual } from "@/lib/simulation/visual";
import { type Speed, type ProbabilityPoint, type Banner } from "./types";
import { MINUTES_PER_MS, GOAL_PROGRESS, MOMENTUM_WEIGHTS } from "./constants";
import { easeSmooth } from "./helpers";

function initialEngineState() {
  return {
  clock: 0,
  segment: 0,
  progress: 0,
  completedSequence: 0,
  ball: { x: 50, y: 50 } as Pt,
  players: [] as Pt[],
  possession: null as "home" | "away" | null,
  counter: {
    team: null as "home" | "away" | null,
    until: 0,
  },
  banner: null as Banner | null,
  bannerId: 0,
  probabilityHistory: [] as ProbabilityPoint[],
  lastMinute: -1,
  finished: false,
  halfTimeShown: false,
  now: 0,
};
}

type EngineState = ReturnType<typeof initialEngineState>;
type ShirtNumbers = { home: number[]; away: number[] };

/** The loop mutates a ref; React only ever renders from an immutable copy of it taken after each frame. */
function takeSnapshot(engine: EngineState, numbers: ShirtNumbers) {
  return {
    ...engine,
    probabilityHistory: engine.probabilityHistory.slice(),
    shirtNumbers: numbers,
  };
}

/** The state at kick-off. Pure, so it can seed the hook on mount and reset it on demand. */
function kickOffState(
  sim: MatchPlayerProps["sim"],
  homeFormation: ReturnType<typeof formationFor>,
  awayFormation: ReturnType<typeof formationFor>,
) {
  const engine = initialEngineState();
  engine.probabilityHistory = [
    {
      t: 0,
      ...liveProbs(0, 0, sim.expectedGoals.home, sim.expectedGoals.away),
    },
  ];
  engine.lastMinute = 0;
  engine.players = [
    ...positionsFor(homeFormation, "home", engine.ball, "neutral", 0, 0),
    ...positionsFor(awayFormation, "away", engine.ball, "neutral", 0, 0),
  ];
  const numbers: ShirtNumbers = {
    home: homeFormation.slots.map((_, index) => shirtNumber(index)),
    away: awayFormation.slots.map((_, index) => shirtNumber(index)),
  };
  return { engine, numbers };
}

/** A private copy, because the loop mutates the engine state it is given. */
function freshEngine(kickOff: ReturnType<typeof kickOffState>) {
  return {
    ...kickOff.engine,
    probabilityHistory: kickOff.engine.probabilityHistory.slice(),
  };
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia?.(reducedMotionQuery);
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}
const readReducedMotion = () =>
  window.matchMedia?.(reducedMotionQuery).matches ?? false;
const serverReducedMotion = () => false;

/** All the state, the animation loop and the values derived from them. Moved out of the component unchanged. */
export function useMatchPlayer({
  sim,
  homeSlug,
  awaySlug,
  homeCrest,
  awayCrest,
  autoplay = true,
}: MatchPlayerProps) {
  const homeTeam = useMemo<TeamVisual>(
    () => ({ ...teamVisual(homeSlug), crest: homeCrest ?? null }),
    [homeSlug, homeCrest],
  );
  const awayTeam = useMemo<TeamVisual>(
    () => ({ ...teamVisual(awaySlug), crest: awayCrest ?? null }),
    [awaySlug, awayCrest],
  );
  const kit = useMemo(
    () => kits(homeTeam, awayTeam),
    [homeTeam, awayTeam],
  );

  const homeFormation = useMemo(
    () => formationFor(homeSlug),
    [homeSlug],
  );
  const awayFormation = useMemo(
    () => formationFor(awaySlug),
    [awaySlug],
  );
  const segments = useMemo(
    () => choreograph(sim, homeFormation, awayFormation),
    [sim, homeFormation, awayFormation],
  );

  const endTime = 90 + sim.addedTime;
  const fullLive = useMemo(
    () => deriveLive(sim.events, sim.expectedGoals),
    [sim],
  );

  const [playing, setPlaying] = useState(autoplay);
  const [speedChoice, setSpeed] = useState<Speed | null>(null);
  const [camera, setCamera] = useState<"tactical" | "broadcast">("tactical");
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    serverReducedMotion,
  );
  // Reduced motion starts playback at 4x unless the person has picked a speed.
  const speed: Speed = speedChoice ?? (reducedMotion ? 4 : 1);

  const kickOff = useMemo(
    () => kickOffState(sim, homeFormation, awayFormation),
    [sim, homeFormation, awayFormation],
  );
  const state = useRef<EngineState>(freshEngine(kickOff));
  const shirtNumbers = useRef<ShirtNumbers>(kickOff.numbers);
  const [snapshot, setSnapshot] = useState(() =>
    takeSnapshot(freshEngine(kickOff), kickOff.numbers),
  );
  const redraw = () =>
    setSnapshot(takeSnapshot(state.current, shirtNumbers.current));

  // A new simulation restarts the match. React state is adjusted during render
  // (the supported pattern for state derived from props); the engine ref is
  // brought in line by the effect below, which sets no state.
  const [seenKickOff, setSeenKickOff] = useState(kickOff);
  if (seenKickOff !== kickOff) {
    setSeenKickOff(kickOff);
    setPlaying(autoplay);
    if (reducedMotion) setSpeed(null);
    setSnapshot(takeSnapshot(freshEngine(kickOff), kickOff.numbers));
  }

  useEffect(() => {
    const { bannerId, now } = state.current;
    state.current = { ...freshEngine(kickOff), bannerId, now };
    shirtNumbers.current = kickOff.numbers;
  }, [kickOff]);

  function reset(startPlaying: boolean) {
    const { bannerId, now } = state.current;

    state.current = { ...freshEngine(kickOff), bannerId, now };
    shirtNumbers.current = kickOff.numbers;

    setPlaying(startPlaying);
    redraw();
  }

  function shownEvents(current: Pick<EngineState, "completedSequence" | "clock">) {
    return sim.events.filter(
      (event) =>
        event.seq <= current.completedSequence ||
        (!isBeatEvent(event) && event.t <= current.clock),
    );
  }

  function currentScore(current: Pick<EngineState, "completedSequence" | "clock">) {
    const events = shownEvents(current);
    return events.length
      ? events[events.length - 1].score
      : { home: 0, away: 0 };
  }

  function applySubstitutions(current: EngineState) {
    const numbers = {
      home: homeFormation.slots.map((_, index) => shirtNumber(index)),
      away: awayFormation.slots.map((_, index) => shirtNumber(index)),
    };

    for (const segment of segments) {
      if (
        segment.type !== "beat" ||
        segment.beat.kind !== "substitution" ||
        segment.beat.seq > current.completedSequence ||
        !segment.beat.sub
      ) {
        continue;
      }

      numbers[segment.beat.team][segment.beat.sub.slot] =
        segment.beat.sub.onNumber;
    }

    shirtNumbers.current = numbers;
  }

  function recordProbability(current: EngineState) {
    const score = currentScore(current);
    const remainingFactor = Math.max(
      0,
      (90 - Math.min(current.clock, 90)) / 90,
    );

    current.probabilityHistory.push({
      t: current.clock,
      ...liveProbs(
        score.home,
        score.away,
        sim.expectedGoals.home * remainingFactor,
        sim.expectedGoals.away * remainingFactor,
      ),
    });
  }

  function showBanner(
    current: EngineState,
    text: string,
    detail: string | null,
    milliseconds: number,
  ) {
    current.banner = {
      id: ++current.bannerId,
      text,
      detail,
      until: current.now + milliseconds,
    };
  }

  function finish() {
    const current = state.current;

    current.segment = segments.length;
    current.clock = endTime;
    current.completedSequence = sim.events[sim.events.length - 1]?.seq ?? 0;
    current.finished = true;
    current.banner = null;
    current.ball = { x: 50, y: 50 };
    current.probabilityHistory = fullLive
      .map((point) => ({
        t: point.minute,
        home: point.home,
        draw: point.draw,
        away: point.away,
      }))
      .concat({
        t: endTime,
        ...liveProbs(sim.final.home, sim.final.away, 0, 0),
      });

    applySubstitutions(current);
    setPlaying(false);

    current.players = [
      ...positionsFor(
        homeFormation,
        "home",
        current.ball,
        "neutral",
        sim.final.home - sim.final.away,
        90,
      ),
      ...positionsFor(
        awayFormation,
        "away",
        current.ball,
        "neutral",
        sim.final.away - sim.final.home,
        90,
      ),
    ];

    redraw();
  }

  useEffect(() => {
    if (!playing) return;

    let frameId = 0;
    let previous = performance.now();

    const tick = (nowMs: number) => {
      const current = state.current;
      const elapsed = Math.min(50, nowMs - previous) * speed;
      previous = nowMs;
      current.now = nowMs;

      if (!current.finished) {
        const segment = segments[current.segment];

        if (!segment) {
          current.clock = Math.min(
            endTime,
            current.clock + elapsed * MINUTES_PER_MS,
          );

          if (current.clock >= endTime) {
            finish();
            return;
          }
        } else if (segment.type === "spell") {
          const spell = segment.spell;
          current.clock = Math.min(
            spell.toT,
            Math.max(current.clock, spell.fromT) + elapsed * MINUTES_PER_MS,
          );
          current.ball = along(
            spell.path,
            (current.clock - spell.fromT) / (spell.toT - spell.fromT),
          );

          if (current.possession !== spell.team) {
            current.counter = current.possession
              ? { team: spell.team, until: nowMs + 2200 }
              : current.counter;
            current.possession = spell.team;
          }

          if (current.clock >= spell.toT) {
            current.segment += 1;
            current.progress = 0;
          }
        } else {
          const beat: Beat = segment.beat;
          current.clock = Math.max(current.clock, beat.t);
          current.progress += elapsed / beat.durationMs;
          current.ball = along(
            beat.path,
            easeSmooth(Math.min(1, current.progress)),
          );

          if (current.possession !== beat.team) {
            current.counter = current.possession
              ? { team: beat.team, until: nowMs + 2200 }
              : current.counter;
            current.possession = beat.team;
          }

          const completeAt =
            beat.kind === "goal"
              ? GOAL_PROGRESS
              : beat.kind === "substitution"
                ? 0.5
                : 1;

          if (
            current.progress >= completeAt &&
            current.completedSequence < beat.seq
          ) {
            current.completedSequence = beat.seq;
            applySubstitutions(current);
            recordProbability(current);

            if (beat.banner) {
              showBanner(
                current,
                beat.banner,
                beat.detail,
                beat.kind === "goal" ? 2600 : 1500,
              );
            }
          }

          if (current.progress >= 1) {
            current.segment += 1;
            current.progress = 0;

            if (beat.kind === "goal") {
              current.ball = { x: 50, y: 50 };
              current.possession = null;
              current.counter = {
                team: beat.team === "home" ? "away" : "home",
                until: nowMs + 2500,
              };
            }
          }
        }

        const minute = Math.floor(current.clock);
        if (minute !== current.lastMinute) {
          current.lastMinute = minute;
          recordProbability(current);
        }

        if (!current.halfTimeShown && current.clock >= 45) {
          current.halfTimeShown = true;
          showBanner(current, "HALF TIME", null, 1100);
        }

        if (current.banner && nowMs > current.banner.until) {
          current.banner = null;
        }

        if (current.segment >= segments.length && current.clock >= endTime) {
          finish();
          return;
        }
      }

      const score = currentScore(current);
      const matchMinute = current.clock;

      const phaseFor = (side: "home" | "away"): Phase => {
        const ownSideX = side === "home" ? current.ball.x : 100 - current.ball.x;
        const celebrating = current.banner?.text === "GOAL";

        if (celebrating) return "neutral";
        if (
          current.counter.team === side &&
          nowMs < current.counter.until
        ) {
          return "counter";
        }
        if (current.possession === side) {
          return ownSideX > 45 ? "attack" : "neutral";
        }
        return current.possession ? "defend" : "neutral";
      };

      const targetPlayers = [
        ...positionsFor(
          homeFormation,
          "home",
          current.ball,
          phaseFor("home"),
          score.home - score.away,
          matchMinute,
        ),
        ...positionsFor(
          awayFormation,
          "away",
          current.ball,
          phaseFor("away"),
          score.away - score.home,
          matchMinute,
        ),
      ];

      const smoothing = 1 - Math.exp(-elapsed / speed / 230);
      current.players =
        current.players.length === 22
          ? current.players.map((player, index) => ({
              x:
                player.x +
                (targetPlayers[index].x - player.x) * smoothing,
              y:
                player.y +
                (targetPlayers[index].y - player.y) * smoothing,
            }))
          : targetPlayers;

      redraw();
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
    // The simulation timeline is replaced when `segments` changes. Playback
    // state and speed control the animation loop; the engine data is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, segments]);

  const current = snapshot;
  const score = currentScore(current);
  const events = shownEvents(current);
  const finished = current.finished;
  const pitchPlayers = useMemo(
    () => (current.players.length === 22 ? current.players : []),
    [current.players],
  );

  const carrierIndex = useMemo(() => {
    if (!pitchPlayers.length || !current.possession) return -1;

    const offset = current.possession === "home" ? 0 : 11;
    let closest = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 1; index < 11; index += 1) {
      const player = pitchPlayers[offset + index];
      const distance =
        (player.x - current.ball.x) ** 2 +
        (player.y - current.ball.y) ** 2;

      if (distance < bestDistance) {
        bestDistance = distance;
        closest = offset + index;
      }
    }

    return closest;
  }, [pitchPlayers, current.possession, current.ball.x, current.ball.y]);

  const lastSegment = segments[current.segment];
  const substitutionFlash =
    lastSegment?.type === "beat" &&
    lastSegment.beat.kind === "substitution" &&
    lastSegment.beat.sub
      ? { side: lastSegment.beat.team, slot: lastSegment.beat.sub.slot }
      : null;

  const remainingFactor = Math.max(
    0,
    (90 - Math.min(current.clock, 90)) / 90,
  );
  const live = finished
    ? liveProbs(sim.final.home, sim.final.away, 0, 0)
    : liveProbs(
        score.home,
        score.away,
        sim.expectedGoals.home * remainingFactor,
        sim.expectedGoals.away * remainingFactor,
      );
  const previousProbability =
    [...current.probabilityHistory]
      .reverse()
      .find((point) => point.t <= current.clock - 5) ??
    current.probabilityHistory[0] ??
    // The first render happens before the reset effect has recorded any history. Without this fallback it threw on mount.
    live;

  const arrow = (next: number, previous: number) => {
    if (Math.abs(next - previous) < 0.005) return "→";
    return next > previous ? "↑" : "↓";
  };

  const recentEvents = events.filter(
    (event) =>
      event.team &&
      MOMENTUM_WEIGHTS[event.type] &&
      event.t > current.clock - 10 &&
      event.t <= current.clock,
  );
  const homeMomentum = recentEvents
    .filter((event) => event.team === "home")
    .reduce((total, event) => total + MOMENTUM_WEIGHTS[event.type], 0);
  const awayMomentum = recentEvents
    .filter((event) => event.team === "away")
    .reduce((total, event) => total + MOMENTUM_WEIGHTS[event.type], 0);
  const momentumTotal = homeMomentum + awayMomentum;
  const homeMomentumShare = momentumTotal
    ? homeMomentum / momentumTotal
    : 0.5;

  const momentumBlocks = sim.momentum.filter(
    (item) => item.from <= current.clock || finished,
  );
  const maxMomentum = Math.max(
    1,
    ...momentumBlocks.map((item) => Math.abs(item.value)),
  );

  const probabilityChart =
    current.probabilityHistory.length > 1
      ? (outcome: "home" | "draw" | "away") =>
          current.probabilityHistory
            .map(
              (point) =>
                `${(point.t / endTime) * 300},${80 - point[outcome] * 76}`,
            )
            .join(" ")
      : null;

  const explanation = finished
    ? explainResult({
        home: homeTeam.name,
        away: awayTeam.name,
        final: sim.final,
        stats: sim.stats,
        xg: sim.expectedGoals,
        chances: sim.baseline ?? live,
      })
    : null;

  return {
    sim,
    homeTeam,
    awayTeam,
    kit,
    homeFormation,
    awayFormation,
    segments,
    endTime,
    fullLive,
    playing,
    setPlaying,
    speed,
    setSpeed,
    camera,
    setCamera,
    reducedMotion,
    shirtNumbers: snapshot.shirtNumbers,
    reset,
    finish,
    current,
    score,
    events,
    finished,
    pitchPlayers,
    carrierIndex,
    lastSegment,
    substitutionFlash,
    remainingFactor,
    live,
    previousProbability,
    arrow,
    recentEvents,
    homeMomentum,
    awayMomentum,
    momentumTotal,
    homeMomentumShare,
    momentumBlocks,
    maxMomentum,
    probabilityChart,
    explanation,
  };
}

export type MatchPlayerView = ReturnType<typeof useMatchPlayer>;
