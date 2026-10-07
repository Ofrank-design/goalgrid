export function SimBanner() {
  const labels = [
    "SIMULATION",
    "SYNTHETIC DATA",
    "HYPOTHETICAL RESULT",
    "NOT A LIVE MATCH PREDICTION",
  ];

  return (
    <div className="chips" role="note" aria-label="Simulation labels">
      {labels.map((label) => (
        <span key={label} className="chip" style={{ cursor: "default" }}>
          {label}
        </span>
      ))}
    </div>
  );
}
