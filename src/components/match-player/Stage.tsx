import { PitchSvg } from "../PitchSvg";
import type { MatchPlayerView } from "./useMatchPlayer";

export function Stage({ v }: { v: MatchPlayerView }) {
  const { homeTeam, awayTeam, kit, camera, shirtNumbers, current, pitchPlayers, carrierIndex, substitutionFlash } = v;
  return (
    <div className="mp-stage">
      <div
        className={`mp-cam ${camera}`}
        style={{
          aspectRatio: camera === "broadcast" ? "105 / 62" : "105 / 68",
        }}
      >
        <PitchSvg
          players={pitchPlayers}
          ball={current.ball}
          kit={kit}
          nums={shirtNumbers}
          carrier={carrierIndex}
          flash={substitutionFlash}
          label={`${homeTeam.name} versus ${awayTeam.name}, simulated match on a pitch`}
        />
      </div>

      {current.banner && (
        <div className="mp-banner" key={current.banner.id}>
          <div>
            <b
              style={{
                color:
                  current.banner.text === "GOAL"
                    ? "#fde047"
                    : current.banner.text.includes("RED")
                      ? "#f87171"
                      : current.banner.text.includes("YELLOW")
                        ? "#facc15"
                        : "#e2e8f0",
              }}
            >
              {current.banner.text}
            </b>
            {current.banner.detail && (
              <span>
                {current.banner.text === "GOAL"
                  ? `${homeTeam.shortName} ${current.banner.detail} ${awayTeam.shortName}`
                  : current.banner.detail}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mp-sr">
        Formations are illustrative. Players are shown by shirt number and role.
      </div>
    </div>
  );
}
