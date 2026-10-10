/** Shown where a provider sent nothing (a plan limit, a rate limit or an outage). It keeps the page's shape instead of failing. */
export function DataUnavailable({ title, text, lines = 3 }: { title: string; text?: string; lines?: number }) {
  return (
    <div className="card skel-card" role="status">
      <b>{title}</b>
      <p className="note">{text ?? "This data is not available from the connected providers right now. It appears here as soon as a provider returns it."}</p>
      <div aria-hidden="true">{Array.from({ length: lines }, (_, i) => <div key={i} className="skel" style={{ width: `${92 - i * 14}%` }} />)}</div>
    </div>
  );
}
