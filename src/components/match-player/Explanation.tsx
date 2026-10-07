import type { MatchPlayerView } from "./useMatchPlayer";

export function Explanation({ explanation }: { explanation: NonNullable<MatchPlayerView["explanation"]> }) {
  return (
    <div className="card">
      <b>Why this result?</b>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
        {explanation.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
