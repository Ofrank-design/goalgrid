import { type Speed } from "./types";
import type { MatchPlayerView } from "./useMatchPlayer";

export function Controls({ v }: { v: MatchPlayerView }) {
  const { playing, setPlaying, speed, setSpeed, camera, setCamera, reset, finish, finished } = v;
  return (
    <div
      className="chips"
      style={{ justifyContent: "center", alignItems: "center" }}
    >
      <button
        className="chip"
        type="button"
        disabled={finished}
        onClick={() => setPlaying((currentPlaying) => !currentPlaying)}
      >
        {playing ? "⏸ Pause" : "▶ Play"}
      </button>

      {([1, 2, 4] as Speed[]).map((option) => (
        <button
          key={option}
          className={`chip ${speed === option ? "on" : ""}`}
          type="button"
          aria-pressed={speed === option}
          onClick={() => setSpeed(option)}
        >
          {option}×
        </button>
      ))}

      <button
        className="chip"
        type="button"
        disabled={finished}
        onClick={finish}
      >
        ⏭ Skip
      </button>

      <button
        className="chip"
        type="button"
        onClick={() => reset(true)}
      >
        ↻ Restart
      </button>

      <button
        className={`chip ${camera === "tactical" ? "on" : ""}`}
        type="button"
        aria-pressed={camera === "tactical"}
        onClick={() => setCamera("tactical")}
      >
        Tactical
      </button>

      <button
        className={`chip ${camera === "broadcast" ? "on" : ""}`}
        type="button"
        aria-pressed={camera === "broadcast"}
        onClick={() => setCamera("broadcast")}
      >
        Broadcast
      </button>
    </div>
  );
}
