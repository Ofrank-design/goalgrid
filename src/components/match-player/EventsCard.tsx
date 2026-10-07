import { EVENT_LABELS } from "./constants";
import type { MatchPlayerView } from "./useMatchPlayer";

export function EventsCard({ v }: { v: MatchPlayerView }) {
  const { homeTeam, awayTeam, events } = v;
  return (
    <div className="card">
      <b>Events</b>
      <ol
        style={{
          margin: "6px 0 0",
          paddingLeft: 0,
          listStyle: "none",
          maxHeight: 220,
          overflow: "auto",
        }}
      >
        {events
          .filter((event) => event.type !== "shot")
          .slice()
          .reverse()
          .map((event) => (
            <li key={event.seq}>
              <b className="n">{event.label}</b>{" "}
              {event.team
                ? event.team === "home"
                  ? homeTeam.shortName
                  : awayTeam.shortName
                : ""}{" "}
              {EVENT_LABELS[event.type]}
              {event.type === "goal"
                ? ` (${event.score.home}–${event.score.away})`
                : ""}
            </li>
          ))}
      </ol>
    </div>
  );
}
