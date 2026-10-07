const FEATURES = [
  ["chart", "Match Predictions", "AI-powered predictions for 1X2, over/under, BTTS and exact scores."],
  ["users", "Team Analysis", "In-depth stats, form, xG and tactical insights for all teams."],
  ["user", "Player Insights", "Performance metrics, injuries, form and key player data."],
  ["wave", "Live Scores", "Real-time updates, lineups and match events."],
  ["clock", "Historical Data", "Past results, head-to-head and prediction accuracy trends."],
  ["brain", "AI Consensus", "5+ models. One smarter prediction."],
] as const;

const LEAGUES = [
  ["pl", "Premier League", "#fbfafc"],
  ["ll", "LaLiga", "#fbfafc"],
  ["sa", "Serie A", "#fbfafc"],
  ["bl", "Bundesliga", "#fbfafc"],
  ["l1", "Ligue 1", "#081c3d"],
] as const;

export function Features() {
  return (
    <div className="fc" id="fc">
      {FEATURES.map(([icon, title, text]) => (
        <div className="f" key={icon}>
          <div className="ib"><svg className="ic"><use href={`#i-${icon}`} /></svg></div>
          <h3>{title}</h3>
          <p>{text}</p>
        </div>
      ))}
    </div>
  );
}

export function Leagues() {
  return (
    <div className="lgs" id="lgs">
      {LEAGUES.map(([key, name, background]) => (
        <div key={key}>
          <div className="tile" style={{ background }}><i style={{ backgroundImage: `var(--${key})` }} /></div>
          {name}
        </div>
      ))}
    </div>
  );
}
