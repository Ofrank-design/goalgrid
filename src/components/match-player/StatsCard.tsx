import { type MatchSim } from "@/lib/simulation/match";
import type { MatchPlayerView } from "./useMatchPlayer";

export function StatsCard({ v }: { v: MatchPlayerView }) {
  const { sim, finished } = v;
  return (
    <div className="card">
      <b>Statistics</b>
      <span className="note"> synthetic</span>

      <table>
        <tbody>
          {(
            [
              ["Possession", (stats: MatchSim["stats"]["home"]) => `${stats.possession}%`],
              ["Shots", (stats: MatchSim["stats"]["home"]) => stats.shots],
              ["On target", (stats: MatchSim["stats"]["home"]) => stats.shotsOnTarget],
              ["Corners", (stats: MatchSim["stats"]["home"]) => stats.corners],
              ["Yellow cards", (stats: MatchSim["stats"]["home"]) => stats.yellow],
              ["Red cards", (stats: MatchSim["stats"]["home"]) => stats.red],
              ["Substitutions", (stats: MatchSim["stats"]["home"]) => stats.substitutions],
            ] as [
              string,
              (stats: MatchSim["stats"]["home"]) => string | number,
            ][]
          ).map(([label, readStat]) => (
            <tr key={label}>
              <td className="n">
                {finished ? readStat(sim.stats.home) : "–"}
              </td>
              <td>{label}</td>
              <td className="n">
                {finished ? readStat(sim.stats.away) : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <span className="note">Totals appear at full time.</span>
    </div>
  );
}
